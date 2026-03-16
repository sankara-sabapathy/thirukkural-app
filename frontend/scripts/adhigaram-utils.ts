import * as fs from 'fs';
import * as path from 'path';

export interface AdhigaramRouteData {
  id: number;
  start: number;
  end: number;
  pal: string;
  pal_tr: string;
  pal_tl?: string;
  iyal: string;
  iyal_tr: string;
  iyal_tl?: string;
  adikaram: string;
  adikaram_tr: string;
  adikaram_tl?: string;
}

const ADHIGARAMS_PATH = path.join(process.cwd(), 'public/data/thirukkural/adhigarams.json');

export function loadAdhigarams(): AdhigaramRouteData[] {
  if (!fs.existsSync(ADHIGARAMS_PATH)) {
    throw new Error(`Adhigaram index not found at ${ADHIGARAMS_PATH}. Run npm run sync:kural-data first.`);
  }

  const data = JSON.parse(fs.readFileSync(ADHIGARAMS_PATH, 'utf8')) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`Invalid adhigaram index at ${ADHIGARAMS_PATH}.`);
  }

  return data as AdhigaramRouteData[];
}

export function getAdhigaramRoutes(): string[] {
  return loadAdhigarams().map((adhigaram) => `/adhigaram/${adhigaram.id}`);
}
