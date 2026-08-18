"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "./ui/Button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AIErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AI Component Error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 min-h-[300px] border-2 border-dashed border-red-200 dark:border-red-900/30 rounded-[32px] bg-red-50/50 dark:bg-red-950/10">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                عذراً، حدث خطأ في مساعد زين الذكي
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                يبدو أن هناك مشكلة تقنية مؤقتة. يمكنك محاولة إعادة تشغيل المحادثة.
              </p>
            </div>
            <Button
              onClick={this.handleReset}
              variant="outline"
              className="flex items-center gap-2 border-red-200 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-950/20"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة المحاولة</span>
            </Button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
