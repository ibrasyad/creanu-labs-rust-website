import React from 'react';
import { X } from 'lucide-react';
import { ThemeConfig } from '../types/theme';
import { EngineKind, WorkerProgressPhase } from '../engine/workerProtocol';

interface ProgressBarProps {
  currentDay: number;
  totalDays: number;
  currentDateStr: string;
  phase?: WorkerProgressPhase;
  engine?: EngineKind;
  onCancel?: () => void;
  theme: ThemeConfig;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentDay,
  totalDays,
  currentDateStr,
  phase = 'simulation',
  engine = 'typescript',
  onCancel,
  theme,
}) => {
  const safeTotal = Math.max(1, totalDays);
  const pct = Math.min(100, Math.round((currentDay / safeTotal) * 100));

  return (
    <div className={`p-4 border ${theme.borderClass} ${theme.cardClass} shadow-md space-y-2 animate-in fade-in duration-150`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">
            {phase === 'baseline' ? 'Matching Baseline' : 'Simulating'} Day {currentDay} of {safeTotal}
          </span>
          <span className="font-mono text-[11px] opacity-70 px-1.5 py-0.5 rounded border border-inherit">
            {currentDateStr}
          </span>
          <span className={`font-mono text-[11px] ${theme.mutedClass}`}>
            &middot; {engine === 'wasm' ? 'Rust / WebAssembly' : 'TypeScript Engine'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-bold font-mono text-emerald-500">{pct}%</span>
          {onCancel && (
            <button
              onClick={onCancel}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-medium transition ${theme.buttonClass}`}
            >
              <X className="w-3 h-3" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>
      <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-emerald-500 h-full transition-all duration-100 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
