import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Users } from 'lucide-react';
import { ThemeConfig } from '../../types/theme';
import {
  CONVERSION_STEPS,
  MONTHS,
  MutateConfigFn,
  UpdateFieldFn,
  WEEKDAYS,
  sanitizeSlug,
} from './types';

interface PersonasPanelProps {
  parsedConfig: any;
  updateField: UpdateFieldFn;
  mutateConfig: MutateConfigFn;
  theme: ThemeConfig;
}

type PersonaDrawerSection = 'demographics' | 'schedule' | 'funnel' | 'weights';

const DEFAULT_DEMOGRAPHICS = {
  city: {
    south_jakarta: 15,
    tangerang_city: 12,
    west_jakarta: 10,
    east_jakarta: 8,
    central_jakarta: 5,
  },
  gender: {
    female: 10,
    male: 10,
  },
  acquisition_channel: {
    organic: 12,
    paid: 8,
  },
};

export const PersonasPanel: React.FC<PersonasPanelProps> = ({
  parsedConfig,
  updateField,
  mutateConfig,
  theme,
}) => {
  const [openSections, setOpenSections] = useState<Record<string, PersonaDrawerSection | null>>({});
  const [newPersonaName, setNewPersonaName] = useState('');
  const [newWeightKeys, setNewWeightKeys] = useState<Record<string, string>>({});
  const [selectedSubcatCategory, setSelectedSubcatCategory] = useState<Record<string, string>>({});

  const personasObj: Record<string, any> = parsedConfig.personas || {};
  const personaEntries = Object.entries(personasObj);
  const catalogKeys = Object.keys(parsedConfig.catalog || {});

  const toggleSection = (personaKey: string, section: PersonaDrawerSection) => {
    setOpenSections((prev) => ({
      ...prev,
      [personaKey]: prev[personaKey] === section ? null : section,
    }));
  };

  const handleAddPersona = () => {
    const cleanKey =
      sanitizeSlug(newPersonaName) || `persona_${personaEntries.length + 1}`;
    mutateConfig((cfg) => {
      cfg.personas = cfg.personas || {};
      let uniqueKey = cleanKey;
      let idx = 2;
      while (cfg.personas[uniqueKey]) uniqueKey = `${cleanKey}_${idx++}`;

      const categoryWeights: Record<string, number> = {};
      const quantityBias: Record<string, number> = {};
      for (const cat of Object.keys(cfg.catalog || {})) {
        categoryWeights[cat] = 1.0;
        quantityBias[cat] = 1.0;
      }

      cfg.personas[uniqueKey] = {
        profile: 'balanced',
        description: 'Custom shopper persona',
        base_user: 10,
        daily_retry: 2,
        daily_new_user_chance: 0.08,
        daily_new_user_chance_weekend: 0.12,
        visit_chance: {
          monday: 0.05,
          tuesday: 0.05,
          wednesday: 0.05,
          thursday: 0.05,
          friday: 0.06,
          saturday: 0.1,
          sunday: 0.1,
        },
        category_weight: categoryWeights,
        quantity_bias: quantityBias,
        city: { ...DEFAULT_DEMOGRAPHICS.city },
        gender: { ...DEFAULT_DEMOGRAPHICS.gender },
        acquisition_channel: { ...DEFAULT_DEMOGRAPHICS.acquisition_channel },
      };
    });
    setNewPersonaName('');
  };

  const handleRemovePersona = (personaKey: string) => {
    if (personaEntries.length <= 1) return;
    mutateConfig((cfg) => {
      if (cfg.personas) delete cfg.personas[personaKey];
    });
  };

  const addDemographicEntry = (
    personaKey: string,
    group: 'city' | 'gender' | 'acquisition_channel'
  ) => {
    const fieldId = `${personaKey}:${group}`;
    const clean = sanitizeSlug(newWeightKeys[fieldId] || '');
    if (!clean) return;
    mutateConfig((cfg) => {
      const persona = cfg.personas?.[personaKey];
      if (!persona) return;
      if (!persona[group] || typeof persona[group] !== 'object') {
        persona[group] = { ...DEFAULT_DEMOGRAPHICS[group] };
      }
      if (persona[group][clean] === undefined) {
        persona[group][clean] = 10;
      }
    });
    setNewWeightKeys((prev) => ({ ...prev, [fieldId]: '' }));
  };

  const removeDemographicEntry = (
    personaKey: string,
    group: 'city' | 'gender' | 'acquisition_channel',
    entryKey: string
  ) => {
    mutateConfig((cfg) => {
      const map = cfg.personas?.[personaKey]?.[group];
      if (!map || Object.keys(map).length <= 1) return;
      delete map[entryKey];
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className={`text-xs ${theme.mutedClass}`}>
            Configure customer cohorts. Expand sections inside any persona card for demographics, weekday schedules, funnel overrides, and category weights.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="text"
            value={newPersonaName}
            onChange={(e) => setNewPersonaName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddPersona();
            }}
            placeholder="New persona name..."
            className={`w-36 rounded px-2 py-1 text-xs border ${theme.inputClass}`}
          />
          <button
            onClick={handleAddPersona}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border whitespace-nowrap shrink-0 ${theme.buttonClass}`}
          >
            <Plus className="w-3.5 h-3.5" /> Add Persona
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {personaEntries.map(([personaKey, persona]) => {
          const activeDrawer = openSections[personaKey] ?? null;
          const subcatCatKey =
            selectedSubcatCategory[personaKey] && parsedConfig.catalog?.[selectedSubcatCategory[personaKey]]
              ? selectedSubcatCategory[personaKey]
              : catalogKeys[0] || '';
          const subcatsInCat = Object.keys(parsedConfig.catalog?.[subcatCatKey] || {});

          return (
            <div
              key={personaKey}
              className="p-4 rounded-lg border border-inherit bg-black/5 dark:bg-white/5 space-y-3"
            >
              {/* Persona Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-xs capitalize text-emerald-600 dark:text-emerald-400">
                      {personaKey.replace(/_/g, ' ')}
                    </h4>
                    <span className="text-[10px] font-mono opacity-60">{personaKey}</span>
                  </div>
                  <input
                    type="text"
                    value={persona.description ?? ''}
                    placeholder="Persona description..."
                    onChange={(e) => updateField(['personas', personaKey, 'description'], e.target.value)}
                    className={`w-full rounded px-2 py-1 text-[11px] border ${theme.inputClass}`}
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    value={persona.profile ?? 'balanced'}
                    onChange={(e) => updateField(['personas', personaKey, 'profile'], e.target.value)}
                    aria-label={`${personaKey} profile`}
                    className={`rounded px-2 py-1 text-[11px] font-mono border ${theme.inputClass}`}
                  >
                    <option value="conservative">conservative</option>
                    <option value="balanced">balanced</option>
                    <option value="aggressive">aggressive</option>
                  </select>
                  {personaEntries.length > 1 && (
                    <button
                      onClick={() => handleRemovePersona(personaKey)}
                      className="p-1 opacity-60 hover:opacity-100 hover:text-rose-500 transition"
                      title="Delete persona"
                      aria-label={`Delete ${personaKey}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Core Acquisition Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Base Users</label>
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    value={persona.base_user ?? 10}
                    onChange={(e) => updateField(['personas', personaKey, 'base_user'], Number(e.target.value))}
                    className={`w-full rounded px-2 py-1 text-xs font-mono tabular-nums border ${theme.inputClass}`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Daily Retry</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={persona.daily_retry ?? 3}
                    onChange={(e) => updateField(['personas', personaKey, 'daily_retry'], Number(e.target.value))}
                    className={`w-full rounded px-2 py-1 text-xs font-mono tabular-nums border ${theme.inputClass}`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Weekday New %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={persona.daily_new_user_chance ?? 0.1}
                    onChange={(e) =>
                      updateField(['personas', personaKey, 'daily_new_user_chance'], parseFloat(e.target.value))
                    }
                    className={`w-full rounded px-2 py-1 text-xs font-mono tabular-nums border ${theme.inputClass}`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Weekend New %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={persona.daily_new_user_chance_weekend ?? 0.15}
                    onChange={(e) =>
                      updateField(['personas', personaKey, 'daily_new_user_chance_weekend'], parseFloat(e.target.value))
                    }
                    className={`w-full rounded px-2 py-1 text-xs font-mono tabular-nums border ${theme.inputClass}`}
                  />
                </div>
              </div>

              {/* Drawer Selector Tabs (Progressive Disclosure) */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-inherit/50">
                {(
                  [
                    { id: 'weights', label: 'Categories & Qty Bias' },
                    { id: 'demographics', label: 'City, Gender & Channel' },
                    { id: 'schedule', label: 'Weekday & Monthly Visits' },
                    { id: 'funnel', label: 'Funnel & Basket Overrides' },
                  ] as const
                ).map((sec) => {
                  const isOpen = activeDrawer === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => toggleSection(personaKey, sec.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition ${
                        isOpen ? theme.accentClass : `${theme.buttonClass} opacity-85 hover:opacity-100`
                      }`}
                    >
                      {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>{sec.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Drawer 1: Category Weights, Quantity Bias & Subcategory Weights */}
              {activeDrawer === 'weights' && (
                <div className="pt-2 border-t border-inherit/40 space-y-3 text-[11px]">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`font-semibold ${theme.mutedClass}`}>
                        Category Weight & Qty Bias
                      </span>
                      <span className={`text-[10px] ${theme.mutedClass}`}>Weight / Qty λ Mult</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {catalogKeys.map((cat) => {
                        const weight = persona.category_weight?.[cat] ?? 1.0;
                        const bias = persona.quantity_bias?.[cat] ?? 1.0;
                        return (
                          <div key={cat} className="flex items-center justify-between gap-1.5 text-[10px] py-0.5">
                            <span className="truncate capitalize flex-1">{cat.replace(/_/g, ' ')}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="20"
                                title="Category selection weight"
                                value={weight}
                                onChange={(e) =>
                                  updateField(['personas', personaKey, 'category_weight', cat], parseFloat(e.target.value))
                                }
                                className={`w-12 text-right rounded px-1 py-0.5 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                              />
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                max="10"
                                title="Quantity bias multiplier"
                                value={bias}
                                onChange={(e) =>
                                  updateField(['personas', personaKey, 'quantity_bias', cat], parseFloat(e.target.value))
                                }
                                className={`w-12 text-right rounded px-1 py-0.5 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Subcategory Weight Overrides */}
                  {catalogKeys.length > 0 && (
                    <div className="pt-2 border-t border-inherit/40 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className={`font-semibold ${theme.mutedClass}`}>
                          Subcategory Weight Overrides
                        </span>
                        <select
                          value={subcatCatKey}
                          onChange={(e) =>
                            setSelectedSubcatCategory((prev) => ({ ...prev, [personaKey]: e.target.value }))
                          }
                          className={`rounded px-1.5 py-0.5 text-[10px] border ${theme.inputClass}`}
                        >
                          {catalogKeys.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {subcatsInCat.map((subKey) => {
                          const val = persona.subcategory_weight?.[subcatCatKey]?.[subKey];
                          return (
                            <label key={subKey} className="flex items-center justify-between gap-1 text-[10px]">
                              <span className="truncate capitalize">{subKey.replace(/_/g, ' ')}</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="1.0"
                                value={val ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  mutateConfig((cfg) => {
                                    const p = cfg.personas?.[personaKey];
                                    if (!p) return;
                                    if (raw === '') {
                                      if (p.subcategory_weight?.[subcatCatKey]) {
                                        delete p.subcategory_weight[subcatCatKey][subKey];
                                        if (Object.keys(p.subcategory_weight[subcatCatKey]).length === 0) {
                                          delete p.subcategory_weight[subcatCatKey];
                                        }
                                        if (Object.keys(p.subcategory_weight).length === 0) {
                                          delete p.subcategory_weight;
                                        }
                                      }
                                    } else {
                                      p.subcategory_weight = p.subcategory_weight || {};
                                      p.subcategory_weight[subcatCatKey] = p.subcategory_weight[subcatCatKey] || {};
                                      p.subcategory_weight[subcatCatKey][subKey] = parseFloat(raw);
                                    }
                                  });
                                }}
                                className={`w-12 text-right rounded px-1 py-0.5 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Drawer 2: Demographics (City, Gender, Acquisition Channel) */}
              {activeDrawer === 'demographics' && (
                <div className="pt-2 border-t border-inherit/40 space-y-3 text-[11px]">
                  {(
                    [
                      { key: 'city', label: 'City Weights' },
                      { key: 'gender', label: 'Gender Weights' },
                      { key: 'acquisition_channel', label: 'Acquisition Channels' },
                    ] as const
                  ).map((group) => {
                    const activeMap: Record<string, number> =
                      persona[group.key] && Object.keys(persona[group.key]).length > 0
                        ? persona[group.key]
                        : DEFAULT_DEMOGRAPHICS[group.key];
                    const fieldId = `${personaKey}:${group.key}`;
                    return (
                      <div key={group.key} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-semibold ${theme.mutedClass}`}>{group.label}</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={newWeightKeys[fieldId] || ''}
                              onChange={(e) =>
                                setNewWeightKeys((prev) => ({ ...prev, [fieldId]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') addDemographicEntry(personaKey, group.key);
                              }}
                              placeholder={`Add ${group.key.replace('_', ' ')}...`}
                              className={`w-28 rounded px-1.5 py-0.5 text-[10px] border ${theme.inputClass}`}
                            />
                            <button
                              onClick={() => addDemographicEntry(personaKey, group.key)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${theme.buttonClass}`}
                              title={`Add ${group.key}`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {Object.entries(activeMap).map(([entryKey, weight]) => (
                            <div
                              key={entryKey}
                              className="flex items-center justify-between gap-1 text-[10px] rounded border border-inherit/60 px-1.5 py-1"
                            >
                              <span className="truncate capitalize">{entryKey.replace(/_/g, ' ')}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={weight}
                                  onChange={(e) => {
                                    const num = parseFloat(e.target.value);
                                    mutateConfig((cfg) => {
                                      const p = cfg.personas?.[personaKey];
                                      if (!p) return;
                                      if (!p[group.key]) {
                                        p[group.key] = { ...DEFAULT_DEMOGRAPHICS[group.key] };
                                      }
                                      p[group.key][entryKey] = Number.isFinite(num) ? num : 0;
                                    });
                                  }}
                                  className={`w-11 text-right rounded px-1 py-0.5 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                                />
                                {Object.keys(activeMap).length > 1 && persona[group.key]?.[entryKey] !== undefined && (
                                  <button
                                    onClick={() => removeDemographicEntry(personaKey, group.key, entryKey)}
                                    className="opacity-50 hover:opacity-100 hover:text-rose-500"
                                    title={`Remove ${entryKey}`}
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Drawer 3: Weekday & Monthly Visit Schedule */}
              {activeDrawer === 'schedule' && (
                <div className="pt-2 border-t border-inherit/40 space-y-3 text-[11px]">
                  <div className="space-y-1.5">
                    <span className={`block font-semibold ${theme.mutedClass}`}>
                      Weekday Visit Probability (Mon–Sun)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {WEEKDAYS.map((day) => {
                        const val =
                          persona.visit_chance?.[day] ??
                          parsedConfig.simulation?.visit_chance?.[day] ??
                          (day === 'saturday' || day === 'sunday' ? 0.08 : 0.05);
                        return (
                          <label key={day} className="flex items-center justify-between gap-1 text-[10px]">
                            <span className="capitalize">{day.slice(0, 3)}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="1"
                              value={val}
                              onChange={(e) =>
                                updateField(['personas', personaKey, 'visit_chance', day], parseFloat(e.target.value))
                              }
                              className={`w-14 text-right rounded px-1 py-0.5 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-inherit/40 space-y-1.5">
                    <span className={`block font-semibold ${theme.mutedClass}`}>
                      Monthly Visit Multiplier (Jan–Dec)
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                      {MONTHS.map((m) => (
                        <label key={m} className="flex items-center justify-between gap-1 text-[10px]">
                          <span className="capitalize">{m.slice(0, 3)}</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="5"
                            value={persona.monthly_visit_chance_multiplier?.[m] ?? 1.0}
                            onChange={(e) =>
                              updateField(
                                ['personas', personaKey, 'monthly_visit_chance_multiplier', m],
                                parseFloat(e.target.value)
                              )
                            }
                            className={`w-12 text-right rounded px-1 py-0.5 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Drawer 4: Funnel & Basket Overrides */}
              {activeDrawer === 'funnel' && (
                <div className="pt-2 border-t border-inherit/40 space-y-3 text-[11px]">
                  <div className="space-y-1.5">
                    <span className={`block font-semibold ${theme.mutedClass}`}>
                      Persona Conversion Rates (Overrides Global Funnel)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {CONVERSION_STEPS.map((step) => {
                        const rate =
                          persona[step.key]?.conversion_rate ??
                          parsedConfig.funnel?.[step.key]?.conversion_rate ??
                          step.fallback;
                        return (
                          <label key={step.key} className="flex items-center justify-between gap-1 text-[10px]">
                            <span>{step.label}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="1"
                              value={rate}
                              onChange={(e) =>
                                updateField(['personas', personaKey, step.key, 'conversion_rate'], parseFloat(e.target.value))
                              }
                              className={`w-14 text-right rounded px-1 py-0.5 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-inherit/40 grid grid-cols-3 gap-2">
                    <div>
                      <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Basket Min</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={persona.basket?.min_items ?? parsedConfig.simulation?.basket?.min_items ?? 1}
                        onChange={(e) => updateField(['personas', personaKey, 'basket', 'min_items'], Number(e.target.value))}
                        className={`w-full rounded px-2 py-1 text-xs font-mono tabular-nums border ${theme.inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Basket Max</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={persona.basket?.max_items ?? parsedConfig.simulation?.basket?.max_items ?? 12}
                        onChange={(e) => updateField(['personas', personaKey, 'basket', 'max_items'], Number(e.target.value))}
                        className={`w-full rounded px-2 py-1 text-xs font-mono tabular-nums border ${theme.inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] block mb-0.5 ${theme.mutedClass}`}>Qty Base λ</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="10"
                        value={persona.quantity_model?.base_lambda ?? parsedConfig.simulation?.quantity_model?.base_lambda ?? 1.0}
                        onChange={(e) =>
                          updateField(['personas', personaKey, 'quantity_model', 'base_lambda'], parseFloat(e.target.value))
                        }
                        className={`w-full rounded px-2 py-1 text-xs font-mono tabular-nums border ${theme.inputClass}`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
