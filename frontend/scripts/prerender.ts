import * as fs from 'fs';
import * as path from 'path';
import { getAdhigaramRoutes } from './adhigaram-utils';

const ROUTES_FILE = path.join(process.cwd(), 'prerender-routes.txt');
const KURAL_START = clampRouteNumber(process.env.PRERENDER_KURAL_START ?? '1');
const KURAL_END = clampRouteNumber(process.env.PRERENDER_KURAL_END ?? '1330');
const INCLUDE_HOME_ROUTE = process.env.PRERENDER_INCLUDE_HOME !== 'false';
const INCLUDE_LIBRARY_ROUTE = process.env.PRERENDER_INCLUDE_LIBRARY !== 'false';

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

  if (INCLUDE_LIBRARY_ROUTE) {
    routes.push('/kurals');
  }

  routes.push('/pricing', '/about', '/contact', '/privacy', '/terms');
  routes.push(...getAdhigaramRoutes());

  for (let i = KURAL_START; i <= KURAL_END; i++) {
    routes.push(`/kural/${i}`);
  }

  return routes;
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
