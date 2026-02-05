---
trigger: always_on
---

# Project Context: Thirukkural Application

1.  **Project Goal**: A daily service delivering Thirukkural (Tamil wisdom) via email and push notifications, monetized through a credit and subscription system.
2.  **Tech Stack**:
    *   **Infrastructure**: AWS CDK (TypeScript) defining a Serverless architecture (Lambda, API Gateway, DynamoDB, Cognito, EventBridge, CloudFront).
    *   **Backend**: Node.js 20.x runtime for Lambda functions.
    *   **Frontend**: Angular 18+ (Standalone Components) hosted on S3 + CloudFront.
    *   **Database**: AWS DynamoDB. Key tables: `UsersTable` (Profiles, Credits, Sub Status), `ThirukkuralTable` (Content), `PushSubscriptionsTable` (Web Push).
    *   **Auth**: AWS Cognito with Google Federation.
    *   **Payments**: Razorpay (India/International support via INR/USD).
3.  **Key Architectures**:
    *   **Daily Scheduler**: `send-daily-email.ts` triggers via EventBridge. It prioritizes Active Subscriptions > Credit Deduction. Sends emails via SES or Brevo.
    *   **Payment Flow**: 
        *   Frontend (`PaymentService`) -> Backend (`/payment/order` or `/payment/subscription`) -> Razorpay.
        *   Verification: Frontend verifies signature via `/payment/verify` immediately. Webhook (`/payment/webhook`) handles async logical updates (DB updates).
    *   **Notifications**: Uses `web-push` for browser notifications and dynamic templates for system emails (Welcome, Low Credits, etc.).
4.  **Configuration & Secrets**:
    *   Managed via AWS SSM Parameter Store (`/stage/thirukkural/...`).
    *   **Frontend Config**:
        *   Uses `envsubst` in GitHub Actions to inject values into `environment.prod.ts` and `environment.dev.ts` at build time.
        *   Keys fetched from CloudFormation outputs: `API_URL`, `USER_POOL_ID`, `CLIENT_ID`, `USER_POOL_DOMAIN`.
        *   Keys fetched from SSM: `VAPID_PUBLIC_KEY`, `RAZORPAY_KEY_ID` (SecureString), `BASE_DOMAIN`.
        *   **Local Dev**: Uses `environment.ts` with hardcoded/cached values.
    *   **Backend Secrets**:
        *   Sensitive keys (Razorpay Secret, Google Client Secret) are fetched at runtime or injected as SecureStrings.
    *   `scripts/setup-ssm.ts` is the source of truth for parameter keys.
5.  **Development & Testing**:
    *   **Localhost Auth**: By default, `AuthService` uses a dummy user. To test against real backend (e.g., for Payments), set `localStorage.setItem('real_auth', 'true')` in the browser console.
    *   **Backend Tests**: Uses `vitest` with `aws-sdk-client-mock`. Run `npm test` in `backend/`.
    *   **Frontend**: Run `npm start`. Note: Payment calls require the backend API to be deployed (`api.krss.online` or stage URL).
6.  **Codebase Structure**:
    *   `backend/lib/thirukkural-stack.ts`: Main infrastructure definition.
    *   `backend/src/handlers/`: Lambda business logic (`razorpay-handler.ts`, `user-profile.ts`, etc.).
    *   `frontend/src/app/services/`: Core logic (`PaymentService`, `AuthService`).
    *   `frontend/src/app/pages/`: Feature modules (`PricingComponent`, `ProfileComponent`).
7.  **Specific Implementations**:
    *   **Dual Currency**: Determined by `CloudFront-Viewer-Country` header (Backend) or User Toggle (Frontend). INR for India, USD for Rest of World.
    *   **Signature Verification**: Implemented in `razorpay-handler.ts` (HMAC SHA256) to secure payment success callbacks.
8.  **Context Maintenance**:
    *   **CRITICAL**: This document MUST be updated whenever a new architectural component, major feature, or significant refactor is fully completed. Continuous enrichment ensures that future agents generally understand the evolving system state and constraints.
