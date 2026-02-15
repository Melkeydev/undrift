# Architecture

## Overview

Undrift is a Chrome extension + web platform that helps users quit distracting websites through blocking, behavioral interventions, time tracking, and a personal analytics dashboard. The extension handles all real-time functionality (blocking, tracking, notifications) while the server provides data persistence, user accounts, and the dashboard web app.

## System Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                      Chrome Extension                          │
│                                                                │
│  ┌──────────┐   ┌─────────────┐   ┌────────────────────────┐  │
│  │  Popup   │   │ Intervention│   │  Background Service    │  │
│  │  (React) │   │  Page       │   │  Worker                │  │
│  │          │   │  (React)    │   │                        │  │
│  │ • Config │   │ • Motivate  │   │ • URL blocking         │  │
│  │ • Start  │   │ • Breathe   │   │ • Tab monitoring       │  │
│  │ • Timer  │   │ • Reflect   │   │ • Time tracking        │  │
│  │ • Stats  │   │ • Stats     │   │ • Streak management    │  │
│  └────┬─────┘   └──────┬──────┘   │ • Notifications        │  │
│       │                │          │ • Data sync            │  │
│       └── chrome.runtime.sendMessage ──┘                    │  │
│                                                                │
│  Chrome APIs:                                                  │
│  • chrome.storage.local/sync    • chrome.declarativeNetRequest │
│  • chrome.tabs (monitoring)     • chrome.alarms (heartbeat)    │
│  • chrome.idle (detection)      • chrome.notifications         │
│  • chrome.windows (focus)                                      │
└──────────────────────┬─────────────────────────────────────────┘
                       │ HTTP (REST) — data sync
                       ▼
┌────────────────────────────────────────────────────────────────┐
│                    Go Backend (port 8080)                       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  HTTP Handlers (net/http)                                │  │
│  │                                                          │  │
│  │  Auth:          Data:             Dashboard:             │  │
│  │  POST /auth/*   POST /api/sync    GET /api/time-tracking │  │
│  │                 GET  /api/stats   GET /api/sessions      │  │
│  │                                   GET /api/streaks       │  │
│  │                 Settings:                                │  │
│  │                 GET/PUT /api/settings                     │  │
│  │                 GET /health                               │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                      │
│                   ┌──────▼──────┐                               │
│                   │  Database   │                               │
│                   │  (Postgres  │                               │
│                   │  or Dynamo) │                               │
│                   └─────────────┘                               │
│                                                                │
│  Static File Serving:                                          │
│  Dashboard web app (React SPA) served from /dashboard/*        │
└────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Extension Frontend | React | 18.2.0 |
| Extension Language | TypeScript | 5.3.0 |
| Build Tool | Vite | 5.0.0 |
| Extension Bundler | CRXJS | 2.0.0-beta.23 |
| Backend | Go | 1.23.2 |
| Database | TBD (PostgreSQL or DynamoDB) | - |
| Dashboard | React SPA (served by Go) | - |
| Chrome APIs | Manifest V3 | - |

### What Was Removed

| Technology | Previous Purpose | Status |
|---|---|---|
| Stripe (v76 SDK) | $1 payment to break blocks | **Removed** |
| DynamoDB `UndriftPayments` table | Payment records | **Replaced** with user/tracking data |

## Client Architecture

The Chrome extension has three isolated contexts:

### 1. Background Service Worker (`src/background/index.ts`)

The core of the extension. Runs in the background (ephemeral in MV3, woken by events).

**Responsibilities:**
- **URL blocking** — Manage `declarativeNetRequest` dynamic rules
- **Tab monitoring** — Track active tab changes, navigation, focus
- **Time tracking** — Accumulate per-site duration, persist via heartbeat
- **Session management** — Start/end focus sessions, manage timers
- **Streak management** — Calculate and update streak data
- **Notifications** — Fire OS-level notifications via `chrome.notifications`
- **Data sync** — Periodically push data to server (when user is authenticated)
- **State persistence** — All state in `chrome.storage.local` (survives worker suspension)

### 2. Popup (`src/popup/Popup.tsx`)

Entry point for users to configure and start focus sessions.

**Responsibilities:**
- Site selection (presets + custom domains)
- Start focus session with duration
- Show active session countdown
- Show quick stats (today's tracking, current streak)
- End session manually
- Link to dashboard

### 3. Intervention Page (`src/blocked/Blocked.tsx`)

Displayed as a full-page redirect when visiting a blocked site during a focus session. Replaces the old "pay $1" blocked page.

**Responsibilities:**
- Display motivational messaging and personal reason
- Provide urge management tools (breathing exercise, reflection prompt)
- Show session progress, streak status, and stats
- Log intervention interactions for analytics
- Provide a positive exit path ("Go back to work")

### Communication Patterns

```
Popup ──sendMessage──► Background Service Worker
                            │
Intervention Page ──sendMessage──┘
     │
     └──No server calls (all intervention data stored locally)

Background Service Worker ──HTTP──► Go Backend (sync only)
```

Key change from v1: The intervention page does NOT call the server directly. All data is stored locally via `chrome.storage` and synced by the background worker.

## Server Architecture

Single Go server responsible for:

1. **User authentication** — Magic link email, JWT issuance
2. **Data sync endpoint** — Receive bulk data from extension
3. **Dashboard API** — Serve analytics queries from the web dashboard
4. **Static file serving** — Serve the dashboard React SPA

### Structure

```
server/
├── main.go              # Entry point, route registration
├── handlers/
│   ├── auth.go          # Authentication handlers
│   ├── sync.go          # Extension data sync
│   ├── tracking.go      # Time tracking queries
│   ├── sessions.go      # Session history queries
│   ├── streaks.go       # Streak data queries
│   └── settings.go      # User settings CRUD
├── middleware/
│   ├── auth.go          # JWT validation
│   ├── cors.go          # CORS (restricted to extension + dashboard origins)
│   └── ratelimit.go     # Per-IP rate limiting
├── models/
│   └── models.go        # Data structures
├── db/
│   └── db.go            # Database operations
└── dashboard/           # Built React SPA static files
```

## Extension Permissions

| Permission | Usage |
|---|---|
| `storage` | Persist session state, time tracking, streaks, preferences, auth token |
| `declarativeNetRequest` | Block/redirect URLs via declarative rules |
| `alarms` | Session end timer, heartbeat for time tracking, notification scheduling |
| `tabs` | Monitor active tab, detect navigation, redirect on block |
| `notifications` | OS-level push notifications for nudges and alerts |
| `idle` | Detect user idle/active/locked for accurate time tracking |
| `<all_urls>` (host) | Required for URL blocking and tab URL access on any domain |

### New Permissions (vs v1)

| Permission | Why It's New |
|---|---|
| `notifications` | Time alerts, streak notifications, session reminders |
| `idle` | Pause time tracking when user is away |

## Deployment Topology

- **Extension:** Built with Vite to `client/dist/`, loaded as unpacked extension or published to Chrome Web Store
- **Server:** Standalone Go binary serving both the API and dashboard static files
- **Database:** Managed database (PostgreSQL on Railway/Supabase/RDS, or DynamoDB)
- **Dashboard:** React SPA built to static files, served by the Go server at `/dashboard/*`

### Simplified vs v1

No Stripe integration, no webhook endpoints, no external payment processing. The server is a straightforward CRUD API with auth.
