import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts';
import { TrendingUp, ShoppingCart, DollarSign, Percent, Award, GitCompareArrows, Layers, FileDiff, ChevronDown, ChevronUp, Cpu } from 'lucide-react';
import { DailyMetric, SimulationSummary } from '../types/simulation';
import { ThemeConfig } from '../types/theme';
import { DEFAULT_CONFIG_YAML } from '../engine/defaultConfig';
import { EngineKind } from '../engine/workerProtocol';
import { diffYamlConfigs, formatDiffValue } from '../utils/yamlDiff';

interface SummaryDashboardProps {
  summary: SimulationSummary;
  baselineSummary: SimulationSummary | null;
  configYaml?: string;
  engineUsed?: EngineKind | null;
  elapsedMs?: number | null;
  theme: ThemeConfig;
}

type AggregationInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface AggregatedBucket {
  label: string;
  revenue: number;
  baselineRevenue: number;
  diffRevenue: number;
  diffPct: number | null;
  transactions: number;
  baselineTransactions: number;
  diffTransactions: number;
}

function aggregateMetrics(raw: DailyMetric[], interval: AggregationInterval): Map<string, { label: string; revenue: number; transactions: number }> {
  const result = new Map<string, { label: string; revenue: number; transactions: number }>();
  if (raw.length === 0) return result;

  if (interval === 'daily') {
    raw.forEach((d, idx) => {
      const key = `${idx}:${d.date}`;
      result.set(key, {
        label: d.date.slice(5),
        revenue: d.gross_revenue,
        transactions: d.transactions,
      });
    });
    return result;
  }

  if (interval === 'weekly') {
    let currentWeekRev = 0;
    let currentWeekTrx = 0;
    let weekNumber = 1;
    for (let i = 0; i < raw.length; i++) {
      currentWeekRev += raw[i].gross_revenue;
      currentWeekTrx += raw[i].transactions;
      if ((i + 1) % 7 === 0 || i === raw.length - 1) {
        const label = `W${weekNumber}`;
        result.set(label, {
          label,
          revenue: currentWeekRev,
          transactions: currentWeekTrx,
        });
        currentWeekRev = 0;
        currentWeekTrx = 0;
        weekNumber++;
      }
    }
    return result;
  }

  if (interval === 'monthly') {
    for (const d of raw) {
      const monthKey = d.date.slice(0, 7);
      const existing = result.get(monthKey) || { label: monthKey, revenue: 0, transactions: 0 };
      existing.revenue += d.gross_revenue;
      existing.transactions += d.transactions;
      result.set(monthKey, existing);
    }
    return result;
  }

  for (const d of raw) {
    const yearKey = d.date.slice(0, 4);
    const existing = result.get(yearKey) || { label: yearKey, revenue: 0, transactions: 0 };
    existing.revenue += d.gross_revenue;
    existing.transactions += d.transactions;
    result.set(yearKey, existing);
  }
  return result;
}

export const SummaryDashboard: React.FC<SummaryDashboardProps> = ({
  summary,
  baselineSummary,
  configYaml,
  engineUsed,
  elapsedMs,
  theme,
}) => {
  const [interval, setInterval] = useState<AggregationInterval>('daily');
  const [showAllDiffs, setShowAllDiffs] = useState(false);
  const [isDiffExpanded, setIsDiffExpanded] = useState(true);

  const yamlDiff = useMemo(() => {
    if (!configYaml) return { entries: [], parseError: null };
    return diffYamlConfigs(DEFAULT_CONFIG_YAML, configYaml);
  }, [configYaml]);

  const visibleDiffs = showAllDiffs ? yamlDiff.entries : yamlDiff.entries.slice(0, 8);

  const formatIDR = (val: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);

  const formatSignedIDR = (val: number) => {
    const prefix = val > 0 ? '+' : val < 0 ? '-' : '';
    return `${prefix}${formatIDR(Math.abs(val))}`;
  };

  const formatCompactIDR = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k`;
    return `${val}`;
  };

  const userDays = Math.max(1, summary.daily_metrics.length);
  const baselineDays = baselineSummary ? Math.max(1, baselineSummary.daily_metrics.length) : userDays;
  const startDate = summary.daily_metrics[0]?.date || '';
  const endDate = summary.daily_metrics[summary.daily_metrics.length - 1]?.date || '';

  const baselineLineColor = theme.mode === 'dark' ? '#94a3b8' : '#64748b';
  const positiveColor = '#10b981';
  const negativeColor = '#f43f5e';

  const computeDelta = (current: number, baseline: number) => {
    if (!baselineSummary || baseline === 0) return null;
    const diff = current - baseline;
    const pct = (diff / baseline) * 100;
    const sign = pct >= 0 ? '+' : '';
    return {
      diff,
      pct,
      text: `${sign}${pct.toFixed(1)}% vs ${baselineDays}d baseline`,
      isPositive: diff >= 0,
    };
  };

  const revenueDelta = baselineSummary ? computeDelta(summary.total_revenue, baselineSummary.total_revenue) : null;
  const ordersDelta = baselineSummary ? computeDelta(summary.total_transactions, baselineSummary.total_transactions) : null;
  const aovDelta = baselineSummary ? computeDelta(summary.average_order_value, baselineSummary.average_order_value) : null;
  const convDelta = baselineSummary ? computeDelta(summary.overall_conversion_rate, baselineSummary.overall_conversion_rate) : null;

  // Prepare Funnel Comparison Data
  const funnelStages = ['landing_page', 'product_view', 'add_to_cart', 'checkout', 'paid'];
  const funnelData = funnelStages.map((stage) => {
    const count = summary.funnel_breakdown[stage] || 0;
    const baseCount = summary.funnel_breakdown['landing_page'] || 1;
    const baselineCount = baselineSummary?.funnel_breakdown[stage] || 0;
    const baselineBaseCount = baselineSummary?.funnel_breakdown['landing_page'] || 1;
    const diff = count - baselineCount;
    const diffPct = baselineCount > 0 ? (diff / baselineCount) * 100 : null;
    return {
      stage: stage.replace(/_/g, ' ').toUpperCase(),
      sessions: count,
      baselineSessions: baselineCount,
      diff,
      diffPct,
      dropoffPct: Math.round((count / baseCount) * 100),
      baselineDropoffPct: Math.round((baselineCount / baselineBaseCount) * 100),
    };
  });

  // Aggregate Current & Baseline metrics side-by-side across Daily / Weekly / Monthly / Yearly
  const aggregatedComparisonData: AggregatedBucket[] = useMemo(() => {
    const currentMap = aggregateMetrics(summary.daily_metrics, interval);
    const baselineMap = aggregateMetrics(baselineSummary?.daily_metrics || [], interval);

    const orderedKeys: string[] = [];
    const seen = new Set<string>();
    for (const k of currentMap.keys()) {
      orderedKeys.push(k);
      seen.add(k);
    }
    for (const k of baselineMap.keys()) {
      if (!seen.has(k)) orderedKeys.push(k);
    }

    return orderedKeys.map((key) => {
      const cur = currentMap.get(key);
      const base = baselineMap.get(key);
      const revenue = cur?.revenue ?? 0;
      const baselineRevenue = base?.revenue ?? 0;
      const diffRevenue = revenue - baselineRevenue;
      const diffPct = baselineRevenue > 0 ? (diffRevenue / baselineRevenue) * 100 : null;
      const transactions = cur?.transactions ?? 0;
      const baselineTransactions = base?.transactions ?? 0;
      return {
        label: cur?.label || base?.label || key,
        revenue,
        baselineRevenue,
        diffRevenue,
        diffPct,
        transactions,
        baselineTransactions,
        diffTransactions: transactions - baselineTransactions,
      };
    });
  }, [summary.daily_metrics, baselineSummary, interval]);

  // Category Revenue Comparison sorted by absolute variance
  const categoryComparison = useMemo(() => {
    const catKeys = new Set([
      ...Object.keys(summary.category_revenue || {}),
      ...Object.keys(baselineSummary?.category_revenue || {}),
    ]);
    return Array.from(catKeys)
      .map((category) => {
        const current = summary.category_revenue[category] || 0;
        const baseline = baselineSummary?.category_revenue[category] || 0;
        const diff = current - baseline;
        const diffPct = baseline > 0 ? (diff / baseline) * 100 : null;
        return {
          category: category.replace(/_/g, ' '),
          current,
          baseline,
          diff,
          diffPct,
        };
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || b.current - a.current)
      .slice(0, 8);
  }, [summary.category_revenue, baselineSummary]);

  return (
    <div className="space-y-6">
      {/* Matched Horizon Context Strip + Engine Metadata */}
      {baselineSummary && (
        <div className={`px-4 py-2.5 border ${theme.borderClass} ${theme.cardClass} flex flex-wrap items-center justify-between gap-2 text-xs`}>
          <div className="flex items-center gap-2 flex-wrap">
            <GitCompareArrows className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">Matched Baseline Active:</span>
            <span className={theme.mutedClass}>
              Comparing <span className="font-mono font-semibold">{userDays} days</span> ({startDate} &rarr; {endDate}) against default config over the same <span className="font-mono font-semibold">{baselineDays}-day</span> window.
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-4 text-[11px] font-mono">
            {engineUsed && (
              <span className={`flex items-center gap-1 ${theme.mutedClass}`}>
                <Cpu className="w-3.5 h-3.5" />
                {engineUsed === 'wasm' ? 'Rust / Wasm' : 'TS Worker'}
                {typeof elapsedMs === 'number' ? ` (${elapsedMs}ms)` : ''}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5" style={{ backgroundColor: theme.chartLineColor }} />
              Current
            </span>
            <span className="flex items-center gap-1.5 opacity-80">
              <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: baselineLineColor }} />
              Baseline ({baselineDays}d)
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className={`p-5 border ${theme.borderClass} ${theme.cardClass} flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">
            <span>Total Revenue</span>
            <DollarSign className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight">{formatIDR(summary.total_revenue)}</div>
          {baselineSummary && (
            <div className={`text-[11px] font-mono mt-1 ${theme.mutedClass}`}>
              Baseline ({baselineDays}d): {formatIDR(baselineSummary.total_revenue)}
            </div>
          )}
          {revenueDelta && (
            <div className={`text-xs mt-1.5 font-medium font-mono ${revenueDelta.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {revenueDelta.text} ({formatSignedIDR(revenueDelta.diff)})
            </div>
          )}
        </div>

        {/* Completed Orders */}
        <div className={`p-5 border ${theme.borderClass} ${theme.cardClass} flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">
            <span>Completed Orders</span>
            <ShoppingCart className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight">
            {summary.total_transactions.toLocaleString()}
          </div>
          {baselineSummary && (
            <div className={`text-[11px] font-mono mt-1 ${theme.mutedClass}`}>
              Baseline ({baselineDays}d): {baselineSummary.total_transactions.toLocaleString()}
            </div>
          )}
          {ordersDelta && (
            <div className={`text-xs mt-1.5 font-medium font-mono ${ordersDelta.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {ordersDelta.text} ({ordersDelta.diff >= 0 ? '+' : ''}{ordersDelta.diff.toLocaleString()})
            </div>
          )}
        </div>

        {/* Funnel Conversion */}
        <div className={`p-5 border ${theme.borderClass} ${theme.cardClass} flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">
            <span>Funnel Conversion</span>
            <Percent className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight">
            {(summary.overall_conversion_rate * 100).toFixed(2)}%
          </div>
          {baselineSummary && (
            <div className={`text-[11px] font-mono mt-1 ${theme.mutedClass}`}>
              Baseline ({baselineDays}d): {(baselineSummary.overall_conversion_rate * 100).toFixed(2)}%
            </div>
          )}
          {convDelta && (
            <div className={`text-xs mt-1.5 font-medium font-mono ${convDelta.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {convDelta.text} ({convDelta.diff >= 0 ? '+' : ''}{(convDelta.diff * 100).toFixed(2)} pp)
            </div>
          )}
        </div>

        {/* Average Order Value */}
        <div className={`p-5 border ${theme.borderClass} ${theme.cardClass} flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">
            <span>Average Order Value</span>
            <TrendingUp className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight">{formatIDR(summary.average_order_value)}</div>
          {baselineSummary && (
            <div className={`text-[11px] font-mono mt-1 ${theme.mutedClass}`}>
              Baseline ({baselineDays}d): {formatIDR(baselineSummary.average_order_value)}
            </div>
          )}
          {aovDelta && (
            <div className={`text-xs mt-1.5 font-medium font-mono ${aovDelta.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {aovDelta.text} ({formatSignedIDR(aovDelta.diff)})
            </div>
          )}
        </div>
      </div>

      {/* Visual Charts Grid: Funnel Comparison + Revenue Overlay */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Journey BarChart (Current vs Baseline) */}
        <div className={`p-5 border ${theme.borderClass} ${theme.cardClass} flex flex-col`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">Conversion Drop-off: Current vs. Baseline</h3>
              <p className={`text-xs ${theme.mutedClass}`}>Surviving sessions across stages ({baselineDays}d comparison)</p>
            </div>
            <span className="text-xs font-mono font-semibold opacity-80">
              {funnelData[funnelData.length - 1]?.dropoffPct}% End-to-End
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.chartGridColor} vertical={false} />
                <XAxis dataKey="stage" tick={{ fill: theme.chartTickColor, fontSize: 10 }} />
                <YAxis tick={{ fill: theme.chartTickColor, fontSize: 10 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload;
                    const sign = row.diff >= 0 ? '+' : '';
                    return (
                      <div
                        className="p-2.5 rounded-lg border text-xs shadow-md font-mono space-y-1"
                        style={{ backgroundColor: theme.chartTooltipBg, borderColor: theme.chartTooltipBorder }}
                      >
                        <div className="font-bold">{label}</div>
                        <div>Current: {row.sessions.toLocaleString()} ({row.dropoffPct}%)</div>
                        {baselineSummary && (
                          <>
                            <div className="opacity-75">Baseline: {row.baselineSessions.toLocaleString()} ({row.baselineDropoffPct}%)</div>
                            <div className={row.diff >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                              Diff: {sign}{row.diff.toLocaleString()} {row.diffPct !== null ? `(${sign}${row.diffPct.toFixed(1)}%)` : ''}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="sessions" name="Current" fill={theme.chartBarColor} radius={[4, 4, 0, 0]} />
                {baselineSummary && (
                  <Bar dataKey="baselineSessions" name={`Baseline (${baselineDays}d)`} fill={baselineLineColor} opacity={0.45} radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stage-by-stage Delta Strip */}
          {baselineSummary && (
            <div className={`grid grid-cols-5 gap-2 mt-4 pt-3 border-t ${theme.borderClass}`}>
              {funnelData.map((row) => (
                <div key={row.stage} className="text-center">
                  <div className={`text-[10px] truncate ${theme.mutedClass}`}>{row.stage}</div>
                  <div
                    className={`text-[11px] font-mono font-bold ${
                      row.diff === 0
                        ? theme.mutedClass
                        : row.diff > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {row.diffPct === null ? '—' : `${row.diff >= 0 ? '+' : ''}${row.diffPct.toFixed(1)}%`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue Timeline: Current vs Baseline Overlay */}
        <div className={`p-5 border ${theme.borderClass} ${theme.cardClass} flex flex-col`}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">Revenue Trend: Current vs. Baseline</h3>
              <p className={`text-xs ${theme.mutedClass}`}>Overlay across {interval} intervals</p>
            </div>

            {/* Aggregation Toggles: Daily, Weekly, Monthly, Yearly */}
            <div className="flex items-center gap-1 p-0.5 rounded border border-inherit bg-black/5 dark:bg-white/5 text-[11px]">
              {(['daily', 'weekly', 'monthly', 'yearly'] as AggregationInterval[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInterval(mode)}
                  className={`px-2 py-0.5 rounded capitalize font-medium transition ${
                    interval === mode ? theme.accentClass : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aggregatedComparisonData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.chartGridColor} />
                <XAxis dataKey="label" tick={{ fill: theme.chartTickColor, fontSize: 9 }} />
                <YAxis tick={{ fill: theme.chartTickColor, fontSize: 9 }} tickFormatter={formatCompactIDR} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as AggregatedBucket;
                    return (
                      <div
                        className="p-2.5 rounded-lg border text-xs shadow-md font-mono space-y-1"
                        style={{ backgroundColor: theme.chartTooltipBg, borderColor: theme.chartTooltipBorder }}
                      >
                        <div className="font-bold">{label}</div>
                        <div>Current: {formatIDR(row.revenue)} ({row.transactions} orders)</div>
                        {baselineSummary && (
                          <>
                            <div className="opacity-75">Baseline: {formatIDR(row.baselineRevenue)} ({row.baselineTransactions} orders)</div>
                            <div className={row.diffRevenue >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                              Diff: {formatSignedIDR(row.diffRevenue)}
                              {row.diffPct !== null ? ` (${row.diffRevenue >= 0 ? '+' : ''}${row.diffPct.toFixed(1)}%)` : ''}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="revenue" name="Current" stroke={theme.chartLineColor} strokeWidth={2} dot={{ r: 2 }} />
                {baselineSummary && (
                  <Line
                    type="monotone"
                    dataKey="baselineRevenue"
                    name={`Baseline (${baselineDays}d)`}
                    stroke={baselineLineColor}
                    strokeWidth={1.75}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Period Difference (Variance) Chart + Category Diff Breakdown */}
      {baselineSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Difference (Current - Baseline) Bar Chart */}
          <div className={`p-5 border ${theme.borderClass} ${theme.cardClass} flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">Revenue Variance (&Delta; Current &minus; Baseline)</h3>
                <p className={`text-xs ${theme.mutedClass}`}>Highlights exact {interval} periods above or below baseline</p>
              </div>
              <span className="text-[11px] font-mono opacity-75 capitalize">{interval} delta</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregatedComparisonData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.chartGridColor} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: theme.chartTickColor, fontSize: 9 }} />
                  <YAxis tick={{ fill: theme.chartTickColor, fontSize: 9 }} tickFormatter={formatCompactIDR} />
                  <ReferenceLine y={0} stroke={theme.chartTickColor} strokeWidth={1} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as AggregatedBucket;
                      const ordSign = row.diffTransactions >= 0 ? '+' : '';
                      return (
                        <div
                          className="p-2.5 rounded-lg border text-xs shadow-md font-mono space-y-1"
                          style={{ backgroundColor: theme.chartTooltipBg, borderColor: theme.chartTooltipBorder }}
                        >
                          <div className="font-bold">{label}</div>
                          <div className={row.diffRevenue >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                            &Delta; Revenue: {formatSignedIDR(row.diffRevenue)}
                            {row.diffPct !== null ? ` (${row.diffRevenue >= 0 ? '+' : ''}${row.diffPct.toFixed(1)}%)` : ''}
                          </div>
                          <div>&Delta; Orders: {ordSign}{row.diffTransactions}</div>
                          <div className="opacity-70">Current {formatIDR(row.revenue)} vs Base {formatIDR(row.baselineRevenue)}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="diffRevenue" name="Revenue Diff" radius={[3, 3, 0, 0]}>
                    {aggregatedComparisonData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.diffRevenue >= 0 ? positiveColor : negativeColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Revenue Variance Breakdown */}
          <div className={`p-5 border ${theme.borderClass} ${theme.cardClass} flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider">Where Categories Differ</h3>
                  <p className={`text-xs ${theme.mutedClass}`}>Top categories by revenue variance vs. {baselineDays}d baseline</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b ${theme.borderClass} opacity-60 font-mono`}>
                    <th className="py-2 px-2 font-semibold">Category</th>
                    <th className="py-2 px-2 font-semibold text-right">Current</th>
                    <th className="py-2 px-2 font-semibold text-right">Baseline</th>
                    <th className="py-2 px-2 font-semibold text-right">&Delta; Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit/40">
                  {categoryComparison.map((cat) => (
                    <tr key={cat.category} className="hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="py-2 px-2 font-medium capitalize">{cat.category}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatIDR(cat.current)}</td>
                      <td className="py-2 px-2 text-right font-mono opacity-70">{formatIDR(cat.baseline)}</td>
                      <td
                        className={`py-2 px-2 text-right font-mono font-semibold ${
                          cat.diff === 0
                            ? theme.mutedClass
                            : cat.diff > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatSignedIDR(cat.diff)}
                        {cat.diffPct !== null && (
                          <span className="ml-1 text-[10px] opacity-80">
                            ({cat.diff >= 0 ? '+' : ''}{cat.diffPct.toFixed(1)}%)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* YAML Parameter Diff ("What Changed vs. Default") */}
      {configYaml && (
        <div className={`p-5 border ${theme.borderClass} ${theme.cardClass} space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileDiff className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  What Changed vs. Default YAML
                </h3>
                <p className={`text-xs ${theme.mutedClass}`}>
                  {yamlDiff.parseError
                    ? yamlDiff.parseError
                    : yamlDiff.entries.length === 0
                    ? 'Exact match with the default balanced configuration.'
                    : `${yamlDiff.entries.length} parameter${yamlDiff.entries.length === 1 ? '' : 's'} overridden in this scenario.`}
                </p>
              </div>
            </div>

            {yamlDiff.entries.length > 0 && (
              <button
                onClick={() => setIsDiffExpanded((prev) => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-medium transition ${theme.buttonClass}`}
              >
                <span>{isDiffExpanded ? 'Hide Diff' : 'Show Diff'}</span>
                {isDiffExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {isDiffExpanded && yamlDiff.entries.length > 0 && (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b ${theme.borderClass} opacity-60 font-mono`}>
                      <th className="py-2 px-2 font-semibold">YAML Path</th>
                      <th className="py-2 px-2 font-semibold">Default</th>
                      <th className="py-2 px-2 font-semibold">Current Run</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-inherit/40 font-mono">
                    {visibleDiffs.map((entry) => (
                      <tr key={entry.path} className="hover:bg-black/5 dark:hover:bg-white/5">
                        <td className="py-1.5 px-2 text-[11px] font-semibold">{entry.path}</td>
                        <td className={`py-1.5 px-2 text-[11px] ${theme.mutedClass}`}>
                          {formatDiffValue(entry.defaultValue)}
                        </td>
                        <td className="py-1.5 px-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatDiffValue(entry.currentValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {yamlDiff.entries.length > 8 && (
                <button
                  onClick={() => setShowAllDiffs((prev) => !prev)}
                  className={`text-[11px] font-mono underline underline-offset-2 ${theme.mutedClass} hover:opacity-100`}
                >
                  {showAllDiffs
                    ? 'Show top 8 changes'
                    : `+ ${yamlDiff.entries.length - 8} more parameter changes`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Top Products Table */}
      <div className={`p-5 border ${theme.borderClass} ${theme.cardClass}`}>
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Top Selling Grocery Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${theme.borderClass} opacity-60 font-mono`}>
                <th className="py-2 px-3 font-semibold">Rank</th>
                <th className="py-2 px-3 font-semibold">Product Name</th>
                <th className="py-2 px-3 font-semibold text-right">Units Sold</th>
                <th className="py-2 px-3 font-semibold text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit/40">
              {summary.top_products.map(([prod, qty, rev], idx) => (
                <tr key={prod} className="hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="py-2.5 px-3 font-mono font-bold opacity-70">#{idx + 1}</td>
                  <td className="py-2.5 px-3 font-medium capitalize">{prod}</td>
                  <td className="py-2.5 px-3 text-right font-mono opacity-80">{qty.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">{formatIDR(rev)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
