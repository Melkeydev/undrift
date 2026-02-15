import { useEffect, useState, useRef, useCallback } from "react";
import "./blocked.css";

interface BlockSession {
  isActive: boolean;
  endsAt: number;
  blockedSites: string[];
  startedAt?: number;
}

interface StatsData {
  interruptionsToday: number;
}

type BreathePhase = "inhale" | "hold-in" | "exhale" | "hold-out";

const MOTIVATIONAL_MESSAGES = [
  "You started this session for a reason.",
  "Is this really what you want to be doing right now?",
  "Your future self will thank you.",
  "You don't need this. You need what you were working on.",
  "Every time you resist, it gets easier.",
  "This urge will pass. Stay the course.",
  "You're stronger than a momentary impulse.",
];

const REFLECTION_PROMPTS = [
  "What triggered you to come here right now?",
  "What were you doing before you navigated here?",
  "On a scale of 1-10, how strong is the urge right now?",
  "What would completing your session mean to you?",
];

const BREATHE_PHASE_DURATION = 4000; // 4 seconds per phase
const BREATHE_TOTAL_CYCLES = 3;

const PHASE_LABELS: Record<BreathePhase, string> = {
  inhale: "Inhale...",
  "hold-in": "Hold...",
  exhale: "Exhale...",
  "hold-out": "Hold...",
};

const PHASE_ORDER: BreathePhase[] = ["inhale", "hold-in", "exhale", "hold-out"];

function getReturnUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("returnUrl");
}

function getHostname(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return url;
  }
}

function formatTime(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hrs > 0) return `${hrs}:${pad(mins)}:${pad(secs)}`;
  return `${mins}:${pad(secs)}`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getEncouragingMessage(interruptions: number): string {
  if (interruptions === 0) return "No interruptions today. Clean focus.";
  if (interruptions <= 3) return "You're resisting well today.";
  return "Each time you resist gets easier.";
}

export function Blocked() {
  const returnUrl = getReturnUrl();
  const blockedSite = returnUrl ? getHostname(returnUrl) : "this site";

  const [session, setSession] = useState<BlockSession | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [motivationalMsg] = useState(() => pickRandom(MOTIVATIONAL_MESSAGES));

  const [personalReason, setPersonalReason] = useState<string | null>(null);
  const [reasonInput, setReasonInput] = useState("");

  const [expandedTool, setExpandedTool] = useState<
    "breathe" | "reflect" | "stats" | null
  >(null);

  const [breatheActive, setBreatheActive] = useState(false);
  const [breathePhase, setBreathePhase] = useState<BreathePhase>("inhale");
  const [breatheCycle, setBreatheCycle] = useState(0);
  const [breatheComplete, setBreatheComplete] = useState(false);
  const breatheTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reflectPrompt] = useState(() => pickRandom(REFLECTION_PROMPTS));
  const [reflectResponse, setReflectResponse] = useState("");
  const [reflectSubmitted, setReflectSubmitted] = useState(false);

  const [xpToast, setXpToast] = useState<{ amount: number; key: number } | null>(null);
  const [achievementModal, setAchievementModal] = useState<{ name: string; description: string; icon: string } | null>(null);

  const [stats, setStats] = useState<StatsData>({ interruptionsToday: 0 });

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_SESSION" }, (response) => {
      if (response) setSession(response);
    });

    chrome.runtime.sendMessage({ type: "GET_STATS" }, (response) => {
      if (response) setStats(response);
    });

    chrome.storage.sync.get("personalReason", (result) => {
      if (result.personalReason) setPersonalReason(result.personalReason);
    });

    if (returnUrl) {
      chrome.runtime.sendMessage({
        type: "LOG_INTERRUPTION",
        domain: getHostname(returnUrl),
      });
    }
  }, [returnUrl]);

  useEffect(() => {
    if (!session?.isActive) return;

    const tick = () => {
      const left = session.endsAt - Date.now();
      setRemaining(left);
      if (left <= 0) {
        setSession((s) => (s ? { ...s, isActive: false } : null));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const advanceBreathe = useCallback(
    (phaseIndex: number, cycle: number) => {
      if (cycle >= BREATHE_TOTAL_CYCLES) {
        setBreatheComplete(true);
        setBreatheActive(false);
        chrome.runtime.sendMessage({
          type: "LOG_BREATHE",
          status: "complete",
          domain: blockedSite,
        }, (response) => {
          if (response) showGamificationFeedback(response);
        });
        return;
      }

      const phase = PHASE_ORDER[phaseIndex];
      setBreathePhase(phase);
      setBreatheCycle(cycle);

      breatheTimerRef.current = setTimeout(() => {
        const nextIndex = phaseIndex + 1;
        if (nextIndex < PHASE_ORDER.length) {
          advanceBreathe(nextIndex, cycle);
        } else {
          advanceBreathe(0, cycle + 1);
        }
      }, BREATHE_PHASE_DURATION);
    },
    [blockedSite]
  );

  const startBreathe = () => {
    setBreatheActive(true);
    setBreatheComplete(false);
    setBreatheCycle(0);
    chrome.runtime.sendMessage({
      type: "LOG_BREATHE",
      status: "start",
      domain: blockedSite,
    });
    advanceBreathe(0, 0);
  };

  useEffect(() => {
    return () => {
      if (breatheTimerRef.current) clearTimeout(breatheTimerRef.current);
    };
  }, []);

  const showGamificationFeedback = (response: { xpAwarded?: number; newAchievements?: { id: string; tier: string }[] }) => {
    if (response.xpAwarded && response.xpAwarded > 0) {
      setXpToast({ amount: response.xpAwarded, key: Date.now() });
      setTimeout(() => setXpToast(null), 1800);
    }
    if (response.newAchievements && response.newAchievements.length > 0) {
      const achId = response.newAchievements[0]!.id;
      const name = achId.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      setAchievementModal({ name, description: "Achievement unlocked!", icon: "\u2B50" });
    }
  };

  const saveReason = () => {
    const trimmed = reasonInput.trim();
    if (!trimmed) return;
    chrome.storage.sync.set({ personalReason: trimmed });
    setPersonalReason(trimmed);
    setReasonInput("");
  };

  const submitReflection = () => {
    const trimmed = reflectResponse.trim();
    if (!trimmed) return;
    chrome.runtime.sendMessage({
      type: "SAVE_REFLECTION",
      text: trimmed,
      domain: blockedSite,
      data: {
        domain: blockedSite,
        prompt: reflectPrompt,
        response: trimmed,
        urgeLevel: null,
      },
    }, (response) => {
      if (response) showGamificationFeedback(response);
    });
    setReflectSubmitted(true);
  };

  const toggleTool = (tool: "breathe" | "reflect" | "stats") => {
    setExpandedTool((prev) => (prev === tool ? null : tool));
  };

  const goBackToWork = () => {
    chrome.runtime.sendMessage({
      type: "LOG_INTERRUPTION",
      domain: blockedSite,
      outcome: "stayed",
    });
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "about:blank";
    }
  };

  const sessionDuration = session?.startedAt
    ? session.endsAt - session.startedAt
    : 0;
  const elapsed = sessionDuration - remaining;
  const progressPercent =
    sessionDuration > 0
      ? Math.min(100, Math.max(0, (elapsed / sessionDuration) * 100))
      : 0;
  const minutesLeft = Math.max(0, Math.ceil(remaining / 60000));

  if (!session?.isActive) {
    return (
      <div className="ended-page">
        <div className="ended-icon">&#10003;</div>
        <div className="ended-title">Session complete</div>
        <div className="ended-text">Redirecting you back...</div>
      </div>
    );
  }

  return (
    <div className="blocked-page">

      <div className="shield-icon" aria-hidden="true">
        &#128737;
      </div>
      <h1 className="blocked-title">{blockedSite} is blocked</h1>
      <p className="blocked-subtitle">{motivationalMsg}</p>


      <div className="timer-section">
        <div className="timer-display" aria-label={`${minutesLeft} minutes remaining`}>
          {formatTime(remaining)}
        </div>
        <div className="timer-progress-bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="timer-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="timer-subtext">
          <strong>{minutesLeft} minute{minutesLeft !== 1 ? "s" : ""} left</strong>{" "}
          &mdash; you&apos;ve got this
        </div>
      </div>


      <div className="reason-card">
        <div className="reason-label">Your Reason</div>
        {personalReason ? (
          <div className="reason-text">&ldquo;{personalReason}&rdquo;</div>
        ) : (
          <div className="reason-input-row">
            <input
              className="reason-input"
              type="text"
              placeholder="Why did you start this session?"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveReason()}
              aria-label="Enter your reason for focusing"
            />
            <button className="reason-save-btn" onClick={saveReason}>
              Save
            </button>
          </div>
        )}
      </div>


      <div className="tools-row">

        <div className="tool-card">
          <div
            className="tool-card-header"
            onClick={() => toggleTool("breathe")}
            role="button"
            tabIndex={0}
            aria-expanded={expandedTool === "breathe"}
            onKeyDown={(e) => e.key === "Enter" && toggleTool("breathe")}
          >
            <span className="tool-card-icon" aria-hidden="true">&#127744;</span>
            Breathe
          </div>
          {expandedTool === "breathe" && (
            <div className="tool-card-body">
              {breatheComplete ? (
                <div className="breathe-complete">
                  <div className="breathe-complete-text">
                    Feeling calmer? Go back to what matters.
                  </div>
                  <div className="breathe-complete-sub">
                    Exercise complete &mdash; 3 cycles
                  </div>
                </div>
              ) : breatheActive ? (
                <div className="breathe-container">
                  <div className="breathe-circle-wrapper">
                    <div className={`breathe-circle ${breathePhase}`} />
                  </div>
                  <div className="breathe-prompt">
                    {PHASE_LABELS[breathePhase]}
                  </div>
                  <div className="breathe-timer">
                    Cycle {breatheCycle + 1} of {BREATHE_TOTAL_CYCLES}
                  </div>
                </div>
              ) : (
                <div className="breathe-container">
                  <button className="breathe-start-btn" onClick={startBreathe}>
                    Start breathing exercise
                  </button>
                </div>
              )}
            </div>
          )}
        </div>


        <div className="tool-card">
          <div
            className="tool-card-header"
            onClick={() => toggleTool("reflect")}
            role="button"
            tabIndex={0}
            aria-expanded={expandedTool === "reflect"}
            onKeyDown={(e) => e.key === "Enter" && toggleTool("reflect")}
          >
            <span className="tool-card-icon" aria-hidden="true">&#9998;</span>
            Reflect
          </div>
          {expandedTool === "reflect" && (
            <div className="tool-card-body">
              {reflectSubmitted ? (
                <div className="reflect-submitted">
                  Reflection saved. Thank you for taking a moment.
                </div>
              ) : (
                <div className="reflect-container">
                  <div className="reflect-prompt">{reflectPrompt}</div>
                  <textarea
                    className="reflect-textarea"
                    placeholder="Type your thoughts..."
                    value={reflectResponse}
                    onChange={(e) => setReflectResponse(e.target.value)}
                    aria-label="Reflection response"
                  />
                  <button
                    className="reflect-submit-btn"
                    onClick={submitReflection}
                    disabled={!reflectResponse.trim()}
                  >
                    Submit
                  </button>
                </div>
              )}
            </div>
          )}
        </div>


        <div className="tool-card">
          <div
            className="tool-card-header"
            onClick={() => toggleTool("stats")}
            role="button"
            tabIndex={0}
            aria-expanded={expandedTool === "stats"}
            onKeyDown={(e) => e.key === "Enter" && toggleTool("stats")}
          >
            <span className="tool-card-icon" aria-hidden="true">&#128200;</span>
            Stats
          </div>
          {expandedTool === "stats" && (
            <div className="tool-card-body">
              <div className="stats-container">
                <div className="stat-row">
                  <span className="stat-label">Interruptions today</span>
                  <span className="stat-value">
                    Resisted {stats.interruptionsToday} time
                    {stats.interruptionsToday !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Session progress</span>
                  <span className="stat-value">
                    {Math.round(progressPercent)}% complete
                  </span>
                </div>
                <div className="stats-encouragement">
                  {getEncouragingMessage(
                    stats.interruptionsToday
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>


      <button className="go-back-btn" onClick={goBackToWork}>
        Go back to work
      </button>

      {xpToast && (
        <div key={xpToast.key} className="xp-toast">+{xpToast.amount} XP</div>
      )}

      {achievementModal && (
        <div className="achievement-overlay" onClick={() => setAchievementModal(null)}>
          <div className="achievement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="achievement-modal-icon">{achievementModal.icon}</div>
            <div className="achievement-modal-title">Achievement Unlocked!</div>
            <div className="achievement-modal-name">{achievementModal.name}</div>
            <div className="achievement-modal-desc">{achievementModal.description}</div>
            <button className="achievement-modal-btn" onClick={() => setAchievementModal(null)}>
              Nice!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
