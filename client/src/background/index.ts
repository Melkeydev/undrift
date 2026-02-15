import {
  getGamificationData,
  saveGamificationData,
  getSessionCtx,
  saveSessionCtx,
  createDefaultSessionCtx,
  awardXP,
  updateCounters,
  checkAchievements,
  ACHIEVEMENT_XP,
  ACHIEVEMENT_DEFINITIONS,
} from "../gamification";
import type {
  EarnedAchievement,
  CounterEvent,
} from "../gamification";

interface BlockSession {
  isActive: boolean;
  endsAt: number;
  blockedSites: string[];
  sessionId: string;
  startedAt: number;
  durationMinutes: number;
  interruptions: Interruption[];
  endReason?: "timer" | "manual" | "browser_closed";
  completed?: boolean;
  endedAt?: number;
}

interface Interruption {
  timestamp: number;
  domain: string;
  outcome: "stayed" | "broke";
}

interface TimeTrackingData {
  daily: {
    [date: string]: {
      [domain: string]: number;
    };
  };
  current: {
    domain: string;
    startedAt: number;
  } | null;
}

interface SessionHistory {
  sessions: BlockSession[];
  lastSyncedAt: number;
}

interface NotificationState {
  timeAlertsSent: {
    [domain: string]: {
      [threshold: number]: string;
    };
  };
  sessionWarningFired: boolean;
}

interface Reflection {
  timestamp: number;
  sessionId: string;
  text: string;
  domain?: string;
}

const DEFAULT_BLOCKED_SITES = ["twitter.com", "x.com"];
const IDLE_DETECTION_INTERVAL = 60;
const HEARTBEAT_PERIOD_MINUTES = 0.5;
const TIME_ALERT_THRESHOLDS = [15, 30, 60]; // minutes
const SESSION_WARNING_MINUTES = 5;
const MAX_LOCAL_SESSIONS = 100;

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isTrackableUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    !url.startsWith("chrome-extension://") &&
    !url.startsWith("chrome://") &&
    !url.startsWith("about:") &&
    (url.startsWith("http://") || url.startsWith("https://"))
  );
}

function extractDomain(url: string): string | null {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return null;
  }
}

function normalizeDomain(hostname: string): string {
  const lower = hostname.toLowerCase();
  if (lower.startsWith("www.")) return lower.slice(4);
  return lower;
}

function isBlockedUrl(url: string, blockedSites: string[]): boolean {
  try {
    const hostname = new URL(url).hostname;
    return blockedSites.some(
      (site) => hostname === site || hostname.endsWith(`.${site}`)
    );
  } catch {
    return false;
  }
}

function getBlockedPageUrl(originalUrl: string): string {
  const blockedPage = chrome.runtime.getURL("src/blocked/index.html");
  return `${blockedPage}?returnUrl=${encodeURIComponent(originalUrl)}`;
}

async function getSession(): Promise<BlockSession> {
  const result = await chrome.storage.local.get("session");
  return (
    result.session || {
      isActive: false,
      endsAt: 0,
      blockedSites: DEFAULT_BLOCKED_SITES,
      sessionId: "",
      startedAt: 0,
      durationMinutes: 0,
      interruptions: [],
    }
  );
}

async function saveSession(session: BlockSession): Promise<void> {
  await chrome.storage.local.set({ session });
}

async function getTimeTracking(): Promise<TimeTrackingData> {
  const result = await chrome.storage.local.get("timeTracking");
  return result.timeTracking || { daily: {}, current: null };
}

async function saveTimeTracking(data: TimeTrackingData): Promise<void> {
  await chrome.storage.local.set({ timeTracking: data });
}

async function getSessionHistory(): Promise<SessionHistory> {
  const result = await chrome.storage.local.get("sessionHistory");
  return result.sessionHistory || { sessions: [], lastSyncedAt: 0 };
}

async function saveSessionHistory(history: SessionHistory): Promise<void> {
  await chrome.storage.local.set({ sessionHistory: history });
}

async function getNotificationState(): Promise<NotificationState> {
  const result = await chrome.storage.local.get("notificationState");
  return (
    result.notificationState || {
      timeAlertsSent: {},
      sessionWarningFired: false,
    }
  );
}

async function saveNotificationState(
  state: NotificationState
): Promise<void> {
  await chrome.storage.local.set({ notificationState: state });
}

async function redirectExistingTabs(blockedSites: string[]): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id && tab.url && isBlockedUrl(tab.url, blockedSites)) {
      chrome.tabs.update(tab.id, { url: getBlockedPageUrl(tab.url) });
    }
  }
}

async function restoreBlockedTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const blockedPageOrigin = chrome.runtime.getURL("src/blocked/index.html");
  for (const tab of tabs) {
    if (tab.id && tab.url?.startsWith(blockedPageOrigin)) {
      const url = new URL(tab.url);
      const returnUrl = url.searchParams.get("returnUrl");
      if (returnUrl) {
        chrome.tabs.update(tab.id, { url: returnUrl });
      }
    }
  }
}

async function enableBlocking(sites: string[]): Promise<void> {
  const blockedPageUrl = chrome.runtime.getURL("src/blocked/index.html");
  let ruleId = 1;
  const allRules: chrome.declarativeNetRequest.Rule[] = [];

  for (const site of sites) {
    allRules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {
          regexSubstitution: `${blockedPageUrl}?returnUrl=\\0`,
        },
      },
      condition: {
        regexFilter: `^https?://(www\\.)?${site.replace(".", "\\.")}/.*`,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
        ],
      },
    });
  }

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map((r) => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: allRules,
  });
}

async function disableBlocking(): Promise<void> {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map((r) => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
  });
}

async function flushCurrentTracking(): Promise<void> {
  const tracking = await getTimeTracking();
  if (!tracking.current) return;

  const now = Date.now();
  const elapsed = Math.round((now - tracking.current.startedAt) / 1000);
  if (elapsed <= 0) return;

  const today = getTodayString();
  if (!tracking.daily[today]) tracking.daily[today] = {};
  tracking.daily[today][tracking.current.domain] =
    (tracking.daily[today][tracking.current.domain] || 0) + elapsed;

  tracking.current.startedAt = now;
  await saveTimeTracking(tracking);
}

async function startTracking(domain: string): Promise<void> {
  await flushCurrentTracking();
  const tracking = await getTimeTracking();
  tracking.current = { domain, startedAt: Date.now() };
  await saveTimeTracking(tracking);
}

async function stopTracking(): Promise<void> {
  await flushCurrentTracking();
  const tracking = await getTimeTracking();
  tracking.current = null;
  await saveTimeTracking(tracking);
}

async function handleTabChange(
  tabId: number,
  windowId?: number
): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (windowId !== undefined) {
      const focusedWindow = await chrome.windows.getLastFocused();
      if (focusedWindow.id !== windowId) return;
    }
    if (tab.url && isTrackableUrl(tab.url)) {
      const domain = extractDomain(tab.url);
      if (domain) {
        await startTracking(domain);
        return;
      }
    }
    await stopTracking();
  } catch {
    await stopTracking();
  }
}

async function resumeTrackingForActiveTab(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (tab?.id && tab.url && isTrackableUrl(tab.url)) {
      const domain = extractDomain(tab.url);
      if (domain) {
        await startTracking(domain);
        return;
      }
    }
    await stopTracking();
  } catch {
    await stopTracking();
  }
}

async function sendNotification(
  id: string,
  title: string,
  message: string,
  priority: number = 0
): Promise<void> {
  try {
    chrome.notifications.create(id, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title,
      message,
      priority,
      silent: false,
    });
  } catch {
    // Notifications may fail if user disabled them at OS level
  }
}

async function checkTimeAlerts(): Promise<void> {
  const tracking = await getTimeTracking();
  if (!tracking.current) return;

  const today = getTodayString();
  const domain = tracking.current.domain;
  const totalSeconds = tracking.daily[today]?.[domain] || 0;
  const totalMinutes = totalSeconds / 60;

  const state = await getNotificationState();
  if (!state.timeAlertsSent[domain]) state.timeAlertsSent[domain] = {};

  let changed = false;
  for (const threshold of TIME_ALERT_THRESHOLDS) {
    if (
      totalMinutes >= threshold &&
      state.timeAlertsSent[domain][threshold] !== today
    ) {
      state.timeAlertsSent[domain][threshold] = today;
      changed = true;
      await sendNotification(
        `time-alert-${domain}-${threshold}`,
        `${domain} — ${threshold} minutes`,
        `You've spent ${threshold} minutes on ${domain} today. Is this how you want to spend your time?`,
        threshold >= 60 ? 2 : 1
      );
    }
  }

  if (changed) await saveNotificationState(state);
}

interface GamificationResult {
  xpAwarded: number;
  newAchievements: EarnedAchievement[];
  leveledUp: boolean;
  newLevel: number;
}

async function processGamificationEvent(
  counterEvent: CounterEvent,
  xpActions: { source: Parameters<typeof awardXP>[1]; amount: number; description: string }[],
  checkCtx?: Parameters<typeof checkAchievements>[2],
): Promise<GamificationResult> {
  let data = await getGamificationData();
  const session = await getSession();
  const sessionCtx = session.sessionId
    ? await getSessionCtx(session.sessionId)
    : undefined;

  data = updateCounters(data, counterEvent);

  let totalAwarded = 0;
  let leveledUp = false;
  let newLevel = data.xp.level;

  for (const action of xpActions) {
    const result = awardXP(data, action.source, action.amount, action.description, sessionCtx);
    data = result.data;
    totalAwarded += result.awarded;
    if (result.leveledUp) {
      leveledUp = true;
      newLevel = result.newLevel;
    }
  }

  const achievementResult = checkAchievements(data, checkCtx);
  data = achievementResult.data;
  const newAchievements = achievementResult.newAchievements;

  for (const a of newAchievements) {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === a.id);
    const xp = ACHIEVEMENT_XP[a.tier];
    const result = awardXP(data, "achievement", xp, `Achievement: ${def?.name ?? a.id}`);
    data = result.data;
    totalAwarded += result.awarded;
    if (result.leveledUp) {
      leveledUp = true;
      newLevel = result.newLevel;
    }
  }

  await saveGamificationData(data);
  if (sessionCtx) await saveSessionCtx(sessionCtx);

  for (const a of newAchievements) {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === a.id);
    if (def) {
      await sendNotification(
        `achievement-${a.id}`,
        "Achievement Unlocked!",
        `${def.icon} ${def.name} — ${def.description}`,
        2,
      );
    }
  }
  if (leveledUp) {
    await sendNotification(
      `level-up-${newLevel}`,
      "Level Up!",
      `You're now Level ${newLevel}. Keep going!`,
      1,
    );
  }

  return { xpAwarded: totalAwarded, newAchievements, leveledUp, newLevel };
}

async function startSession(
  durationMinutes: number,
  sites: string[]
): Promise<void> {
  const sessionId = generateId();
  const now = Date.now();
  const endsAt = now + durationMinutes * 60 * 1000;

  const session: BlockSession = {
    isActive: true,
    endsAt,
    blockedSites: sites,
    sessionId,
    startedAt: now,
    durationMinutes,
    interruptions: [],
  };

  await saveSession(session);
  await enableBlocking(session.blockedSites);
  await redirectExistingTabs(session.blockedSites);

  await saveSessionCtx(createDefaultSessionCtx(sessionId));

  const notifState = await getNotificationState();
  notifState.sessionWarningFired = false;
  await saveNotificationState(notifState);

  chrome.alarms.create("sessionEnd", { when: endsAt });

  const warningTime = endsAt - SESSION_WARNING_MINUTES * 60 * 1000;
  if (warningTime > now) {
    chrome.alarms.create("session-warning", { when: warningTime });
  }
}

async function endSession(
  reason: "timer" | "manual" | "browser_closed"
): Promise<void> {
  const session = await getSession();
  if (!session.isActive) return;

  const completed = reason === "timer" || reason === "browser_closed";

  session.isActive = false;
  session.endedAt = Date.now();
  session.endReason = reason;
  session.completed = completed;

  if (reason === "manual") {
    for (const interruption of session.interruptions) {
      if ((interruption.outcome as string) === "pending") {
        interruption.outcome = "broke";
      }
    }
  }

  await saveSession(session);
  await disableBlocking();
  await restoreBlockedTabs();
  chrome.alarms.clear("sessionEnd");
  chrome.alarms.clear("session-warning");

  const history = await getSessionHistory();
  history.sessions.unshift({ ...session });
  if (history.sessions.length > MAX_LOCAL_SESSIONS) {
    history.sessions = history.sessions.slice(0, MAX_LOCAL_SESSIONS);
  }
  await saveSessionHistory(history);

  if (completed) {
    const durationBonus = Math.floor(session.durationMinutes / 30) * 10;
    const xpActions: { source: Parameters<typeof awardXP>[1]; amount: number; description: string }[] = [
      { source: "session_complete", amount: 50, description: `Completed ${session.durationMinutes}-min focus session` },
    ];
    if (durationBonus > 0) {
      xpActions.push({ source: "session_duration_bonus", amount: durationBonus, description: `Duration bonus (${session.durationMinutes} min)` });
    }
    await processGamificationEvent(
      { type: "session_complete", durationMinutes: session.durationMinutes, interruptionCount: session.interruptions.length, startedAt: session.startedAt },
      xpActions,
      { sessionStartedAt: session.startedAt, sessionEndedAt: session.endedAt, sessionDurationMinutes: session.durationMinutes },
    );
  } else if (reason === "manual") {
    await processGamificationEvent(
      { type: "session_manual_end" },
      [],
    );
  }

  if (completed) {
    const interruptionCount = session.interruptions.length;
    const siteCount = session.blockedSites.length;
    await sendNotification(
      "session-complete",
      "Focus session complete!",
      `You blocked ${siteCount} site${siteCount !== 1 ? "s" : ""} for ${session.durationMinutes} minutes` +
        (interruptionCount > 0
          ? ` and resisted ${interruptionCount} temptation${interruptionCount !== 1 ? "s" : ""}.`
          : "."),
      2
    );
  }
}

async function ensureAlarmsExist(): Promise<void> {
  const heartbeat = await chrome.alarms.get("heartbeat");
  if (!heartbeat) {
    chrome.alarms.create("heartbeat", {
      periodInMinutes: HEARTBEAT_PERIOD_MINUTES,
    });
  }
}

// Top-level event listeners required by MV3
chrome.idle.setDetectionInterval(IDLE_DETECTION_INTERVAL);

chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === "active") {
    await resumeTrackingForActiveTab();
  } else {
    await stopTracking();
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await handleTabChange(activeInfo.tabId, activeInfo.windowId);
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.url === undefined) return;
  if (!tab.active) return;
  const focusedWindow = await chrome.windows.getLastFocused();
  if (tab.windowId !== focusedWindow.id) return;

  if (isTrackableUrl(changeInfo.url)) {
    const domain = extractDomain(changeInfo.url);
    if (domain) {
      await startTracking(domain);
      return;
    }
  }
  await stopTracking();
});

chrome.tabs.onRemoved.addListener(async (_tabId) => {
  await resumeTrackingForActiveTab();
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await stopTracking();
  } else {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        windowId,
      });
      if (tab?.id && tab.url && isTrackableUrl(tab.url)) {
        const domain = extractDomain(tab.url);
        if (domain) {
          await startTracking(domain);
          return;
        }
      }
      await stopTracking();
    } catch {
      await stopTracking();
    }
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "sessionEnd") {
    await endSession("timer");
    return;
  }

  if (alarm.name === "session-warning") {
    const session = await getSession();
    if (!session.isActive) return;
    const notifState = await getNotificationState();
    if (notifState.sessionWarningFired) return;
    notifState.sessionWarningFired = true;
    await saveNotificationState(notifState);
    await sendNotification(
      "session-warning",
      "Focus session ending soon",
      `${SESSION_WARNING_MINUTES} minutes left. You stayed focused — great work.`,
      1
    );
    return;
  }

  if (alarm.name === "heartbeat") {
    await flushCurrentTracking();
    await checkTimeAlerts();
    return;
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "START_SESSION") {
    const sites = message.sites || DEFAULT_BLOCKED_SITES;
    startSession(message.durationMinutes, sites).then(() =>
      sendResponse({ success: true })
    );
    return true;
  }

  if (message.type === "END_SESSION") {
    endSession("manual").then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === "GET_SESSION") {
    getSession().then((session) => sendResponse(session));
    return true;
  }

  if (message.type === "GET_TIME_TRACKING") {
    getTimeTracking().then((data) => sendResponse(data));
    return true;
  }

  if (message.type === "LOG_INTERRUPTION") {
    (async () => {
      const session = await getSession();
      if (!session.isActive) {
        sendResponse({ success: false });
        return;
      }
      const interruption: Interruption = {
        timestamp: Date.now(),
        domain: message.domain || "unknown",
        outcome: "stayed",
      };
      session.interruptions.push(interruption);
      await saveSession(session);

      const gamResult = await processGamificationEvent(
        { type: "interruption_resisted" },
        [{ source: "interruption_resisted", amount: 15, description: `Resisted ${message.domain || "distraction"}` }],
      );
      sendResponse({ success: true, xpAwarded: gamResult.xpAwarded, newAchievements: gamResult.newAchievements });
    })();
    return true;
  }

  if (message.type === "GET_STATS") {
    (async () => {
      const [tracking, history] = await Promise.all([
        getTimeTracking(),
        getSessionHistory(),
      ]);
      const today = getTodayString();
      const todayTracking = tracking.daily[today] || {};
      const totalToday = Object.values(todayTracking).reduce(
        (sum, s) => sum + s,
        0
      );
      const completedSessions = history.sessions.filter(
        (s) => s.completed
      ).length;
      const totalSessions = history.sessions.length;
      sendResponse({
        todayTracking,
        totalTodaySeconds: totalToday,
        completedSessions,
        totalSessions,
        completionRate:
          totalSessions > 0
            ? Math.round((completedSessions / totalSessions) * 100)
            : 0,
      });
    })();
    return true;
  }

  if (message.type === "GET_GAMIFICATION") {
    getGamificationData().then((data) => sendResponse(data));
    return true;
  }

  if (message.type === "LOG_BREATHE") {
    (async () => {
      if (message.status !== "complete") {
        sendResponse({ success: true });
        return;
      }
      const gamResult = await processGamificationEvent(
        { type: "breathing_complete" },
        [{ source: "breathing_exercise", amount: 10, description: "Completed breathing exercise" }],
      );
      sendResponse({ success: true, xpAwarded: gamResult.xpAwarded, newAchievements: gamResult.newAchievements });
    })();
    return true;
  }

  if (message.type === "SAVE_REFLECTION") {
    (async () => {
      const result = await chrome.storage.local.get("reflections");
      const reflections: Reflection[] = result.reflections || [];
      const session = await getSession();
      const text = message.text || message.data?.response || "";
      reflections.push({
        timestamp: Date.now(),
        sessionId: session.sessionId || "",
        text,
        domain: message.domain || message.data?.domain,
      });
      await chrome.storage.local.set({ reflections });

      let gamResult: GamificationResult | null = null;
      if (text.length >= 10) {
        gamResult = await processGamificationEvent(
          { type: "reflection_submitted" },
          [{ source: "reflection", amount: 10, description: "Submitted reflection" }],
        );
      }
      sendResponse({
        success: true,
        xpAwarded: gamResult?.xpAwarded ?? 0,
        newAchievements: gamResult?.newAchievements ?? [],
      });
    })();
    return true;
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await ensureAlarmsExist();

  const session = await getSession();
  if (session.isActive && session.endsAt > Date.now()) {
    await enableBlocking(session.blockedSites);
    chrome.alarms.create("sessionEnd", { when: session.endsAt });
    const warningTime =
      session.endsAt - SESSION_WARNING_MINUTES * 60 * 1000;
    if (warningTime > Date.now()) {
      chrome.alarms.create("session-warning", { when: warningTime });
    }
  } else if (session.isActive) {
    await endSession("browser_closed");
  }

  await resumeTrackingForActiveTab();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarmsExist();

  const session = await getSession();
  if (session.isActive && session.endsAt > Date.now()) {
    chrome.alarms.create("sessionEnd", { when: session.endsAt });
    const warningTime =
      session.endsAt - SESSION_WARNING_MINUTES * 60 * 1000;
    if (warningTime > Date.now()) {
      chrome.alarms.create("session-warning", { when: warningTime });
    }
  } else if (session.isActive) {
    await endSession("browser_closed");
  }

  await resumeTrackingForActiveTab();
});

export {};
