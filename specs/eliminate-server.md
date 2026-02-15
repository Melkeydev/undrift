# Eliminate Server Dependency

## Problem

The current v2 architecture requires users to run a Go server + PostgreSQL database to use the dashboard. Real users just want to install a Chrome extension from the Web Store and have it work. Nobody is going to set up a backend to track their screen time.

## Decision

**Move the dashboard into the extension as a local page.** The entire app runs client-side in the browser. No server, no database, no accounts.

---

## What Changes

### Dashboard becomes an extension page

Instead of a separate web app at `http://localhost:8080/dashboard`, the dashboard is an HTML page inside the extension:

```
chrome-extension://<ext-id>/src/dashboard/index.html
```

Opened via:
- "Open Dashboard" button in the popup → `chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard/index.html") })`
- Or directly from the Chrome extension icon context menu

### Data source changes

The dashboard React app currently fetches from REST API endpoints. Instead, it reads directly from `chrome.storage.local`:

| Current (server) | New (local) |
|---|---|
| `GET /api/time-tracking` | `chrome.storage.local.get("timeTracking")` |
| `GET /api/sessions` | `chrome.storage.local.get("sessionHistory")` |
| `GET /api/streaks` | `chrome.storage.local.get("streak")` |
| `GET /api/stats/overview` | Computed from local storage data |
| `GET /api/settings` | `chrome.storage.sync.get(["personalReason", "notificationSettings"])` |
| `PUT /api/settings` | `chrome.storage.sync.set(...)` |
| `POST /api/auth/magic-link` | **Removed** — no accounts |
| `POST /api/sync` | **Removed** — no sync |

### What to remove

| Component | Status |
|---|---|
| `server/` directory (entire Go backend) | **Remove** — not needed for MVP |
| `server/handlers/` | **Remove** |
| `server/middleware/` | **Remove** |
| `server/db/` | **Remove** |
| `server/migrations/` | **Remove** |
| `dashboard/src/api.ts` (fetch-based API client) | **Rewrite** — replace with chrome.storage reads |
| `dashboard/src/pages/Login.tsx` | **Remove** — no auth needed |
| Auth flow in `dashboard/src/App.tsx` | **Remove** — no login gate |
| `authToken` in `chrome.storage.sync` | **Remove** — no JWT |
| PostgreSQL dependency | **Remove** |
| `pgx` Go driver | **Remove** |
| `.env.example` (DATABASE_URL, JWT_SECRET, etc.) | **Remove** |

### What stays unchanged

| Component | Notes |
|---|---|
| `client/src/background/index.ts` | Fully local already — no server calls |
| `client/src/blocked/Blocked.tsx` | Fully local already — no server calls |
| `client/src/popup/Popup.tsx` | Update "Open Dashboard" URL to use `chrome.runtime.getURL()` |
| `client/manifest.json` | Add dashboard page to `web_accessible_resources` or as a chrome page |
| Dashboard UI pages (Overview, Time Tracking, Sessions, Streaks, Settings) | Keep — just change data source from fetch to chrome.storage |
| Dashboard charts (Recharts) | Keep as-is |
| Dashboard styling | Keep as-is |
| Mock data (`mockData.ts`) | Keep for development/demo |

---

## Implementation Steps

### Step 1: Move dashboard into extension

Move `dashboard/` source files into `client/src/dashboard/`:

```
client/src/dashboard/
├── index.html          # Entry point
├── Dashboard.tsx       # Root component (replaces App.tsx, no auth gate)
├── components/
│   └── Layout.tsx      # Sidebar navigation
├── pages/
│   ├── Overview.tsx
│   ├── TimeTracking.tsx
│   ├── Sessions.tsx
│   ├── Streaks.tsx
│   └── Settings.tsx
├── storage.ts          # NEW: chrome.storage adapter (replaces api.ts)
├── utils.ts
└── dashboard.css
```

### Step 2: Create storage adapter

Replace `api.ts` (fetch-based) with `storage.ts` (chrome.storage-based):

```typescript
// storage.ts — reads directly from chrome.storage.local

export async function getTimeTracking(startDate: string, endDate: string) {
  const { timeTracking } = await chrome.storage.local.get("timeTracking");
  if (!timeTracking?.daily) return {};

  // Filter to date range
  const filtered: Record<string, Record<string, number>> = {};
  for (const [date, domains] of Object.entries(timeTracking.daily)) {
    if (date >= startDate && date <= endDate) {
      filtered[date] = domains as Record<string, number>;
    }
  }
  return filtered;
}

export async function getSessions(page: number, limit: number) {
  const { sessionHistory } = await chrome.storage.local.get("sessionHistory");
  const sessions = sessionHistory?.sessions || [];
  // Sort by startedAt descending, paginate
  const sorted = sessions.sort((a, b) => b.startedAt - a.startedAt);
  return {
    sessions: sorted.slice((page - 1) * limit, page * limit),
    total: sorted.length,
  };
}

export async function getStreaks() {
  const { streak } = await chrome.storage.local.get("streak");
  return streak || { currentStreak: 0, longestStreak: 0 };
}

export async function getOverviewStats() {
  const [{ timeTracking }, { sessionHistory }, { streak }] = await Promise.all([
    chrome.storage.local.get("timeTracking"),
    chrome.storage.local.get("sessionHistory"),
    chrome.storage.local.get("streak"),
  ]);
  // Compute stats from raw data (same logic the server would have done)
  // ...
}

export async function getSettings() {
  return chrome.storage.sync.get(["personalReason", "notificationSettings"]);
}

export async function updateSettings(data: Record<string, any>) {
  return chrome.storage.sync.set(data);
}
```

### Step 3: Update manifest.json

Add the dashboard page as a web-accessible resource and/or chrome_url_overrides:

```json
{
  "web_accessible_resources": [
    {
      "resources": [
        "src/blocked/index.html",
        "src/dashboard/index.html"
      ],
      "matches": ["<all_urls>"]
    }
  ]
}
```

Alternatively, register it as the extension's options page:
```json
{
  "options_page": "src/dashboard/index.html"
}
```

### Step 4: Update popup dashboard link

In `Popup.tsx`, change the "Open Dashboard" button:

```typescript
// Before (server-hosted)
chrome.tabs.create({ url: "http://localhost:8080/dashboard" });

// After (extension page)
chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard/index.html") });
```

### Step 5: Remove Login page and auth gate

- Delete `Login.tsx`
- Remove auth check from the dashboard root component
- Remove `authToken` from storage
- Dashboard is always accessible (it's a local extension page, inherently "authenticated")

### Step 6: Remove server directory

Delete the entire `server/` directory. It can be re-introduced later if cross-device sync is needed.

### Step 7: Update Vite config

CRXJS should bundle the dashboard page alongside the popup and blocked page. Add it as an additional HTML entry point in `vite.config.ts`:

```typescript
// vite.config.ts
import { crx } from "@crxjs/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        // CRXJS handles popup and background automatically from manifest
        // Dashboard needs to be an explicit entry if not in manifest
        dashboard: "src/dashboard/index.html",
      },
    },
  },
});
```

---

## What the user experience looks like

1. User installs Undrift from Chrome Web Store
2. Clicks extension icon → popup opens
3. Selects sites, starts a focus session → blocking works immediately
4. Visits blocked site → sees intervention page with breathing/reflect/stats tools
5. Clicks "Open Dashboard" in popup → new tab opens with full analytics dashboard
6. Dashboard shows time tracking charts, session history, streak calendar — all from local data
7. **No account creation, no server, no login, no setup**

---

## When to re-introduce the server

The server becomes relevant when any of these features are needed:

| Feature | Why it needs a server |
|---|---|
| Cross-device sync | Data must live somewhere accessible from multiple machines |
| Data backup | Protection against browser data loss / extension uninstall |
| Public landing page / marketing site | Need a web server to host it |
| Accountability partner | Need a server to relay data between two users |
| Community / leaderboards | Shared state across users |
| Monetization (premium features) | Payment processing, license validation |

At that point, the Go server and PostgreSQL schema we already built can be re-introduced. The `storage.ts` adapter can be extended to also sync data to the server when an account is linked — the extension remains fully functional offline, with sync as an optional enhancement.

---

## Impact on specs

| Spec | Update needed |
|---|---|
| `architecture.md` | Remove server from system diagram, dashboard is an extension page |
| `dashboard.md` | Update data source from API to chrome.storage |
| `data-flow.md` | Remove "Dashboard Data Sync" flow (#7), simplify storage map |
| `database.md` | Mark PostgreSQL schema as "future/optional", primary store is chrome.storage |
| `README.md` | Update tech stack, remove server from critical path |
| `auth.md` | Mark as future/optional — no auth needed for extension-only mode |
| `deployment.md` | Simplify to just Chrome Web Store publishing |
