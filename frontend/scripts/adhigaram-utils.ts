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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePositiveInteger(value: unknown, fieldName: string, index: number): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(
      `Invalid adhigaram index at ${ADHIGARAMS_PATH}: entry ${index + 1} has invalid ${fieldName}.`
    );
  }

  return Number(value);
}

function parseRequiredString(value: unknown, fieldName: string, index: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Invalid adhigaram index at ${ADHIGARAMS_PATH}: entry ${index + 1} has invalid ${fieldName}.`
    );
  }

  return value;
}

function parseOptionalString(value: unknown, fieldName: string, index: number): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(
      `Invalid adhigaram index at ${ADHIGARAMS_PATH}: entry ${index + 1} has invalid ${fieldName}.`
    );
  }

  return value;
}

function validateAdhigaram(entry: unknown, index: number): AdhigaramRouteData {
  if (!isRecord(entry)) {
    throw new Error(`Invalid adhigaram index at ${ADHIGARAMS_PATH}: entry ${index + 1} is not an object.`);
  }

  const id = parsePositiveInteger(entry.id, 'id', index);
  const start = parsePositiveInteger(entry.start, 'start', index);
  const end = parsePositiveInteger(entry.end, 'end', index);

  if (end < start) {
    throw new Error(
      `Invalid adhigaram index at ${ADHIGARAMS_PATH}: entry ${index + 1} has end before start.`
    );
  }

  return {
    id,
    start,
    end,
    pal: parseRequiredString(entry.pal, 'pal', index),
    pal_tr: parseRequiredString(entry.pal_tr, 'pal_tr', index),
    pal_tl: parseOptionalString(entry.pal_tl, 'pal_tl', index),
    iyal: parseRequiredString(entry.iyal, 'iyal', index),
    iyal_tr: parseRequiredString(entry.iyal_tr, 'iyal_tr', index),
    iyal_tl: parseOptionalString(entry.iyal_tl, 'iyal_tl', index),
    adikaram: parseRequiredString(entry.adikaram, 'adikaram', index),
    adikaram_tr: parseRequiredString(entry.adikaram_tr, 'adikaram_tr', index),
    adikaram_tl: parseOptionalString(entry.adikaram_tl, 'adikaram_tl', index)
  };
}

export function loadAdhigarams(): AdhigaramRouteData[] {
  if (!fs.existsSync(ADHIGARAMS_PATH)) {
    throw new Error(`Adhigaram index not found at ${ADHIGARAMS_PATH}. Run npm run sync:kural-data first.`);
  }

  const data = JSON.parse(fs.readFileSync(ADHIGARAMS_PATH, 'utf8')) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`Invalid adhigaram index at ${ADHIGARAMS_PATH}.`);
  }

  return data.map((entry, index) => validateAdhigaram(entry, index));
}

export function getAdhigaramRoutes(): string[] {
  return loadAdhigarams().map((adhigaram) => `/adhigaram/${adhigaram.id}`);
}
