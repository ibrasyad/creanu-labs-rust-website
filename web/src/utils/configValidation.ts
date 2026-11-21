import * as yaml from 'js-yaml';

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  startDate: string;
  endDate: string;
  totalDays: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDateUtc(dateStr: string): Date | null {
  if (!ISO_DATE_RE.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function validateSimulationConfig(yamlStr: string): ConfigValidationResult {
  const fallback = {
    valid: false,
    errors: [] as string[],
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    totalDays: 90,
  };

  if (!yamlStr || !yamlStr.trim()) {
    return { ...fallback, errors: ['YAML configuration is empty.'] };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(yamlStr);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...fallback, errors: [`YAML syntax error: ${msg}`] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...fallback, errors: ['Configuration root must be a YAML mapping/object.'] };
  }

  const cfg = parsed as Record<string, any>;
  const errors: string[] = [];

  // 1. Validate date bounds
  const startStr = String(cfg.date?.start_date ?? '').trim();
  const endStr = String(cfg.date?.end_date ?? '').trim();
  const startDt = parseIsoDateUtc(startStr);
  const endDt = parseIsoDateUtc(endStr);

  let totalDays = 90;
  if (!startDt) {
    errors.push('date.start_date must be a valid YYYY-MM-DD calendar date.');
  }
  if (!endDt) {
    errors.push('date.end_date must be a valid YYYY-MM-DD calendar date.');
  }
  if (startDt && endDt) {
    if (startDt.getTime() > endDt.getTime()) {
      errors.push(`date.start_date (${startStr}) cannot be after date.end_date (${endStr}).`);
    } else {
      totalDays = Math.round((endDt.getTime() - startDt.getTime()) / (1000 * 3600 * 24)) + 1;
      if (totalDays > 1096) {
        errors.push(`Date range (${totalDays} days) exceeds the 3-year browser safety limit (1,096 days).`);
      }
    }
  }

  // 2. Validate personas
  if (!cfg.personas || typeof cfg.personas !== 'object' || Array.isArray(cfg.personas)) {
    errors.push('personas must be a non-empty mapping of customer segments.');
  } else {
    const personaEntries = Object.entries(cfg.personas);
    if (personaEntries.length === 0) {
      errors.push('Define at least one persona under personas.');
    } else {
      let hasAnyUsers = false;
      for (const [name, pCfg] of personaEntries) {
        if (!pCfg || typeof pCfg !== 'object') {
          errors.push(`Persona "${name}" must be a configuration object.`);
          continue;
        }
        const baseUser = Number((pCfg as Record<string, any>).base_user ?? 0);
        const newChance = Number((pCfg as Record<string, any>).daily_new_user_chance ?? 0);
        const newChanceWknd = Number((pCfg as Record<string, any>).daily_new_user_chance_weekend ?? 0);
        if (!Number.isFinite(baseUser) || baseUser < 0) {
          errors.push(`Persona "${name}" has an invalid base_user value.`);
        }
        if (baseUser > 0 || newChance > 0 || newChanceWknd > 0) {
          hasAnyUsers = true;
        }
      }
      if (!hasAnyUsers) {
        errors.push('At least one persona must define base_user > 0 or daily_new_user_chance > 0.');
      }
    }
  }

  // 3. Validate catalog has at least one product
  if (!cfg.catalog || typeof cfg.catalog !== 'object' || Array.isArray(cfg.catalog)) {
    errors.push('catalog must be a non-empty mapping of categories and products.');
  } else {
    let productCount = 0;
    for (const subcats of Object.values(cfg.catalog)) {
      if (!subcats || typeof subcats !== 'object') continue;
      for (const subCfg of Object.values(subcats as Record<string, any>)) {
        if (subCfg && typeof subCfg === 'object' && subCfg.product && typeof subCfg.product === 'object') {
          productCount += Object.keys(subCfg.product).length;
        }
      }
    }
    if (productCount === 0) {
      errors.push('catalog must contain at least one product SKU.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    startDate: startDt ? startStr : fallback.startDate,
    endDate: endDt ? endStr : fallback.endDate,
    totalDays,
  };
}
