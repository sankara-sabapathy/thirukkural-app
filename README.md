# Thirukkural App - Serverless Full Stack Application

A modern, enterprise-grade web application to explore the Thirukkural, built with Angular, AWS CDK, and Serverless technologies.

## 🏗 Architecture

This project uses a **Serverless Architecture** on AWS:

*   **Frontend**: Angular (SPA) hosted on **S3** and served via **CloudFront** (CDN).
*   **Backend**: AWS Lambda (Node.js) & API Gateway.
*   **Database**: DynamoDB (Single-table design principles).
*   **Auth**: Amazon Cognito (User Pools with Google Identity Provider).
*   **Scheduled Jobs**: Amazon EventBridge (Daily Email Trigger).
*   **Email**: Amazon SES.
*   **IaC**: AWS Cloud Development Kit (CDK) in TypeScript.

## 🚀 Deployment Guide

Follow these steps to deploy the application to your own AWS account.

### 1. Prerequisites

*   **Node.js** (v18 or v20)
*   **AWS CLI** (Configured with `aws configure`)
*   **AWS CDK** (`npm install -g aws-cdk`)
*   **Verified SES Email**: You must verify an email address in AWS SES (Simple Email Service) to send emails.

### 2. Install Dependencies

```bash
# Install Backend Dependencies
cd backend
npm install

# Install Frontend Dependencies
cd ../frontend
npm install
```

### 3. Environment Variables

Set the following environment variables in your terminal before deploying.

**Windows (PowerShell):**
```powershell
$env:SES_SENDER_EMAIL="your-verified-email@example.com"
# Optional: For Google Sign-In
$env:GOOGLE_CLIENT_ID="your-google-client-id"
$env:GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

**Mac/Linux:**
```bash
export SES_SENDER_EMAIL="your-verified-email@example.com"
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 4. Build Frontend

The CDK stack will deploy the built artifacts from the frontend directory. You must build the Angular app first.

```bash
cd frontend
npm run build
```
*Ensure the build output is located at `frontend/dist/thirukkural-app`.*

### 5. Deploy Infrastructure

Deploy the entire stack (Backend + Frontend Hosting) using CDK.

```bash
cd backend
npx cdk bootstrap # Run only once per AWS account/region
npx cdk deploy
```

### 6. Post-Deployment Configuration

After a successful deployment, you will see **Outputs** in your terminal. Use these to configure your frontend.

**Example Outputs:**
```text
ThirukkuralStack.ApiUrl = https://xyz.execute-api.ap-south-1.amazonaws.com/prod/
ThirukkuralStack.UserPoolId = ap-south-1_AbCdEfG
ThirukkuralStack.UserPoolClientId = 123456789abcdefgh
ThirukkuralStack.UserPoolDomain = thirukkural-app-123.auth.ap-south-1.amazoncognito.com
ThirukkuralStack.WebsiteUrl = d12345.cloudfront.net
```

1.  Open `frontend/src/environments/environment.ts`.
2.  Update the values with the outputs from above.
3.  **Re-build and Re-deploy Frontend**:
    Since the environment variables are baked into the Angular build, you need to rebuild and deploy again.
    ```bash
    cd frontend
    npm run build
    cd ../backend
    npx cdk deploy # This will update the S3 bucket with new assets
    ```

### 7. Seed Database

Populate the DynamoDB table with the Thirukkural dataset.

```bash
cd backend
npx ts-node scripts/seed.ts
```

## 🔄 CI/CD Pipeline Setup (GitHub Actions)

This project includes a pre-configured GitHub Actions workflow (`.github/workflows/backend-deploy.yml`) for automated deployments.

To enable it, go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions** and add the following secrets:

| Secret Name | Value Description |
| :--- | :--- |
| `AWS_ACCESS_KEY_ID` | Your AWS Access Key ID. |
| `AWS_SECRET_ACCESS_KEY` | Your AWS Secret Access Key. |
| `SES_SENDER_EMAIL` | The verified email address in AWS SES. |
| `GOOGLE_CLIENT_ID` | (Optional) Google OAuth Client ID. |
| `GOOGLE_CLIENT_SECRET` | (Optional) Google OAuth Client Secret. |

*The pipeline is configured to deploy to the `ap-south-1` (Mumbai) region by default.*

## ⚙️ Frontend Configuration Plan

After the backend is deployed, you must update the frontend environment files to connect to your new AWS resources.

| Config Field | Source (CDK Output) | File to Update |
| :--- | :--- | :--- |
| `cognito.userPoolId` | `ThirukkuralStack.UserPoolId` | `src/environments/environment.ts` |
| `cognito.userPoolWebClientId` | `ThirukkuralStack.UserPoolClientId` | `src/environments/environment.ts` |
| `cognito.domain` | `ThirukkuralStack.UserPoolDomain` | `src/environments/environment.ts` |
| `api.baseUrl` | `ThirukkuralStack.ApiUrl` | `src/environments/environment.ts` |

**Note**: For production builds (`npm run build --prod`), update `src/environments/environment.prod.ts` with the same values, but ensure `redirectSignIn` and `redirectSignOut` point to your production domain (e.g., `https://your-domain.com/callback`).

## 🔒 Security & Best Practices

*   **S3 & CloudFront**: The S3 bucket is **private** (`BlockPublicAccess: BLOCK_ALL`). Access is restricted to CloudFront only using **Origin Access Control (OAC)** and a strict Bucket Policy.
*   **Authentication**: Uses Cognito User Pools. API Gateway validates JWT tokens automatically.
*   **Least Privilege**: IAM roles for Lambdas are scoped to only necessary DynamoDB tables and SES actions.
*   **Data Protection**: DynamoDB tables are set to `DESTROY` on stack deletion for cost safety in this demo, but can be changed to `RETAIN` for production.

## 🔧 Troubleshooting

Common issues and solutions encountered during deployment:

### 1. OAuth Redirect Errors
*   **Error**: `InvalidOriginException: redirect is coming from a different origin`
*   **Cause**: The `redirectSignIn` URL in `environment.prod.ts` does not match the Allowed Callback URLs in Cognito.
*   **Fix**: Update `thirukkural-stack.ts` to include your CloudFront URL in `callbackUrls` and `logoutUrls`. Redeploy backend (`cdk deploy`).

### 2. Google Sign-In Error 400
*   **Error**: `redirect_uri_mismatch`
*   **Cause**: The Cognito Callback URL is not registered in Google Cloud Console.
*   **Fix**: Add `https://<your-cognito-domain>/oauth2/idpresponse` to "Authorized redirect URIs" in your Google OAuth Client settings.

### 3. "Sign In" Button Persists After Login
*   **Error**: User is redirected back to home but still appears logged out.
*   **Cause**: Angular app not detecting auth state change immediately after redirect.
*   **Fix**: Ensure `AuthService` listens to Amplify `Hub` events (`auth` channel) to detect `signedIn` events and refresh user state.

### 4. Production Build Using Wrong Environment
*   **Error**: App connects to localhost or wrong API in production.
*   **Cause**: `angular.json` missing `fileReplacements` for production configuration.
*   **Fix**: Add `fileReplacements` in `angular.json` to swap `environment.ts` with `environment.prod.ts`.

### 5. Cognito Domain Error
*   **Error**: "Site can't be reached" with double protocol `https://https://...`
*   **Cause**: `environment.prod.ts` domain field includes `https://`.
*   **Fix**: Remove `https://` from the `domain` field in `environment.prod.ts`. Amplify adds it automatically.

---

## 🔒 Security & Sensitive Data

When deploying this project or pushing to public repositories, be aware of the following:

### Environment Variables (Secrets)
These values should **NEVER** be committed to version control. Use `.env` files (gitignored) or CI/CD secrets.

| Variable | Description | Location |
| :--- | :--- | :--- |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Backend Deployment / CI Secrets |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Backend Deployment / CI Secrets |
| `SES_SENDER_EMAIL` | Verified SES Email Address | Backend Deployment / CI Secrets |
| `AWS_ACCESS_KEY_ID` | AWS Credentials | CI Secrets (GitHub Actions) |
| `AWS_SECRET_ACCESS_KEY` | AWS Credentials | CI Secrets (GitHub Actions) |

### Public Configuration
The following values are **safe to commit** in `environment.ts` / `environment.prod.ts` as they are exposed in the client-side bundle anyway:

*   `userPoolId`
*   `userPoolWebClientId`
*   `domain` (Cognito Domain)
*   `baseUrl` (API Gateway URL)
*   `redirectSignIn` / `redirectSignOut` URLs

**Note**: Although safe to expose, these values are specific to your deployment. If you fork this repo, you must update them with your own AWS resource IDs.

## 🧹 Cleanup

To remove all resources and avoid costs:

```bash
cd backend
npx cdk destroy
```
*Note: This will delete the Database, User Pool, and S3 Bucket.*
