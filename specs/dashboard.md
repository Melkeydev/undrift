# Personal Dashboard (Web Platform)

## Overview

The dashboard is a web application where users view their Undrift analytics, track progress over time, and configure their experience. The extension syncs data to the server, and the dashboard reads from the server API.

---

## User Accounts

### Account Flow

1. User installs Chrome extension
2. Extension works fully offline with local storage (no account required for core blocking)
3. User optionally creates an account on the web platform to unlock the dashboard
4. Extension links to the account via an auth token stored in `chrome.storage.sync`
5. Once linked, the extension syncs data to the server

### Auth Strategy

See [auth.md](./auth.md) for details. The simplest viable approach:

- **Email + magic link** (passwordless) — user enters email, receives link, clicks to authenticate
- Server issues a JWT stored in `chrome.storage.sync`
- Extension sends JWT with sync requests
- Dashboard web app uses the same JWT via cookie or localStorage

---

## Dashboard Pages

### 1. Overview / Home

The landing page after login. Shows a snapshot of current status.

**Components:**
- **Current streak** — large display: "12 days focused" with visual indicator (streak flame/growth metaphor)
- **Today's summary** — time tracked today, sessions completed, interruptions resisted
- **Weekly trend chart** — bar chart showing daily screen time on tracked sites (last 7 days)
- **Quick stats row:**
  - Total sessions completed
  - Average session length
  - Completion rate (% sessions that ran to timer)
  - Most resisted site

---

### 2. Time Tracking

Detailed breakdown of time spent on websites.

**Components:**
- **Date range picker** — today, last 7 days, last 30 days, custom range
- **Daily bar chart** — stacked bars showing time per site per day
- **Site breakdown table:**
  | Site | Today | 7-Day Avg | 30-Day Total | Trend |
  |------|-------|-----------|-------------|-------|
  | youtube.com | 1h 23m | 2h 10m | 48h | ↓ 15% |
  | reddit.com | 45m | 1h 05m | 28h | ↑ 8% |
- **Time of day heatmap** — when is the user most active on distracting sites? (hour × day grid)

---

### 3. Sessions

History of all focus sessions.

**Components:**
- **Session list** — reverse chronological
  - Each entry shows: date, duration, sites blocked, interruption count, outcome (completed / ended early)
  - Expandable to show interruption details (which sites, timestamps)
- **Completion rate chart** — % of sessions completed over time (line chart)
- **Interruption patterns:**
  - "Most tempting site" ranking
  - "Average interruptions per session" trend
  - Time-of-day distribution of interruptions

---

### 4. Streaks

Streak history and milestones.

**Components:**
- **Current streak** — prominent display with days count
- **Streak timeline** — horizontal timeline showing all streaks (colored segments) with gaps between them
- **Longest streak** — highlighted
- **Milestones achieved** — badges for 3, 7, 14, 30, 60, 90 days
- **Calendar heatmap** — GitHub-style contribution graph, colored by:
  - Green: completed session that day
  - Gray: no session
  - Red: streak-breaking day (had an active streak, failed to complete)

---

### 5. Insights (Future)

AI-powered or rule-based insights. Not MVP but worth designing for.

- "Your YouTube usage drops 40% on days you complete a morning focus session"
- "You're most likely to break focus between 2-4 PM — consider scheduling sessions during that window"
- "Your average session length has increased from 30 min to 1.5 hours over the past month"

---

### 6. Settings

User preferences that sync to the extension.

**Sections:**
- **Blocked sites** — manage preset and custom sites (synced to extension)
- **Notification preferences** — toggle and configure each notification type
- **Personal reason** — edit the "why" message shown on the intervention page
- **Tracking preferences** — which sites to track time on (all vs. only blocked sites)
- **Account** — email, delete data, export data
- **Extension link status** — show whether extension is connected, last sync time

---

## API Endpoints

The dashboard reads from the same Go server the extension writes to. Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/magic-link` | Send magic link email |
| `POST` | `/api/auth/verify` | Verify magic link token, return JWT |
| `GET` | `/api/me` | Get current user profile |
| `POST` | `/api/sync` | Receive data from extension |
| `GET` | `/api/time-tracking` | Get time tracking data (with date range params) |
| `GET` | `/api/sessions` | Get session history (paginated) |
| `GET` | `/api/streaks` | Get streak data |
| `GET` | `/api/stats/overview` | Get computed overview stats |
| `GET` | `/api/settings` | Get user settings |
| `PUT` | `/api/settings` | Update user settings |

See [api.md](./api.md) for full request/response specifications.

---

## Tech Stack Options

### Option A: Next.js (Recommended)

- Server-side rendering for fast initial load
- API routes can coexist with the Go backend or replace it
- React-based (consistent with extension code)
- Easy deployment on Vercel

### Option B: Separate React SPA + Go API

- Dashboard is a static React app (Vite-built)
- Go server serves both the API and the static dashboard files
- Simpler deployment (single binary)
- No SSR

### Option C: Go templates + HTMX

- Server-rendered HTML with minimal JS
- Lightest-weight option
- Less interactive but very fast

**Recommendation:** Start with Option B (React SPA served by Go) for simplicity. The extension already uses React, so the component patterns and TypeScript types can be shared. Move to Next.js if SEO or SSR becomes important.

---

## Data Visualization Libraries

For the charts and visualizations, consider:

| Library | Strengths | Size |
|---------|-----------|------|
| **Recharts** | React-native, composable, good defaults | ~100kb |
| **Chart.js** | Simple API, canvas-based, performant | ~60kb |
| **Nivo** | Beautiful defaults, responsive, React-native | ~150kb |
| **Lightweight option: custom SVG** | Zero dependency, full control | 0kb |

**Recommendation:** Recharts — it's React-native, well-documented, and handles the chart types we need (bar, line, heatmap).

---

## Responsive Design

The dashboard should work on:
- **Desktop** (primary) — full layout with sidebar navigation
- **Tablet** — collapsed sidebar, stacked cards
- **Mobile** — single-column, bottom navigation

Users will primarily view the dashboard on desktop/laptop, but mobile access is important for checking streaks and quick stats.
