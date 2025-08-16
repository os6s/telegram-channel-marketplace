import { Component, ReactNode } from "react";

export class ErrorBoundary extends Component<{children: ReactNode}, {err?: any}> {
  state = { err: undefined as any };
  static getDerivedStateFromError(err: any) { return { err }; }
  componentDidCatch(err: any, info: any) { console.error("App crash:", err, info); }
  render() {
    if (this.state.err) {
      return (
        <div style={{padding:16,fontFamily:"system-ui"}}>
          <h3>Something went wrong</h3>
          <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.err?.message || this.state.err)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}