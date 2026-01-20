/**
 * ThinkingAdapter tests
 */

import { ThinkingAdapter } from '../ThinkingAdapter';
import { TUIEventBus } from '../../event-bus';
import { EventEmitter } from '../../../../core/event-emitter';
import type { ILogger } from '../../../../logger/interfaces';

// Mock logger
const mockLogger: ILogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logToolCall: jest.fn(),
  logToolResult: jest.fn(),
  logLLMRequest: jest.fn(),
  logLLMResponse: jest.fn(),
  child: jest.fn(() => mockLogger),
};

describe('ThinkingAdapter', () => {
  let eventBus: TUIEventBus;
  let adapter: ThinkingAdapter;
  let agentEventEmitter: EventEmitter;

  beforeEach(() => {
    eventBus = new TUIEventBus(mockLogger);
    adapter = new ThinkingAdapter(eventBus, mockLogger);
    agentEventEmitter = new EventEmitter();
  });

  it('should initialize correctly', () => {
    expect(adapter).toBeDefined();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ThinkingAdapter initialized',
      expect.objectContaining({ type: 'thinking_adapter_initialized' })
    );
  });

  it('should emit thinking event for planner', () => {
    const eventListener = jest.fn();
    eventBus.on('agent:thinking', eventListener);

    adapter.emitPlannerThinking('Analyzing task complexity');

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agent:thinking',
        content: 'Analyzing task complexity',
        source: 'planner',
      })
    );
  });

  it('should emit thinking event for reflector', () => {
    const eventListener = jest.fn();
    eventBus.on('agent:thinking', eventListener);

    adapter.emitReflectorThinking('Evaluating execution results');

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agent:thinking',
        content: 'Evaluating execution results',
        source: 'reflector',
      })
    );
  });

  it('should connect to agent event emitter', () => {
    adapter.connect(agentEventEmitter);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ThinkingAdapter connected successfully',
      expect.objectContaining({ type: 'thinking_adapter_connected' })
    );
  });

  it('should handle phase change events', () => {
    const eventListener = jest.fn();
    eventBus.on('agent:thinking', eventListener);

    adapter.connect(agentEventEmitter);

    // Emit planning phase event
    agentEventEmitter.emit({
      type: 'phase_changed',
      timestamp: Date.now(),
      data: { from: 'planning', phase: 'planning' },
    });

    expect(eventListener).toHaveBeenCalled();
  });

  it('should disconnect cleanly', () => {
    adapter.disconnect();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ThinkingAdapter disconnected',
      expect.objectContaining({ type: 'thinking_adapter_disconnected' })
    );
  });
});
