# Stripe Integration

> **DEPRECATED:** This document describes the v1 payment system which has been removed. Undrift v2 replaces the $1 payment mechanism with QUITTR-inspired behavioral interventions (see [interventions.md](./interventions.md)). This document is kept for historical reference only.

## Overview

Undrift v1 used Stripe Checkout to process $1 payments when a user wanted to "break" a focus block. The integration used Stripe's hosted checkout page (no PCI compliance burden on the server).

---

## Payment Flow

```
┌─────────────┐     POST /create-checkout-session     ┌──────────────┐
│  Blocked     │ ──────────────────────────────────►  │  Go Server   │
│  Page        │  ◄──── { sessionId, url }            │              │
│  (Extension) │                                       │              │
└──────┬───────┘                                       └──────┬───────┘
       │                                                      │
       │  window.open(url)                                    │ Stripe SDK:
       ▼                                                      │ Create Session
┌─────────────┐                                        ┌──────▼───────┐
│  Stripe     │                                        │  DynamoDB    │
│  Checkout   │                                        │  (paid:false)│
│  Page       │                                        └──────────────┘
└──────┬───────┘
       │  User pays
       ▼
┌─────────────┐     POST /webhook                     ┌──────────────┐
│  Stripe     │ ──────────────────────────────────►   │  Go Server   │
│  (Webhook)  │  checkout.session.completed            │              │
└─────────────┘                                        └──────┬───────┘
                                                              │
                                                       ┌──────▼───────┐
                                                       │  DynamoDB    │
                                                       │  (paid:true) │
                                                       └──────────────┘
       ┌─────────────┐
       │  Blocked     │  GET /check-payment (polling)
       │  Page        │ ──────────────────────────────►  { paid: true }
       │  (Extension) │
       └──────────────┘
              │
              ▼ END_SESSION → redirect to original URL
```

---

## Server-Side Implementation

### Stripe SDK
- **Package:** `github.com/stripe/stripe-go/v76`
- **API Key:** Set via `stripe.Key = os.Getenv("STRIPE_SECRET_KEY")`

### Checkout Session Creation

**Endpoint:** `POST /create-checkout-session`

```go
params := &stripe.CheckoutSessionParams{
    PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
    LineItems: []*stripe.CheckoutSessionLineItemParams{{
        PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
            Currency:   stripe.String("usd"),
            UnitAmount: stripe.Int64(100), // $1.00
            ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
                Name: stripe.String("Break Focus Block"),
            },
        },
        Quantity: stripe.Int64(1),
    }},
    Mode:       stripe.String(string(stripe.CheckoutSessionModePayment)),
    SuccessURL: stripe.String(successURL),
    CancelURL:  stripe.String(cancelURL),
}
```

**Key Details:**
- One-time payment mode (`payment`, not `subscription`)
- Card only (no Apple Pay, Google Pay, etc.)
- Single line item: "Break Focus Block" at $1.00 USD
- No customer object created (anonymous checkout)
- No metadata attached to the Stripe session

### Webhook Handler

**Endpoint:** `POST /webhook`
**Event:** `checkout.session.completed`

```go
// If webhook secret is set, verify signature
if webhookSecret != "" {
    event, err = webhook.ConstructEvent(payload, sigHeader, webhookSecret)
} else {
    // Falls back to unsigned — INSECURE
    json.Unmarshal(payload, &event)
}
```

On successful event:
1. Extract session ID from event data
2. Call `markPaymentPaid(sessionID)` → DynamoDB update

### Payment Status Check

**Endpoint:** `GET /check-payment?session_id={id}`

Reads the payment record from DynamoDB by `paymentId` (which equals the Stripe session ID) and returns `{ paid: boolean }`.

---

## Client-Side Implementation

### API Functions (`src/utils/api.ts`)

```typescript
// Create checkout session
createCheckoutSession(userId: string): Promise<{ sessionId: string, url: string }>

// Poll payment status
checkPayment(sessionId: string): Promise<{ paid: boolean }>
```

### Payment Trigger (`src/blocked/Blocked.tsx`)

1. Get/create anonymous user ID
2. Call `createCheckoutSession(userId)`
3. Open returned Stripe URL in new tab: `window.open(data.url)`
4. Start polling `checkPayment(sessionId)` every 2 seconds
5. When `paid === true`:
   - Send `END_SESSION` message to background service worker
   - Navigate to original blocked URL

---

## DynamoDB Record

```json
{
  "paymentId": "cs_test_abc123...",       // Stripe session ID (partition key)
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "stripeSessionId": "cs_test_abc123...", // Duplicated
  "amount": 100,                          // Cents
  "paid": false,                          // Updated to true via webhook
  "createdAt": 1700000000                 // Unix timestamp (seconds)
}
```

Note: `paymentId` and `stripeSessionId` are redundant — both store the Stripe session ID.

---

## Configuration

| Environment Variable | Required | Description |
|---------------------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Should be | Webhook endpoint signing secret (`whsec_...`) |
| `SUCCESS_URL` | No | Redirect after successful payment (default: `example.com`) |
| `CANCEL_URL` | No | Redirect after cancelled payment (default: `example.com`) |

---

## Assessment: Is Stripe Checkout the Right Choice?

**Yes.** For a quick $1 one-time payment, Stripe Checkout is the best fit among Stripe's products:

| Approach | Speed for user | Complexity | Fits $1 one-time? |
|----------|---------------|------------|-------------------|
| **Stripe Checkout (current)** | ~15-30s first time, ~10s repeat | Low | Yes |
| Stripe Payment Links | ~15-30s | Very low | Yes, but no programmatic session creation |
| Stripe Elements (embedded) | ~10-15s | Medium-High (PCI SAQ A-EP) | Overkill |
| Stripe Payment Intents (custom) | ~10-15s | High | Overkill |

**Why Checkout wins for this use case:**
- **Zero PCI burden** — card data never touches the server (SAQ A)
- **Stripe handles the entire payment UI** — no custom form to build or maintain
- **Supports saved payment methods** — returning users are faster
- **Link (Stripe's 1-click checkout)** — auto-enabled on Checkout, drastically speeds up repeat purchases
- **Low code surface** — ~50 lines of server code total

### Critical Improvement: Enable More Payment Methods

The current code explicitly restricts payment methods to card only (`main.go:119`):

```go
PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
```

**Removing this line entirely** would let Stripe Checkout auto-enable all compatible methods:
- **Link** — Stripe's 1-click checkout (email + saved cards, ~3 seconds for returning users)
- **Apple Pay / Google Pay** — instant tap on supported devices
- **Other regional methods** as Stripe adds them

This single change would make the "break block for $1" experience near-instant for returning users, which is exactly what the product needs — the payment should feel like a quick penalty, not a checkout ordeal.

---

## Issues

1. **Webhook body read is unsafe** — `r.Body.Read(payload)` can return partial data, causing truncated payloads and silently dropped webhooks (see [bugs.md](./bugs.md#bug-016))
2. **Webhook signature is optional** — if `STRIPE_WEBHOOK_SECRET` is empty, webhooks are processed unsigned (see [bugs.md](./bugs.md#bug-001))
3. **DynamoDB save failure silently ignored** — if `savePayment` fails, the server still returns the checkout URL; user pays but `check-payment` always returns false (see [bugs.md](./bugs.md#bug-017))
4. **Card-only payment methods** — `PaymentMethodTypes` is hardcoded to `["card"]`, blocking Link, Apple Pay, and Google Pay
5. **No Stripe customer object** — can't link repeat payments to the same payer
6. **No metadata on Stripe session** — can't correlate payments back to specific blocked sites or sessions
7. **Success/Cancel URLs are meaningless** — the user is paying in a new tab while the blocked page polls; the success page is never actually used by the flow
8. **Redundant fields** — `paymentId` and `stripeSessionId` always have the same value
9. **No idempotency** — if the webhook fires twice, `markPaymentPaid` runs twice (harmless but sloppy)
10. **No refund handling** — no webhook handler for `charge.refunded` or `checkout.session.expired`
11. **Polling inefficiency** — frontend polls every 2 seconds with no timeout (see [bugs.md](./bugs.md#bug-006))
