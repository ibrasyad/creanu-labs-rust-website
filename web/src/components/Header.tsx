import React, { useState } from 'react';
import { Play, Download, Sparkles, Sliders, BarChart3, Code, Sun, Moon, Info, Share2, Check } from 'lucide-react';
import { PRESET_SCENARIOS } from '../presets';
import { ThemeConfig } from '../types/theme';

interface HeaderProps {
  currentPresetId: string;
  onSelectPreset: (id: string) => void;
  isRunning: boolean;
  onRunSimulation: () => void;
  onOpenExport: () => void;
  onCopyShareLink: () => Promise<boolean> | boolean;
  hasOutput: boolean;
  activeTab: 'studio' | 'dashboard' | 'yaml' | 'about';
  onChangeTab: (tab: 'studio' | 'dashboard' | 'yaml' | 'about') => void;
  theme: ThemeConfig;
  onToggleThemeMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPresetId,
  onSelectPreset,
  isRunning,
  onRunSimulation,
  onOpenExport,
  onCopyShareLink,
  hasOutput,
  activeTab,
  onChangeTab,
  theme,
  onToggleThemeMode,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShareClick = async () => {
    const ok = await onCopyShareLink();
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <header className={`border-b ${theme.headerClass} sticky top-0 z-30 px-4 xl:px-6 py-3 transition-colors duration-150`}>
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Brand & Primary Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-start gap-3 xl:gap-5 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-base shadow-sm shrink-0">
              🥬
            </div>
            <span className="font-bold text-sm tracking-tight whitespace-nowrap">Creanu Labs</span>
          </div>

          {/* Primary View Tabs */}
          <nav className="flex items-center gap-1 p-1 rounded-lg border border-inherit bg-black/5 dark:bg-white/5 overflow-x-auto">
            <button
              onClick={() => onChangeTab('studio')}
              className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                activeTab === 'studio' ? theme.accentClass : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>Config Studio</span>
            </button>

            <button
              onClick={() => onChangeTab('dashboard')}
              className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                activeTab === 'dashboard' ? theme.accentClass : 'opacity-70 hover:opacity-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>Analytics Dashboard</span>
            </button>

            <button
              onClick={() => onChangeTab('yaml')}
              className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                activeTab === 'yaml' ? theme.accentClass : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Code className="w-3.5 h-3.5 shrink-0" />
              <span>Raw YAML</span>
            </button>

            <button
              onClick={() => onChangeTab('about')}
              className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                activeTab === 'about' ? theme.accentClass : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>About</span>
            </button>
          </nav>
        </div>

        {/* Right Side: Preset, Actions, Light/Dark Toggle on Far Right */}
        <div className="flex items-center justify-end flex-wrap sm:flex-nowrap gap-1.5 xl:gap-2 shrink-0">
          {/* Grocery Preset Dropdown */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-inherit text-xs bg-black/5 dark:bg-white/5 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <select
              value={currentPresetId}
              onChange={(e) => onSelectPreset(e.target.value)}
              aria-label="Simulation preset"
              className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer pr-1 max-w-[140px] xl:max-w-[190px] truncate"
            >
              {PRESET_SCENARIOS.map((p) => (
                <option key={p.id} value={p.id} className={theme.mode === 'dark' ? 'bg-[#15181e] text-white' : 'bg-white text-slate-900'}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Share Link Button */}
          <button
            onClick={handleShareClick}
            className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-md text-xs font-semibold border whitespace-nowrap shrink-0 transition ${theme.buttonClass}`}
            title="Copy shareable scenario URL"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>Share</span>
              </>
            )}
          </button>

          {/* Run Button */}
          <button
            onClick={onRunSimulation}
            disabled={isRunning}
            className={`flex items-center gap-1.5 px-3 xl:px-3.5 py-1.5 rounded-md text-xs font-bold whitespace-nowrap shrink-0 transition active:scale-95 disabled:opacity-50 ${theme.accentClass}`}
          >
            {isRunning ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                <span>Run</span>
              </>
            )}
          </button>

          {/* Export Button */}
          <button
            onClick={onOpenExport}
            disabled={!hasOutput}
            className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-md text-xs font-semibold border whitespace-nowrap shrink-0 transition disabled:opacity-40 ${theme.buttonClass}`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Download ZIP</span>
          </button>

          {/* Light / Dark Mode Toggle (Far Right) */}
          <button
            onClick={onToggleThemeMode}
            className={`p-1.5 rounded-md border whitespace-nowrap shrink-0 transition ${theme.buttonClass}`}
            title={`Switch to ${theme.mode === 'light' ? 'Dark' : 'Light'} Mode`}
            aria-label={`Switch to ${theme.mode === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme.mode === 'light' ? (
              <Moon className="w-4 h-4 text-slate-700" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
