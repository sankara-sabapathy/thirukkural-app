# Technical Learnings & Retrospectives

## 2026-02-04: Angular HttpClient & Cognito Authorization Gap

### Issue
We encountered a `401 Unauthorized` error when calling the backend API from the Profile page, despite the user being logged in via Cognito.

### Root Cause
1.  **Protocol Mismatch**: The backend `NodejsFunction` utilizes a Cognito Authorizer which expects an `Authorization: Bearer <token>` header.
2.  **Client Implementation**: The Frontend uses Angular's standard `HttpClient`. Unlike the AWS Amplify API client (which automatically signs requests), `HttpClient` is "dumb" and does not attach credentials by default.
3.  **Process Gap**: Development focused on component logic (frontend) and handler logic (backend) in isolation. Integration testing was delayed, shielding this recurring pattern requirement from view until E2E verification.

### Corrective Action
Implemented an `AuthInterceptor` (Functional Interceptor) in `src/app/core/auth.interceptor.ts` that:
1.  Fetches the current Auth Session from Amplify (`fetchAuthSession`).
2.  Extracts the `idToken`.
3.  Clones the HTTP request to inject the `Authorization` header.
4.  Registered this in `app.config.ts`.

### Key Learning
**"When using standard `HttpClient` with a secured AWS API Gateway, ALWAYS implement an `HttpInterceptor` as the first step of integration to propagate authentication tokens. Never assume the Auth library handles `HttpClient` traffic."**
