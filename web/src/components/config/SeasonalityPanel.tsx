import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { ThemeConfig } from '../../types/theme';
import { MONTHS, UpdateFieldFn, WEEKDAYS } from './types';

interface SeasonalityPanelProps {
  parsedConfig: any;
  updateField: UpdateFieldFn;
  theme: ThemeConfig;
}

export const SeasonalityPanel: React.FC<SeasonalityPanelProps> = ({
  parsedConfig,
  updateField,
  theme,
}) => {
  const [dupFilter, setDupFilter] = useState<'all' | 'unique'>('all');

  const monthlyRates: Record<string, number> =
    parsedConfig.date?.transaction_volume?.monthly_rate || {};
  const monthlyNoise = parsedConfig.date?.transaction_volume?.monthly_rate_noise || {
    distribution: 'poisson',
    multiplier: 1.25,
  };
  const globalVisitChance: Record<string, number> =
    parsedConfig.simulation?.visit_chance || {};
  const duplicateRules: Record<string, boolean> =
    parsedConfig.simulation?.subcategory_allow_duplicates || {};

  // Gather every subcategory from catalog + explicit duplicate rules
  const allSubcategories = Array.from(
    new Set([
      ...Object.values<any>(parsedConfig.catalog || {}).flatMap((subs) =>
        Object.keys(subs || {})
      ),
      ...Object.keys(duplicateRules),
    ])
  ).sort();

  const filteredSubcats =
    dupFilter === 'unique'
      ? allSubcategories.filter((s) => duplicateRules[s] === false)
      : allSubcategories;

  return (
    <div className="space-y-6 text-xs">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className={theme.mutedClass}>
          Global monthly seasonality multipliers (<code>config/date.yaml</code>), fallback weekday visit rates, and basket duplicate constraints.
        </p>
      </div>

      {/* Monthly Seasonality Multipliers */}
      <div className="p-4 rounded-lg border border-inherit bg-black/5 dark:bg-white/5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Monthly Traffic &amp; Volume Rate (Jan–Dec)
            </h4>
            <p className={`text-[11px] ${theme.mutedClass}`}>
              Multiplies global daily visit intensity by calendar month (1.0 = baseline).
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className={theme.mutedClass}>Noise Dist:</span>
            <select
              value={monthlyNoise.distribution ?? 'poisson'}
              onChange={(e) =>
                updateField(
                  ['date', 'transaction_volume', 'monthly_rate_noise', 'distribution'],
                  e.target.value
                )
              }
              className={`rounded px-1.5 py-0.5 font-mono border ${theme.inputClass}`}
            >
              {['poisson', 'lognormal', 'normal', 'uniform'].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span className={theme.mutedClass}>Mult:</span>
            <input
              type="number"
              step="0.01"
              min="1"
              value={monthlyNoise.multiplier ?? 1.25}
              onChange={(e) =>
                updateField(
                  ['date', 'transaction_volume', 'monthly_rate_noise', 'multiplier'],
                  parseFloat(e.target.value)
                )
              }
              className={`w-14 text-right rounded px-1.5 py-0.5 font-mono tabular-nums border ${theme.inputClass}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {MONTHS.map((m) => (
            <label
              key={m}
              className="flex items-center justify-between gap-2 p-2 rounded border border-inherit/60"
            >
              <span className="capitalize font-medium">{m.slice(0, 3)}</span>
              <input
                type="number"
                step="0.05"
                min="0"
                max="5"
                value={monthlyRates[m] ?? 1.0}
                onChange={(e) =>
                  updateField(
                    ['date', 'transaction_volume', 'monthly_rate', m],
                    parseFloat(e.target.value)
                  )
                }
                className={`w-14 text-right rounded px-1.5 py-0.5 font-mono tabular-nums border ${theme.inputClass}`}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Global Weekday Visit Chance Defaults */}
      <div className="p-4 rounded-lg border border-inherit bg-black/5 dark:bg-white/5 space-y-3">
        <div>
          <h4 className="font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Global Weekday Visit Defaults
          </h4>
          <p className={`text-[11px] ${theme.mutedClass}`}>
            Fallback daily visit probability used when a customer tier does not define its own weekday schedule.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {WEEKDAYS.map((day) => (
            <label
              key={day}
              className="flex items-center justify-between gap-1.5 p-2 rounded border border-inherit/60"
            >
              <span className="capitalize font-medium">{day.slice(0, 3)}</span>
              <input
                type="number"
                step="0.005"
                min="0"
                max="1"
                value={globalVisitChance[day] ?? (day === 'saturday' || day === 'sunday' ? 0.075 : 0.05)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) updateField(['simulation', 'visit_chance', day], v);
                }}
                className={`w-14 text-right rounded px-1.5 py-0.5 font-mono tabular-nums border ${theme.inputClass}`}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Fallback Basket & Quantity Defaults */}
      <div className="p-4 rounded-lg border border-inherit bg-black/5 dark:bg-white/5 space-y-3">
        <div>
          <h4 className="font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Fallback Basket &amp; Quantity Defaults (simulation.yaml)
          </h4>
          <p className={`text-[11px] ${theme.mutedClass}`}>
            Used only when a customer tier does not define its own basket bounds or base quantity λ.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center justify-between gap-2 p-2.5 rounded border border-inherit/60">
            <span className={theme.mutedClass}>Min Items / Basket</span>
            <input
              type="number"
              min="1"
              max="30"
              value={parsedConfig.simulation?.basket?.min_items ?? 1}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) updateField(['simulation', 'basket', 'min_items'], v);
              }}
              className={`w-16 text-right rounded px-1.5 py-0.5 font-mono tabular-nums border ${theme.inputClass}`}
            />
          </label>
          <label className="flex items-center justify-between gap-2 p-2.5 rounded border border-inherit/60">
            <span className={theme.mutedClass}>Max Items / Basket</span>
            <input
              type="number"
              min="1"
              max="50"
              value={parsedConfig.simulation?.basket?.max_items ?? 12}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) updateField(['simulation', 'basket', 'max_items'], v);
              }}
              className={`w-16 text-right rounded px-1.5 py-0.5 font-mono tabular-nums border ${theme.inputClass}`}
            />
          </label>
          <label className="flex items-center justify-between gap-2 p-2.5 rounded border border-inherit/60">
            <span className={theme.mutedClass}>Base Qty / Item (λ)</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={parsedConfig.simulation?.quantity_model?.base_lambda ?? 1.0}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v)) updateField(['simulation', 'quantity_model', 'base_lambda'], v);
              }}
              className={`w-16 text-right rounded px-1.5 py-0.5 font-mono tabular-nums border ${theme.inputClass}`}
            />
          </label>
        </div>
      </div>

      {/* Subcategory Duplicate Rule Matrix */}
      <div className="p-4 rounded-lg border border-inherit bg-black/5 dark:bg-white/5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Subcategory Basket Duplication Rules
            </h4>
            <p className={`text-[11px] ${theme.mutedClass}`}>
              Control whether customers can buy multiple SKUs from the same subcategory in a single checkout (e.g., disable for <code>rice</code> or <code>oils</code>).
            </p>
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded border border-inherit bg-black/5 dark:bg-white/5 shrink-0">
            <button
              onClick={() => setDupFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                dupFilter === 'all' ? theme.accentClass : 'opacity-70 hover:opacity-100'
              }`}
            >
              All ({allSubcategories.length})
            </button>
            <button
              onClick={() => setDupFilter('unique')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                dupFilter === 'unique' ? theme.accentClass : 'opacity-70 hover:opacity-100'
              }`}
            >
              1x Only ({allSubcategories.filter((s) => duplicateRules[s] === false).length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-1">
          {filteredSubcats.map((sub) => {
            const allow = duplicateRules[sub] !== false;
            return (
              <button
                key={sub}
                onClick={() => updateField(['simulation', 'subcategory_allow_duplicates', sub], !allow)}
                className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded border text-[11px] text-left transition ${
                  allow
                    ? 'border-inherit hover:border-emerald-500/60'
                    : 'border-amber-500/50 bg-amber-500/10'
                }`}
              >
                <span className="truncate capitalize">{sub.replace(/_/g, ' ')}</span>
                <span
                  className={`font-mono text-[10px] shrink-0 ${
                    allow ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400 font-bold'
                  }`}
                >
                  {allow ? 'Allow' : '1x'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
