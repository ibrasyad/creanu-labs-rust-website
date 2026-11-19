import * as yaml from 'js-yaml';
import { DEFAULT_CONFIG_YAML } from '../engine/defaultConfig';
import { PRESET_SCENARIOS } from '../presets';

function isPlainObject(val: unknown): val is Record<string, any> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((encoded.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function computeObjectPatch(baseObj: any, currentObj: any): Record<string, any> | undefined {
  if (!isPlainObject(baseObj) || !isPlainObject(currentObj)) {
    return JSON.stringify(baseObj) === JSON.stringify(currentObj) ? undefined : currentObj;
  }

  const patch: Record<string, any> = {};
  let hasDiff = false;

  for (const key of Object.keys(currentObj)) {
    if (!Object.prototype.hasOwnProperty.call(baseObj, key)) {
      patch[key] = currentObj[key];
      hasDiff = true;
    } else {
      const childPatch = computeObjectPatch(baseObj[key], currentObj[key]);
      if (childPatch !== undefined) {
        patch[key] = childPatch;
        hasDiff = true;
      }
    }
  }

  for (const key of Object.keys(baseObj)) {
    if (!Object.prototype.hasOwnProperty.call(currentObj, key)) {
      patch[key] = null;
      hasDiff = true;
    }
  }

  return hasDiff ? patch : undefined;
}

function applyObjectPatch(target: any, patch: any): any {
  if (!isPlainObject(target) || !isPlainObject(patch)) {
    return patch;
  }
  const result: Record<string, any> = { ...target };
  for (const key of Object.keys(patch)) {
    const patchVal = patch[key];
    if (patchVal === null) {
      delete result[key];
    } else if (isPlainObject(patchVal) && isPlainObject(result[key])) {
      result[key] = applyObjectPatch(result[key], patchVal);
    } else {
      result[key] = patchVal;
    }
  }
  return result;
}

export function buildShareUrl(presetId: string, configYaml: string, currentHref?: string): string {
  const href = currentHref || (typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
  const url = new URL(href);
  url.searchParams.delete('preset');
  url.searchParams.delete('patch');

  const presetObj = PRESET_SCENARIOS.find((p) => p.id === presetId);
  const baseYaml = presetObj?.configYaml || DEFAULT_CONFIG_YAML;
  if (presetObj) {
    url.searchParams.set('preset', presetObj.id);
  }

  try {
    const baseParsed = (yaml.load(baseYaml) as Record<string, any>) || {};
    const currentParsed = (yaml.load(configYaml) as Record<string, any>) || {};
    const patch = computeObjectPatch(baseParsed, currentParsed);
    if (patch && Object.keys(patch).length > 0) {
      const encoded = toBase64Url(JSON.stringify(patch));
      url.searchParams.set('patch', encoded);
    }
  } catch {
    // If YAML currently has syntax errors, still share the base preset cleanly.
  }

  return url.toString();
}

export interface HydratedScenario {
  presetId: string;
  configYaml: string;
  hadShareParams: boolean;
  error: string | null;
}

export function hydrateScenarioFromUrl(searchStr?: string): HydratedScenario {
  const search = searchStr ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(search);
  const presetParam = params.get('preset');
  const patchParam = params.get('patch');

  if (!presetParam && !patchParam) {
    return {
      presetId: 'default',
      configYaml: DEFAULT_CONFIG_YAML,
      hadShareParams: false,
      error: null,
    };
  }

  const matchedPreset = PRESET_SCENARIOS.find((p) => p.id === presetParam) || PRESET_SCENARIOS[0];
  if (!patchParam) {
    return {
      presetId: matchedPreset.id,
      configYaml: matchedPreset.configYaml,
      hadShareParams: true,
      error: null,
    };
  }

  try {
    const patchJson = fromBase64Url(patchParam);
    const patchObj = JSON.parse(patchJson);
    const baseParsed = (yaml.load(matchedPreset.configYaml) as Record<string, any>) || {};
    const merged = applyObjectPatch(baseParsed, patchObj);
    return {
      presetId: matchedPreset.id,
      configYaml: yaml.dump(merged),
      hadShareParams: true,
      error: null,
    };
  } catch {
    return {
      presetId: matchedPreset.id,
      configYaml: matchedPreset.configYaml,
      hadShareParams: true,
      error: 'Shared scenario link had an invalid patch; loaded base preset instead.',
    };
  }
}
