import type {
  TimeTrackingEntry,
  Session,
  OverviewStats,
  Settings,
  SiteBreakdown,
} from './mockData';

interface StoredTimeTracking {
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

interface StoredSession {
  isActive: boolean;
  endsAt: number;
  blockedSites: string[];
  sessionId: string;
  startedAt: number;
  durationMinutes: number;
  interruptions: {
    timestamp: number;
    domain: string;
    outcome: 'stayed' | 'broke';
  }[];
  endReason?: 'timer' | 'manual' | 'browser_closed';
  completed?: boolean;
  endedAt?: number;
}

interface StoredSessionHistory {
  sessions: StoredSession[];
  lastSyncedAt: number;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export async function getTimeTracking(
  start: string,
  end: string
): Promise<TimeTrackingEntry[]> {
  const { timeTracking } = await chrome.storage.local.get('timeTracking') as { timeTracking?: StoredTimeTracking };
  if (!timeTracking?.daily) return [];

  const entries: TimeTrackingEntry[] = [];
  for (const [date, domains] of Object.entries(timeTracking.daily)) {
    if (date >= start && date <= end) {
      for (const [domain, seconds] of Object.entries(domains)) {
        entries.push({ date, domain, seconds });
      }
    }
  }
  return entries;
}

export async function getSiteBreakdown(): Promise<SiteBreakdown[]> {
  const { timeTracking } = await chrome.storage.local.get('timeTracking') as { timeTracking?: StoredTimeTracking };
  if (!timeTracking?.daily) return [];

  const today = todayStr();
  const weekAgo = daysAgoStr(6);
  const monthAgo = daysAgoStr(29);
  const twoWeeksAgo = daysAgoStr(13);

  const domainStats: Record<string, { today: number; weekTotal: number; weekDays: number; monthTotal: number; prevWeekTotal: number }> = {};

  for (const [date, domains] of Object.entries(timeTracking.daily)) {
    for (const [domain, seconds] of Object.entries(domains)) {
      if (!domainStats[domain]) {
        domainStats[domain] = { today: 0, weekTotal: 0, weekDays: 0, monthTotal: 0, prevWeekTotal: 0 };
      }
      if (date === today) domainStats[domain].today = seconds;
      if (date >= weekAgo && date <= today) {
        domainStats[domain].weekTotal += seconds;
        domainStats[domain].weekDays += 1;
      }
      if (date >= monthAgo && date <= today) {
        domainStats[domain].monthTotal += seconds;
      }
      if (date >= twoWeeksAgo && date < weekAgo) {
        domainStats[domain].prevWeekTotal += seconds;
      }
    }
  }

  return Object.entries(domainStats)
    .map(([domain, stats]) => {
      const weekAvg = stats.weekDays > 0 ? Math.round(stats.weekTotal / stats.weekDays) : 0;
      const prevWeekAvg = stats.prevWeekTotal / 7;
      const trendPercent = prevWeekAvg > 0
        ? Math.round(((weekAvg - prevWeekAvg) / prevWeekAvg) * 100)
        : 0;

      return {
        domain,
        todaySeconds: stats.today,
        weekAvgSeconds: weekAvg,
        monthTotalSeconds: stats.monthTotal,
        trendPercent,
      };
    })
    .sort((a, b) => b.todaySeconds - a.todaySeconds);
}

export async function getSessions(
  page: number = 1,
  limit: number = 10
): Promise<{ sessions: Session[]; total: number }> {
  const { sessionHistory } = await chrome.storage.local.get('sessionHistory') as { sessionHistory?: StoredSessionHistory };
  const storedSessions = sessionHistory?.sessions || [];

  const sessions: Session[] = storedSessions.map((s) => ({
    id: s.sessionId,
    startedAt: new Date(s.startedAt).toISOString(),
    endedAt: s.endedAt ? new Date(s.endedAt).toISOString() : null,
    durationMinutes: s.durationMinutes,
    blockedSites: s.blockedSites,
    endReason: s.endReason || 'timer',
    completed: s.completed ?? false,
    interruptions: s.interruptions.map((i) => ({
      timestamp: new Date(i.timestamp).toISOString(),
      domain: i.domain,
      outcome: i.outcome,
    })),
  }));

  sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const start = (page - 1) * limit;

  return {
    sessions: sessions.slice(start, start + limit),
    total: sessions.length,
  };
}

export async function getCalendarData(): Promise<{ date: string; completed: boolean }[]> {
  const { sessionHistory } = await chrome.storage.local.get('sessionHistory') as { sessionHistory?: StoredSessionHistory };
  const sessions = sessionHistory?.sessions || [];

  const completedDates = new Set<string>();
  for (const s of sessions) {
    if (s.completed && s.startedAt) {
      const date = new Date(s.startedAt).toISOString().split('T')[0];
      completedDates.add(date);
    }
  }

  return Array.from({ length: 90 }, (_, i) => {
    const date = daysAgoStr(89 - i);
    return { date, completed: completedDates.has(date) };
  });
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const [
    { timeTracking },
    { sessionHistory },
  ] = await Promise.all([
    chrome.storage.local.get('timeTracking') as Promise<{ timeTracking?: StoredTimeTracking }>,
    chrome.storage.local.get('sessionHistory') as Promise<{ sessionHistory?: StoredSessionHistory }>,
  ]);

  const today = todayStr();
  const todayData = timeTracking?.daily?.[today] || {};
  const todayScreenTime = Object.values(todayData).reduce((sum, s) => sum + s, 0);

  const sessions = sessionHistory?.sessions || [];
  const todaySessions = sessions.filter(
    (s) => s.completed && new Date(s.startedAt).toISOString().split('T')[0] === today
  );
  const completedSessions = sessions.filter((s) => s.completed);
  const totalSessions = sessions.length;

  const todayInterruptions = todaySessions.reduce(
    (sum, s) => sum + s.interruptions.filter((i) => i.outcome === 'stayed').length,
    0
  );

  const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
    const date = daysAgoStr(6 - i);
    const dayData = timeTracking?.daily?.[date] || {};
    const seconds = Object.values(dayData).reduce((sum, s) => sum + s, 0);
    return { date, seconds };
  });

  const avgSessionMinutes = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((sum, s) => sum + s.durationMinutes, 0) / completedSessions.length)
    : 0;

  const completionRate = totalSessions > 0
    ? completedSessions.length / totalSessions
    : 0;

  const siteCounts: Record<string, number> = {};
  for (const s of sessions) {
    for (const i of s.interruptions) {
      if (i.outcome === 'stayed') {
        siteCounts[i.domain] = (siteCounts[i.domain] || 0) + 1;
      }
    }
  }
  const mostResistedSite = Object.entries(siteCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'None yet';

  return {
    todayScreenTime,
    sessionsToday: todaySessions.length,
    interruptionsResisted: todayInterruptions,
    weeklyTrend,
    totalSessions,
    avgSessionMinutes,
    completionRate,
    mostResistedSite,
  };
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(['personalReason', 'notificationSettings']);
  return {
    personalReason: result.personalReason || '',
    notificationPrefs: result.notificationSettings || {
      timeLimit: true,
      dailySummary: false,
    },
  };
}

export async function getGamificationData() {
  const { gamification } = await chrome.storage.local.get('gamification');
  return gamification || {
    xp: { total: 0, todayEarned: 0, todayDate: '', level: 1, history: [] },
    achievements: { earned: [] },
    counters: {
      totalSessionsCompleted: 0,
      totalInterruptionsResisted: 0,
      totalFocusMinutes: 0,
      totalBreathingExercises: 0,
      totalReflections: 0,
      totalTimeSavedMinutes: 0,
      consecutiveCompletedSessions: 0,
      consecutiveCleanSessions: 0,
    },
  };
}

export async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  const updates: Record<string, unknown> = {};
  if (data.personalReason !== undefined) updates.personalReason = data.personalReason;
  if (data.notificationPrefs !== undefined) updates.notificationSettings = data.notificationPrefs;
  await chrome.storage.sync.set(updates);
  return getSettings();
}
