/// <reference types="vite/client" />
import { runSimulationClient } from './simulator';
import { SimulationOutput } from '../types/simulation';
import { EngineKind, WorkerRequest, WorkerResponse } from './workerProtocol';

interface WasmModuleExports {
  default: () => Promise<unknown>;
  run_simulation_wasm: (
    configStr: string,
    startDate?: string | null,
    endDate?: string | null,
    seed?: number | null,
    progressJs?: ((day: number, totalDays: number, dateStr: string) => void) | null
  ) => SimulationOutput;
}

const wasmLoaders = import.meta.glob<WasmModuleExports>('../wasm-pkg/lettuce_melon_engine.js');

let cachedWasm: WasmModuleExports | null = null;
let wasmAttempted = false;

async function tryLoadWasm(): Promise<WasmModuleExports | null> {
  if (wasmAttempted) return cachedWasm;
  wasmAttempted = true;

  const loader = wasmLoaders['../wasm-pkg/lettuce_melon_engine.js'];
  if (!loader) {
    return null;
  }

  try {
    const mod = await loader();
    if (typeof mod.default === 'function') {
      await mod.default();
    }
    if (typeof mod.run_simulation_wasm === 'function') {
      cachedWasm = mod;
      return cachedWasm;
    }
  } catch (err) {
    console.warn('[Worker] Wasm module unavailable, falling back to TypeScript simulator:', err);
  }
  return null;
}

const post = (msg: WorkerResponse) => {
  (globalThis as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage(msg);
};

async function executeRun(
  wasm: WasmModuleExports | null,
  yamlStr: string,
  onProgress: (day: number, totalDays: number, dateStr: string, engine: EngineKind) => void
): Promise<{ result: SimulationOutput; engine: EngineKind }> {
  if (wasm) {
    try {
      const result = wasm.run_simulation_wasm(yamlStr, null, null, null, (day, totalDays, dateStr) => {
        onProgress(day, totalDays, dateStr, 'wasm');
      });
      return { result, engine: 'wasm' };
    } catch (err) {
      // Fall back to TypeScript if Wasm cannot parse a custom JS-only variant
      console.warn('[Worker] Wasm run failed, retrying with TypeScript simulator:', err);
    }
  }

  const result = runSimulationClient(yamlStr, (day, totalDays, dateStr) => {
    onProgress(day, totalDays, dateStr, 'typescript');
  });
  return { result, engine: 'typescript' };
}

globalThis.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (!req || req.type !== 'RUN') return;

  const startedAt = performance.now();
  try {
    const wasm = await tryLoadWasm();

    const mainRun = await executeRun(wasm, req.configYaml, (day, totalDays, dateStr, engine) => {
      post({
        id: req.id,
        type: 'PROGRESS',
        phase: 'simulation',
        day,
        totalDays,
        dateStr,
        engine,
      });
    });

    let baseline: SimulationOutput | null = null;
    if (req.baselineYaml) {
      const baselineRun = await executeRun(wasm, req.baselineYaml, (day, totalDays, dateStr, engine) => {
        post({
          id: req.id,
          type: 'PROGRESS',
          phase: 'baseline',
          day,
          totalDays,
          dateStr,
          engine,
        });
      });
      baseline = baselineRun.result;
    }

    post({
      id: req.id,
      type: 'COMPLETE',
      output: mainRun.result,
      baseline,
      engine: mainRun.engine,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
  } catch (err: any) {
    post({
      id: req.id,
      type: 'ERROR',
      message: err?.message ? String(err.message) : String(err),
    });
  }
});
