# Bugs and Issues

> **Note:** Undrift v2 removes the Stripe payment system. Payment-related bugs (BUG-001, BUG-005, BUG-006, BUG-012, BUG-013, BUG-016, BUG-017) are no longer applicable and are listed under [Resolved by Pivot](#resolved-by-pivot) at the bottom.

## Critical

### BUG-002: CORS Allows All Origins
- **Location:** `server/main.go` — `corsMiddleware()` function
- **Description:** `Access-Control-Allow-Origin` is set to `*`, meaning any website can make requests to the backend API.
- **Impact:** Any malicious webpage could call API endpoints for arbitrary user IDs.
- **Fix:** Restrict allowed origins to the Chrome extension origin (`chrome-extension://<extension-id>`) and the dashboard domain.

### BUG-003: No User Identity Verification
- **Location:** `client/src/utils/userId.ts`, `server/main.go`
- **Description:** User IDs are random UUIDs generated client-side with no server-side validation. The server trusts whatever `userId` value is sent.
- **Impact:** Any client can impersonate any user by sending their UUID. User data can be queried for arbitrary users.
- **Fix:** Implement authentication (see [auth.md](./auth.md)). v2 adds user accounts with email + magic link auth.

---

## High Severity

### BUG-004: DynamoDB Full Table Scan for User Stats
- **Location:** `server/main.go` — `getPaymentsByUser()` function
- **Description:** The function uses a DynamoDB `Scan` with a filter expression instead of a `Query` with an index.
- **Impact:** Scans read every item in the table. Cost and latency scale with total table size.
- **Fix:** v2 migrates to PostgreSQL with proper indexes, eliminating this issue entirely.
- **Status:** Will be resolved by database migration.

### BUG-008: Session Survives Extension Disable/Update
- **Location:** `client/src/background/index.ts`
- **Description:** If the extension is disabled or updated mid-session, `declarativeNetRequest` rules are removed by Chrome, but session data in `chrome.storage.local` still shows active. On restart, it tries to resume but the session time may have already passed.
- **Impact:** Stale sessions can cause unexpected blocking after extension restart, or the countdown can show negative time.
- **Fix:** On resume, check if `endsAt` is in the past. If so, clean up the session, mark it as completed with `endReason: "browser_closed"`, and update streak data.

---

## Medium Severity

### BUG-010: No Request Body Size Limit
- **Location:** `server/main.go` — POST handlers
- **Description:** No maximum body size is enforced on incoming requests.
- **Impact:** An attacker could send a very large request body, consuming server memory.
- **Fix:** Use `http.MaxBytesReader(w, r.Body, maxSize)` to cap request body size on all POST endpoints.

### BUG-011: No Rate Limiting
- **Location:** `server/main.go` — all endpoints
- **Description:** No rate limiting is implemented on any endpoint.
- **Impact:** An attacker could spam endpoints, consuming server resources.
- **Fix:** Add rate limiting middleware (per-IP or per-user). v2 server architecture includes `middleware/ratelimit.go`.

### BUG-018: No `onStartup` Handler
- **Location:** `client/src/background/index.ts`
- **Description:** The service worker only registers `chrome.runtime.onInstalled`, not `chrome.runtime.onStartup`. On browser cold start (not extension update), `onInstalled` does not fire, so alarms and session state may not be restored.
- **Impact:** After browser restart, focus sessions may not resume, time tracking heartbeat may not restart, and streak-check alarms may be lost.
- **Fix:** Add a `chrome.runtime.onStartup` listener that re-creates critical alarms (`heartbeat`, `streak-check`) and resumes any active session.

---

## Low Severity

### BUG-014: No Graceful Server Shutdown
- **Location:** `server/main.go` — `main()` function
- **Description:** The server uses `http.ListenAndServe` with no signal handling or graceful shutdown.
- **Impact:** In-flight requests are abruptly terminated on server stop.
- **Fix:** Use `http.Server` with `Shutdown()` and `os/signal` for graceful termination.

### BUG-015: No Input Validation on Custom Sites
- **Location:** `client/src/popup/Popup.tsx`
- **Description:** Custom site input accepts any string. No validation that it's a valid domain.
- **Impact:** Invalid domains can be added to the block list, which either silently fail or create malformed regex rules.
- **Fix:** Validate domain format before adding to the list (basic regex check for valid domain pattern).

### BUG-019: chrome.storage.local Has 10MB Limit
- **Location:** `client/src/background/index.ts` (time tracking storage)
- **Description:** `chrome.storage.local` has a 10MB quota. Continuous time tracking data (daily per-domain entries) will accumulate over months.
- **Impact:** After extended use, storage could fill up, causing writes to fail silently.
- **Fix:** Prune local time tracking data older than 90 days. Older data should be synced to the server before pruning.

---

## Resolved by Pivot

The following bugs from v1 are no longer applicable because the Stripe payment system has been removed:

| Bug | Description | Status |
|-----|-------------|--------|
| BUG-001 | Webhook signature validation is optional | **Removed** — no webhooks in v2 |
| BUG-005 | Default success/cancel URLs point to example.com | **Removed** — no checkout flow in v2 |
| BUG-006 | Payment polling never times out | **Removed** — no payment polling in v2 |
| ~~BUG-007~~ | ~~No interval cleanup on component unmount~~ | **Was invalid** — cleanup existed in v1 code |
| ~~BUG-009~~ | ~~context.TODO() used for DB operations~~ | **Was invalid** — handlers already used r.Context() |
| BUG-012 | Hardcoded $1 price | **Removed** — no payment in v2 |
| BUG-013 | `getUserStats` API exists but is unused | **Removed** — endpoint removed in v2 |
| BUG-016 | Webhook body read can truncate payload | **Removed** — no webhooks in v2 |
| BUG-017 | DynamoDB save failure silently ignored on checkout | **Removed** — no checkout in v2 |
