/**
 * VELUM - Point d'entrée de l'application
 * Version corrigée avec gestion d'erreurs
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// ============================================================================
// ERROR BOUNDARY (Basic)
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[VELUM] Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#020202',
            color: '#FAFAFA',
            fontFamily: 'Inter, sans-serif',
            padding: '2rem',
            textAlign: 'center'
          }}
        >
          <h1
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '2rem',
              marginBottom: '1rem',
              color: '#D4AF37'
            }}
          >
            VELUM
          </h1>
          <p style={{ marginBottom: '2rem', color: '#737373' }}>
            Une erreur inattendue s'est produite.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '1rem 2rem',
              backgroundColor: '#D4AF37',
              color: '#020202',
              border: 'none',
              borderRadius: '9999px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            Recharger l'application
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre
              style={{
                marginTop: '2rem',
                padding: '1rem',
                backgroundColor: '#0A0A0A',
                borderRadius: '0.5rem',
                maxWidth: '600px',
                overflow: 'auto',
                fontSize: '0.75rem',
                textAlign: 'left',
                color: '#ef4444'
              }}
            >
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  const container = document.getElementById('root');

  if (!container) {
    console.error('[VELUM] Root element not found');
    return;
  }

  const root = createRoot(container);

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Log version info
  console.log(
    '%c VELUM %c v5.0.0 ',
    'background: #D4AF37; color: #020202; font-weight: bold; padding: 2px 8px; border-radius: 4px 0 0 4px;',
    'background: #020202; color: #D4AF37; font-weight: bold; padding: 2px 8px; border-radius: 0 4px 4px 0;'
  );
}

// Start the application
init();
