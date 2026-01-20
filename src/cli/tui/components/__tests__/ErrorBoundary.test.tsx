/**
 * Tests for ErrorBoundary component
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { ErrorBoundary } from '../ErrorBoundary';
import { Text } from 'ink';

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <Text>No error</Text>;
};

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <Text>Hello World</Text>
      </ErrorBoundary>
    );

    expect(lastFrame()).toContain('Hello World');
  });

  it('should catch and display error', () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(lastFrame()).toContain('TUI Error');
    expect(lastFrame()).toContain('Test error');
  });

  it('should call onError callback when error is caught', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <Text color="red">Custom Error UI</Text>;

    const { lastFrame } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(lastFrame()).toContain('Custom Error UI');
  });
});
