import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Keep the UI resilient; details remain in the browser console for debugging.
    console.error('Digital Heroes UI error:', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
        <section className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Digital Heroes</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Something went wrong</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">The page hit an unexpected error. Your account data is still controlled by the backend.</p>
          <button type="button" onClick={this.handleReload} className="mt-6 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200">Reload page</button>
        </section>
      </main>
    );
  }
}
