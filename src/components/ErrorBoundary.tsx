import React from "react";
import { reportEvent } from "../lib/reportError";

/** If a page crashes while drawing, show a calm message and a way back instead of a blank screen. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  declare props: { children: React.ReactNode };
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    reportEvent("render_error", error?.message || "A page failed to draw");
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-[#F8FAFC] text-[#0b1c30]" id="main-content">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-extrabold font-heading">Something went wrong on our side</h1>
          <p className="text-sm text-slate-600">
            Your application is saved on this device. Please reload the page. If it keeps happening, email us and mention what you were doing.
          </p>
          <a href="/" className="inline-flex items-center justify-center min-h-11 px-6 rounded-xl bg-[#006644] text-white font-bold text-sm">
            Back to the home page
          </a>
        </div>
      </main>
    );
  }
}
