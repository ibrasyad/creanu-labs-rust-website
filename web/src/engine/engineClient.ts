import { runSimulationClient } from './simulator';
import { SimulationOutput } from '../types/simulation';
import { EngineKind, WorkerProgressPhase, WorkerResponse } from './workerProtocol';

export interface RunSimulationParams {
  configYaml: string;
  baselineYaml: string | null;
  onProgress?: (info: {
    phase: WorkerProgressPhase;
    day: number;
    totalDays: number;
    dateStr: string;
    engine: EngineKind;
  }) => void;
}

export interface RunSimulationResult {
  output: SimulationOutput;
  baseline: SimulationOutput | null;
  engine: EngineKind;
  elapsedMs: number;
}

export interface RunningTask {
  promise: Promise<RunSimulationResult>;
  cancel: () => void;
}

let activeWorker: Worker | null = null;
let nextRequestId = 1;

function getOrCreateWorker(): Worker {
  if (!activeWorker) {
    activeWorker = new Worker(new URL('./simulation.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return activeWorker;
}

export function runSimulationAsync(params: RunSimulationParams): RunningTask {
  const { configYaml, baselineYaml, onProgress } = params;

  if (typeof Worker === 'undefined') {
    const promise = new Promise<RunSimulationResult>((resolve, reject) => {
      try {
        const started = performance.now();
        const output = runSimulationClient(configYaml, (day, totalDays, dateStr) => {
          onProgress?.({ phase: 'simulation', day, totalDays, dateStr, engine: 'typescript' });
        });
        const baseline = baselineYaml
          ? runSimulationClient(baselineYaml, (day, totalDays, dateStr) => {
              onProgress?.({ phase: 'baseline', day, totalDays, dateStr, engine: 'typescript' });
            })
          : null;
        resolve({
          output,
          baseline,
          engine: 'typescript',
          elapsedMs: Math.round(performance.now() - started),
        });
      } catch (err) {
        reject(err);
      }
    });
    return { promise, cancel: () => {} };
  }

  const requestId = nextRequestId++;
  let worker = getOrCreateWorker();
  let settled = false;
  let rejectFn: ((err: Error) => void) | null = null;

  const promise = new Promise<RunSimulationResult>((resolve, reject) => {
    rejectFn = reject;

    const cleanup = () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };

    const handleMessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (!msg || msg.id !== requestId) return;

      if (msg.type === 'PROGRESS') {
        onProgress?.({
          phase: msg.phase,
          day: msg.day,
          totalDays: msg.totalDays,
          dateStr: msg.dateStr,
          engine: msg.engine,
        });
      } else if (msg.type === 'COMPLETE') {
        settled = true;
        cleanup();
        resolve({
          output: msg.output,
          baseline: msg.baseline,
          engine: msg.engine,
          elapsedMs: msg.elapsedMs,
        });
      } else if (msg.type === 'ERROR') {
        settled = true;
        cleanup();
        reject(new Error(msg.message));
      }
    };

    const handleError = (err: ErrorEvent) => {
      settled = true;
      cleanup();
      worker.terminate();
      if (activeWorker === worker) {
        activeWorker = null;
      }
      reject(new Error(err.message || 'Simulation worker encountered an error'));
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage({
      id: requestId,
      type: 'RUN',
      configYaml,
      baselineYaml,
    });
  });

  const cancel = () => {
    if (settled) return;
    settled = true;
    worker.terminate();
    if (activeWorker === worker) {
      activeWorker = null;
    }
    rejectFn?.(new Error('Simulation cancelled by user.'));
  };

  return { promise, cancel };
}
