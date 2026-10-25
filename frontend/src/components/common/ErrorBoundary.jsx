import React from 'react';
import { HiExclamationCircle, HiRefresh } from 'react-icons/hi';
import Button from './Button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({
          error: this.state.error,
          retry: this.handleRetry
        });
      }

      return (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-rose-100 shadow-xs text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <HiExclamationCircle className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Unable to display this view
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              An unexpected error occurred while rendering this section. You can try reloading or returning to the dashboard.
            </p>
          </div>
          {this.state.error?.message && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left font-mono text-[11px] text-rose-700 max-h-32 overflow-y-auto">
              {this.state.error.message}
            </div>
          )}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={this.handleRetry}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-2 text-xs"
            >
              <HiRefresh className="w-4 h-4" />
              <span>Try Again</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = '/committee/dashboard';
              }}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
