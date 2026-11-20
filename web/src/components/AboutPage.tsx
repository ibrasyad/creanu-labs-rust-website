import React, { useState } from 'react';
import {
  ArrowRight,
  Database,
  Layers,
  GitBranch,
  BarChart3,
  Sliders,
  Compass,
  BookOpen,
  Footprints,
  Sparkles,
} from 'lucide-react';
import { ThemeConfig } from '../types/theme';
import { SITE_CONTENT, SchemaTableKey } from '../content/siteContent';
import { ABOUT_CONTENT } from '../content/aboutContent';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AboutPageProps {
  theme: ThemeConfig;
  onNavigateTab: (tab: 'studio' | 'dashboard' | 'yaml' | 'about') => void;
}

const KNOWN_SECTION_IDS = new Set([
  'why-i-made-this',
  'what-it-does',
  'architecture-evolution',
  'ai-acknowledgment',
  'great-ways-to-practice-with-the-output',
]);

export const AboutPage: React.FC<AboutPageProps> = ({ theme, onNavigateTab }) => {
  const { frontmatter, sections } = ABOUT_CONTENT;
  const aboutSpec = SITE_CONTENT.about;
  const schemaTables = aboutSpec.schemaTables;
  const simulationLevers = aboutSpec.simulationLevers;
  const traceSteps = aboutSpec.traceOrderSteps;

  const [selectedTable, setSelectedTable] = useState<SchemaTableKey>('transactions');
  const [selectedLever, setSelectedLever] = useState<string>(simulationLevers[0]?.key || 'visit_decay');
  const [selectedTraceStep, setSelectedTraceStep] = useState<number>(0);

  const findSection = (id: string) => sections.find((s) => s.id === id);
  const whySection = findSection('why-i-made-this');
  const whatSection = findSection('what-it-does');
  const aiSection = findSection('ai-acknowledgment');
  const archSection = aiSection || findSection('architecture-evolution');
  const practiceSection = findSection('great-ways-to-practice-with-the-output');
  const extraSections = sections.filter((s) => !KNOWN_SECTION_IDS.has(s.id));

  const activeSchema = schemaTables[selectedTable];
  const activeLever = simulationLevers.find((l) => l.key === selectedLever) || simulationLevers[0];
  const activeTrace = traceSteps[selectedTraceStep] || traceSteps[0];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero / Story Introduction (Frontmatter from about.md) */}
      <section className={`p-6 md:p-8 border ${theme.borderClass} ${theme.cardClass} space-y-5`}>
        <div className={`text-xs font-mono ${theme.mutedClass} flex flex-wrap items-center gap-2`}>
          {(frontmatter.kicker || []).map((item, idx) => (
            <React.Fragment key={item}>
              {idx > 0 && <span aria-hidden="true">&middot;</span>}
              <span>{item}</span>
            </React.Fragment>
          ))}
        </div>

        <div className="space-y-3 max-w-3xl">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight [text-wrap:balance]">
            {frontmatter.title}
          </h1>
          <MarkdownRenderer
            content={frontmatter.lead}
            theme={theme}
            className="text-sm [&_p]:text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={() => onNavigateTab('studio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition ${theme.accentClass}`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{frontmatter.ctaPrimary}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigateTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold border transition ${theme.buttonClass}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{frontmatter.ctaSecondary}</span>
          </button>
        </div>
      </section>

      {/* Why I Made This + What It Does (Rendered from about.md) */}
      {(whySection || whatSection) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {whySection && (
            <div className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-3`}>
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">{whySection.title}</h2>
              </div>
              <MarkdownRenderer content={whySection.body} theme={theme} />
            </div>
          )}

          {whatSection && (
            <div className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-3`}>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">{whatSection.title}</h2>
              </div>
              <MarkdownRenderer content={whatSection.body} theme={theme} />
            </div>
          )}
        </section>
      )}

      {/* How the Simulation Pipeline Works */}
      <section className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-5`}>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">{aboutSpec.pipelineTitle}</h2>
          <p className={`text-xs mt-0.5 ${theme.mutedClass}`}>{aboutSpec.pipelineSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-1">
          {aboutSpec.pipelineSteps.map((item) => (
            <div key={item.step} className={`border-t pt-3 ${theme.borderClass} space-y-1.5`}>
              <div className="text-xs font-mono font-bold opacity-60">{item.step}</div>
              <div className="text-xs font-semibold">{item.title}</div>
              <p className={`text-xs leading-relaxed ${theme.mutedClass}`}>{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Data Dictionary (5 Exported Tables) */}
      <section className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">{aboutSpec.schemaTitle}</h2>
              <p className={`text-xs ${theme.mutedClass}`}>{aboutSpec.schemaSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg border border-inherit bg-black/5 dark:bg-white/5">
            {(Object.keys(schemaTables) as SchemaTableKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSelectedTable(key)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium transition ${
                  selectedTable === key ? theme.accentClass : 'opacity-70 hover:opacity-100'
                }`}
              >
                {schemaTables[key].filename}
              </button>
            ))}
          </div>
        </div>

        {activeSchema && (
          <div className={`pt-3 border-t ${theme.borderClass} space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold">{activeSchema.description}</span>
              <span className={`font-mono text-[11px] ${theme.mutedClass}`}>
                Grain: {activeSchema.grain}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b ${theme.borderClass} opacity-60 font-mono`}>
                    <th className="py-2 px-3 font-semibold">Column</th>
                    <th className="py-2 px-3 font-semibold">Type</th>
                    <th className="py-2 px-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit/40">
                  {activeSchema.columns.map((col) => (
                    <tr key={col.name} className="hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="py-2 px-3 font-mono font-semibold">{col.name}</td>
                      <td className={`py-2 px-3 font-mono ${theme.mutedClass}`}>{col.type}</td>
                      <td className={`py-2 px-3 ${theme.mutedClass}`}>{col.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Interactive Simulation Lever Glossary */}
      <section className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">{aboutSpec.glossaryTitle}</h2>
              <p className={`text-xs ${theme.mutedClass}`}>{aboutSpec.glossarySubtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {simulationLevers.map((lever) => (
            <button
              key={lever.key}
              onClick={() => setSelectedLever(lever.key)}
              className={`px-2.5 py-1.5 rounded border text-[11px] font-mono font-medium transition ${
                selectedLever === lever.key
                  ? theme.accentClass
                  : `${theme.borderClass} opacity-75 hover:opacity-100`
              }`}
            >
              {lever.label}
            </button>
          ))}
        </div>

        {activeLever && (
          <div className={`p-4 border ${theme.borderClass} bg-black/5 dark:bg-white/5 space-y-2.5 text-xs`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono font-bold text-sm">{activeLever.label}</span>
              <span className={`font-mono text-[11px] ${theme.mutedClass}`}>
                YAML: {activeLever.yamlPath}
              </span>
            </div>
            <p className="font-medium">{activeLever.summary}</p>
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t ${theme.borderClass}`}>
              <div>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${theme.mutedClass}`}>
                  How It Runs
                </div>
                <p className={`mt-1 leading-relaxed ${theme.mutedClass}`}>{activeLever.mechanism}</p>
              </div>
              <div>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${theme.mutedClass}`}>
                  Dataset Impact
                </div>
                <p className={`mt-1 leading-relaxed ${theme.mutedClass}`}>{activeLever.outputImpact}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Trace One Simulated Order Walkthrough */}
      <section className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-4`}>
        <div className="flex items-center gap-2">
          <Footprints className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">{aboutSpec.traceTitle}</h2>
            <p className={`text-xs ${theme.mutedClass}`}>{aboutSpec.traceSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {traceSteps.map((item, idx) => (
            <button
              key={item.step}
              onClick={() => setSelectedTraceStep(idx)}
              className={`p-2.5 rounded border text-left transition ${
                selectedTraceStep === idx
                  ? theme.accentClass
                  : `${theme.borderClass} opacity-75 hover:opacity-100`
              }`}
            >
              <div className="text-[10px] font-mono opacity-75">STEP {item.step}</div>
              <div className="text-xs font-semibold truncate">{item.title}</div>
            </button>
          ))}
        </div>

        {activeTrace && (
          <div className={`p-4 border ${theme.borderClass} bg-black/5 dark:bg-white/5 space-y-2 text-xs`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">
                Step {activeTrace.step}: {activeTrace.title}
              </span>
            </div>
            <div className={`p-2.5 rounded border ${theme.borderClass} font-mono text-[11px] overflow-x-auto`}>
              {activeTrace.code}
            </div>
            <p className={`leading-relaxed ${theme.mutedClass}`}>{activeTrace.detail}</p>
          </div>
        )}
      </section>

      {/* AI Acknowledgment / Architecture Evolution & Practice Use Cases (Rendered from about.md) */}
      {(archSection || practiceSection) && (
        <section
          className={`grid grid-cols-1 ${archSection && practiceSection ? 'md:grid-cols-2' : ''} gap-6`}
        >
          {archSection && (
            <div className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-3`}>
              <div className="flex items-center gap-2">
                {aiSection ? (
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <GitBranch className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                )}
                <h2 className="text-sm font-bold uppercase tracking-wider">{archSection.title}</h2>
              </div>
              <MarkdownRenderer content={archSection.body} theme={theme} />
            </div>
          )}

          {practiceSection && (
            <div className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-3`}>
              <h2 className="text-sm font-bold uppercase tracking-wider">{practiceSection.title}</h2>
              <MarkdownRenderer content={practiceSection.body} theme={theme} />
            </div>
          )}
        </section>
      )}

      {/* Any extra ## sections added to about.md render automatically */}
      {extraSections.map((sec) => (
        <section key={sec.id} className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-3`}>
          <h2 className="text-sm font-bold uppercase tracking-wider">{sec.title}</h2>
          <MarkdownRenderer content={sec.body} theme={theme} />
        </section>
      ))}
    </div>
  );
};
