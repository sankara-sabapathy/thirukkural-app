import * as fs from 'fs';
import * as path from 'path';
import { getAdhigaramRoutes } from './adhigaram-utils';

const ROUTES_FILE = path.join(process.cwd(), 'prerender-routes.txt');
const RAW_KURAL_START = process.env.PRERENDER_KURAL_START ?? '1';
const RAW_KURAL_END = process.env.PRERENDER_KURAL_END ?? '1330';
const KURAL_START = clampRouteNumber(RAW_KURAL_START);
const KURAL_END = clampRouteNumber(RAW_KURAL_END);
const INCLUDE_HOME_ROUTE = process.env.PRERENDER_INCLUDE_HOME !== 'false';
const INCLUDE_LIBRARY_ROUTE = process.env.PRERENDER_INCLUDE_LIBRARY !== 'false';

function clampRouteNumber(value: string): number {
  const normalizedValue = value.trim();
  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(
      `Invalid prerender Kural route number "${value}". ` +
      'Use a whole number between 1 and 1330.'
    );
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);
  return Math.min(1330, Math.max(1, parsedValue));
}

function getRoutesToPrerender(): string[] {
  validateRouteRange();

  const routes: string[] = [];

  if (INCLUDE_HOME_ROUTE) {
    routes.push('/');
  }

  if (INCLUDE_LIBRARY_ROUTE) {
    routes.push('/kurals');
  }

  routes.push('/adhigaram');
  routes.push('/widgets/daily-kural', '/pricing', '/about', '/contact', '/privacy', '/terms');
  routes.push(...getAdhigaramRoutes());

  for (let i = KURAL_START; i <= KURAL_END; i++) {
    routes.push(`/kural/${i}`);
  }

  return routes;
}

function validateRouteRange(): void {
  if (KURAL_START <= KURAL_END) {
    return;
  }

  throw new Error(
    `Invalid prerender Kural range: start ${KURAL_START} is greater than end ${KURAL_END}. ` +
    `Received PRERENDER_KURAL_START=${RAW_KURAL_START} and PRERENDER_KURAL_END=${RAW_KURAL_END}.`
  );
}

function writeRoutesFile(routes: string[]): void {
  fs.writeFileSync(ROUTES_FILE, `${routes.join('\n')}\n`, 'utf8');
}

function run(): void {
  const routes = getRoutesToPrerender();
  writeRoutesFile(routes);
  console.log(`Generated prerender routes file at ${ROUTES_FILE} with ${routes.length} route(s).`);
}

run();
