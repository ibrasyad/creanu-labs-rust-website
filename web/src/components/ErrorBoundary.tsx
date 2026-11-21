import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[GroceryLab ErrorBoundary]', error, info);
  }

  private handleResetView = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.assign(window.location.pathname);
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#f8f9fa] text-[#0f172a] dark:bg-[#0e1013] dark:text-[#f8fafc] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white dark:bg-[#15181e] border border-[#cbd5e1] dark:border-[#3a4250] rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h1 className="text-base font-bold tracking-tight">Something went wrong in GroceryLab</h1>
          </div>

          <p className="text-xs text-[#64748b] dark:text-[#9aa3b2] leading-relaxed">
            The interface encountered an unexpected error. Your simulation configs remain safe—try resetting the view or reloading the default workspace.
          </p>

          {this.state.errorMessage && (
            <div className="p-3 rounded-lg border border-rose-500/25 bg-rose-500/5 text-xs font-mono text-rose-600 dark:text-rose-400 break-words">
              {this.state.errorMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={this.handleResetView}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-[#0f172a] text-white hover:bg-[#1e293b] dark:bg-[#f8fafc] dark:text-[#0e1013] dark:hover:bg-[#e2e8f0] transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Recover View</span>
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold border border-[#94a3b8] dark:border-[#4a5364] bg-[#f1f5f9] hover:bg-[#e2e8f0] dark:bg-[#1b1e25] dark:hover:bg-[#252932] transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Default Workspace</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
