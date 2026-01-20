/**
 * ErrorBoundary - React component to catch and display errors
 */

import React, { Component, type ReactNode } from 'react';
import { Box, Text } from 'ink';

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * ErrorBoundary component to catch React errors and display fallback UI
 *
 * @example
 * ```tsx
 * <ErrorBoundary onError={(error) => logger.error('TUI Error', error)}>
 *   <TUIApp />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="red"
          padding={1}
        >
          <Text color="red" bold>
            TUI Error
          </Text>
          <Text>{'\n'}</Text>
          <Text color="red">{this.state.error?.message || 'An unknown error occurred'}</Text>
          <Text>{'\n'}</Text>
          {this.state.error?.stack && (
            <>
              <Text dimColor>Stack trace:</Text>
              <Text dimColor>{this.state.error.stack.substring(0, 500)}</Text>
              <Text>{'\n'}</Text>
            </>
          )}
          <Text dimColor>Press Ctrl+C to exit</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}
