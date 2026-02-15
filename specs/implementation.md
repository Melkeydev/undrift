# Implementation Details

## Project Structure

```
undrift/
├── client/                          # Chrome Extension (React + TypeScript)
│   ├── src/
│   │   ├── background/
│   │   │   └── index.ts             # Service worker — blocking engine (159 lines)
│   │   ├── popup/
│   │   │   ├── Popup.tsx            # Main popup component (170 lines)
│   │   │   ├── index.tsx            # React mount point
│   │   │   └── index.html           # Popup HTML shell
│   │   ├── blocked/
│   │   │   ├── Blocked.tsx          # Blocked page component (124 lines)
│   │   │   ├── index.tsx            # React mount point
│   │   │   └── index.html           # Blocked page HTML shell
│   │   ├── utils/
│   │   │   ├── api.ts               # Backend API client (37 lines)
│   │   │   └── userId.ts            # UUID generation/persistence (11 lines)
│   │   └── vite-env.d.ts            # TypeScript env declarations
│   ├── manifest.json                # Chrome Extension manifest v3
│   ├── vite.config.ts               # Vite + CRXJS build config
│   ├── tsconfig.json                # TypeScript configuration
│   ├── package.json                 # Dependencies
│   └── package-lock.json            # Lockfile
│
├── server/                          # Go Backend
│   ├── main.go                      # Entire server in one file (342 lines)
│   ├── go.mod                       # Go module dependencies
│   ├── go.sum                       # Dependency checksums
│   └── .env.example                 # Environment variable template
│
└── specs/                           # This documentation
```

---

## Client Implementation

### Build System

- **Vite 5.0.0** with `@vitejs/plugin-react` for JSX/React support
- **CRXJS Vite Plugin** (`@crxjs/vite-plugin@2.0.0-beta.23`) for Chrome Extension bundling
  - Reads `manifest.json` and generates proper extension output
  - Handles service worker bundling, HTML entry points, content script injection
- Output: `client/dist/` — loadable as an unpacked Chrome extension

### Background Service Worker

**File:** `src/background/index.ts`

Key implementation details:

1. **Session Storage Schema:**
   ```typescript
   interface Session {
     isActive: boolean;
     endsAt: number;        // Unix timestamp (ms)
     blockedSites: string[]; // Domain strings
   }
   ```

2. **URL Blocking via `declarativeNetRequest`:**
   - Creates one rule per blocked domain
   - Rule type: `redirect`
   - Uses regex URL filter: `^https?://([a-z0-9-]+\\.)*{domain}/.*`
   - Redirects to: `chrome-extension://{id}/src/blocked/index.html?returnUrl={url}`
   - Rule IDs: sequential integers starting at 1

3. **Session Lifecycle:**
   - Start: Save session → enable blocking → redirect existing tabs → set alarm
   - End: Clear alarm → disable blocking → restore tabs → clear session storage
   - Resume: On `chrome.runtime.onInstalled`, check for active session → re-enable if valid

4. **Chrome Message Protocol:**
   ```typescript
   // Messages:
   { type: "START_SESSION", duration: number, sites: string[] }
   { type: "END_SESSION" }
   { type: "GET_SESSION" }

   // Responses:
   { session: Session | null }  // for GET_SESSION
   ```

### Popup Component

**File:** `src/popup/Popup.tsx`

- React functional component with hooks
- State managed via `useState` + `useEffect`
- Preset sites: hardcoded array of `{ name, domains[] }` objects
- Persistence: `chrome.storage.local` for `selectedPresets` and `customSites`
- Timer: `setInterval` at 1000ms, formats milliseconds to `HH:MM:SS`

### Blocked Page Component

**File:** `src/blocked/Blocked.tsx`

- Reads `returnUrl` from `window.location.search`
- Extracts hostname via `new URL(returnUrl).hostname`
- Payment flow: `createCheckoutSession()` → `window.open()` → poll `checkPayment()` every 2s
- On payment confirmed: `chrome.runtime.sendMessage({ type: "END_SESSION" })` → redirect

### API Client

**File:** `src/utils/api.ts`

- Base URL: `import.meta.env.VITE_API_URL || "http://localhost:8080"`
- Three functions wrapping `fetch()`:
  - `createCheckoutSession(userId)` → POST
  - `checkPayment(sessionId)` → GET
  - `getUserStats(userId)` → GET (currently unused)

### User ID

**File:** `src/utils/userId.ts`

- Uses `chrome.storage.sync` (syncs across devices)
- Generates UUID via `crypto.randomUUID()`
- Cached in storage after first generation

---

## Server Implementation

### Single-File Architecture

Everything lives in `server/main.go`. No separate packages, no router library, no middleware framework.

### Configuration

Environment variables loaded at startup:
| Variable | Default | Purpose |
|----------|---------|---------|
| `STRIPE_SECRET_KEY` | (none) | Stripe API authentication |
| `STRIPE_WEBHOOK_SECRET` | (none) | Webhook signature verification |
| `DYNAMODB_TABLE` | `UndriftPayments` | DynamoDB table name |
| `SUCCESS_URL` | `https://example.com/success` | Post-payment redirect |
| `CANCEL_URL` | `https://example.com/cancel` | Payment cancel redirect |
| `PORT` | `8080` | Server listen port |

### Database Model

```go
type Payment struct {
    PaymentID       string `dynamodbav:"paymentId"`
    UserID          string `dynamodbav:"userId"`
    StripeSessionID string `dynamodbav:"stripeSessionId"`
    Amount          int64  `dynamodbav:"amount"`
    Paid            bool   `dynamodbav:"paid"`
    CreatedAt       int64  `dynamodbav:"createdAt"`
}
```

**Primary Key:** `paymentId` (set to Stripe session ID)

### Database Operations

| Function | DynamoDB Operation | Notes |
|----------|-------------------|-------|
| `savePayment()` | `PutItem` | Creates new payment record |
| `markPaymentPaid()` | `UpdateItem` | Sets `paid = true` by `paymentId` |
| `checkPaymentPaid()` | `GetItem` | Reads single item by `paymentId` |
| `getPaymentsByUser()` | `Scan` + FilterExpression | **Full table scan** — needs GSI |

### Stripe Integration

- **SDK:** `stripe-go/v76`
- **Checkout Mode:** `payment` (one-time)
- **Payment Method:** `card` only
- **Line Item:** "Break Focus Block", $1.00 USD (100 cents), quantity 1
- **Webhook Event:** `checkout.session.completed`

### Route Registration

```go
http.HandleFunc("/create-checkout-session", handleCreateCheckoutSession)
http.HandleFunc("/webhook", handleWebhook)
http.HandleFunc("/check-payment", handleCheckPayment)
http.HandleFunc("/user-stats", handleUserStats)
http.HandleFunc("/health", handleHealth)
```

No middleware chaining — CORS is applied per-handler via `enableCORS(w)` calls.

---

## Dependencies

### Client (`package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 18.2.0 | UI framework |
| `react-dom` | 18.2.0 | DOM rendering |
| `@crxjs/vite-plugin` | 2.0.0-beta.23 | Extension bundling |
| `@vitejs/plugin-react` | 4.2.1 | React/JSX support |
| `vite` | 5.0.0 | Build tool |
| `@types/chrome` | 0.0.260 | Chrome API types |
| `@types/react` | 18.2.43 | React types |
| `@types/react-dom` | 18.2.17 | ReactDOM types |
| `typescript` | 5.3.0 | Type checking |

### Server (`go.mod`)

| Module | Purpose |
|--------|---------|
| `github.com/aws/aws-sdk-go-v2` | AWS SDK core |
| `github.com/aws/aws-sdk-go-v2/config` | AWS config loading |
| `github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue` | DynamoDB marshaling |
| `github.com/aws/aws-sdk-go-v2/service/dynamodb` | DynamoDB client |
| `github.com/stripe/stripe-go/v76` | Stripe SDK |

---

## Build & Run

### Client
```bash
cd client
npm install
npm run dev        # Dev mode with HMR
npm run build      # Production build to dist/
```

Load `client/dist/` as an unpacked extension in `chrome://extensions`.

### Server
```bash
cd server
cp .env.example .env   # Fill in real values
go run main.go
```

Requires:
- AWS credentials configured (via env vars, `~/.aws/credentials`, or IAM role)
- DynamoDB table `UndriftPayments` created in the configured region
- Stripe API keys
