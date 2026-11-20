import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Megaphone, Plus, Trash2 } from 'lucide-react';
import { ThemeConfig } from '../../types/theme';
import { FUNNEL_STEPS, MONTHS, MutateConfigFn, UpdateFieldFn } from './types';

interface EventsPanelProps {
  parsedConfig: any;
  updateField: UpdateFieldFn;
  mutateConfig: MutateConfigFn;
  theme: ThemeConfig;
}

export const EventsPanel: React.FC<EventsPanelProps> = ({
  parsedConfig,
  updateField,
  mutateConfig,
  theme,
}) => {
  const [expandedTargeting, setExpandedTargeting] = useState<Record<string, boolean>>({});
  const personaKeys = Object.keys(parsedConfig.personas || {});

  const addMarketingEvent = () => {
    mutateConfig((cfg) => {
      cfg.event = cfg.event || {};
      let idx = Object.keys(cfg.event).length + 1;
      let key = `campaign_${idx}`;
      while (cfg.event[key]) key = `campaign_${++idx}`;
      cfg.event[key] = {
        name: 'New Campaign',
        description: 'Describe the campaign goal',
        year: 1,
        start_month: 1,
        end_month: 3,
        overall: { new_user: 1.1, visit: 1.1 },
      };
    });
  };

  const removeMarketingEvent = (key: string) => {
    mutateConfig((cfg) => {
      if (cfg.event) delete cfg.event[key];
    });
  };

  const renameMarketingEvent = (oldKey: string, newKey: string) => {
    const clean = newKey.trim().replace(/\s+/g, '_').toLowerCase();
    if (!clean || clean === oldKey) return;
    mutateConfig((cfg) => {
      if (!cfg.event?.[oldKey] || cfg.event[clean]) return;
      const rebuilt: Record<string, any> = {};
      for (const [k, v] of Object.entries<any>(cfg.event)) {
        if (k === oldKey) rebuilt[clean] = v;
        else rebuilt[k] = v;
      }
      cfg.event = rebuilt;
    });
  };

  const setScheduleMode = (evtKey: string, mode: 'month' | 'date') => {
    mutateConfig((cfg) => {
      const target = cfg.event?.[evtKey];
      if (!target) return;
      if (mode === 'date') {
        target.start_date = target.start_date || cfg.date?.start_date || '2026-01-01';
        if (target.end_date === undefined) target.end_date = null;
      } else {
        delete target.start_date;
        delete target.end_date;
        target.year = target.year ?? 1;
        target.start_month = target.start_month ?? 1;
      }
    });
  };

  const updateTargetingMetric = (
    evtKey: string,
    scope: 'profiles' | 'personas',
    targetKey: string,
    metric: 'visit' | 'new_user',
    rawVal: string
  ) => {
    const val = rawVal === '' ? undefined : parseFloat(rawVal);
    mutateConfig((cfg) => {
      const evt = cfg.event?.[evtKey];
      if (!evt) return;
      if (val === undefined) {
        if (evt[scope]?.[targetKey]) {
          delete evt[scope][targetKey][metric];
          if (Object.keys(evt[scope][targetKey]).length === 0) delete evt[scope][targetKey];
          if (Object.keys(evt[scope]).length === 0) delete evt[scope];
        }
      } else {
        evt[scope] = evt[scope] || {};
        evt[scope][targetKey] = evt[scope][targetKey] || {};
        evt[scope][targetKey][metric] = val;
      }
    });
  };

  const updateTargetingConversion = (
    evtKey: string,
    scope: 'profiles' | 'personas',
    targetKey: string,
    step: string,
    rawVal: string
  ) => {
    const val = rawVal === '' ? undefined : parseFloat(rawVal);
    mutateConfig((cfg) => {
      const evt = cfg.event?.[evtKey];
      if (!evt) return;
      if (val === undefined) {
        if (evt[scope]?.[targetKey]?.conversion) {
          delete evt[scope][targetKey].conversion[step];
          if (Object.keys(evt[scope][targetKey].conversion).length === 0) {
            delete evt[scope][targetKey].conversion;
          }
          if (Object.keys(evt[scope][targetKey]).length === 0) delete evt[scope][targetKey];
          if (Object.keys(evt[scope]).length === 0) delete evt[scope];
        }
      } else {
        evt[scope] = evt[scope] || {};
        evt[scope][targetKey] = evt[scope][targetKey] || {};
        evt[scope][targetKey].conversion = evt[scope][targetKey].conversion || {};
        evt[scope][targetKey].conversion[step] = val;
      }
    });
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className={theme.mutedClass}>
            Promotional campaigns and ongoing A/B tests. Set End Month or End Date to <strong>Permanent</strong> so effects persist across future years.
          </p>
        </div>
        <button
          onClick={addMarketingEvent}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border whitespace-nowrap shrink-0 ${theme.buttonClass}`}
        >
          <Plus className="w-3 h-3" /> Add Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries<any>(parsedConfig.event || {}).map(([evtKey, evt]) => {
          const isDateMode = Boolean(evt.start_date || evt.end_date);
          const isPermanentMonth = evt.end_month === null || evt.end_month === undefined;
          const isPermanentDate = evt.end_date === null || evt.end_date === undefined || evt.end_date === '';
          const targetingOpen = Boolean(expandedTargeting[evtKey]);

          return (
            <div key={evtKey} className="p-3.5 rounded-lg border border-inherit bg-black/5 dark:bg-white/5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <input
                  value={evt.name ?? evtKey}
                  onChange={(e) => updateField(['event', evtKey, 'name'], e.target.value)}
                  className={`flex-1 min-w-0 rounded px-2 py-1 text-xs font-bold border ${theme.inputClass}`}
                />
                <button
                  onClick={() => removeMarketingEvent(evtKey)}
                  className="opacity-60 hover:opacity-100 hover:text-rose-500 shrink-0"
                  title="Remove campaign"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Campaign Key</label>
                  <input
                    defaultValue={evtKey}
                    onBlur={(e) => renameMarketingEvent(evtKey, e.target.value)}
                    className={`w-full rounded px-2 py-1 text-[11px] font-mono border ${theme.inputClass}`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Schedule Mode</label>
                  <div className="flex rounded border border-inherit overflow-hidden text-[10px]">
                    <button
                      onClick={() => setScheduleMode(evtKey, 'month')}
                      className={`flex-1 py-1 font-semibold ${
                        !isDateMode ? theme.accentClass : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      Year/Mo
                    </button>
                    <button
                      onClick={() => setScheduleMode(evtKey, 'date')}
                      className={`flex-1 py-1 font-semibold ${
                        isDateMode ? theme.accentClass : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      Exact Dates
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Description</label>
                <input
                  value={evt.description ?? ''}
                  onChange={(e) => updateField(['event', evtKey, 'description'], e.target.value)}
                  className={`w-full rounded px-2 py-1 text-[11px] border ${theme.inputClass}`}
                />
              </div>

              {!isDateMode ? (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Sim Year</label>
                    <input
                      type="number"
                      min="1"
                      value={evt.year ?? 1}
                      onChange={(e) => updateField(['event', evtKey, 'year'], Number(e.target.value))}
                      className={`w-full rounded px-2 py-1 font-mono tabular-nums border ${theme.inputClass}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Start Month</label>
                    <select
                      value={evt.start_month ?? 1}
                      onChange={(e) => updateField(['event', evtKey, 'start_month'], Number(e.target.value))}
                      className={`w-full rounded px-1 py-1 font-mono border ${theme.inputClass}`}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m.slice(0, 3)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>End Month</label>
                    <select
                      value={isPermanentMonth ? 'permanent' : String(evt.end_month)}
                      onChange={(e) => {
                        const val = e.target.value === 'permanent' ? null : Number(e.target.value);
                        updateField(['event', evtKey, 'end_month'], val);
                      }}
                      className={`w-full rounded px-1 py-1 font-mono border ${theme.inputClass}`}
                    >
                      <option value="permanent">Permanent</option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={String(i + 1)}>
                          {m.slice(0, 3)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Start Date</label>
                    <input
                      type="date"
                      value={evt.start_date ?? ''}
                      onChange={(e) => updateField(['event', evtKey, 'start_date'], e.target.value)}
                      className={`w-full rounded px-1.5 py-1 text-[11px] font-mono border ${theme.inputClass}`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className={`text-[10px] ${theme.mutedClass}`}>End Date</label>
                      <label className="flex items-center gap-1 text-[9px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isPermanentDate}
                          onChange={(e) =>
                            updateField(
                              ['event', evtKey, 'end_date'],
                              e.target.checked ? null : evt.start_date || '2026-12-31'
                            )
                          }
                        />
                        <span>Permanent</span>
                      </label>
                    </div>
                    {isPermanentDate ? (
                      <div className={`w-full rounded px-2 py-1 text-[11px] font-mono border opacity-70 ${theme.inputClass}`}>
                        Ongoing (no end)
                      </div>
                    ) : (
                      <input
                        type="date"
                        value={evt.end_date ?? ''}
                        onChange={(e) => updateField(['event', evtKey, 'end_date'], e.target.value)}
                        className={`w-full rounded px-1.5 py-1 text-[11px] font-mono border ${theme.inputClass}`}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Overall Multipliers */}
              <div className="pt-2 border-t border-inherit/40 space-y-1.5">
                <span className={`block text-[10px] font-semibold uppercase ${theme.mutedClass}`}>
                  Overall Multipliers
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px]">Visit</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={evt.overall?.visit ?? 1}
                      onChange={(e) => updateField(['event', evtKey, 'overall', 'visit'], parseFloat(e.target.value))}
                      className={`w-12 text-right rounded px-1 py-0.5 font-mono tabular-nums border ${theme.inputClass}`}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px]">New</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={evt.overall?.new_user ?? 1}
                      onChange={(e) => updateField(['event', evtKey, 'overall', 'new_user'], parseFloat(e.target.value))}
                      className={`w-12 text-right rounded px-1 py-0.5 font-mono tabular-nums border ${theme.inputClass}`}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px]">Conv</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={evt.overall?.conversion ?? 1}
                      onChange={(e) =>
                        updateField(['event', evtKey, 'overall', 'conversion'], parseFloat(e.target.value))
                      }
                      className={`w-12 text-right rounded px-1 py-0.5 font-mono tabular-nums border ${theme.inputClass}`}
                    />
                  </div>
                </div>
              </div>

              {/* Collapsible Profile & Persona Targeting */}
              <div className="pt-1 border-t border-inherit/40">
                <button
                  onClick={() =>
                    setExpandedTargeting((prev) => ({ ...prev, [evtKey]: !targetingOpen }))
                  }
                  className="w-full flex items-center justify-between py-1 text-[10px] font-semibold uppercase opacity-80 hover:opacity-100"
                >
                  <span>Profile &amp; Persona Targeting</span>
                  {targetingOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {targetingOpen && (
                  <div className="space-y-2 pt-1.5">
                    {['conservative', 'balanced', 'aggressive'].map((prof) => {
                      const profCfg = evt.profiles?.[prof];
                      return (
                        <div key={prof} className="rounded border border-inherit/50 p-2 space-y-1">
                          <span className="text-[10px] capitalize font-semibold">Profile: {prof}</span>
                          <div className="grid grid-cols-2 gap-2">
                            {(['visit', 'new_user'] as const).map((metric) => (
                              <label key={metric} className="flex items-center justify-between gap-1 text-[10px]">
                                <span>{metric === 'new_user' ? 'New user' : 'Visit'}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="—"
                                  value={profCfg?.[metric] ?? ''}
                                  onChange={(e) =>
                                    updateTargetingMetric(evtKey, 'profiles', prof, metric, e.target.value)
                                  }
                                  className={`w-14 text-right rounded px-1 py-0.5 font-mono border ${theme.inputClass}`}
                                />
                              </label>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {FUNNEL_STEPS.slice(0, -1).map((step) => (
                              <label key={step} className="flex items-center justify-between gap-1 text-[10px]">
                                <span className="truncate">{step.replace(/_/g, ' ')}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="—"
                                  value={profCfg?.conversion?.[step] ?? ''}
                                  onChange={(e) =>
                                    updateTargetingConversion(evtKey, 'profiles', prof, step, e.target.value)
                                  }
                                  className={`w-14 text-right rounded px-1 py-0.5 font-mono border ${theme.inputClass}`}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {personaKeys.length > 0 && (
                      <div className="pt-1 space-y-1.5">
                        <span className={`block text-[10px] font-semibold uppercase ${theme.mutedClass}`}>
                          Specific Persona Overrides
                        </span>
                        {personaKeys.map((pKey) => {
                          const personaCfg = evt.personas?.[pKey];
                          return (
                            <div key={pKey} className="rounded border border-inherit/50 p-2 space-y-1">
                              <span className="text-[10px] capitalize font-semibold">{pKey.replace(/_/g, ' ')}</span>
                              <div className="grid grid-cols-2 gap-2">
                                {(['visit', 'new_user'] as const).map((metric) => (
                                  <label key={metric} className="flex items-center justify-between gap-1 text-[10px]">
                                    <span>{metric === 'new_user' ? 'New user' : 'Visit'}</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="—"
                                      value={personaCfg?.[metric] ?? ''}
                                      onChange={(e) =>
                                        updateTargetingMetric(evtKey, 'personas', pKey, metric, e.target.value)
                                      }
                                      className={`w-14 text-right rounded px-1 py-0.5 font-mono border ${theme.inputClass}`}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {Object.keys(parsedConfig.event || {}).length === 0 && (
          <p className={`text-[11px] ${theme.mutedClass}`}>
            No campaigns yet. Add one to model seasonal traffic spikes or ongoing A/B tests.
          </p>
        )}
      </div>
    </div>
  );
};
