# Deployment

## Current State

There is no deployment infrastructure. No Dockerfiles, CI/CD pipelines, or infrastructure-as-code configuration exists.

---

## Components to Deploy

| Component | Type | Target |
|-----------|------|--------|
| Chrome Extension | Static build artifact | Chrome Web Store or sideloaded |
| Go Server | Binary / container | Cloud VM, container service, or serverless |
| DynamoDB Table | Managed service | AWS |
| Stripe Webhooks | External config | Stripe Dashboard |

---

## Server Deployment

### Requirements
- Go 1.23.2+ runtime (or compile to static binary)
- AWS credentials with DynamoDB access
- Network access to Stripe API and DynamoDB
- Publicly accessible URL for Stripe webhooks

### Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `STRIPE_SECRET_KEY` | Yes | `sk_test_...` (test) or `sk_live_...` (prod) |
| `STRIPE_WEBHOOK_SECRET` | Yes | `whsec_...` from Stripe Dashboard |
| `DYNAMODB_TABLE` | No | Defaults to `UndriftPayments` |
| `SUCCESS_URL` | Yes | Must be set to a real URL |
| `CANCEL_URL` | Yes | Must be set to a real URL |
| `PORT` | No | Defaults to `8080` |

### Build

```bash
cd server
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o undrift-server main.go
```

### Deployment Options

**Option A: AWS EC2 / Lightsail**
- Simple: upload binary, run as systemd service
- Manual scaling, patching, etc.

**Option B: AWS ECS / Fargate**
- Needs a Dockerfile (doesn't exist yet)
- Managed scaling, no server maintenance

**Option C: AWS Lambda + API Gateway**
- Would require refactoring handlers to Lambda format
- Most cost-effective for low traffic
- Natural fit since DynamoDB is already AWS

**Option D: Railway / Fly.io / Render**
- Simplest deployment experience
- Auto-deploy from Git
- Managed SSL, scaling

---

## Client Deployment

### Build

```bash
cd client
npm ci
npm run build
# Output: client/dist/
```

### Chrome Web Store Publishing

1. Zip `client/dist/` contents
2. Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
3. Fill in store listing (name, description, screenshots, icons)
4. Submit for review

**Review considerations:**
- `<all_urls>` permission will trigger manual review
- Must provide justification for broad host permissions
- Prepare privacy policy (handles payments)

### Sideloading (Development)

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `client/dist/` directory

---

## AWS Setup

### DynamoDB Table

```bash
aws dynamodb create-table \
  --table-name UndriftPayments \
  --attribute-definitions AttributeName=paymentId,AttributeType=S \
  --key-schema AttributeName=paymentId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### IAM Policy (minimum required)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/UndriftPayments"
    }
  ]
}
```

---

## Stripe Setup

### Test Mode
1. Use test API keys from Stripe Dashboard
2. Configure webhook endpoint: `https://<server-url>/webhook`
3. Subscribe to event: `checkout.session.completed`
4. Use test card: `4242 4242 4242 4242`

### Production Mode
1. Activate Stripe account (requires business details)
2. Switch to live API keys
3. Update webhook endpoint to production server URL
4. Update `SUCCESS_URL` and `CANCEL_URL`

---

## Missing Infrastructure

| Item | Status | Needed For |
|------|--------|-----------|
| Dockerfile | Missing | Container deployment |
| docker-compose.yml | Missing | Local dev environment |
| CI/CD pipeline | Missing | Automated testing and deployment |
| Infrastructure-as-code | Missing | Reproducible AWS setup |
| Monitoring/alerting | Missing | Production observability |
| Logging | Missing | Debugging and audit trail |
| SSL/TLS | Missing | HTTPS for the server |
| Domain name | Missing | Production URL |
| Health check integration | Partial | `/health` exists but no monitoring consumes it |

---

## Recommended Deployment Architecture

```
┌─────────────────────────────┐
│     Chrome Web Store        │
│     (Extension dist)        │
└─────────────┬───────────────┘
              │ HTTPS
              ▼
┌─────────────────────────────┐
│  Load Balancer / CDN        │
│  (Cloudflare / ALB)         │
│  SSL termination            │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Go Server                  │
│  (ECS Fargate / Fly.io)     │
│  Auto-scaling               │
└──────┬──────────────┬───────┘
       │              │
       ▼              ▼
┌────────────┐ ┌─────────────┐
│  DynamoDB  │ │  Stripe     │
│  (AWS)     │ │  (External) │
└────────────┘ └─────────────┘
```
