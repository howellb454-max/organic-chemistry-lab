"use client";

import React from "react";
import { FlaskConical, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <FlaskConical className="size-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">
              {this.props.fallbackTitle || "Ocurrió un error con el editor"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {this.props.fallbackMessage ||
                "El editor molecular encontró un problema inesperado. Por favor, recarga la página para continuar."}
            </p>
          </div>
          <Button onClick={this.handleReload} variant="outline" size="sm">
            <RefreshCcw className="mr-1.5 size-3.5" />
            Recargar página
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
