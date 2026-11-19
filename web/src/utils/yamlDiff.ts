import * as yaml from 'js-yaml';

export interface YamlDiffEntry {
  path: string;
  changeType: 'modified' | 'added' | 'removed';
  defaultValue: unknown;
  currentValue: unknown;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, idx) => valuesEqual(item, b[idx]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => valuesEqual(a[k], b[k]));
  }
  return false;
}

function collectDiffs(
  baseObj: unknown,
  currentObj: unknown,
  prefix: string,
  out: YamlDiffEntry[]
): void {
  if (valuesEqual(baseObj, currentObj)) return;

  if (isPlainObject(baseObj) && isPlainObject(currentObj)) {
    const allKeys = Array.from(new Set([...Object.keys(baseObj), ...Object.keys(currentObj)]));
    for (const key of allKeys) {
      const nextPath = prefix ? `${prefix}.${key}` : key;
      const inBase = Object.prototype.hasOwnProperty.call(baseObj, key);
      const inCurrent = Object.prototype.hasOwnProperty.call(currentObj, key);

      if (!inBase && inCurrent) {
        out.push({
          path: nextPath,
          changeType: 'added',
          defaultValue: undefined,
          currentValue: currentObj[key],
        });
      } else if (inBase && !inCurrent) {
        out.push({
          path: nextPath,
          changeType: 'removed',
          defaultValue: baseObj[key],
          currentValue: undefined,
        });
      } else {
        collectDiffs(baseObj[key], currentObj[key], nextPath, out);
      }
    }
    return;
  }

  out.push({
    path: prefix || '(root)',
    changeType: 'modified',
    defaultValue: baseObj,
    currentValue: currentObj,
  });
}

export function formatDiffValue(val: unknown): string {
  if (val === undefined) return '— (removed)';
  if (val === null) return 'null';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (Array.isArray(val)) {
    return `[${val.length} items]`;
  }
  if (isPlainObject(val)) {
    const keys = Object.keys(val);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
  }
  return String(val);
}

export function diffYamlConfigs(defaultYaml: string, currentYaml: string): {
  entries: YamlDiffEntry[];
  parseError: string | null;
} {
  try {
    const baseParsed = (defaultYaml.trim() ? yaml.load(defaultYaml) : {}) ?? {};
    const currentParsed = (currentYaml.trim() ? yaml.load(currentYaml) : {}) ?? {};
    const entries: YamlDiffEntry[] = [];
    collectDiffs(baseParsed, currentParsed, '', entries);
    return { entries, parseError: null };
  } catch (err: any) {
    return { entries: [], parseError: err?.message || 'Unable to parse YAML for comparison' };
  }
}
