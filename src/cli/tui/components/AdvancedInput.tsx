/**
 * AdvancedInput Component - Enhanced input with multiline and history support
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { AdvancedInputProps } from '../types';
import { logger } from '../logger';

/**
 * AdvancedInput component with multiline support and command history
 */
export const AdvancedInput: React.FC<AdvancedInputProps> = ({
  onSubmit,
  history = [],
  placeholder = 'Type your message...',
  disabled = false,
}) => {
  const [value, setValue] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isMultiline, setIsMultiline] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  /**
   * Handle input submission
   */
  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) {
      logger.debug('User input submitted', {
        type: 'user_input_submit',
        length: trimmed.length,
        isMultiline,
      });

      onSubmit(trimmed);
      setValue('');
      setHistoryIndex(-1);
      setIsMultiline(false);
      setCursorPosition(0);
    }
  }, [value, isMultiline, onSubmit]);

  /**
   * Navigate to previous history item
   */
  const navigateHistoryUp = useCallback(() => {
    if (history.length === 0) return;

    const newIndex = Math.min(historyIndex + 1, history.length - 1);
    setHistoryIndex(newIndex);
    const historyValue = history[history.length - 1 - newIndex];
    setValue(historyValue);
    setCursorPosition(historyValue.length);

    logger.debug('Navigated history up', {
      type: 'history_navigation',
      direction: 'up',
      index: newIndex,
    });
  }, [history, historyIndex]);

  /**
   * Navigate to next history item
   */
  const navigateHistoryDown = useCallback(() => {
    if (historyIndex < 0) return;

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);

    if (newIndex >= 0) {
      const historyValue = history[history.length - 1 - newIndex];
      setValue(historyValue);
      setCursorPosition(historyValue.length);
    } else {
      setValue('');
      setCursorPosition(0);
    }

    logger.debug('Navigated history down', {
      type: 'history_navigation',
      direction: 'down',
      index: newIndex,
    });
  }, [history, historyIndex]);

  /**
   * Toggle multiline mode
   */
  const toggleMultiline = useCallback(() => {
    setIsMultiline((prev) => !prev);
    logger.debug('Toggled multiline mode', {
      type: 'multiline_toggle',
      isMultiline: !isMultiline,
    });
  }, [isMultiline]);

  /**
   * Handle keyboard input
   */
  useInput(
    (input, key) => {
      // Ignore input if disabled
      if (disabled) return;

      // Ctrl+M: Toggle multiline mode
      if (key.ctrl && input === 'm') {
        toggleMultiline();
        return;
      }

      // Up arrow: Navigate history up
      if (key.upArrow && !isMultiline) {
        navigateHistoryUp();
        return;
      }

      // Down arrow: Navigate history down
      if (key.downArrow && !isMultiline) {
        navigateHistoryDown();
        return;
      }

      // Enter: Submit or newline
      if (key.return) {
        if (isMultiline && !key.ctrl) {
          // Add newline in multiline mode
          setValue((prev) => prev + '\n');
          setCursorPosition((prev) => prev + 1);
        } else {
          // Submit (single line or Ctrl+Enter in multiline)
          handleSubmit();
        }
        return;
      }

      // Backspace
      if (key.backspace || key.delete) {
        if (value.length > 0) {
          setValue((prev) => prev.slice(0, -1));
          setCursorPosition((prev) => Math.max(0, prev - 1));
        }
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        setValue((prev) => prev + input);
        setCursorPosition((prev) => prev + 1);
      }
    },
    { isActive: !disabled }
  );

  /**
   * Render multiline content with line numbers
   */
  const renderMultilineContent = () => {
    const lines = value.split('\n');
    return (
      <Box flexDirection="column" paddingLeft={1}>
        {lines.map((line, index) => (
          <Box key={index}>
            <Text dimColor>{String(index + 1).padStart(2, ' ')}│ </Text>
            <Text>{line || ' '}</Text>
          </Box>
        ))}
        <Box>
          <Text dimColor>{String(lines.length + 1).padStart(2, ' ')}│ </Text>
          <Text>_</Text>
        </Box>
      </Box>
    );
  };

  /**
   * Render single line content
   */
  const renderSingleLineContent = () => {
    const displayValue = value || placeholder;
    const isPlaceholder = !value;

    return (
      <Box paddingX={1}>
        <Text color={disabled ? 'gray' : 'green'}>
          {disabled ? '\u23F8 ' : '\u270F '}
        </Text>
        <Text dimColor={isPlaceholder} color={disabled ? 'gray' : undefined}>
          {displayValue}
        </Text>
        {!disabled && !isPlaceholder && <Text>_</Text>}
      </Box>
    );
  };

  /**
   * Render help text
   */
  const renderHelpText = () => {
    if (disabled) {
      return (
        <Text dimColor>
          Input disabled - agent is working
        </Text>
      );
    }

    if (isMultiline) {
      return (
        <Text dimColor>
          Ctrl+Enter: Send | Ctrl+M: Exit multiline | Ctrl+C: Exit app
        </Text>
      );
    }

    return (
      <Text dimColor>
        Enter: Send | Ctrl+M: Multiline | ↑↓: History | Ctrl+C: Exit
      </Text>
    );
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={disabled ? 'gray' : 'green'}
    >
      {/* Input area */}
      {isMultiline ? renderMultilineContent() : renderSingleLineContent()}

      {/* Help text */}
      <Box paddingX={1} paddingTop={0}>
        {renderHelpText()}
      </Box>

      {/* Multiline indicator */}
      {isMultiline && (
        <Box paddingX={1}>
          <Text color="yellow">
            [Multiline Mode] {value.split('\n').length} line(s)
          </Text>
        </Box>
      )}
    </Box>
  );
};
