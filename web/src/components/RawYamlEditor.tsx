import React, { useRef, useState } from 'react';
import { Copy, Check, RotateCcw, AlertCircle, FileCode } from 'lucide-react';
import * as yaml from 'js-yaml';
import { ThemeConfig } from '../types/theme';
import { DEFAULT_CONFIG_YAML } from '../engine/defaultConfig';

interface RawYamlEditorProps {
  value: string;
  onChange: (val: string) => void;
  theme: ThemeConfig;
}

export const RawYamlEditor: React.FC<RawYamlEditorProps> = ({
  value,
  onChange,
  theme,
}) => {
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Validate YAML
  let parseError: string | null = null;
  try {
    yaml.load(value);
  } catch (err: any) {
    parseError = err.message;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmReset = () => {
    onChange(DEFAULT_CONFIG_YAML);
    setConfirmReset(false);
  };

  const handleScroll = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const lineCount = value.split('\n').length;

  return (
    <div className={`border ${theme.borderClass} ${theme.cardClass} flex flex-col h-[700px] overflow-hidden`}>
      {/* Top Bar */}
      <div className={`px-4 py-3 border-b ${theme.borderClass} flex flex-wrap items-center justify-between gap-2`}>
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 opacity-70" />
          <span className="text-xs font-semibold tracking-wide font-mono">simulation_config.yaml</span>
          <span className={`text-[11px] font-mono ${theme.mutedClass}`}>
            {lineCount.toLocaleString()} lines &middot; {value.length.toLocaleString()} bytes
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {parseError ? (
            <div className="flex items-center gap-1.5 text-xs text-rose-500 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>YAML Syntax Error</span>
            </div>
          ) : (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium font-mono">
              Valid YAML Spec
            </span>
          )}

          <button
            onClick={handleCopy}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border ${theme.buttonClass} transition`}
            title="Copy YAML to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {confirmReset ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleConfirmReset}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-600 text-white hover:bg-rose-700 transition"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className={`px-2 py-1 text-xs font-medium rounded border ${theme.buttonClass} transition`}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border ${theme.buttonClass} transition`}
              title="Reset to default YAML"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {parseError && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 text-xs text-rose-500 font-mono">
          {parseError}
        </div>
      )}

      {/* Editor Body with Full Synchronized Line Numbers */}
      <div className="flex-1 flex overflow-hidden font-mono text-xs">
        <div
          ref={gutterRef}
          className={`select-none px-3 py-4 text-right border-r ${theme.borderClass} opacity-40 shrink-0 overflow-hidden leading-relaxed`}
          style={{ width: '58px' }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          wrap="off"
          className={`flex-1 p-4 bg-transparent resize-none focus:outline-none overflow-auto leading-relaxed whitespace-pre ${theme.textClass}`}
          style={{ tabSize: 2 }}
        />
      </div>
    </div>
  );
};
