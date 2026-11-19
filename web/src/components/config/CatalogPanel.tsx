import React, { useState } from 'react';
import { Package, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { ThemeConfig } from '../../types/theme';
import { MutateConfigFn, UpdateFieldFn, sanitizeSlug } from './types';

interface CatalogPanelProps {
  parsedConfig: any;
  updateField: UpdateFieldFn;
  mutateConfig: MutateConfigFn;
  theme: ThemeConfig;
}

export const CatalogPanel: React.FC<CatalogPanelProps> = ({
  parsedConfig,
  updateField,
  mutateConfig,
  theme,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcatName, setNewSubcatName] = useState('');
  const [newProductDrafts, setNewProductDrafts] = useState<
    Record<string, { name: string; base_price: number; weight: number }>
  >({});

  const catalogObj: Record<string, Record<string, any>> = parsedConfig.catalog || {};
  const duplicateRules: Record<string, boolean> =
    parsedConfig.simulation?.subcategory_allow_duplicates || {};

  const activeCategory =
    selectedCategory && catalogObj[selectedCategory] ? selectedCategory : null;

  const handleAddCategory = () => {
    const cleanCat = sanitizeSlug(newCategoryName);
    if (!cleanCat) return;
    mutateConfig((cfg) => {
      cfg.catalog = cfg.catalog || {};
      if (!cfg.catalog[cleanCat]) {
        cfg.catalog[cleanCat] = {
          general_items: {
            cooldown: 1,
            product: {
              sample_item: { base_price: 15000, weight: 1.0 },
            },
          },
        };
      }
      // Ensure tiers include default weight for the new category
      for (const tier of Object.values<any>(cfg.tiers || {})) {
        if (tier.category_weight && tier.category_weight[cleanCat] === undefined) {
          tier.category_weight[cleanCat] = 1.0;
        }
      }
    });
    setSelectedCategory(cleanCat);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (catKey: string) => {
    if (Object.keys(catalogObj).length <= 1) return;
    mutateConfig((cfg) => {
      if (cfg.catalog) delete cfg.catalog[catKey];
      for (const tier of Object.values<any>(cfg.tiers || {})) {
        if (tier.category_weight) delete tier.category_weight[catKey];
        if (tier.quantity_bias) delete tier.quantity_bias[catKey];
      }
    });
    if (selectedCategory === catKey) setSelectedCategory(null);
  };

  const handleAddSubcategory = (catKey: string) => {
    const cleanSub = sanitizeSlug(newSubcatName);
    if (!cleanSub) return;
    mutateConfig((cfg) => {
      cfg.catalog[catKey] = cfg.catalog[catKey] || {};
      if (!cfg.catalog[catKey][cleanSub]) {
        cfg.catalog[catKey][cleanSub] = {
          cooldown: 1,
          product: {
            [`${cleanSub}_standard`]: { base_price: 15000, weight: 1.0 },
          },
        };
      }
      cfg.simulation = cfg.simulation || {};
      cfg.simulation.subcategory_allow_duplicates =
        cfg.simulation.subcategory_allow_duplicates || {};
      if (cfg.simulation.subcategory_allow_duplicates[cleanSub] === undefined) {
        cfg.simulation.subcategory_allow_duplicates[cleanSub] = true;
      }
    });
    setNewSubcatName('');
  };

  const handleDeleteSubcategory = (catKey: string, subKey: string) => {
    mutateConfig((cfg) => {
      if (cfg.catalog?.[catKey]) {
        delete cfg.catalog[catKey][subKey];
      }
    });
  };

  const handleToggleDuplicates = (subcatKey: string) => {
    const current = duplicateRules[subcatKey] !== false;
    updateField(['simulation', 'subcategory_allow_duplicates', subcatKey], !current);
  };

  const handleAddProduct = (catKey: string, subKey: string) => {
    const draft = newProductDrafts[subKey] || {
      name: '',
      base_price: 15000,
      weight: 1.0,
    };
    const cleanProd = sanitizeSlug(draft.name);
    if (!cleanProd) return;
    mutateConfig((cfg) => {
      const sub = cfg.catalog?.[catKey]?.[subKey];
      if (!sub) return;
      sub.product = sub.product || {};
      sub.product[cleanProd] = {
        base_price: Math.max(100, Number(draft.base_price) || 10000),
        weight: Math.max(0.01, Number(draft.weight) || 1.0),
      };
    });
    setNewProductDrafts((prev) => ({
      ...prev,
      [subKey]: { name: '', base_price: 15000, weight: 1.0 },
    }));
  };

  const handleRemoveProduct = (catKey: string, subKey: string, prodKey: string) => {
    mutateConfig((cfg) => {
      const products = cfg.catalog?.[catKey]?.[subKey]?.product;
      if (!products || Object.keys(products).length <= 1) return;
      delete products[prodKey];
    });
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className={theme.mutedClass}>
            Adjust subcategory cooldowns &amp; duplicate rules inline, or inspect any category to add SKUs and adjust IDR pricing.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCategory();
            }}
            placeholder="New category..."
            className={`w-36 rounded px-2 py-1 text-xs border ${theme.inputClass}`}
          />
          <button
            onClick={handleAddCategory}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border whitespace-nowrap shrink-0 ${theme.buttonClass}`}
          >
            <Plus className="w-3.5 h-3.5" /> Add Category
          </button>
        </div>
      </div>

      {/* Selected Category SKU & Product Inspector Drawer */}
      {activeCategory && (
        <div className={`p-4 rounded-lg border ${theme.borderClass} ${theme.cardClass} space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-inherit">
            <div>
              <span className="font-bold text-sm uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {activeCategory.replace(/_/g, ' ')} — SKU &amp; Pricing Editor
              </span>
              <p className={`text-[11px] ${theme.mutedClass}`}>
                Add products to subcategories, tune selection weights, or set per-SKU cooldown overrides.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newSubcatName}
                  onChange={(e) => setNewSubcatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubcategory(activeCategory);
                  }}
                  placeholder="Add subcategory..."
                  className={`w-36 rounded px-2 py-1 text-xs border ${theme.inputClass}`}
                />
                <button
                  onClick={() => handleAddSubcategory(activeCategory)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border ${theme.buttonClass}`}
                >
                  <Plus className="w-3 h-3" /> Subcategory
                </button>
              </div>
              {Object.keys(catalogObj).length > 1 && (
                <button
                  onClick={() => handleDeleteCategory(activeCategory)}
                  className="p-1.5 rounded border border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
                  title="Delete category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setSelectedCategory(null)}
                className={`p-1.5 rounded border ${theme.buttonClass}`}
                title="Close inspector"
                aria-label="Close category inspector"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {Object.entries<any>(catalogObj[activeCategory] || {}).map(([subKey, subcat]) => {
              const allowDup = duplicateRules[subKey] !== false;
              const products = Object.entries<any>(subcat.product || {});
              const draft = newProductDrafts[subKey] || {
                name: '',
                base_price: 15000,
                weight: 1.0,
              };

              return (
                <div key={subKey} className="p-3 rounded border border-inherit bg-black/5 dark:bg-white/5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-xs capitalize">{subKey.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-[10px]">
                        <span className={theme.mutedClass}>Cooldown (d):</span>
                        <input
                          type="number"
                          min="0"
                          max="90"
                          value={subcat.cooldown ?? 1}
                          onChange={(e) =>
                            updateField(['catalog', activeCategory, subKey, 'cooldown'], Number(e.target.value))
                          }
                          className={`w-12 text-right rounded px-1 py-0.5 font-mono tabular-nums border ${theme.inputClass}`}
                        />
                      </label>
                      <button
                        onClick={() => handleToggleDuplicates(subKey)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                          allowDup
                            ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                            : 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                        }`}
                        title="Toggle whether multiple products from this subcategory can appear in one basket"
                      >
                        {allowDup ? 'Dup: Allow' : 'Dup: 1x/Basket'}
                      </button>
                      {Object.keys(catalogObj[activeCategory] || {}).length > 1 && (
                        <button
                          onClick={() => handleDeleteSubcategory(activeCategory, subKey)}
                          className="opacity-60 hover:opacity-100 hover:text-rose-500"
                          title="Delete subcategory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Product List */}
                  <div className="space-y-1.5">
                    <div className={`grid grid-cols-12 gap-1.5 text-[10px] font-semibold ${theme.mutedClass} px-1`}>
                      <span className="col-span-5">Product SKU</span>
                      <span className="col-span-3 text-right">Price (IDR)</span>
                      <span className="col-span-2 text-right">Weight</span>
                      <span className="col-span-2 text-right">CD</span>
                    </div>
                    {products.map(([prodKey, prod]) => (
                      <div key={prodKey} className="grid grid-cols-12 gap-1.5 items-center text-[11px]">
                        <span className="col-span-5 truncate font-mono text-[10px]" title={prodKey}>
                          {prodKey}
                        </span>
                        <input
                          type="number"
                          min="100"
                          step="500"
                          value={prod.base_price ?? 10000}
                          onChange={(e) =>
                            updateField(
                              ['catalog', activeCategory, subKey, 'product', prodKey, 'base_price'],
                              Number(e.target.value)
                            )
                          }
                          className={`col-span-3 text-right rounded px-1.5 py-0.5 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                        />
                        <input
                          type="number"
                          min="0.01"
                          step="0.1"
                          value={prod.weight ?? 1.0}
                          onChange={(e) =>
                            updateField(
                              ['catalog', activeCategory, subKey, 'product', prodKey, 'weight'],
                              parseFloat(e.target.value)
                            )
                          }
                          className={`col-span-2 text-right rounded px-1 py-0.5 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                        />
                        <div className="col-span-2 flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            placeholder="—"
                            title="Optional SKU cooldown override in days"
                            value={prod.cooldown ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              mutateConfig((cfg) => {
                                const p = cfg.catalog?.[activeCategory]?.[subKey]?.product?.[prodKey];
                                if (!p) return;
                                if (raw === '') delete p.cooldown;
                                else p.cooldown = Number(raw);
                              });
                            }}
                            className={`w-10 text-right rounded px-1 py-0.5 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                          />
                          {products.length > 1 && (
                            <button
                              onClick={() => handleRemoveProduct(activeCategory, subKey, prodKey)}
                              className="opacity-50 hover:opacity-100 hover:text-rose-500"
                              title={`Remove ${prodKey}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add New Product Row */}
                  <div className="pt-2 border-t border-inherit/40 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) =>
                        setNewProductDrafts((prev) => ({
                          ...prev,
                          [subKey]: { ...draft, name: e.target.value },
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddProduct(activeCategory, subKey);
                      }}
                      placeholder="new_sku_name"
                      className={`flex-1 min-w-0 rounded px-2 py-1 text-[10px] font-mono border ${theme.inputClass}`}
                    />
                    <input
                      type="number"
                      min="100"
                      step="500"
                      value={draft.base_price}
                      onChange={(e) =>
                        setNewProductDrafts((prev) => ({
                          ...prev,
                          [subKey]: { ...draft, base_price: Number(e.target.value) },
                        }))
                      }
                      placeholder="IDR"
                      className={`w-20 text-right rounded px-1.5 py-1 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                    />
                    <button
                      onClick={() => handleAddProduct(activeCategory, subKey)}
                      className={`flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-semibold border shrink-0 ${theme.buttonClass}`}
                    >
                      <Plus className="w-3 h-3" /> SKU
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Category Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries<any>(catalogObj).map(([catKey, subcats]) => {
          const totalProducts = Object.values<any>(subcats || {}).reduce(
            (sum, s) => sum + Object.keys(s.product || {}).length,
            0
          );
          const isSelected = activeCategory === catKey;
          return (
            <div
              key={catKey}
              className={`p-3.5 rounded-lg border transition space-y-2 ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-inherit bg-black/5 dark:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {catKey.replace(/_/g, ' ')}
                  </span>
                  <span className="ml-2 text-[10px] opacity-70 font-mono tabular-nums">
                    {totalProducts} SKUs
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCategory(isSelected ? null : catKey)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                    isSelected ? theme.accentClass : theme.buttonClass
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>{isSelected ? 'Editing' : 'Edit SKUs'}</span>
                </button>
              </div>

              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {Object.entries<any>(subcats || {}).map(([subcatKey, subcat]) => {
                  const allowDup = duplicateRules[subcatKey] !== false;
                  return (
                    <div key={subcatKey} className="flex items-center justify-between text-[11px] py-0.5 gap-1">
                      <span className="truncate capitalize flex-1">{subcatKey.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleToggleDuplicates(subcatKey)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition ${
                            allowDup
                              ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                              : 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                          }`}
                          title={
                            allowDup
                              ? 'Multiple items from this subcategory allowed per basket'
                              : 'Max 1 item from this subcategory per basket'
                          }
                        >
                          {allowDup ? 'dup:on' : 'dup:off'}
                        </button>
                        <span className={`text-[10px] ${theme.mutedClass}`}>CD:</span>
                        <input
                          type="number"
                          min="0"
                          max="90"
                          value={subcat.cooldown ?? 1}
                          onChange={(e) =>
                            updateField(['catalog', catKey, subcatKey, 'cooldown'], Number(e.target.value))
                          }
                          className={`w-10 text-right rounded px-1 py-0.5 text-[10px] font-mono tabular-nums border ${theme.inputClass}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
