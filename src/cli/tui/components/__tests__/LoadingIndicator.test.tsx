/**
 * Tests for LoadingIndicator component
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { LoadingIndicator } from '../LoadingIndicator';

describe('LoadingIndicator', () => {
  it('should render with default message', () => {
    const { lastFrame } = render(<LoadingIndicator />);

    expect(lastFrame()).toContain('Loading OpenJRAgent');
  });

  it('should render with custom message', () => {
    const { lastFrame } = render(
      <LoadingIndicator message="Initializing Agent..." />
    );

    expect(lastFrame()).toContain('Initializing Agent');
  });

  it('should render without full screen mode', () => {
    const { lastFrame } = render(
      <LoadingIndicator message="Loading..." fullScreen={false} />
    );

    expect(lastFrame()).toContain('Loading');
  });

  it('should render with different spinner types', () => {
    const spinnerTypes = ['dots', 'line', 'pipe'] as const;

    spinnerTypes.forEach((type) => {
      const { lastFrame } = render(
        <LoadingIndicator spinnerType={type} message="Test" />
      );

      expect(lastFrame()).toContain('Test');
    });
  });
});
