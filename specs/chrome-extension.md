# Chrome Extension

## Manifest

**Version:** Manifest V3

### Permissions

| Permission | Why It's Needed |
|------------|----------------|
| `storage` | Persist session state, time tracking, streaks, user prefs, auth token, UUID |
| `declarativeNetRequest` | Block/redirect URLs via declarative rules (no persistent background needed) |
| `alarms` | Session end timer, heartbeat for time tracking, notification scheduling, daily streak check |
| `tabs` | Query tabs, monitor active tab changes, detect navigation, redirect on block |
| `notifications` | OS-level push notifications for time alerts, streak reminders, session events |
| `idle` | Detect user idle/active/locked for accurate time tracking |

### Host Permissions

| Permission | Why It's Needed |
|------------|----------------|
| `<all_urls>` | Required to apply blocking rules to any domain AND to read tab URLs for time tracking |

**Install warning:** `<all_urls>` triggers "Read and change all your data on all websites" — this is expected for an extension that blocks arbitrary domains and tracks time on all sites.

### Entry Points

| Context | HTML | Script | Purpose |
|---------|------|--------|---------|
| Background | - | `src/background/index.ts` | Service worker — blocking, tracking, notifications |
| Popup | `src/popup/index.html` | `src/popup/Popup.tsx` | UI when clicking extension icon |
| Intervention Page | `src/blocked/index.html` | `src/blocked/Blocked.tsx` | Full-page intervention for blocked sites |

### Web Accessible Resources

- `src/blocked/index.html` — must be web-accessible so `declarativeNetRequest` redirect rules can target it

---

## Service Worker Lifecycle

Chrome MV3 service workers are **ephemeral** — they can be suspended after ~30 seconds of inactivity.

### How Undrift Handles This

1. **State Persistence:** All state is stored in `chrome.storage.local`, never in-memory global variables. The service worker reads from storage on every event.

2. **Alarms for Timing:** Uses `chrome.alarms` instead of `setTimeout`/`setInterval`:
   - `"sessionEnd"` — focus session timer
   - `"session-warning"` — 5 min before session end
   - `"heartbeat"` — 30-second periodic alarm for time tracking persistence
   - `"streak-check"` — daily at 8 PM for streak-at-risk notification
   - `"sync"` — periodic data sync to server

3. **Event Registration at Top Level:** All `chrome.*` event listeners are registered at the top level of the service worker script (not inside async callbacks), per MV3 requirements.

4. **Resume on Startup:**
   - `chrome.runtime.onInstalled` — handles install and extension updates
   - `chrome.runtime.onStartup` — handles browser cold start (re-creates alarms, resumes tracking)

### What Resets the 30-Second Idle Timer

- Any chrome extension event firing (tab events, alarm events, etc.)
- Any chrome extension API call
- Message received on a long-lived port (Chrome 114+)
- Active WebSocket (Chrome 116+)

The heartbeat alarm (every 30 seconds) effectively keeps the worker alive during active tracking, since each alarm fire resets the idle timer.

---

## Tab Monitoring (New in v2)

### Events Used

| Event | Purpose | Data |
|-------|---------|------|
| `chrome.tabs.onActivated` | User switches tabs | `tabId`, `windowId` (must call `chrome.tabs.get(tabId)` for URL) |
| `chrome.tabs.onUpdated` | In-tab navigation | `tabId`, `changeInfo.url`, `tab` object |
| `chrome.tabs.onRemoved` | Tab closed | `tabId` |
| `chrome.windows.onFocusChanged` | Chrome window focus change | `windowId` (`WINDOW_ID_NONE` when Chrome loses focus) |

### Key Gotchas

1. **`onActivated` does NOT include the tab URL** — you must follow up with `chrome.tabs.get(tabId)` to read the URL
2. **`onUpdated` fires for many reasons** (loading status, title changes, favicons) — filter on `changeInfo.url !== undefined` to catch only navigation
3. **Multiple windows:** Only track time for the tab in the currently focused window
4. **`chrome-extension://` and `chrome://` URLs:** Skip tracking for these

---

## Idle Detection (New in v2)

### API: `chrome.idle`

| Method/Event | Purpose |
|---|---|
| `chrome.idle.setDetectionInterval(60)` | Set idle threshold to 60 seconds |
| `chrome.idle.onStateChanged` | Fires on state transitions: `"active"` ↔ `"idle"` ↔ `"locked"` |

### Behavior

- **`"idle"`**: User hasn't interacted with the computer for 60 seconds → pause time tracking
- **`"locked"`**: Screen is locked → pause time tracking
- **`"active"`**: User returned → resume time tracking for current active tab

**Permission:** `"idle"` (no install warning)

---

## Notifications (New in v2)

### API: `chrome.notifications`

```typescript
chrome.notifications.create("notification-id", {
  type: "basic",
  iconUrl: "icons/icon128.png",
  title: "Title",
  message: "Body text",
  priority: 2,
  requireInteraction: false
});
```

### Limitations

| Limitation | Impact |
|---|---|
| Chrome must be running | No notifications when Chrome is fully closed |
| macOS: `list`/`image` types render poorly | Use `basic` type only |
| User can disable at OS level | Notifications silently fail |

**Permission:** `"notifications"` (install warning: "Display notifications")

See [notifications.md](./notifications.md) for full notification types and logic.

---

## URL Blocking Mechanism

### How `declarativeNetRequest` Works

MV3 uses declarative rules that Chrome evaluates natively — no request interception.

### Rule Structure

For each blocked domain:

```typescript
{
  id: <sequential integer>,
  priority: 1,
  action: {
    type: "redirect",
    redirect: {
      regexSubstitution: "chrome-extension://<ext-id>/src/blocked/index.html?returnUrl=\\0"
    }
  },
  condition: {
    regexFilter: "^https?://([a-z0-9-]+\\.)*<domain>/.*",
    resourceTypes: ["main_frame"]
  }
}
```

- Only `main_frame` requests are blocked (not subresources)
- `\\0` captures the full original URL
- Regex covers both protocols and all subdomains
- Rules persist across service worker restarts (Chrome manages them)

### Rule Management

- `addRules` on session start
- `removeRuleIds` on session end
- Rules survive service worker suspension

---

## Tab Management

### On Session Start (`redirectExistingTabs`)

1. Query all tabs: `chrome.tabs.query({})`
2. Check each tab URL against blocked domains
3. Redirect matching tabs to intervention page with `returnUrl` param

### On Session End (`restoreBlockedTabs`)

1. Query all tabs on the intervention page (URL contains `blocked/index.html`)
2. Extract `returnUrl` from the intervention page's URL
3. Navigate tab back to the original URL

---

## Storage Usage

### `chrome.storage.local` (device-only)

| Key | Type | Content |
|-----|------|---------|
| `session` | object | Active session state + interruptions |
| `selectedPresets` | string[] | Selected preset categories |
| `customSites` | string[] | Custom domains |
| `timeTracking` | object | Daily per-domain time data + current tracking state |
| `sessionHistory` | object | Recent sessions + last sync timestamp |
| `streak` | object | Current/longest streak + dates |
| `reflections` | array | Journal entries from intervention page |
| `notificationState` | object | Deduplication tracking |

### `chrome.storage.sync` (cross-device)

| Key | Type | Content |
|-----|------|---------|
| `userId` | string | UUID v4 |
| `authToken` | string | JWT for server auth (if logged in) |
| `personalReason` | string | User's motivational reason |
| `notificationSettings` | object | Notification preferences |

---

## Preset Sites

Hardcoded in `Popup.tsx`:

| Name | Domains |
|------|---------|
| X/Twitter | `x.com`, `twitter.com` |
| Instagram | `instagram.com` |
| YouTube | `youtube.com` |
| Twitch | `twitch.tv` |
| Reddit | `reddit.com` |
| TikTok | `tiktok.com` |

---

## Known Extension-Specific Issues

1. **No `onStartup` handler (v1 bug):** Must add `chrome.runtime.onStartup` for browser cold start resilience
2. **`<all_urls>` is a sensitive permission:** Chrome Web Store review may flag this
3. **CRXJS beta:** Build tool is on `2.0.0-beta.23` — pre-release
4. **No options page:** Should add for notification/tracking preferences
5. **No icon defined:** Manifest needs extension icons
6. **Storage quota:** `chrome.storage.local` has a 10MB limit — time tracking data should be pruned (keep last 90 days locally, older data lives on server only)
