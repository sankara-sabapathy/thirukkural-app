# Build & Deployment Pipeline Issues

## Historical Issues

### 1. Broken Deployments (The "Test Gate")
**Issue:**
Deployment pipeline would proceed even if code was broken, causing downtime in the dev environment.

**Solution:**
Implemented a mandatory **Test Gate** in `dev-auto-deploy.yml`.
-   **Parallel Execution:** Frontend and Backend tests run simultaneously to save time.
-   **Blocker:** Deployment jobs (`deploy-backend`, `deploy-frontend`) strictly `need` the test jobs to succeed.
-   **Result:** No bad code reaches the cloud.

### 2. Deployment Sequence Race Conditions
**Issue:**
Frontend deployed before Backend, causing UI to make calls to non-existent API endpoints during infrastructure updates.

**Solution:**
Enforced sequential deployment:
1.  **Backend Stack:** Deploys API, Database, Cognito.
2.  **Frontend Assets:** Deploys only after Backend finishes successfully.

### 3. SCSS Build Budgets
**Issue:**
Angular build failed with `Error: budget exceeded`. specific to `home.component.scss` (>8kB).

**Solution:**
-   Refactored SCSS to reduce duplication.
-   Moved shared styles to global `styles.scss` only where necessary.
-   Avoided large imports in component-specific styles.

### 4. CDK Module Errors
**Issue:**
Build failed with `Cannot find module 'aws-cdk-lib/aws-certificatemanager'`.

**Solution:**
-   This was a version mismatch in `package.json`.
-   **Fix:** Ensure all `@aws-cdk/...` or `aws-cdk-lib` dependencies are aligned to the same version. Run `npm ci` to ensure clean install from lockfile.
