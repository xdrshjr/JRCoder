/**
 * Tests for EmptyState component
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('should render with default message', () => {
    const { lastFrame } = render(<EmptyState />);

    expect(lastFrame()).toContain('No activities yet');
  });

  it('should render with custom message', () => {
    const { lastFrame } = render(
      <EmptyState message="Custom empty message" />
    );

    expect(lastFrame()).toContain('Custom empty message');
  });

  it('should render with helper text', () => {
    const { lastFrame } = render(
      <EmptyState
        message="No data"
        helperText="Waiting for input..."
      />
    );

    expect(lastFrame()).toContain('No data');
    expect(lastFrame()).toContain('Waiting for input');
  });

  it('should render with icon', () => {
    const { lastFrame } = render(
      <EmptyState
        message="Empty"
        icon="💭"
      />
    );

    expect(lastFrame()).toContain('💭');
    expect(lastFrame()).toContain('Empty');
  });

  it('should render in full screen mode', () => {
    const { lastFrame } = render(
      <EmptyState message="Empty" fullScreen={true} />
    );

    expect(lastFrame()).toContain('Empty');
  });
});
