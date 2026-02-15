import { useEffect, useState } from "react";
import "./popup.css";
import { LevelBadge } from "../components/LevelBadge";
import { getXPProgress } from "../gamification";

interface BlockSession {
  isActive: boolean;
  endsAt: number;
  blockedSites: string[];
}

interface SessionStats {
  interruptionsResisted: number;
}

const PRESET_SITES = [
  { id: "twitter", label: "X / Twitter", icon: "\u{1D54F}", domains: ["x.com", "twitter.com"] },
  { id: "instagram", label: "Instagram", icon: "\uD83D\uDCF7", domains: ["instagram.com"] },
  { id: "youtube", label: "YouTube", icon: "\u25B6", domains: ["youtube.com"] },
  { id: "twitch", label: "Twitch", icon: "\uD83C\uDFAE", domains: ["twitch.tv"] },
  { id: "reddit", label: "Reddit", icon: "\uD83D\uDD17", domains: ["reddit.com"] },
  { id: "tiktok", label: "TikTok", icon: "\u266A", domains: ["tiktok.com"] },
];

const DURATIONS = [
  { label: "1 min", minutes: 1 },
  { label: "1 hr", minutes: 60 },
  { label: "1.5 hr", minutes: 90 },
  { label: "2 hr", minutes: 120 },
];

const ENCOURAGEMENTS = [
  "You're doing great! Stay focused.",
  "Keep it up! Your future self will thank you.",
  "Strong focus today. Keep going!",
  "Every minute of focus counts.",
  "You've got this!",
];

const DASHBOARD_URL = chrome.runtime.getURL("src/dashboard/index.html");

function formatTime(ms: number): { display: string; label: string } {
  if (ms <= 0) return { display: "0:00", label: "session ended" };
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (hrs > 0) {
    return { display: `${hrs}:${pad(mins)}:${pad(secs)}`, label: "remaining" };
  }
  return { display: `${mins}:${pad(secs)}`, label: "remaining" };
}

function formatScreenTime(seconds: number): string {
  if (seconds < 60) return "< 1m";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export function Popup() {
  const [session, setSession] = useState<BlockSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(0);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [customSites, setCustomSites] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [todayScreenTime, setTodayScreenTime] = useState<number>(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [levelInfo, setLevelInfo] = useState<{ level: number; progressPercent: number } | null>(null);
  const [encouragement] = useState(
    () => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
  );

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_POPUP_STATE" }, (response) => {
      if (response) {
        setSession(response.session);
        setSelectedPresets(response.selectedPresets || ["twitter"]);
        setCustomSites(response.customSites || []);
        setTodayScreenTime(response.todayScreenTime || 0);
        if (response.stats) setSessionStats(response.stats);
        if (response.gamification?.xp) {
          const progress = getXPProgress(response.gamification.xp.total);
          setLevelInfo({ level: progress.level, progressPercent: progress.progressPercent });
        }
      }
      setLoading(false);
    });
  }, []);

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

  const togglePreset = (id: string) => {
    const updated = selectedPresets.includes(id)
      ? selectedPresets.filter((p) => p !== id)
      : [...selectedPresets, id];
    setSelectedPresets(updated);
    chrome.storage.local.set({ selectedPresets: updated });
  };

  const addCustomSite = () => {
    const site = customInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (site && !customSites.includes(site)) {
      const updated = [...customSites, site];
      setCustomSites(updated);
      chrome.storage.local.set({ customSites: updated });
      setCustomInput("");
    }
  };

  const removeCustomSite = (site: string) => {
    const updated = customSites.filter((s) => s !== site);
    setCustomSites(updated);
    chrome.storage.local.set({ customSites: updated });
  };

  const getBlockedDomains = (): string[] => {
    const presetDomains = PRESET_SITES
      .filter((site) => selectedPresets.includes(site.id))
      .flatMap((site) => site.domains);
    return [...presetDomains, ...customSites];
  };

  const handleStart = (minutes: number) => {
    const sites = getBlockedDomains();
    if (sites.length === 0) return;
    chrome.runtime.sendMessage({ type: "START_SESSION", durationMinutes: minutes, sites }, () => {
      chrome.runtime.sendMessage({ type: "GET_SESSION" }, (response) => {
        setSession(response);
      });
    });
  };

  const handleEndClick = () => {
    setShowEndConfirm(true);
  };

  const handleEndConfirm = () => {
    chrome.runtime.sendMessage({ type: "END_SESSION" }, () => {
      setSession((s) => (s ? { ...s, isActive: false } : null));
      setShowEndConfirm(false);
    });
  };

  const handleEndCancel = () => {
    setShowEndConfirm(false);
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: DASHBOARD_URL });
  };

  if (loading) {
    return (
      <div className="popup">
        <div className="loading">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const headerBadges = (
    <div className="header-badges">
      {levelInfo && (
        <LevelBadge level={levelInfo.level} progressPercent={levelInfo.progressPercent} size="sm" />
      )}
    </div>
  );

  if (session?.isActive) {
    const { display, label } = formatTime(remaining);
    return (
      <div className="popup">
        <div className="header">
          <span className="header-icon">&#x1F6E1;</span>
          <h1>Undrift</h1>
          {headerBadges}
        </div>

        <div className="active-session">
          <div className="session-badge">
            <span className="session-badge-dot" />
            Session active
          </div>

          <div className="timer-display">{display}</div>
          <div className="timer-label">{label}</div>

          <div className="session-stats">
            <div className="stat-row">
              <span className="stat-label">Interruptions resisted</span>
              <span className="stat-value">{sessionStats?.interruptionsResisted ?? 0}</span>
            </div>
            <div className="encouragement">{encouragement}</div>
          </div>

          <div className="blocked-sites-list">
            Blocking: <span>{session.blockedSites.join(", ")}</span>
          </div>

          {showEndConfirm ? (
            <div className="end-confirm">
              <p className="end-confirm-message">
                Are you sure you want to end this session early?
              </p>
              <div className="end-confirm-buttons">
                <button className="btn-keep-going" onClick={handleEndCancel}>
                  Keep Going
                </button>
                <button className="btn-end-confirm" onClick={handleEndConfirm}>
                  End Session
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-end" onClick={handleEndClick}>
              End Session
            </button>
          )}
        </div>

        <div className="footer">
          <button className="btn-dashboard" onClick={openDashboard}>
            Open Dashboard
          </button>
        </div>
      </div>
    );
  }

  const hasSites = getBlockedDomains().length > 0;

  return (
    <div className="popup">
      <div className="header">
        <span className="header-icon">&#x1F6E1;</span>
        <h1>Undrift</h1>
        {headerBadges}
      </div>

      <div className="header-stats">
        <span className="today-stat">Today: {formatScreenTime(todayScreenTime)}</span>
      </div>

      <div className="section-label">Block these sites</div>
      <div className="site-grid">
        {PRESET_SITES.map((site) => (
          <button
            key={site.id}
            className={`site-pill ${selectedPresets.includes(site.id) ? "selected" : ""}`}
            onClick={() => togglePreset(site.id)}
          >
            <span className="site-pill-icon">{site.icon}</span>
            <span className="site-pill-label">{site.label}</span>
          </button>
        ))}
      </div>

      <div className="custom-section">
        <div className="section-label">Custom sites</div>
        <div className="custom-input-row">
          <input
            type="text"
            className="custom-input"
            placeholder="e.g. facebook.com"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomSite()}
          />
          <button className="btn-add" onClick={addCustomSite}>Add</button>
        </div>
        {customSites.length > 0 && (
          <div className="custom-tags">
            {customSites.map((site) => (
              <span key={site} className="custom-tag">
                {site}
                <button onClick={() => removeCustomSite(site)}>&times;</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="duration-section">
        <div className="section-label">Focus duration</div>
        <div className="duration-row">
          {DURATIONS.map((d) => (
            <button
              key={d.minutes}
              className="btn-duration"
              disabled={!hasSites}
              onClick={() => handleStart(d.minutes)}
            >
              {d.label}
            </button>
          ))}
        </div>
        {!hasSites && (
          <div className="hint">Select at least one site to start</div>
        )}
      </div>

      <div className="footer">
        <button className="btn-dashboard" onClick={openDashboard}>
          Open Dashboard
        </button>
      </div>
    </div>
  );
}
