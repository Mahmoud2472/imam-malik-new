import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Application ErrorBoundary Caught Error]:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetApp = () => {
    try {
      // Clear service workers and caches
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((reg) => reg.unregister());
        });
      }
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      // Clear session/local data that might have corrupted
      window.sessionStorage.clear();
      // Keep basic user settings if needed, but remove temporary cache markers
      window.localStorage.removeItem('imsc_force_mock_supabase');
      window.localStorage.removeItem('imsc_force_mock_supabase_healed');
    } catch (e) {
      console.warn('Could not reset local storage:', e);
    }

    // Force hard refresh to root
    window.location.href = '/#/';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div id="error-boundary-screen" className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 text-slate-800">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-amber-200">
              <AlertTriangle size={32} />
            </div>

            <h1 className="text-xl font-black text-emerald-950 mb-2">
              Something unexpected occurred
            </h1>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              The portal encountered a temporary rendering or state issue. Your academic records and account remain completely safe.
            </p>

            {this.state.error && (
              <div className="p-3 bg-slate-100 rounded-xl text-left text-[11px] font-mono text-slate-700 mb-6 overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                id="error-reload-btn"
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-emerald-900 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
              >
                <RefreshCw size={16} />
                Reload Portal
              </button>

              <button
                id="error-reset-cache-btn"
                type="button"
                onClick={this.handleResetApp}
                className="w-full py-3 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Trash2 size={16} />
                Clear Cache & Hard Reset
              </button>

              <a
                id="error-home-link"
                href="/#/"
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Home size={14} />
                Return to School Homepage
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
