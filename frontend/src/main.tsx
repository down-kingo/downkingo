import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n"; // Inicializa react-i18next
import "./index.css";
import Lenis from "lenis";

// Initialize Lenis for smooth scrolling
const lenis = new Lenis({
  lerp: 0.1,
  smoothWheel: true,
});

function raf(time: number) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}

requestAnimationFrame(raf);

class ErrorBoundary extends React.Component<
  any,
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-surface-900 text-surface-50 h-screen overflow-auto font-mono">
          <h1 className="text-xl font-bold text-red-500 mb-4">
            Something went wrong
          </h1>
          <div className="bg-surface-800 p-4 rounded-lg border border-surface-700">
            <p className="font-bold mb-2">{this.state.error?.toString()}</p>
            <pre className="text-xs text-surface-400 overflow-x-auto">
              {this.state.error?.stack}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const renderApp = () => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Wails v3: Runtime is available immediately via @wailsio/runtime imports
renderApp();
