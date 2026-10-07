import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  error: Error | null
}

// রেন্ডারে কোনো এরর হলে সাদা পেজের বদলে এরর বার্তা দেখায়
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="card auth">
        <h1>কিছু একটা সমস্যা হয়েছে</h1>
        <p className="muted">নিচের লেখাটি কপি করে পাঠান:</p>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '.8rem' }}>
          {this.state.error.message}
        </pre>
        <button onClick={() => window.location.reload()}>পেজ রিলোড করুন</button>
      </div>
    )
  }
}
