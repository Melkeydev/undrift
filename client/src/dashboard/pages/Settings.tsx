import { useState, useEffect, type FormEvent } from 'react';
import { getSettings, updateSettings } from '../storage';
import type { Settings as SettingsType } from '../mockData';

type NotifKey = keyof SettingsType['notificationPrefs'];

const NOTIF_LABELS: Record<NotifKey, string> = {
  timeLimit: 'Time limit warnings',
  dailySummary: 'Daily summary',
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setReason(s.personalReason);
    });
  }, []);

  async function handleSaveReason(e: FormEvent) {
    e.preventDefault();
    await updateSettings({ personalReason: reason });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleToggle(key: NotifKey) {
    if (!settings) return;
    const updated = {
      ...settings,
      notificationPrefs: {
        ...settings.notificationPrefs,
        [key]: !settings.notificationPrefs[key],
      },
    };
    setSettings(updated);
    await updateSettings({ notificationPrefs: updated.notificationPrefs });
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-16 px-6 text-text-muted text-sm gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-accent-ember animate-pulse-dot" />
        <div className="w-1.5 h-1.5 rounded-full bg-accent-ember animate-pulse-dot animate-pulse-dot-2" />
        <div className="w-1.5 h-1.5 rounded-full bg-accent-ember animate-pulse-dot animate-pulse-dot-3" />
      </div>
    );
  }

  return (
    <div className="animate-page-enter max-w-[640px]">

      <div className="mb-10">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-secondary mb-4">
          Personal Reason
        </h3>
        <div className="bg-bg-card border border-border-card rounded-md p-6 backdrop-blur-[8px] shadow-card transition-[border-color,box-shadow] duration-300 hover:border-[rgba(255,255,255,0.1)]">
          <form onSubmit={handleSaveReason}>
            <div className="mb-6">
              <label
                htmlFor="reason"
                className="block text-xs text-text-secondary mb-2 font-medium uppercase tracking-[0.06em]"
              >
                Why do you want to stay focused?
              </label>
              <textarea
                id="reason"
                className="w-full py-3 px-4 bg-bg-input border border-border-card rounded-sm text-text-primary text-sm transition-[border-color,box-shadow] duration-200 focus:outline-none focus:border-accent-ember focus:shadow-[0_0_0_3px_var(--color-accent-ember-dim)] placeholder:text-text-muted min-h-[120px] resize-y leading-relaxed"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Write your motivation here... This will be shown on the intervention page when you try to visit a blocked site."
              />
            </div>
            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 py-2.5 px-5.5 rounded-sm text-[13px] font-medium border-none tracking-wide transition-all duration-200 bg-accent-ember text-[#0c0c12] shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:bg-[#f5a623] hover:shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:-translate-y-px"
              >
                Save Reason
              </button>
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-accent-green text-[13px] font-medium animate-fade-in-up">
                  {'\u2713'} Saved
                </span>
              )}
            </div>
          </form>
        </div>
      </div>


      <div className="mb-10">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-secondary mb-4">
          Notification Preferences
        </h3>
        <div className="bg-bg-card border border-border-card rounded-md p-6 backdrop-blur-[8px] shadow-card transition-[border-color,box-shadow] duration-300 hover:border-[rgba(255,255,255,0.1)]">
          {(Object.keys(NOTIF_LABELS) as NotifKey[]).map((key) => (
            <div
              key={key}
              className="flex justify-between items-center py-3.5 border-b border-border-subtle last:border-b-0"
            >
              <span className="text-sm text-text-primary">{NOTIF_LABELS[key]}</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.notificationPrefs[key]}
                  onChange={() => handleToggle(key)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-10">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-secondary mb-4">
          Legal
        </h3>
        <div className="bg-bg-card border border-border-card rounded-md p-6 backdrop-blur-[8px] shadow-card transition-[border-color,box-shadow] duration-300 hover:border-[rgba(255,255,255,0.1)]">
          <a
            href="https://pouncing-debt-56d.notion.site/Privacy-Policy-30a0a25f4a63805186a5c0bcb4f12b33"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent-ember hover:underline"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}
