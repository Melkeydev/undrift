# Undrift — Specs

> Technical specification for Undrift, a Chrome extension that helps users quit distracting websites through blocking, time tracking, behavioral interventions, and a personal analytics dashboard.

---

## Document Map

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | System diagram, technology stack, client/server/dashboard architecture, extension permissions, deployment topology |
| [implementation.md](./implementation.md) | Full project structure, build system, code walkthrough for every module, dependencies, build & run instructions |
| [tracking.md](./tracking.md) | Time tracking system: per-site duration tracking, streak system, session history, data collection mechanisms |
| [interventions.md](./interventions.md) | QUITTR-inspired behavioral interventions: blocked page design, urge management tools, motivational techniques |
| [notifications.md](./notifications.md) | Push notification system: nudges, time warnings, streak alerts, idle detection |
| [dashboard.md](./dashboard.md) | Web platform personal dashboard: analytics, visualizations, progress tracking, user accounts |
| [ui.md](./ui.md) | Popup and blocked page UI specs, component states, user flows, visual design notes |
| [api.md](./api.md) | REST API reference (all endpoints, request/response formats, error codes) and Chrome extension message protocol |
| [data-flow.md](./data-flow.md) | Step-by-step data flow diagrams for every user journey: session start, site blocking, interventions, tracking, dashboard sync |
| [database.md](./database.md) | Database schema, operations, client-side Chrome storage usage, data model |
| [auth.md](./auth.md) | Authentication strategy for linking extension to dashboard accounts |
| [security.md](./security.md) | Vulnerability inventory, security analysis, remediation roadmap |
| [bugs.md](./bugs.md) | Prioritized bug list with locations, impacts, and fixes |
| [chrome-extension.md](./chrome-extension.md) | Chrome MV3 specifics: permissions, service worker lifecycle, declarativeNetRequest blocking, tab monitoring, notifications, idle detection |
| [gamification.md](./gamification.md) | Achievements, Focus Level (XP system), badges, anti-gaming protections, UI integration |
| [testing.md](./testing.md) | Current state, what should be tested, recommended stack, priority order |
| [deployment.md](./deployment.md) | Server/client deployment options, infrastructure, recommended architecture |
| [stripe.md](./stripe.md) | **DEPRECATED** — Previous Stripe payment integration (removed in pivot) |

---

## Quick Reference

### What is Undrift?

A Chrome extension + web platform that helps users quit distracting websites. Users select sites to block and set focus sessions. When they try to visit a blocked site, they see an intervention page with QUITTR-inspired behavioral tools (motivational messaging, urge management, breathing exercises). The extension tracks time spent on sites, maintains quit streaks, counts interruption attempts, and syncs everything to a personal analytics dashboard on the web platform.

**Inspired by QUITTR's approach:** Blocking alone is insufficient. Undrift layers multiple intervention techniques — blocking prevents access, the intervention page manages urges in the moment, and the dashboard provides long-term progress visibility and motivation.

### Core Features

1. **Site blocking** — `declarativeNetRequest` redirect rules during focus sessions
2. **Behavioral interventions** — QUITTR-style blocked page with motivational tools instead of a paywall
3. **Time tracking** — Per-site duration tracking via tab monitoring (`chrome.tabs`, `chrome.idle`)
4. **Streak system** — Consecutive days/sessions without breaking focus
5. **Interruption tracking** — How many times users attempt to visit blocked sites and whether they push through or stay focused
6. **Push notifications** — Nudges when spending too long on tracked sites, streak reminders
7. **Personal dashboard** — Web platform with analytics, progress charts, and historical data

### Tech Stack

- **Extension:** React 18 + TypeScript + Vite + CRXJS (Chrome Extension MV3)
- **Server:** Go 1.23 + standard library `net/http`
- **Database:** TBD (PostgreSQL or DynamoDB)
- **Dashboard:** Web app (framework TBD — could be part of existing React setup or separate Next.js app)

### What Changed (Pivot from v1)

| Aspect | v1 (Payment Model) | v2 (Current) |
|--------|-------------------|--------------|
| Block-breaking mechanism | Pay $1 via Stripe | No block-breaking — interventions encourage staying focused |
| Blocked page | Minimal "pay to break" screen | Rich intervention page with motivational tools |
| Backend purpose | Stripe checkout + webhook | User accounts, data sync, analytics API |
| Data collected | Payment records only | Time tracking, streaks, session history, intervention outcomes |
| Dashboard | None | Web platform with personal analytics |
| Notifications | None | Push notifications for time alerts and streaks |
| Tab monitoring | None | Active tab tracking for time-on-site data |

### Critical Implementation Priorities

1. **Tab monitoring + time tracking** — Core new capability the extension needs
2. **Intervention page redesign** — Replace payment flow with behavioral tools
3. **Streak + session tracking** — Data model and storage
4. **Notifications** — Time-based nudges
5. **Dashboard API** — Sync extension data to server
6. **Dashboard web app** — Analytics UI
