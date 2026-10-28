'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Map } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './card';

interface Props {
  children: ReactNode;
  viewName?: string;
  onReset?: () => void;
  onGoToMap?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ViewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ViewErrorBoundary:${this.props.viewName || 'unknown'}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[50vh] p-4 sm:p-6">
          <Card className="max-w-md w-full bg-card/95 border-destructive/40 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="size-12 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="size-6" />
              </div>
              <CardTitle className="text-lg sm:text-xl text-foreground font-semibold">
                Сбой отображения раздела
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                В модуле {this.props.viewName ? `«${this.props.viewName}»` : 'интерфейса'} произошла непредвиденная ошибка при рендеринге данных.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {this.state.error?.message && (
                <div className="p-2.5 rounded bg-muted/60 border border-border/50 text-xs font-mono text-muted-foreground break-words max-h-24 overflow-y-auto">
                  {this.state.error.message}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button
                  onClick={this.handleReset}
                  variant="default"
                  className="flex-1 gap-1.5 text-xs sm:text-sm h-9"
                >
                  <RotateCcw className="size-3.5" />
                  Повторить попытку
                </Button>
                {this.props.onGoToMap && (
                  <Button
                    onClick={this.props.onGoToMap}
                    variant="outline"
                    className="flex-1 gap-1.5 text-xs sm:text-sm h-9"
                  >
                    <Map className="size-3.5" />
                    На карту
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ViewErrorBoundary;
