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
ThirukkuralStack.ApiUrl = https://xyz.execute-api.us-east-1.amazonaws.com/prod/
ThirukkuralStack.UserPoolId = us-east-1_AbCdEfG
ThirukkuralStack.UserPoolClientId = 123456789abcdefgh
ThirukkuralStack.UserPoolDomain = thirukkural-app-123.auth.us-east-1.amazoncognito.com
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

## 🔒 Security & Best Practices

*   **S3 & CloudFront**: The S3 bucket is **private** (`BlockPublicAccess: BLOCK_ALL`). Access is restricted to CloudFront only using **Origin Access Control (OAC)** and a strict Bucket Policy.
*   **Authentication**: Uses Cognito User Pools. API Gateway validates JWT tokens automatically.
*   **Least Privilege**: IAM roles for Lambdas are scoped to only necessary DynamoDB tables and SES actions.
*   **Data Protection**: DynamoDB tables are set to `DESTROY` on stack deletion for cost safety in this demo, but can be changed to `RETAIN` for production.

## 🧹 Cleanup

To remove all resources and avoid costs:

```bash
cd backend
npx cdk destroy
```
*Note: This will delete the Database, User Pool, and S3 Bucket.*
