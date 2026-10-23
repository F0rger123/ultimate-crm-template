import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: Error) { return { error: err }; }
  componentDidCatch(err: Error, info: React.ErrorInfo) { console.error("CRM Starter Error:", err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{ maxWidth: 400, textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: "#d4d4d4", fontSize: 20, marginBottom: 8 }}>Something crashed</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 16 }}>{this.state.error?.message}</p>
            <button onClick={() => this.setState({ error: null })}
              style={{ background: "#525252", color: "white", border: "none", borderRadius: 12, padding: "10px 24px", cursor: "pointer", fontSize: 14 }}>
              Go Back
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SafePage({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
