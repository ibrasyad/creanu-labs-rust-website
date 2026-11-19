import { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { ConfigEditor } from './components/ConfigEditor';
import { RawYamlEditor } from './components/RawYamlEditor';
import { SummaryDashboard } from './components/SummaryDashboard';
import { AboutPage } from './components/AboutPage';
import { ExportModal } from './components/ExportModal';
import { ProgressBar } from './components/ProgressBar';
import { PRESET_SCENARIOS } from './presets';
import { DEFAULT_CONFIG_YAML } from './engine/defaultConfig';
import { runSimulationAsync, RunningTask } from './engine/engineClient';
import { EngineKind, WorkerProgressPhase } from './engine/workerProtocol';
import { SimulationOutput } from './types/simulation';
import { ThemeMode, SWISS_THEMES } from './types/theme';
import { buildShareUrl, hydrateScenarioFromUrl } from './utils/shareUrl';
import { Sparkles, BarChart2, AlertCircle, X } from 'lucide-react';
import * as yaml from 'js-yaml';

function extractDateBounds(yamlStr: string): { startDate: string; endDate: string; totalDays: number } {
  try {
    const parsed = yaml.load(yamlStr) as any;
    const startDate = String(parsed?.date?.start_date || '2026-01-01');
    const endDate = String(parsed?.date?.end_date || '2026-03-31');
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const totalDays =
      Number.isFinite(startMs) && Number.isFinite(endMs)
        ? Math.max(1, Math.round((endMs - startMs) / (1000 * 3600 * 24)) + 1)
        : 90;
    return { startDate, endDate, totalDays };
  } catch {
    return { startDate: '2026-01-01', endDate: '2026-03-31', totalDays: 90 };
  }
}

function buildBaselineYamlForWindow(startDate: string, endDate: string): string {
  const baselineCfgObj = yaml.load(DEFAULT_CONFIG_YAML) as any;
  if (baselineCfgObj.date) {
    baselineCfgObj.date.start_date = startDate;
    baselineCfgObj.date.end_date = endDate;
  }
  return yaml.dump(baselineCfgObj);
}

export function App() {
  const initialScenario = useMemo(() => hydrateScenarioFromUrl(), []);

  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [activeTab, setActiveTab] = useState<'studio' | 'dashboard' | 'yaml' | 'about'>('studio');

  const [currentPresetId, setCurrentPresetId] = useState<string>(initialScenario.presetId);
  const [configYaml, setConfigYaml] = useState<string>(initialScenario.configYaml);

  const [output, setOutput] = useState<SimulationOutput | null>(null);
  const [baselineOutput, setBaselineOutput] = useState<SimulationOutput | null>(null);
  const baselineCacheRef = useRef<Map<string, SimulationOutput>>(new Map());
  const runningTaskRef = useRef<RunningTask | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    phase: WorkerProgressPhase;
    day: number;
    total: number;
    dateStr: string;
    engine: EngineKind;
  } | null>(null);
  const [engineUsed, setEngineUsed] = useState<EngineKind | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [simError, setSimError] = useState<string | null>(initialScenario.error);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const theme = SWISS_THEMES[themeMode];

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', themeMode === 'dark');
    }
  }, [themeMode]);

  // Execute initial simulation inside background worker on mount
  useEffect(() => {
    let active = true;
    const { startDate, endDate, totalDays } = extractDateBounds(initialScenario.configYaml);
    const cacheKey = `${startDate}|${endDate}`;
    const baselineYaml = buildBaselineYamlForWindow(startDate, endDate);

    setIsRunning(true);
    setProgress({ phase: 'simulation', day: 0, total: totalDays, dateStr: 'Initializing...', engine: 'typescript' });

    const isDefaultMatch = initialScenario.configYaml === DEFAULT_CONFIG_YAML;
    const task = runSimulationAsync({
      configYaml: initialScenario.configYaml,
      baselineYaml: isDefaultMatch ? null : baselineYaml,
      onProgress: (info) => {
        if (!active) return;
        setProgress({
          phase: info.phase,
          day: info.day,
          total: info.totalDays,
          dateStr: info.dateStr,
          engine: info.engine,
        });
      },
    });
    runningTaskRef.current = task;

    task.promise
      .then((res) => {
        if (!active) return;
        const resolvedBaseline = res.baseline || res.output;
        baselineCacheRef.current.set(cacheKey, resolvedBaseline);
        setOutput(res.output);
        setBaselineOutput(resolvedBaseline);
        setEngineUsed(res.engine);
        setElapsedMs(res.elapsedMs);
      })
      .catch((err: any) => {
        if (!active) return;
        if (err?.message === 'Simulation cancelled by user.') return;
        console.error('Initial baseline simulation error:', err);
        setSimError(err?.message || 'Failed to run initial baseline simulation.');
      })
      .finally(() => {
        if (!active) return;
        runningTaskRef.current = null;
        setIsRunning(false);
        setProgress(null);
      });

    return () => {
      active = false;
      task.cancel();
    };
  }, [initialScenario.configYaml]);

  // Preset Selection
  const handleSelectPreset = (presetId: string) => {
    setCurrentPresetId(presetId);
    const chosen = PRESET_SCENARIOS.find((p) => p.id === presetId);
    if (chosen) {
      setConfigYaml(chosen.configYaml);
    }
  };

  // Cancel Running Simulation
  const handleCancelSimulation = () => {
    if (runningTaskRef.current) {
      runningTaskRef.current.cancel();
      runningTaskRef.current = null;
    }
    setIsRunning(false);
    setProgress(null);
  };

  // Run Simulation Handler (async worker + Wasm/TS fallback + baseline cache check)
  const handleRunSimulation = async () => {
    if (runningTaskRef.current) {
      runningTaskRef.current.cancel();
    }

    const { startDate, endDate, totalDays } = extractDateBounds(configYaml);
    const cacheKey = `${startDate}|${endDate}`;
    const cachedBaseline = baselineCacheRef.current.get(cacheKey);
    const baselineYaml = cachedBaseline ? null : buildBaselineYamlForWindow(startDate, endDate);

    setSimError(null);
    setIsRunning(true);
    setProgress({
      phase: 'simulation',
      day: 0,
      total: totalDays,
      dateStr: 'Initializing...',
      engine: engineUsed || 'typescript',
    });

    const task = runSimulationAsync({
      configYaml,
      baselineYaml,
      onProgress: (info) => {
        setProgress({
          phase: info.phase,
          day: info.day,
          total: info.totalDays,
          dateStr: info.dateStr,
          engine: info.engine,
        });
      },
    });
    runningTaskRef.current = task;

    try {
      const res = await task.promise;
      let matchedBaseline = cachedBaseline || null;
      if (!matchedBaseline && res.baseline) {
        baselineCacheRef.current.set(cacheKey, res.baseline);
        matchedBaseline = res.baseline;
      }

      setOutput(res.output);
      setBaselineOutput(matchedBaseline);
      setEngineUsed(res.engine);
      setElapsedMs(res.elapsedMs);
      setActiveTab('dashboard');
    } catch (err: any) {
      if (err?.message !== 'Simulation cancelled by user.') {
        setSimError(err?.message || 'Simulation failed. Check your YAML configuration.');
      }
    } finally {
      runningTaskRef.current = null;
      setIsRunning(false);
      setProgress(null);
    }
  };

  // Shareable Scenario Link
  const handleCopyShareLink = async (): Promise<boolean> => {
    const shareUrl = buildShareUrl(currentPresetId, configYaml);
    try {
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', shareUrl);
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        return true;
      }
      return false;
    } catch {
      setSimError('Could not access clipboard, but the shareable URL was updated in your browser address bar.');
      return false;
    }
  };

  const activeHorizonDays = output?.summary.daily_metrics.length ?? 90;

  return (
    <div className={`min-h-screen flex flex-col ${theme.bodyClass} transition-colors duration-150`}>
      {/* Top Header */}
      <Header
        currentPresetId={currentPresetId}
        onSelectPreset={handleSelectPreset}
        isRunning={isRunning}
        onRunSimulation={handleRunSimulation}
        onOpenExport={() => setIsExportOpen(true)}
        onCopyShareLink={handleCopyShareLink}
        hasOutput={output !== null}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        theme={theme}
        onToggleThemeMode={() => setThemeMode((m) => (m === 'light' ? 'dark' : 'light'))}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Inline Error Banner */}
        {simError && (
          <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{simError}</span>
            </div>
            <button
              onClick={() => setSimError(null)}
              className="p-1 rounded hover:bg-rose-500/20 transition"
              aria-label="Dismiss simulation error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Progress Bar (during active simulation) */}
        {isRunning && progress && (
          <ProgressBar
            currentDay={progress.day}
            totalDays={progress.total}
            currentDateStr={progress.dateStr}
            phase={progress.phase}
            engine={progress.engine}
            onCancel={handleCancelSimulation}
            theme={theme}
          />
        )}

        {/* Tab 1: Config Studio (Quick General Controls + Expandable Complete Controls) */}
        {activeTab === 'studio' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <ConfigEditor
              yamlContent={configYaml}
              onChangeYaml={setConfigYaml}
              theme={theme}
            />

            {/* Quick Teaser Box for Dashboard */}
            {output && (
              <div
                onClick={() => setActiveTab('dashboard')}
                className={`p-4 border ${theme.borderClass} ${theme.cardClass} flex items-center justify-between cursor-pointer hover:border-slate-900 dark:hover:border-slate-100 transition`}
              >
                <div className="flex items-center gap-3">
                  <BarChart2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">Latest Simulation Ready</div>
                    <div className={`text-[11px] ${theme.mutedClass}`}>
                      {output.transactions.length.toLocaleString()} completed transactions &bull;{' '}
                      {output.funnel.length.toLocaleString()} customer journey sessions &bull;{' '}
                      {activeHorizonDays}-day horizon
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold">View Full Dashboard &rarr;</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Dedicated Full Analytics Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-inherit">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  Analytics & {activeHorizonDays}-Day Baseline Diff
                </h2>
                <p className={`text-xs ${theme.mutedClass} mt-0.5`}>
                  Key performance metrics and charts compared against the default configuration over the exact same {activeHorizonDays}-day window.
                </p>
              </div>
              {output && (
                <span className="text-xs font-mono font-medium opacity-80">
                  {output.transactions.length.toLocaleString()} orders generated
                </span>
              )}
            </div>

            {output ? (
              <SummaryDashboard
                summary={output.summary}
                baselineSummary={baselineOutput ? baselineOutput.summary : null}
                configYaml={configYaml}
                engineUsed={engineUsed}
                elapsedMs={elapsedMs}
                theme={theme}
              />
            ) : (
              <div className={`h-64 border border-dashed ${theme.borderClass} rounded-xl flex items-center justify-center text-xs opacity-50`}>
                Click "Run" to execute simulation and render charts.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Raw YAML Editor (Syntax highlighting, line numbers, zero blank screen) */}
        {activeTab === 'yaml' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <RawYamlEditor
              value={configYaml}
              onChange={setConfigYaml}
              theme={theme}
            />
          </div>
        )}

        {/* Tab 4: About Page */}
        {activeTab === 'about' && (
          <div className="animate-in fade-in duration-150">
            <AboutPage theme={theme} onNavigateTab={setActiveTab} />
          </div>
        )}
      </main>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        output={output}
        configYaml={configYaml}
        theme={theme}
      />

      {/* Footer */}
      <footer className={`border-t ${theme.borderClass} py-3.5 px-6 text-center text-xs ${theme.mutedClass} flex flex-wrap items-center justify-center gap-x-2 gap-y-1`}>
        <span>Creanu Labs Synthetic Commerce Engine</span>
        <span aria-hidden="true">&middot;</span>
        <span>Swiss Design ({theme.name})</span>
        <span aria-hidden="true">&middot;</span>
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Sparkles className="w-3 h-3" /> Zero Server Compute Cost
        </span>
      </footer>
    </div>
  );
}

export default App;
