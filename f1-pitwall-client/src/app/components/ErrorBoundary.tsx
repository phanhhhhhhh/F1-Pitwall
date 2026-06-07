import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0a0a0c" }}>
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 p-8"
            style={{ background: "rgba(18,18,21,.9)", boxShadow: "0 0 40px rgba(225,6,0,.08)" }}
          >
            <div className="flex items-center gap-3 mb-5">
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-red-800/60 text-red-500 text-lg font-bold"
                style={{ background: "rgba(225,6,0,.12)" }}
              >
                !
              </span>
              <div>
                <p
                  className="text-[10px] tracking-[0.3em] mb-0.5"
                  style={{ fontFamily: "ui-monospace,monospace", color: "#E10600" }}
                >
                  SYSTEM ERROR
                </p>
                <h2
                  className="text-white font-black text-xl tracking-tight leading-none"
                  style={{ fontFamily: "'Saira Condensed','Saira',system-ui,sans-serif" }}
                >
                  Something went wrong
                </h2>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 px-4 py-3 mb-6" style={{ background: "rgba(0,0,0,.4)" }}>
              <p
                className="text-zinc-400 text-sm break-words"
                style={{ fontFamily: "ui-monospace,monospace" }}
              >
                {this.state.error?.message || "An unexpected error occurred."}
              </p>
            </div>

            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                fontFamily: "ui-monospace,monospace",
                background: "linear-gradient(90deg,#E10600,#ff4a30)",
                color: "#fff",
                boxShadow: "0 0 20px rgba(225,6,0,.25)",
              }}
            >
              TRY AGAIN
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
