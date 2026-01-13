# Service Worker & Push Notification Troubleshooting

## Error: "The script has an unsupported MIME type ('text/html')"

**Symptoms:**
- `NG05604: Service worker registration failed`.
- `ngsw-worker.js` returns 200 OK but content is HTML.

**Root Causes & Fixes:**

1.  **Missing File in Dev Build:**
    -   Angular defaults to no SW in dev.
    -   *Fix:* Add `"serviceWorker": "ngsw-config.json"` to `angular.json` (dev config) and enable `provideServiceWorker` in `app.config.ts`.
2.  **Missing File in S3:**
    -   Deployment pipeline might fail to upload the file or upload it with wrong MIME.
    -   *Fix:* Explicitly set `--content-type "application/javascript"` in S3 commands.
3.  **The "Zombie" Cache (Cloudflare + CloudFront):**
    -   If CloudFront serves a 404 (returning fallback HTML), Cloudflare caches that "success" (200 OK HTML) response.
    -   *Fix:* Invalidate CloudFront AND Purge Cloudflare Cache.

## General Tips
-   **HTTPS:** Required for `window.Notification`.
-   **Debug:** Use `curl -I <url>` to check headers and `server` field (Cloudflare vs AmazonS3).
