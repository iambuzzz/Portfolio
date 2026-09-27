import React from "react";

// Keeps one misbehaving app from taking down the whole desktop.
export default class AppErrorBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.name}] crashed:`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="size-full flex-center flex-col text-center" style={{ gap: 10, padding: 24, color: "var(--c-text, #1c1c1e)" }}>
        <span className="i-ph:warning-circle" style={{ width: 36, height: 36, opacity: 0.6 }} />
        <div style={{ fontSize: 15, fontWeight: 600 }}>{this.props.name} quit unexpectedly.</div>
        <button
          onClick={() => this.setState({ failed: false })}
          style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, background: "#007AFF", color: "white" }}
        >
          Reopen
        </button>
      </div>
    );
  }
}
