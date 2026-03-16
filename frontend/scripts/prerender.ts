import puppeteer, { Browser, Page } from 'puppeteer';
import * as express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const DIST_FOLDER = path.join(process.cwd(), 'dist/frontend/browser');
const PORT = 4200;
const DEFAULT_CONCURRENCY = Math.min(6, Math.max(4, Math.ceil(os.availableParallelism() / 2)));
const ROUTE_CONCURRENCY = Number(process.env.PRERENDER_CONCURRENCY ?? DEFAULT_CONCURRENCY.toString());
const MAX_ATTEMPTS = Number(process.env.PRERENDER_ATTEMPTS ?? '3');
const NAVIGATION_TIMEOUT_MS = Number(process.env.PRERENDER_TIMEOUT_MS ?? '60000');
const ROUTE_READY_TIMEOUT_MS = Number(process.env.PRERENDER_READY_TIMEOUT_MS ?? '15000');
const KURAL_START = clampRouteNumber(process.env.PRERENDER_KURAL_START ?? '1');
const KURAL_END = clampRouteNumber(process.env.PRERENDER_KURAL_END ?? '1330');
const INCLUDE_HOME_ROUTE = process.env.PRERENDER_INCLUDE_HOME !== 'false';
const BLOCKED_RESOURCE_TYPES = new Set(['font', 'image', 'media']);
const BLOCKED_URL_PATTERNS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'google-analytics.com', 'googletagmanager.com'];

type RouteJob = {
  index: number;
  route: string;
  total: number;
};

type PrerenderController = {
  navigate: (url: string) => Promise<boolean>;
};

function clampRouteNumber(value: string): number {
  const parsedValue = Number.parseInt(value, 10);
  if (Number.isNaN(parsedValue)) {
    return 1;
  }

  return Math.min(1330, Math.max(1, parsedValue));
}

function getRoutesToPrerender(): string[] {
  const routes: string[] = [];

  if (INCLUDE_HOME_ROUTE) {
    routes.push('/');
  }

  for (let i = KURAL_START; i <= KURAL_END; i++) {
    routes.push(`/kural/${i}`);
  }

  return routes;
}

function getOutputPath(route: string): string {
  if (route === '/') {
    return path.join(DIST_FOLDER, 'index.html');
  }

  const routeDirectory = path.join(DIST_FOLDER, route);
  fs.mkdirSync(routeDirectory, { recursive: true });
  return path.join(routeDirectory, 'index.html');
}

async function configurePage(page: Page): Promise<void> {
  await page.setCacheEnabled(true);
  await page.evaluateOnNewDocument(() => {
    (globalThis as { __PRERENDER__?: boolean }).__PRERENDER__ = true;
  });
  await page.setRequestInterception(true);

  page.on('request', (request) => {
    if (request.isInterceptResolutionHandled()) {
      return;
    }

    const requestUrl = request.url();
    if (
      BLOCKED_RESOURCE_TYPES.has(request.resourceType()) ||
      BLOCKED_URL_PATTERNS.some((pattern) => requestUrl.includes(pattern))
    ) {
      void request.abort();
      return;
    }

    void request.continue();
  });
}

async function waitForPrerenderController(page: Page): Promise<void> {
  await page.waitForFunction(
    () => Boolean((globalThis as { __PRERENDER_CONTROLLER__?: unknown }).__PRERENDER_CONTROLLER__),
    { timeout: ROUTE_READY_TIMEOUT_MS }
  );
}

async function bootstrapPage(page: Page): Promise<void> {
  await page.goto(`http://localhost:${PORT}/`, {
    waitUntil: 'domcontentloaded',
    timeout: NAVIGATION_TIMEOUT_MS,
  });
  await waitForPrerenderController(page);
}

async function navigateWithinApp(page: Page, route: string): Promise<void> {
  await page.evaluate(async (targetRoute) => {
    const controller = (globalThis as { __PRERENDER_CONTROLLER__?: PrerenderController }).__PRERENDER_CONTROLLER__;
    if (!controller) {
      throw new Error('Prerender controller is not available.');
    }

    const currentPath = window.location.pathname || '/';
    if (currentPath === targetRoute) {
      return;
    }

    const didNavigate = await controller.navigate(targetRoute);
    if (!didNavigate) {
      throw new Error(`Router navigation returned false for ${targetRoute}`);
    }
  }, route);
}

async function verifyRenderedRoute(page: Page, route: string): Promise<void> {
  const expectedCanonicalUrl = `https://thirukkural.site${route}`;

  if (!route.startsWith('/kural/')) {
    await page.waitForSelector('app-root', { timeout: ROUTE_READY_TIMEOUT_MS });
    await page.waitForFunction(
      (url) => {
        const canonicalUrl = document.querySelector("link[rel='canonical']")?.getAttribute('href');
        return canonicalUrl === url;
      },
      { timeout: ROUTE_READY_TIMEOUT_MS },
      expectedCanonicalUrl
    );
    return;
  }

  await page.waitForSelector('.kural-content', { timeout: ROUTE_READY_TIMEOUT_MS });
  await page.waitForFunction(
    (url) => {
      const canonicalUrl = document.querySelector("link[rel='canonical']")?.getAttribute('href');
      const structuredData = document.getElementById('structured-data-kural')?.textContent ?? '';
      return canonicalUrl === url && structuredData.length > 0;
    },
    { timeout: ROUTE_READY_TIMEOUT_MS },
    expectedCanonicalUrl
  );
}

async function renderRoute(page: Page, route: string): Promise<boolean> {
  try {
    try {
      await navigateWithinApp(page, route);
    } catch (navigationError) {
      console.warn(`Falling back to full reload for ${route}:`, navigationError);
      await page.goto(`http://localhost:${PORT}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT_MS,
      });
      await waitForPrerenderController(page);
    }

    await verifyRenderedRoute(page, route);

    const html = await page.content();
    fs.writeFileSync(getOutputPath(route), html);
    return true;
  } catch (error) {
    console.error(`Failed to render ${route}:`, error);
    return false;
  }
}

async function renderRoutes(
  browser: Browser,
  routes: string[]
): Promise<string[]> {
  const failures: string[] = [];
  const workerCount = Math.min(ROUTE_CONCURRENCY, routes.length);
  let nextRouteIndex = 0;

  const pages = await Promise.all(
    Array.from({ length: workerCount }, async () => {
      const page = await browser.newPage();
      await configurePage(page);
      await bootstrapPage(page);
      return page;
    })
  );

  const getNextRoute = (): RouteJob | null => {
    if (nextRouteIndex >= routes.length) {
      return null;
    }

    const route = routes[nextRouteIndex];
    const job = {
      index: nextRouteIndex + 1,
      route,
      total: routes.length,
    };
    nextRouteIndex += 1;
    return job;
  };

  try {
    await Promise.all(
      pages.map(async (page, workerIndex) => {
        while (true) {
          const job = getNextRoute();
          if (!job) {
            return;
          }

          if (job.index === 1 || job.index === job.total || job.index % 50 === 0) {
            console.log(`[worker ${workerIndex + 1}/${workerCount}] Rendering ${job.index}/${job.total}: ${job.route}`);
          }
          const ok = await renderRoute(page, job.route);
          if (!ok) {
            failures.push(job.route);
          }
        }
      })
    );
  } finally {
    await Promise.all(
      pages.map(async (page) => {
        if (!page.isClosed()) {
          await page.close();
        }
      })
    );
  }

  return failures;
}

async function runPrerender(): Promise<void> {
  console.log('Starting custom SSG prerenderer...');

  if (!fs.existsSync(DIST_FOLDER)) {
    throw new Error(`Dist folder not found at ${DIST_FOLDER}. Run 'npm run build' first.`);
  }

  const app = express.default();
  app.use(express.static(DIST_FOLDER));
  app.use((req, res) => {
    res.sendFile(path.join(DIST_FOLDER, 'index.html'));
  });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(PORT, () => {
      console.log(`Local SPA server running on http://localhost:${PORT}`);
      resolve(instance);
    });
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--disable-service-worker'],
  });

  const routes = getRoutesToPrerender();
  let remainingRoutes = routes;

  console.log(`Found ${routes.length} routes to prerender.`);

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      console.log(`Prerender attempt ${attempt} of ${MAX_ATTEMPTS} for ${remainingRoutes.length} route(s).`);
      const failedRoutes = await renderRoutes(browser, remainingRoutes);

      if (failedRoutes.length === 0) {
        remainingRoutes = [];
        break;
      }

      remainingRoutes = failedRoutes;
      console.warn(`Attempt ${attempt} completed with ${failedRoutes.length} failed route(s).`);
    }

    if (remainingRoutes.length > 0) {
      throw new Error(`Prerender incomplete. Failed routes: ${remainingRoutes.join(', ')}`);
    }

    if (KURAL_START === 1 && KURAL_END === 1330) {
      const generatedKuralCount = fs
        .readdirSync(path.join(DIST_FOLDER, 'kural'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory()).length;

      if (generatedKuralCount !== 1330) {
        throw new Error(`Expected 1330 prerendered kural directories, found ${generatedKuralCount}`);
      }
    }

    console.log('Prerendering complete.');
  } finally {
    await browser.close();
    server.close();
  }
}

runPrerender().catch((error) => {
  console.error('Prerender process failed:', error);
  process.exit(1);
});
