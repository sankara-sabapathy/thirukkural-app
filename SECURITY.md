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

### Issue: High API Gateway Costs
**Cause**: Excessive traffic or attack
**Solution**:
1. Check CloudWatch metrics for traffic patterns
2. Lower throttling limits temporarily
3. Enable Cloudflare proxy if not already active
4. Review API Gateway access logs

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
