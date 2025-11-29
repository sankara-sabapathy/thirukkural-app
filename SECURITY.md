# Security Architecture & Implementation Guide

## Overview
This document outlines the enterprise-grade security measures implemented in the Thirukkural Daily application to protect against DDoS attacks, abuse, and cost-based attacks while minimizing operational costs.

## Table of Contents
1. [Security Layers](#security-layers)
2. [Sample Email Feature with Rate Limiting](#sample-email-feature-with-rate-limiting)
3. [API Gateway Throttling](#api-gateway-throttling)
4. [Cloudflare Integration (Recommended)](#cloudflare-integration-recommended)
5. [CloudFront Security](#cloudfront-security)
6. [Cost Analysis](#cost-analysis)
7. [Deployment Guide](#deployment-guide)

---

## Security Layers

The application implements a **defense-in-depth** strategy with multiple security layers:

```
User Request
    ↓
[1] Cloudflare (Free WAF, DDoS Protection) ← OPTIONAL BUT RECOMMENDED
    ↓
[2] CloudFront (AWS CDN with caching)
    ↓
[3] API Gateway (Throttling: 100 RPS, Burst: 200)
    ↓
[4] Lambda Functions
    ↓
[5] DynamoDB Rate Limiting (Sample Email: 1 per 24h per email)
```

---

## Sample Email Feature with Rate Limiting

### Purpose
Allows users to preview the daily email format without requiring authentication, while preventing abuse.

### Implementation

#### Backend: DynamoDB Rate Limiting
- **Table**: `RateLimitTable`
  - **Partition Key**: `pk` (String) - Format: `sample-email:{email}`
  - **TTL Attribute**: `ttl` - Automatic cleanup after 24 hours
  - **Billing Mode**: PAY_PER_REQUEST

#### Lambda Handler: `send-sample-email.ts`
```typescript
// Rate limiting logic
const rateLimitKey = `sample-email:${email}`;
const ttl = Math.floor(Date.now() / 1000) + 86400; // 24 hours

try {
    await docClient.send(new PutCommand({
        TableName: rateLimitTable,
        Item: { pk: rateLimitKey, ttl: ttl },
        ConditionExpression: 'attribute_not_exists(pk)', // Atomic check
    }));
} catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
        return createResponse(429, { 
            message: 'You can only send one sample email every 24 hours.' 
        });
    }
    throw err;
}
```

#### Frontend Integration
- **Endpoint**: `POST /sample-email`
- **Request Body**: `{ "email": "user@example.com" }`
- **Responses**:
  - `200 OK`: Email sent successfully
  - `400 Bad Request`: Invalid email format
  - `429 Too Many Requests`: Rate limit exceeded
  - `500 Internal Server Error`: Server error

#### UI Component
```typescript
// home.component.ts
sendSampleEmail() {
    if (!this.validateEmail(this.sampleEmail)) {
        this.showSnackBar('Please enter a valid email address', 'error');
        return;
    }

    this.isLoadingSample = true;
    this.apiService.sendSampleEmail(this.sampleEmail).subscribe({
        next: () => {
            this.showSnackBar('Sample email sent! Check your inbox.', 'success');
            this.sampleEmail = '';
        },
        error: (err) => {
            const msg = err.error?.message || 'Failed to send sample email.';
            this.showSnackBar(msg, 'error');
        }
    });
}
```

---

## API Gateway Throttling

### Configuration
```typescript
const api = new apigateway.RestApi(this, 'ThirukkuralApi', {
    deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100,    // Max 100 requests/second (steady state)
        throttlingBurstLimit: 200,   // Allow bursts up to 200 requests
        tracingEnabled: true,
    },
});
```

### Cost Protection
- **Throttled requests are billed** (~$3.50 per 1M requests)
- **Backend execution is NOT billed** (Lambda, DynamoDB, SES)
- **Example Attack Scenario**:
  - Without throttling: 1M malicious requests = ~$15+ (Lambda + DB + SES)
  - With throttling: 1M malicious requests = ~$3.50 (API requests only)

### Benefits
- ✅ **Free feature** (no additional AWS charges beyond request costs)
- ✅ Prevents Lambda/DynamoDB overload
- ✅ Automatic 429 responses for excess traffic
- ✅ Per-account, per-region limit

---

## Cloudflare Integration (Recommended)

### Why Cloudflare?
- **Free Tier includes**:
  - Unmetered DDoS protection
  - Web Application Firewall (WAF)
  - Bot detection and mitigation
  - SSL/TLS encryption
  - Caching and CDN
- **Cost Savings**: Blocks malicious traffic BEFORE it reaches AWS
- **No AWS WAF needed**: Saves ~$6-10/month

### Architecture
```
User → Cloudflare (Free WAF) → AWS API Gateway (with secret header check)
```

### Setup Guide

#### Phase 1: AWS Certificate & Custom Domain

1. **Create ACM Certificate**:
   ```bash
   # AWS Console → Certificate Manager (ACM)
   # Region: us-east-1 (for CloudFront) or your API region
   # Domain: api.krss.online
   # Validation: DNS (recommended)
   ```

2. **Update CDK Stack** (for API Gateway):
   ```typescript
   const apiDomain = new apigateway.DomainName(this, 'ApiDomain', {
       domainName: 'api.krss.online',
       certificate: acm.Certificate.fromCertificateArn(
           this, 
           'ApiCertificate', 
           'arn:aws:acm:REGION:ACCOUNT:certificate/ID'
       ),
       endpointType: apigateway.EndpointType.REGIONAL,
   });

   new apigateway.BasePathMapping(this, 'ApiMapping', {
       domainName: apiDomain,
       restApi: api,
   });
   ```

3. **Deploy**:
   ```bash
   cd backend
   cdk deploy
   ```
   
   Note the **Target Domain Name** (e.g., `d-12345.execute-api.us-east-1.amazonaws.com`)

#### Phase 2: Cloudflare DNS Configuration

1. **Add DNS Record**:
   - Type: `CNAME`
   - Name: `api` (for `api.krss.online`)
   - Target: AWS Target Domain Name from Phase 1
   - **Proxy Status**: ☁️ **Proxied** (Orange Cloud) ← CRITICAL!

2. **SSL/TLS Settings**:
   - Navigate to: SSL/TLS → Overview
   - Mode: **Full** or **Full (Strict)**

#### Phase 3: Secret Header (Security Handshake)

1. **Generate Secret Key**:
   ```bash
   # Use a password generator or:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Cloudflare Transform Rule**:
   - Navigate to: Rules → Transform Rules → Modify Request Header
   - **Rule Name**: `Add API Secret`
   - **When**: `Hostname equals api.krss.online`
   - **Then**: Set static header
     - Header: `Referer`
     - Value: `YOUR_GENERATED_SECRET_KEY`
   - Save

3. **Update CDK Stack** (Uncomment and configure):
   ```typescript
   const api = new apigateway.RestApi(this, 'ThirukkuralApi', {
       // ... existing config ...
       policy: new iam.PolicyDocument({
           statements: [
               new iam.PolicyStatement({
                   effect: iam.Effect.ALLOW,
                   principals: [new iam.AnyPrincipal()],
                   actions: ['execute-api:Invoke'],
                   resources: ['execute-api:/*'],
               }),
               new iam.PolicyStatement({
                   effect: iam.Effect.DENY,
                   principals: [new iam.AnyPrincipal()],
                   actions: ['execute-api:Invoke'],
                   resources: ['execute-api:/*'],
                   conditions: {
                       StringNotEquals: {
                           'aws:Referer': 'YOUR_GENERATED_SECRET_KEY'
                       }
                   }
               })
           ]
       })
   });
   ```

4. **Deploy**:
   ```bash
   cd backend
   cdk deploy
   ```

#### Phase 4: Update Frontend Configuration

Update `environment.prod.ts`:
```typescript
export const environment = {
    production: true,
    api: {
        baseUrl: 'https://api.krss.online/prod', // Cloudflare-proxied domain
        endpoints: {
            profile: '/profile',
            sampleEmail: '/sample-email'
        }
    },
    // ... cognito config ...
};
```

### Testing

1. **Test via Cloudflare** (Should work):
   ```bash
   curl https://api.krss.online/prod/sample-email \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

2. **Test Direct to AWS** (Should be blocked with 403):
   ```bash
   curl https://d-12345.execute-api.us-east-1.amazonaws.com/prod/sample-email \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

---

## CloudFront Security

### Current Configuration
- **S3 Bucket**: Private (no public access)
- **Origin Access Control (OAC)**: CloudFront-only access
- **HTTPS**: Enforced via `ViewerProtocolPolicy.REDIRECT_TO_HTTPS`
- **Custom Domain**: `thirukkural.krss.online`
- **Certificate**: ACM certificate in us-east-1

### Cloudflare for CloudFront (Optional)
You can also proxy CloudFront through Cloudflare for additional protection:

1. **Add DNS Record**:
   - Type: `CNAME`
   - Name: `thirukkural` (or `@` for root)
   - Target: CloudFront distribution domain
   - Proxy Status: ☁️ **Proxied**

2. **Benefits**:
   - Free DDoS protection for static assets
   - Additional caching layer
   - Bot protection

### Data Transfer Cost Protection
- ✅ **12MB JSON dataset is NOT served via CloudFront** (seeded to DynamoDB only)
- ✅ Frontend assets are cached (reduces origin requests)
- ✅ Cloudflare caching reduces CloudFront data transfer costs

---

## Cost Analysis

### Current Monthly Costs (Estimated)

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| **API Gateway** | 100 RPS throttling | ~$3.50/1M requests |
| **Lambda** | 3 functions, low traffic | ~$0.20 (Free Tier) |
| **DynamoDB** | PAY_PER_REQUEST | ~$1.25 (Free Tier) |
| **SES** | Email sending | $0.10/1000 emails |
| **CloudFront** | CDN + Custom Domain | ~$1.00 (Free Tier) |
| **Cognito** | User authentication | Free (< 50K MAU) |
| **Cloudflare** | WAF + DDoS Protection | **$0.00 (Free)** |
| **ACM Certificates** | SSL/TLS | **$0.00 (Free)** |
| **Route53** | Hosted Zone | $0.50/month |

**Total Estimated**: **~$2-5/month** (with low traffic)

### Attack Cost Comparison

**Scenario**: 1 million malicious requests to `/sample-email`

| Protection Level | Cost Impact |
|-----------------|-------------|
| **No Protection** | ~$15+ (Lambda + DynamoDB + SES) |
| **API Gateway Throttling Only** | ~$3.50 (API requests only) |
| **Cloudflare + Throttling** | ~$0.00 (blocked before AWS) |

### AWS WAF Alternative (Not Implemented)
- **Cost**: ~$6-10/month
- **Reason for Exclusion**: Cloudflare Free Tier provides equivalent protection

---

## Deployment Guide

### Prerequisites
- AWS Account with CDK configured
- Node.js 20.x
- Domain registered (e.g., `krss.online`)
- Cloudflare account (free tier)

### Step 1: Deploy Backend Infrastructure
```bash
cd backend

# Install dependencies
npm install

# Set environment variables
export SES_SENDER_EMAIL="thirukkural-daily@krss.online"
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Deploy
cdk deploy
```

### Step 2: Configure Certificates
1. Create ACM certificates in AWS Console:
   - `thirukkural.krss.online` (us-east-1 for CloudFront)
   - `api.krss.online` (your API region)
2. Validate via DNS
3. Update CDK stack with certificate ARNs
4. Redeploy: `cdk deploy`

### Step 3: Configure Cloudflare
Follow the [Cloudflare Integration](#cloudflare-integration-recommended) guide above.

### Step 4: Update Frontend Configuration
```bash
cd frontend

# Update environment.prod.ts with:
# - Cloudflare API domain (api.krss.online)
# - Cognito configuration from CDK outputs
# - CloudFront domain (thirukkural.krss.online)

# Build
npm run build

# Deploy to S3
aws s3 sync dist/frontend/browser s3://YOUR_BUCKET_NAME --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### Step 5: Verify Security

1. **Test Rate Limiting**:
   ```bash
   # Should succeed
   curl -X POST https://api.krss.online/prod/sample-email \
     -H "Content-Type: application/json" \
     -d '{"email":"test1@example.com"}'
   
   # Should return 429 (same email within 24h)
   curl -X POST https://api.krss.online/prod/sample-email \
     -H "Content-Type: application/json" \
     -d '{"email":"test1@example.com"}'
   ```

2. **Test Cloudflare Protection** (if configured):
   ```bash
   # Should be blocked (403)
   curl -X POST https://d-12345.execute-api.us-east-1.amazonaws.com/prod/sample-email \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

3. **Test Throttling**:
   ```bash
   # Send 300 requests rapidly (should see 429 responses)
   for i in {1..300}; do
     curl -X POST https://api.krss.online/prod/sample-email \
       -H "Content-Type: application/json" \
       -d "{\"email\":\"test$i@example.com\"}" &
   done
   ```

---

## Monitoring & Alerts

### CloudWatch Metrics to Monitor
1. **API Gateway**:
   - `Count` (total requests)
   - `4XXError` (client errors, including 429)
   - `5XXError` (server errors)
   - `Latency`

2. **Lambda**:
   - `Invocations`
   - `Errors`
   - `Duration`
   - `Throttles`

3. **DynamoDB**:
   - `ConsumedReadCapacityUnits`
   - `ConsumedWriteCapacityUnits`
   - `UserErrors` (ConditionalCheckFailedException for rate limiting)

### Recommended Alarms
```typescript
// Example: Alert on excessive 4XX errors (potential attack)
new cloudwatch.Alarm(this, 'HighClientErrors', {
    metric: api.metricClientError(),
    threshold: 100,
    evaluationPeriods: 1,
    alarmDescription: 'Alert when API receives >100 4XX errors in 1 minute',
});
```

---

## Security Best Practices

### ✅ Implemented
- [x] DynamoDB-based rate limiting with TTL
- [x] API Gateway throttling (100 RPS, 200 burst)
- [x] CloudFront with OAC (no public S3 access)
- [x] HTTPS enforcement
- [x] Cognito authentication for sensitive endpoints
- [x] CORS configuration
- [x] Environment-based configuration
- [x] Cloudflare integration support

### 🔄 Optional Enhancements
- [ ] AWS WAF (if not using Cloudflare)
- [ ] Google reCAPTCHA v3 for sample email form
- [ ] IP-based rate limiting (in addition to email-based)
- [ ] Geo-blocking for CloudFront
- [ ] AWS Shield Advanced (enterprise DDoS protection)
- [ ] VPC for Lambda functions
- [ ] Secrets Manager for sensitive credentials

### 📋 Maintenance Checklist
- [ ] Rotate Cloudflare secret header quarterly
- [ ] Review CloudWatch logs weekly
- [ ] Monitor AWS billing dashboard
- [ ] Update dependencies monthly
- [ ] Review and update throttling limits based on traffic patterns
- [ ] Test disaster recovery procedures

---

## Troubleshooting

### Issue: Sample Email Returns 429 Immediately
**Cause**: DynamoDB rate limit entry exists
**Solution**: 
```bash
# Check DynamoDB for existing entry
aws dynamodb get-item \
  --table-name RateLimitTable \
  --key '{"pk":{"S":"sample-email:user@example.com"}}'

# Delete entry (for testing only)
aws dynamodb delete-item \
  --table-name RateLimitTable \
  --key '{"pk":{"S":"sample-email:user@example.com"}}'
```

### Issue: API Returns 403 After Cloudflare Setup
**Cause**: Secret header mismatch or policy not deployed
**Solution**:
1. Verify Cloudflare Transform Rule is active
2. Check secret header matches in both Cloudflare and CDK
3. Ensure CDK policy is uncommented and deployed
4. **Verify API Gateway Resource Policy in AWS Console**

### Issue: High API Gateway Costs
**Cause**: Excessive traffic or attack
**Solution**:
1. Check CloudWatch metrics for traffic patterns
2. Lower throttling limits temporarily
3. Enable Cloudflare proxy if not already active
4. Review API Gateway access logs

### Issue: CORS Errors (No 'Access-Control-Allow-Origin' Header)
**Cause**: API Gateway blocking request before CORS check
**Solution**:
1. **Verify Cloudflare DNS** is set to **Proxied (Orange Cloud)** for `api.krss.online`
2. **Check Transform Rule** is adding the `Referer` header
3. **Test the policy**: Direct requests to API Gateway should fail with 403
4. **Verify Resource Policy** in AWS Console (see below)

**Steps to Verify:**
```bash
# 1. Check DNS is proxied through Cloudflare
nslookup api.krss.online
# Should show Cloudflare IPs (104.21.x.x or 172.67.x.x)

# 2. Test direct access (should fail with 403)
curl https://[your-api-gateway-id].execute-api.region.amazonaws.com/prod/profile
# Expected: 403 Forbidden

# 3. Test via Cloudflare (should work)
curl https://api.krss.online/prod/sample-email -X POST -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
```

### Issue: SSL Error 525 (SSL Handshake Failed)
**Cause**: Cloudflare cannot connect to API Gateway origin
**Solutions**:

**1. Check Cloudflare SSL/TLS Mode**
- Go to Cloudflare → SSL/TLS → Overview
- Set to **"Full"** (not "Full Strict")

**2. Verify DNS CNAME Target (CRITICAL)**
- **WRONG**: `api` CNAME → `abc123.execute-api.ap-south-1.amazonaws.com` (raw API endpoint)
- **CORRECT**: `api` CNAME → `d-xyz123.execute-api.ap-south-1.amazonaws.com` (custom domain endpoint)

**How to get the correct endpoint:**
1. AWS Console → API Gateway → **Custom domain names**
2. Click on `api.krss.online`
3. Copy the **"API Gateway domain name"** (starts with `d-`)
4. Update Cloudflare CNAME to this value

**3. Verify API Gateway Custom Domain is Deployed**
```bash
# AWS Console → API Gateway → Custom domain names
# Should show: api.krss.online with status "Available"
```

### Issue: Website Not Loading (thirukkural.krss.online)
**Cause**: DNS not configured or SSL issues
**Solution**:

**1. Check DNS Configuration**
```bash
nslookup thirukkural.krss.online
# Should resolve to CloudFront IPs (starts with 2600:9000) if DNS Only
# OR Cloudflare IPs (104.21.x.x) if Proxied
```

**2. Verify Cloudflare Settings**
- **DNS Only (Grey Cloud)**: Direct to CloudFront (simpler, recommended)
  - CNAME: `thirukkural` → `d232e1w18ndbh2.cloudfront.net`
  - Proxy: **DNS Only**
  
- **Proxied (Orange Cloud)**: Through Cloudflare (more secure, complex)
  - Requires Cloudflare Origin Certificate
  - Set SSL/TLS mode to **Full**

**3. Clear DNS Cache**
```powershell
ipconfig /flushdns
```

**4. Verify CloudFront Alternate Domain Name**
- AWS Console → CloudFront → Distributions
- General → Alternate domain names (CNAMEs)
- Should list: `thirukkural.krss.online`

### Issue: Deployment Warning "CLOUDFLARE_SECRET_KEY not provided"
**Cause**: Environment variable not loaded during deployment
**Solution**:

**Local Deployment:**
```bash
# 1. Ensure .env file exists in backend/ folder
cd backend
cat .env  # Should show CLOUDFLARE_SECRET_KEY=...

# 2. Deploy from backend folder
cdk deploy
```

**GitHub Actions Deployment:**
1. Go to Repository → Settings → Secrets and variables → Actions
2. **Secrets** tab: Verify `CLOUDFLARE_SECRET_KEY` exists
3. **Variables** tab: Verify all config variables exist
4. Check workflow file has `env:` block in deploy step

**Verify Policy is Applied:**
```bash
# AWS Console → API Gateway → Thirukkural Service → Resource Policy
# Should show JSON with "StringNotEquals" and "aws:Referer"
```

### Issue: GitHub Actions Not Triggering Automatically
**Cause**: Workflow file not committed or branch mismatch
**Solution**:

1. **Verify workflow is committed to master/main:**
```bash
git status
git log -1 .github/workflows/backend-deploy.yml
```

2. **Check branch name matches:**
```yaml
on:
  push:
    branches: [ master ]  # Change to 'main' if using main branch
```

3. **Verify GitHub Actions permissions:**
- Repository → Settings → Actions → General
- Allow all actions and reusable workflows
- Read and write permissions

4. **Test auto-deploy:**
```bash
# Make a change in backend folder
echo "# Test" >> backend/README.md
git add backend/README.md
git commit -m "Test auto-deploy"
git push origin master
```

---

## Environment Variables Management

### **Sensitive Secrets (GitHub Secrets)**
These should be stored in **GitHub Settings > Secrets and variables > Actions > Secrets**:

| Variable Name | Description | Example |
|--------------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `abc123.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-xyz...` |
| `CLOUDFLARE_SECRET_KEY` | Secret for API Gateway protection | `dee875b3aaf...` (64 chars) |
| `AWS_ACCESS_KEY_ID` | AWS credentials for deployment | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtn...` |

### **Configuration Variables (GitHub Variables)**
These should be stored in **GitHub Settings > Secrets and variables > Actions > Variables**:

| Variable Name | Description | Example |
|--------------|-------------|---------|
| `BASE_DOMAIN` | Root domain name | `krss.online` |
| `SES_SENDER_EMAIL` | Verified SES email | `thirukkural-daily@krss.online` |
| `ACM_CERTIFICATE_ARN_API` | API Gateway cert (regional) | `arn:aws:acm:ap-south-1:...` |
| `ACM_CERTIFICATE_ARN_CLOUDFRONT` | CloudFront cert (us-east-1) | `arn:aws:acm:us-east-1:...` |
| `API_BASE_URL` | Production API endpoint | `https://api.krss.online` ⚠️ **No /prod suffix** |
| `COGNITO_USER_POOL_ID` | Cognito pool ID | `ap-south-1_g6cAch9nf` |
| `COGNITO_WEB_CLIENT_ID` | Cognito client ID | `5bjct26m4mgt914kp0rmjfaad4` |
| `COGNITO_DOMAIN` | Cognito domain | `thirukkural-app-123.auth.ap-south-1.amazoncognito.com` |
| `COGNITO_REDIRECT_SIGNIN` | OAuth callback | `https://thirukkural.krss.online/callback` |
| `COGNITO_REDIRECT_SIGNOUT` | OAuth logout redirect | `https://thirukkural.krss.online/` |
| `S3_BUCKET_NAME` | Frontend S3 bucket | Output from CDK deploy |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution | Output from CDK deploy |

### **Local Development Setup**

**Backend `.env` file:**
```bash
# In backend/.env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
CLOUDFLARE_SECRET_KEY=your_64_char_secret
SES_SENDER_EMAIL=thirukkural-daily@krss.online
BASE_DOMAIN=krss.online
ACM_CERTIFICATE_ARN_API=arn:aws:acm:region:account:certificate/id
ACM_CERTIFICATE_ARN_CLOUDFRONT=arn:aws:acm:us-east-1:account:certificate/id
```

**Frontend `.env` file:**
```bash
# In frontend/.env
API_BASE_URL=https://api.krss.online
COGNITO_USER_POOL_ID=ap-south-1_xxxxx
COGNITO_WEB_CLIENT_ID=xxxxxxxxx
COGNITO_DOMAIN=thirukkural-app-xxx.auth.region.amazoncognito.com
COGNITO_REDIRECT_SIGNIN=https://thirukkural.krss.online/callback
COGNITO_REDIRECT_SIGNOUT=https://thirukkural.krss.online/
```

**⚠️ Important: API Base URL Configuration**

The `API_BASE_URL` should **NOT** include the `/prod` suffix when using a custom domain. Here's why:

**With Custom Domain (api.krss.online):**
- ✅ Correct: `https://api.krss.online`
- ❌ Wrong: `https://api.krss.online/prod`

**With Raw API Gateway Endpoint:**
- ✅ Correct: `https://abc123.execute-api.region.amazonaws.com/prod`

**Explanation:**
When you configure a custom domain with API Gateway Base Path Mapping, AWS automatically routes requests to the specified stage (`prod`). The mapping is:
- Request: `https://api.krss.online/sample-email`
- AWS internally routes to: `[API-ID]/prod/sample-email`

If you include `/prod` in your base URL, requests would try to access `/prod/prod/sample-email`, resulting in 404 errors.

**Important**: Both `.env` files are in `.gitignore` and should never be committed!

---

## GitHub Actions Configuration

### **Backend Deployment Workflow**

File: `.github/workflows/backend-deploy.yml`

**Triggers:**
- Automatic: Push to `master` branch when `backend/**` files change
- Manual: Workflow dispatch

**Environment Variables Mapping:**
```yaml
- name: Deploy CDK Stack
  run: npx cdk deploy --require-approval never
  env:
    # Secrets (encrypted)
    GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
    GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
    CLOUDFLARE_SECRET_KEY: ${{ secrets.CLOUDFLARE_SECRET_KEY }}
    
    # Variables (configuration)
    SES_SENDER_EMAIL: ${{ vars.SES_SENDER_EMAIL }}
    BASE_DOMAIN: ${{ vars.BASE_DOMAIN }}
    ACM_CERTIFICATE_ARN_API: ${{ vars.ACM_CERTIFICATE_ARN_API }}
    ACM_CERTIFICATE_ARN_CLOUDFRONT: ${{ vars.ACM_CERTIFICATE_ARN_CLOUDFRONT }}
```

### **Frontend Deployment Workflow**

File: `.github/workflows/frontend-deploy.yml`

**Triggers:**
- Automatic: Push to `master` branch when `frontend/**` files change
- Manual: Workflow dispatch

**Environment Variables Mapping:**
```yaml
- name: Build
  run: npm run build -- --configuration production
  env:
    # All from Variables (non-sensitive config)
    API_BASE_URL: ${{ vars.API_BASE_URL }}
    COGNITO_USER_POOL_ID: ${{ vars.COGNITO_USER_POOL_ID }}
    COGNITO_WEB_CLIENT_ID: ${{ vars.COGNITO_WEB_CLIENT_ID }}
    COGNITO_DOMAIN: ${{ vars.COGNITO_DOMAIN }}
    COGNITO_REDIRECT_SIGNIN: ${{ vars.COGNITO_REDIRECT_SIGNIN }}
    COGNITO_REDIRECT_SIGNOUT: ${{ vars.COGNITO_REDIRECT_SIGNOUT }}
```

**Build Script:**
The frontend uses a pre-build script (`scripts/set-env.js`) to generate `environment.prod.ts` from environment variables:
```json
{
  "scripts": {
    "config": "node scripts/set-env.js",
    "build": "npm run config && ng build"
  }
}
```

---

## Complete Cloudflare Setup Guide

### **Phase 1: DNS Configuration**

#### **For Frontend (thirukkural.krss.online)**
1. **Cloudflare** → **DNS** → **Records**
2. **Add CNAME Record:**
   - **Type**: CNAME
   - **Name**: `thirukkural`
   - **Target**: `d232e1w18ndbh2.cloudfront.net` (your CloudFront domain)
   - **Proxy Status**: **DNS Only (Grey Cloud)** 🌐 (recommended for simplicity)
   - **TTL**: Auto
3. **Save**

#### **For API (api.krss.online)**
1. **Cloudflare** → **DNS** → **Records**
2. **Add CNAME Record:**
   - **Type**: CNAME
   - **Name**: `api`
   - **Target**: `d-xyz123.execute-api.ap-south-1.amazonaws.com` ⚠️ **CRITICAL: Use custom domain endpoint, NOT raw execute-api endpoint**
   - **Proxy Status**: **Proxied (Orange Cloud)** ☁️ (required for security)
   - **TTL**: Auto
3. **Save**

**How to get the correct API endpoint:**
```bash
# AWS Console → API Gateway → Custom domain names → api.krss.online
# Look for "API Gateway domain name" (starts with d-)
```

### **Phase 2: SSL/TLS Configuration**

1. **Cloudflare** → **SSL/TLS** → **Overview**
2. **Set encryption mode**:
   - For API: **Full** (not Full Strict)
   - For Frontend: **Full** or **Flexible**
3. **Save**

**Why "Full" and not "Full Strict"?**
- Full Strict requires Cloudflare to validate the origin certificate
- API Gateway uses AWS-issued certificates that Cloudflare may not fully trust
- "Full" still encrypts the connection but is more lenient

### **Phase 3: Transform Rules (API Security)**

1. **Cloudflare** → **Rules** → **Transform Rules**
2. **Create Transform Rule** → **Modify Request Header**
3. **Configure:**
   - **Rule Name**: `Add API Secret`
   - **When incoming requests match**:
     - Field: `Hostname`
     - Operator: `equals`
     - Value: `api.krss.online`
   - **Then modify headers**:
     - Action: **Set static**
     - **Header name**: `Referer`
     - **Value**: `dee875b3aafcbdae8f255c7cc8a71d408a94a2b933f6f280d0cf9f8d066acdeb` (your secret key)
4. **Deploy**

**Security Note**: This header is checked by API Gateway's Resource Policy. Requests without it are denied with 403.

### **Phase 4: Verification**

#### **Verify DNS Propagation**
```powershell
# Frontend
nslookup thirukkural.krss.online
# Should show CloudFront IPs (2600:9000:...)

# API
nslookup api.krss.online
# Should show Cloudflare IPs (104.21.x.x, 172.67.x.x)
```

#### **Verify SSL**
```bash
# Both should show valid SSL certificate
curl -I https://thirukkural.krss.online
curl -I https://api.krss.online
```

#### **Verify API Security**
```powershell
# Direct access to API Gateway (should FAIL with 403)
Invoke-WebRequest -Uri "https://[api-gateway-id].execute-api.region.amazonaws.com/prod/profile"

# Access via Cloudflare (should SUCCEED or return proper API response)
Invoke-WebRequest -Uri "https://api.krss.online/prod/sample-email" -Method POST -Body '{"email":"test@example.com"}' -ContentType "application/json"
```

### **Phase 5: Troubleshooting Cloudflare Issues**

**Issue**: Error 525 (SSL Handshake Failed)
- ✅ Set SSL/TLS mode to **Full** (not Full Strict)
- ✅ Verify CNAME points to **custom domain endpoint** (starts with `d-`)
- ✅ Ensure API Gateway custom domain is deployed and active

**Issue**: Error 522 (Connection Timed Out)
- ✅ Check API Gateway is deployed and responding
- ✅ Verify security groups/NACL rules (if using VPC)

**Issue**: CORS errors persist
- ✅ Ensure API is **Proxied (Orange Cloud)**
- ✅ Verify Transform Rule is **Deployed** and **Active**
- ✅ Check API Gateway Resource Policy is applied

**Issue**: DNS changes not taking effect
- ✅ Wait 5-15 minutes for global propagation
- ✅ Clear local DNS cache: `ipconfig /flushdns`
- ✅ Test in incognito mode or on mobile data

---

## Security Architecture Diagram

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ╰─────────────────┬────────────────────┐
                         │                    │
                    [Frontend]            [API Calls]
                         │                    │
                         ▼                    ▼
              ┌──────────────────┐  ┌──────────────────┐
              │   Cloudflare     │  │   Cloudflare     │
              │  (DNS Only) 🌐   │  │  (Proxied) ☁️    │
              │                  │  │  + Transform     │
              └────────┬─────────┘  │  Rule (Referer)  │
                       │            └────────┬─────────┘
                       ▼                     │
              ┌──────────────────┐           │
              │   CloudFront     │           │
              │  + ACM Cert      │           │
              │  + OAC           │           │
              └────────┬─────────┘           │
                       │                     ▼
                       ▼            ┌──────────────────┐
              ┌──────────────────┐  │  API Gateway     │
              │   S3 Bucket      │  │  + Custom Domain │
              │  (Private)       │  │  + ACM Cert      │
              └──────────────────┘  │  + Resource      │
                                    │    Policy        │
                                    │  + Throttling    │
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │  Lambda + DDB    │
                                    │  + Rate Limit    │
                                    └──────────────────┘
```

**Security Layers:**
1. **Cloudflare**: DDoS protection, DNS, SSL/TLS, Transform Rules
2. **CloudFront**: CDN, caching, AWS Shield Standard
3. **API Gateway**: Throttling (100 RPS), Resource Policy (Referer check)
4. **Lambda**: Business logic, DynamoDB rate limiting (24h window)

---

## References

- [AWS API Gateway Throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)
- [DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)
- [Cloudflare Transform Rules](https://developers.cloudflare.com/rules/transform/)
- [AWS WAF Pricing](https://aws.amazon.com/waf/pricing/)
- [CloudFront Security Best Practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/security-best-practices.html)

---

## Support

For questions or issues related to security configuration:
- Email: sabapathy.work@gmail.com
- GitHub Issues: [thirukkural-app/issues](https://github.com/sankara-sabapathy/thirukkural-app/issues)

---

**Last Updated**: 2025-11-29  
**Version**: 1.0.0
