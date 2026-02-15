# Push Notifications

## Overview

Undrift uses Chrome's `chrome.notifications` API to send OS-level notifications from the background service worker. Notifications serve as nudges, warnings, and motivational prompts — they work even when the extension popup is closed.

---

## Notification Types

### 1. Time Alert — "You've been on [site] for X minutes"

**Trigger:** Passive time tracking detects the user has spent more than a configurable threshold on a tracked site.

**Thresholds (user-configurable, defaults):**
- Warning: 15 minutes on a single site
- Escalation: 30 minutes
- Critical: 60 minutes

**Example:**
```
Title: "YouTube — 30 minutes"
Message: "You've been scrolling for 30 minutes. Is this how you want to spend your time?"
```

**Implementation:**
- The heartbeat alarm (every 30 seconds) checks accumulated time for the current domain
- If threshold crossed AND notification not already sent for this threshold today → fire notification
- Track sent notifications in `chrome.storage.local` to avoid spamming

**Behavior:**
- Clicking the notification opens the extension popup (or a "take action" page)
- Does NOT block the site — this is outside a focus session. It's a nudge, not enforcement.

---

### 2. Session Ending Soon

**Trigger:** Focus session has X minutes remaining.

**When:** 5 minutes before session end (configurable).

**Example:**
```
Title: "Focus session ending soon"
Message: "5 minutes left. You stayed focused — great work."
```

**Implementation:**
- Set a `chrome.alarms` alarm at `endsAt - (5 * 60 * 1000)` when session starts
- Name: `"session-warning"`

---

### 3. Session Completed

**Trigger:** Focus session timer expires naturally.

**Example:**
```
Title: "Focus session complete!"
Message: "You blocked 4 sites for 2 hours and resisted 3 temptations. Your streak is now 12 days."
```

**Implementation:**
- Fires from the existing `sessionEnd` alarm handler
- Include stats from the completed session

---

### 4. Streak at Risk

**Trigger:** It's evening (e.g., 8 PM) and the user hasn't completed a focus session today.

**Example:**
```
Title: "Your 12-day streak is at risk"
Message: "Complete a focus session before midnight to keep it alive."
```

**Implementation:**
- Daily alarm at 20:00 local time: `chrome.alarms.create("streak-check", { when: next8pm, periodInMinutes: 1440 })`
- Check if today has a completed session in `SessionHistory`
- Only fire if user has an active streak (>= 1 day)

---

### 5. Streak Milestone

**Trigger:** User completes a session that pushes their streak to a milestone number.

**Milestones:** 3, 7, 14, 21, 30, 60, 90, 180, 365 days

**Example:**
```
Title: "7 days focused!"
Message: "One full week without breaking focus. You're building a real habit."
```

---

### 6. Streak Broken

**Trigger:** Midnight passes with no completed session (checked on next alarm or browser open).

**Example:**
```
Title: "Streak ended at 12 days"
Message: "That was your longest streak yet. Start fresh today."
```

---

### 7. Daily Reminder (Optional)

**Trigger:** User-configured daily reminder time.

**Example:**
```
Title: "Time to focus"
Message: "Start a focus session to stay on track."
```

**Implementation:**
- User sets reminder time in settings
- `chrome.alarms.create("daily-reminder", { when: nextReminderTime, periodInMinutes: 1440 })`

---

## Technical Implementation

### chrome.notifications API

```typescript
chrome.notifications.create("notification-id", {
  type: "basic",
  iconUrl: "icons/icon128.png",
  title: "Notification title",
  message: "Notification body text",
  priority: 2,              // -2 to 2, higher = more prominent
  requireInteraction: false, // true = stays until dismissed
  silent: false              // true = no sound
});
```

### Notification Settings

Users can configure notifications in extension settings:

```typescript
interface NotificationSettings {
  enabled: boolean;                    // Master toggle
  timeAlerts: {
    enabled: boolean;
    thresholdMinutes: number[];       // [15, 30, 60]
  };
  sessionReminders: {
    enabled: boolean;
    warningMinutes: number;           // 5
  };
  streakAlerts: {
    enabled: boolean;
    eveningReminderHour: number;      // 20 (8 PM)
  };
  dailyReminder: {
    enabled: boolean;
    hour: number;                     // 9 (9 AM)
    minute: number;                   // 0
  };
}
```

**Storage:** `chrome.storage.sync` under `notificationSettings`

### Permissions

```json
{
  "permissions": ["notifications", "alarms", "idle"]
}
```

### Limitations

| Limitation | Impact | Workaround |
|-----------|--------|------------|
| Chrome must be running | No notifications if Chrome is fully closed | Note this in onboarding; suggest enabling "Continue running background apps" in Chrome settings |
| macOS notification rendering | `list` and `image` types render poorly | Use `basic` type only |
| 30-second alarm minimum | Can't send time alerts with sub-30s precision | Acceptable — 30s granularity is fine for time nudges |
| User can disable Chrome notifications at OS level | Notifications silently fail | Can check `Notification.permission` and prompt user |

---

## Notification Deduplication

To prevent notification spam:

1. **Time alerts:** Store `lastTimeAlertSent[domain][threshold]` with a date. Don't re-send the same threshold for the same domain on the same day.
2. **Streak alerts:** Store `lastStreakAlertDate`. Only fire once per day.
3. **Session warnings:** Only fire once per session (clear on session start).

```typescript
interface NotificationState {
  timeAlertsSent: {
    [domain: string]: {
      [threshold: number]: string  // date string "2026-02-07"
    }
  };
  lastStreakAlertDate: string;
  sessionWarningFired: boolean;
}
```
