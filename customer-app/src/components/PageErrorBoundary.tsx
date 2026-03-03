import { Component, type ReactNode } from 'react';
import { AppShell } from './AppShell';

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('PageErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AppShell title={this.props.title || 'Error'} showBack>
          <div className="max-w-4xl mx-auto px-4 py-8 text-center">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-cream flex items-center justify-center">
                <svg className="w-8 h-8 text-brand-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-bold text-brand-navy mb-2">
                Something went wrong
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                We hit an unexpected issue loading this page. Please try again.
              </p>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                }}
                className="w-full bg-brand-blue text-white font-semibold py-3 px-6 rounded-xl hover:bg-brand-blue/90 transition-colors min-h-[44px] mb-3"
              >
                Try Again
              </button>
              <button
                onClick={() => window.history.back()}
                className="w-full text-brand-blue font-medium py-3 px-6 rounded-xl hover:bg-brand-cream transition-colors min-h-[44px]"
              >
                Go Back
              </button>
            </div>
          </div>
        </AppShell>
      );
    }

    return this.props.children;
  }
}
