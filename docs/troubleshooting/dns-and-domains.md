# DNS & Domain Configuration Issues

## Historical Issues

### 1. CNAME Resolution Failure for Dev Environment
**Issue:**
The development site (`dev-thirukkural.krss.online`) was not resolving, or resolving incorrectly after deployment.

**Context:**
The architecture uses Cloudflare as the DNS/Edge provider pointing to an AWS CloudFront distribution.

**Diagnosis:**
-   Verified Cloudflare DNS records (CNAME) pointed to the correct CloudFront domain (`*.cloudfront.net`).
-   Verified CloudFront "Alternate Domain Names" (CNAMEs) included the dev subdomain.
-   **Root Cause:** SSL Certificate mismatch or missing CNAME pairing. AWS CloudFront requires the CNAME to be listed in the distribution AND a matching SSL certificate (ACM) covering that domain to be attached.

**Solution:**
1.  Ensure ACM Certificate covers `*.thirukkural.site` (or the specific dev domain).
2.  Add `dev.thirukkural.site` to the CloudFront Distribution's Alternate Domain Names.
3.  In Cloudflare, set CNAME `dev` to the CloudFront URL.
4.  **Important:** Check "Full (Strict)" SSL mode in Cloudflare if the origin calls are HTTPS.

### 2. Multi-Stage Domain Naming
**Issue:**
Confusion between production and dev domain conventions during multi-stage deployment.

**Solution:**
-   **Production:** `thirukkural.site` (Root).
-   **Dev:** `dev.thirukkural.site` (Subdomain).
-   *Note:* Historically used `krss.online` but migrated to `thirukkural.site` for branding. Ensure environment variables (`APP_BASE_DOMAIN`) reflect the correct root based on the stage.
