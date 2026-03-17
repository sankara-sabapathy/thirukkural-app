# AGENTS.md

## Purpose
- Use this file as the primary repo-specific guide for coding agents working in this workspace.
- Prefer concrete repo facts, commands, and failure modes over generic behavior advice.
- When this file conflicts with older narrative docs, trust the code, manifests, workflows, and current environment files first.

## Source Of Truth
- Infrastructure: `backend/lib/thirukkural-stack.ts`
- CDK entry and stage naming: `backend/bin/thirukkural-backend.ts`
- Backend handlers: `backend/src/handlers/`
- Shared backend logic: `backend/src/shared/`
- Frontend app shell and routes: `frontend/src/app/`
- Frontend build/runtime config: `frontend/angular.json`, `frontend/src/environments/`
- CI/CD: `.github/workflows/`
- Historical troubleshooting and learnings: `docs/`
- Legacy agent guidance that informed this file: `.agent/rules/*.md`, `AGENT_RULES.md`

## Current Project Snapshot
- Product: a Thirukkural web app that delivers daily content via email, push notifications, and Telegram, with credits plus Razorpay subscriptions.
- Backend: AWS CDK in TypeScript deploying Lambda, API Gateway, DynamoDB, Cognito, EventBridge, S3, and CloudFront.
- Frontend: Angular 21 standalone application with service worker support, Puppeteer-driven SSG-style prerendering, local vendored Kural data, and Playwright/Vitest tests.
- Runtime/auth: Cognito with Google federation; Angular `HttpClient` requests rely on `frontend/src/app/core/auth.interceptor.ts` to attach the ID token.
- Data model: DynamoDB `UsersTable` stores both user profiles and `AUTH_LINK` records. Do not assume Cognito `sub` is always the real profile primary key.

## Facts That Override Stale Docs
- The frontend is Angular 21, not Angular 18.
- Frontend production output is `frontend/dist/frontend/browser`, not `frontend/dist/thirukkural-app`.
- Deploy-time configuration is primarily sourced from SSM under `/{stage}/thirukkural/*`.
- `frontend/src/environments/environment.dev.ts` and `environment.prod.ts` are template files with placeholders replaced in CI.
- `frontend/src/environments/environment.ts` is the local fallback with hardcoded values for local work.
- The SEO/data pipeline is local-first. Source content lives at `data/thirukkural/allKural.json` and is split into `frontend/public/data/thirukkural/*.json`; do not reintroduce runtime GitHub fetches for core Kural data.
- Current indexable SEO routes are numeric Kural pages under `/kural/:id`, numeric chapter pages under `/adhigaram/:id`, plus a small set of static pages. There are no slugged Kural URLs in production.
- CloudFront must rewrite extensionless paths to nested `index.html` using `backend/src/cloudfront/basic-auth.js` in non-prod and `backend/src/cloudfront/uri-rewrite.js` in prod.
- Domain references are inconsistent across older docs (`krss.online` vs `thirukkural.site`). Derive the active domain from current SSM `base_domain`, workflows, and environment files instead of trusting old prose.
- `implementation_plan.md` is historical bootstrap context, not an up-to-date architecture spec.

## Repo Layout
- `backend/`: CDK app, Lambdas, seed/setup scripts, backend tests.
- `frontend/`: Angular app, prerender/sitemap scripts, frontend tests, Playwright config.
- `docs/`: historical learnings and troubleshooting notes worth checking before changing deployment, DNS, or service-worker behavior.
- `.agent/rules/`: older generic agent rules. Use them as intent, not as the final source of operational truth.

## Working Agreement For Agents
- Start by reading the smallest set of relevant files plus `git status --short`.
- Touch only files needed for the task. Avoid opportunistic cleanup.
- Assume the worktree may already contain user changes. Do not overwrite or revert them unless explicitly asked.
- For routine read-only inspection and repo-local verification, proceed directly.
- Ask before destructive actions, production deploys, network installs, or writing outside the workspace.
- After edits, run the smallest verification step that gives useful confidence. Escalate only if the task requires it.
- Keep this file, `README.md`, and troubleshooting docs aligned when architecture or workflow meaningfully changes.

## High-Value Commands

### Backend
- Install: `cd backend; npm ci`
- TypeScript build: `cd backend; npm run build`
- Tests: `cd backend; npx vitest run`
- Watch tests: `cd backend; npm test`
- SSM bootstrap: `cd backend; $env:STAGE='dev'; npm run setup-ssm`
- Seed data: `cd backend; npm run seed`
- CDK synth: `cd backend; npx cdk synth -c stage=dev`
- CDK deploy: `cd backend; npx cdk deploy --require-approval never -c stage=dev`

### Frontend
- Install: `cd frontend; npm ci`
- Dev server: `cd frontend; npm start`
- Standard build: `cd frontend; npm run build -- --configuration development`
- Sync vendored data: `cd frontend; npm run sync:kural-data`
- Prerender only: `cd frontend; npm run prerender`
- Sitemap only: `cd frontend; npm run generate-sitemap`
- SSG build (dev): `cd frontend; npm run build:ssg:development`
- SSG build (prod): `cd frontend; npm run build:ssg:production`
- Serve prerendered output: `cd frontend; npm run serve:ssg`
- Unit tests: `cd frontend; npm run test`
- Coverage: `cd frontend; npm run test:coverage`
- E2E: `cd frontend; npm run e2e`

## Verification Expectations
- Backend-only changes: at minimum run `npm run build` or targeted `vitest` coverage for touched logic.
- Frontend-only changes: at minimum run a targeted build or `vitest`; run Playwright only when route/UI behavior changed materially.
- Infra or config changes: run `npx cdk synth -c stage=dev`.
- Route, SEO, or static-generation changes: run `npm run build:ssg:development`.
- For SEO changes, validate built HTML in `frontend/dist/frontend/browser/**/index.html`, not just runtime DOM.
- Do not claim success without at least one concrete verification step unless blocked; if blocked, say so explicitly.

## Configuration And Secrets
- SSM path convention is `/{stage}/thirukkural/{key}`.
- `backend/scripts/setup-ssm.ts` is the canonical inventory of stage parameters and secrets that bootstraps SSM.
- Frontend deploy workflows fetch CloudFormation outputs and SSM values, then inject them into `environment.dev.ts` and `environment.prod.ts` using `envsubst`.
- If you add or rename config:
  - update `backend/scripts/setup-ssm.ts`
  - update `backend/.env.example` and `frontend/.env.example` if locally relevant
  - update the affected GitHub workflow(s)
  - document which GitHub secrets or vars operators must add
- `google_client_secret` is currently treated as a plain SSM String for Cognito deploy compatibility. Do not silently convert it back to `SecureString` without redesigning the CDK flow.

## Backend Notes That Matter
- `send-daily-email.ts` handles email delivery, credit deduction, low-credit/out-of-credit alerts, Telegram posting, and push notifications in one flow. Changes here are high-risk.
- Credit deduction is conditional and compensating. Preserve idempotency and refund behavior if email send fails.
- Razorpay logic is split between synchronous `/payment/verify` handling and asynchronous webhook handling. Keep ownership checks and duplicate-processing guards intact.
- `user-profile.ts` performs lazy migration from legacy Cognito-sub keyed records to internal profile IDs via `AUTH_LINK`.
- Non-prod CloudFront uses a basic-auth function; prod does not.
- EventBridge daily send is enabled only for `prod`.

## Frontend Notes That Matter
- Localhost auth is fake by default. `AuthService` uses a dummy user unless `localStorage.setItem('real_auth', 'true')` is set.
- Protected backend calls depend on `auth.interceptor.ts`. Do not replace `HttpClient` usage without preserving token propagation.
- Service worker registration is enabled in both development and production configs.
- The deploy pipeline must publish `ngsw-worker.js` and `ngsw.json` with correct MIME types; otherwise PWA registration breaks.
- `npm run build:ssg` depends on `frontend/scripts/prerender.ts` and `frontend/scripts/sitemap.ts`.
- Lighthouse CI config lives at `frontend/lighthouserc.js` and audits the prerendered static output, not the Angular dev server.
- The header now uses `NgOptimizedImage` with a prerender-friendly local logo asset at `frontend/public/logo-192.jpg`; preserve explicit image dimensions on above-the-fold logos.
- Font loading is centralized in `frontend/src/index.html`; avoid reintroducing duplicate Google Fonts imports in component styles or `styles.scss`.
- `html2canvas` is intentionally lazy-loaded in the Kural detail page so it does not bloat the critical route/prerender path.
- If you change public routes or canonical URLs, update:
  - `frontend/src/app/app.routes.ts`
  - `frontend/scripts/prerender.ts`
  - `frontend/scripts/sitemap.ts`

## SEO / SSG Reality
- `frontend/scripts/prerender.ts` is the canonical SEO prerender pipeline. It prerenders `/`, all `133` `/adhigaram/:id` routes, and all `1330` `/kural/:id` routes into `frontend/dist/frontend/browser/**/index.html`.
- The prerenderer now reuses a live Angular app per Puppeteer worker through `window.__PRERENDER_CONTROLLER__`. Do not revert to one fresh browser boot per route unless correctness requires it; that regresses build time from seconds back into minutes.
- The prerenderer blocks fonts, images, media, and common analytics URLs during HTML generation. Keep that behavior unless a route depends on one of those assets for SEO-visible content.
- `frontend/scripts/sitemap.ts` emits home, selected static routes, `/kurals`, numeric `/adhigaram/:id`, and numeric `/kural/:id` URLs.
- Kural-specific and adhigaram-specific SEO metadata currently lives in `frontend/src/app/services/seo.service.ts`, `frontend/src/app/pages/kural-detail/kural-detail.component.ts`, and `frontend/src/app/pages/adhigaram-detail/adhigaram-detail.component.ts`. Chapter pages now include a visible FAQ section and `FAQPage` JSON-LD alongside `CollectionPage` and `BreadcrumbList`.
- Chapter metadata is generated locally by `scripts/split-data.js` into `frontend/public/data/thirukkural/adhigarams.json`. Keep that file derived from `data/thirukkural/allKural.json`, not hand-edited.
- `frontend/src/app/app.component.ts` applies route-level `data.seo` metadata for the main public static pages and noindex flows such as callback, unsubscribe, and profile. Keep route metadata aligned with any new public or transactional route.
- Local content data lives at `data/thirukkural/allKural.json` and is transformed by `scripts/split-data.js` into `frontend/public/data/thirukkural/*.json`.
- CloudFront viewer-request rewriting is required so `/kural/1153` resolves to `/kural/1153/index.html` in S3. Without that rewrite, direct requests and Googlebot indexing regress to SPA fallback behavior.

## SEO Rules For Future Changes
- When adding or renaming an indexable public route, update all relevant SEO surfaces together:
  - `frontend/src/app/app.routes.ts`
  - `frontend/scripts/prerender.ts`
  - `frontend/scripts/sitemap.ts`
  - route-level `SeoService` usage or `data.seo`
  - CloudFront rewrite logic if the path model changes
- When editing adhigaram FAQs, keep the visible FAQ section and the `FAQPage` JSON-LD in `frontend/src/app/pages/adhigaram-detail/adhigaram-detail.component.ts` aligned. Do not add schema answers that are not present in page content.
- When the canonical production host changes, update all hardcoded SEO references together:
  - `frontend/src/app/app.component.ts`
  - `frontend/src/app/pages/kural-detail/kural-detail.component.ts`
  - `frontend/src/app/services/seo.service.ts`
  - `frontend/scripts/sitemap.ts`
  - any static canonical/OG tags in `frontend/src/index.html`
- Keep the content pipeline local-first. If source content changes, update `data/thirukkural/allKural.json`, run `npm run sync:kural-data`, and verify the generated chunks.
- If the primary content count changes from `1330`, update every hardcoded loop, route list, and validation in prerender, sitemap, and any SEO assertions.
- Prefer stable numeric Kural URLs until slug support exists end to end. Do not partially introduce slug URLs in sitemap/canonicals without matching routes, redirects, and CloudFront rewrite behavior.
- For SEO work, verify the built HTML itself:
  - run `npm run build:ssg:development`
  - inspect `frontend/dist/frontend/browser/kural/1/index.html`
  - optionally run `npm run serve:ssg` and inspect page source on a sample route
- Do not present aspirational SEO features as implemented. Check the route tree, sitemap generator, workflows, and built output first.

## SEO Gaps / Not Yet Implemented
- No slugged Kural URLs such as `/kural/1-agara-mudhala...`; current production shape is `/kural/:id`.
- No zoneless migration tied to SEO work.
- No backlink widget, embeddable daily-Kural script, or other authority-building automation in this repo.

## CI/CD Reality
- `.github/workflows/backend-deploy.yml`: manual backend deploy plus optional SSM setup and seed.
- `.github/workflows/frontend-deploy.yml`: manual frontend deploy; fetches stack outputs and SSM values before building.
- `.github/workflows/dev-auto-deploy.yml`: auto-deploys feature branches to dev after backend and frontend tests pass.
- `.github/workflows/lighthouse.yml`: runs Lighthouse CI against the prerendered frontend on `main` pushes and PRs, failing on SEO regressions below the configured threshold.
- `.github/workflows/test.yml`: frontend-focused main/PR test suite with Vitest coverage and Playwright.
- Older docs mention some commands and outputs that no longer match these workflows. Prefer the workflows.

## Known Pitfalls
- Old docs and code disagree on active domains. Verify from current config before changing redirects, DNS, or sitemap URLs.
- Static generation currently hardcodes 1330 kural pages. Route model changes can break prerender performance or sitemap completeness.
- Payment and profile code depend on Cognito claims plus DynamoDB linking semantics; naive refactors can break existing users.
- Service-worker failures often come from wrong file uploads or cached HTML responses instead of Angular code defects.
- README deployment instructions are partially outdated; treat them as onboarding background, not a precise runbook.

## Documentation Maintenance
- Update this file when the architecture, commands, deployment flow, or critical gotchas change.
- Update `docs/LEARNINGS.md` for hard-earned debugging lessons that are likely to recur.
- Update `docs/troubleshooting/` for deployment, DNS, or service-worker issues after they are understood.
- Keep `README.md` usable for humans, but keep `AGENTS.md` optimized for fast agent execution context.
