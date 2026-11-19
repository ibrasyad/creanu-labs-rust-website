import { SimulationOutput } from '../types/simulation';

export type EngineKind = 'wasm' | 'typescript';

export interface WorkerRunRequest {
  id: number;
  type: 'RUN';
  configYaml: string;
  baselineYaml: string | null;
}

export type WorkerRequest = WorkerRunRequest;

export type WorkerProgressPhase = 'simulation' | 'baseline';

export interface WorkerProgressMessage {
  id: number;
  type: 'PROGRESS';
  phase: WorkerProgressPhase;
  day: number;
  totalDays: number;
  dateStr: string;
  engine: EngineKind;
}

export interface WorkerCompleteMessage {
  id: number;
  type: 'COMPLETE';
  output: SimulationOutput;
  baseline: SimulationOutput | null;
  engine: EngineKind;
  elapsedMs: number;
}

export interface WorkerErrorMessage {
  id: number;
  type: 'ERROR';
  message: string;
}

export type WorkerResponse =
  | WorkerProgressMessage
  | WorkerCompleteMessage
  | WorkerErrorMessage;
