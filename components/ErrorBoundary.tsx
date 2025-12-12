import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './common/Button';
import { XCircleIcon } from './icons/XCircleIcon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    // This is a simple way to reset. A more robust solution might involve clearing state.
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-lg text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl shadow-lg p-8 border border-red-500/50">
                <XCircleIcon className="w-16 h-16 mx-auto text-red-500"/>
                <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                    Oops! Something went wrong.
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                    An unexpected error occurred. Please try refreshing the application.
                </p>
                <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900/50 p-2 rounded-md font-mono">
                    {this.state.error?.message || 'Unknown error'}
                </p>
                <Button onClick={this.handleReset} className="mt-6">
                    Refresh Application
                </Button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;