/**
 * InputBox Component - User input area at the bottom
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { InputBoxProps } from '../types';

/**
 * InputBox component for user input
 */
export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  placeholder = 'Your message...',
  disabled = false,
}) => {
  const [value, setValue] = useState('');

  const handleSubmit = (submittedValue: string) => {
    const trimmed = submittedValue.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setValue('');
    }
  };

  return (
    <Box
      borderStyle="single"
      borderColor={disabled ? 'gray' : 'green'}
      paddingX={1}
      flexDirection="column"
    >
      <Box>
        <Text color={disabled ? 'gray' : 'green'}>
          {disabled ? '\u23F8 ' : '\u270F '}
        </Text>
        {disabled ? (
          <Text dimColor>{placeholder}</Text>
        ) : (
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder={placeholder}
          />
        )}
      </Box>
      <Box paddingTop={0}>
        <Text dimColor>
          {disabled
            ? 'Input disabled - agent is working'
            : 'Press Enter to send | Ctrl+C to exit'}
        </Text>
      </Box>
    </Box>
  );
};
