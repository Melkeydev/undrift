# Security

## Threat Model

Undrift processes real payments. The primary assets to protect are:
1. **Payment integrity** — users should only be charged when they consent, and blocks should only break after real payment
2. **User data** — payment history and spending data
3. **Stripe credentials** — API keys and webhook secrets

---

## Current Vulnerabilities

### Critical

| ID | Vulnerability | OWASP Category | Location |
|----|--------------|----------------|----------|
| SEC-01 | Unsigned webhooks accepted | Broken Authentication | `server/main.go` webhook handler |
| SEC-02 | Open CORS (`*`) | Security Misconfiguration | `server/main.go` `enableCORS()` |
| SEC-03 | No authentication | Broken Authentication | Entire system |
| SEC-04 | No request validation | Injection | `server/main.go` all handlers |

### High

| ID | Vulnerability | OWASP Category | Location |
|----|--------------|----------------|----------|
| SEC-05 | No rate limiting | Broken Access Control | `server/main.go` all endpoints |
| SEC-06 | No request body size limit | Security Misconfiguration | `server/main.go` POST handlers |
| SEC-07 | User stats exposed without auth | Broken Access Control | `/user-stats` endpoint |

### Medium

| ID | Vulnerability | OWASP Category | Location |
|----|--------------|----------------|----------|
| SEC-08 | No CSRF protection | Broken Access Control | All POST endpoints |
| SEC-09 | No input sanitization on custom sites | Injection | `client/src/popup/Popup.tsx` |
| SEC-10 | Secrets in env vars without validation | Security Misconfiguration | `server/main.go` startup |

---

## Detailed Analysis

### SEC-01: Webhook Signature Bypass

The webhook handler checks if `STRIPE_WEBHOOK_SECRET` is set. If empty, it falls back to `json.Unmarshal` on the raw payload without any signature verification.

**Attack:** Send a POST to `/webhook` with a crafted `checkout.session.completed` event containing any session ID → that payment is marked as paid → user breaks block for free.

**Mitigation:**
- Always require `STRIPE_WEBHOOK_SECRET`
- Fail server startup if the secret is not configured
- Never fall back to unsigned processing

### SEC-02: Unrestricted CORS

`Access-Control-Allow-Origin: *` means any website can call the Undrift API from client-side JavaScript.

**Attack:** A malicious page loads in a tab, calls `/create-checkout-session` with a stolen/guessed UUID, or reads `/user-stats` data.

**Mitigation:**
- Set CORS to `chrome-extension://<extension-id>` only
- Or implement token-based auth that CORS alone wouldn't bypass

### SEC-03: No Authentication

User identity is a client-generated UUID with no verification.

**Attack vectors:**
- Impersonate any user by sending their UUID
- Query any user's stats if UUID is known
- No way to revoke access

**Mitigation:** See [auth.md](./auth.md) for options.

### SEC-05: No Rate Limiting

All endpoints accept unlimited requests.

**Attack vectors:**
- Spam `/create-checkout-session` to generate thousands of Stripe sessions (potential Stripe API rate limit issues and DynamoDB costs)
- DDoS the server
- Exhaust DynamoDB read capacity via `/user-stats` scans

**Mitigation:**
- Per-IP rate limiting (e.g., 10 requests/minute on payment endpoints)
- Per-user rate limiting on authenticated endpoints
- Consider a reverse proxy (nginx, Cloudflare) for basic protection

---

## Stripe-Specific Security

### API Key Exposure
The Stripe secret key is loaded from environment variables. It is not exposed to the client (the client only sees the checkout URL, not the key).

### PCI Compliance
Stripe Checkout is used (hosted payment page). No card data touches the Undrift server, so PCI DSS scope is minimal (SAQ A).

### Webhook Security
When properly configured with `STRIPE_WEBHOOK_SECRET`, Stripe webhooks are verified using HMAC-SHA256 signatures. The current implementation makes this optional, which is the vulnerability.

---

## Data Privacy

### Data Collected
- Anonymous UUID (no PII)
- Payment amounts and timestamps
- Stripe session IDs

### Data Not Collected
- No names, emails, or addresses (Stripe handles this)
- No browsing history (blocked sites are only stored locally in the extension)
- No analytics or tracking

### Data Retention
- DynamoDB records are never deleted
- No data export or deletion mechanism exists
- If GDPR/CCPA applies (it likely does once real users are added), a data deletion process is needed

---

## Recommended Security Roadmap

### Phase 1: Critical Fixes (Before any public use)
1. Require webhook signature verification
2. Restrict CORS to extension origin
3. Add request body size limits
4. Validate all input parameters

### Phase 2: Hardening
5. Add rate limiting
6. Add request timeouts (replace `context.TODO()`)
7. Add structured logging for security events
8. Validate UUID format on all endpoints

### Phase 3: Authentication
9. Implement user authentication (see [auth.md](./auth.md))
10. Add CSRF tokens
11. Implement proper access control on user-specific endpoints
