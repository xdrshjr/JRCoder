# OpenJRAgent TUI Prototype Demo

This directory contains the prototype demonstration of the TUI (Text User Interface) for OpenJRAgent.

## Overview

The prototype demonstrates the proposed TUI architecture using the ink framework. It simulates the agent execution flow without connecting to the actual agent system.

## Features Demonstrated

- **Header Bar**: Displays project name, version, current phase, and online status
- **Activity Feed**: Shows real-time execution activities including:
  - Thinking processes (Planner/Reflector)
  - Tool calls with status indicators
  - Bash command execution
  - General messages
- **Status Bar**: Displays task progress, token usage, cost estimation, and iteration count
- **Input Box**: User interaction area with keyboard shortcuts
- **Dynamic Updates**: Real-time activity updates with visual indicators (spinners, checkmarks)

## Prerequisites

Ensure you have installed the required dependencies:

```bash
npm install
```

## Running the Demo

### Option 1: Using ts-node (Development)

```bash
npx ts-node prototype/tui-demo.tsx
```

### Option 2: Compile and Run

```bash
# Compile TypeScript
npx tsc prototype/tui-demo.tsx --jsx react --esModuleInterop --skipLibCheck --outDir prototype/dist

# Run compiled JS
node prototype/dist/tui-demo.js
```

## Keyboard Controls

- **Enter**: Submit input (when input is enabled)
- **Ctrl+C**: Exit the application

## Demo Flow

The prototype simulates a typical agent execution:

1. **Planning Phase**:
   - Analyzes task complexity
   - Generates execution plan

2. **Executing Phase**:
   - Performs code queries
   - Reads files
   - Executes bash commands
   - Writes files
   - Updates task progress

3. **Reflecting Phase**:
   - Evaluates execution results
   - Confirms goal achievement

4. **Completed Phase**:
   - Final status display
   - Awaits user input for next task

## Layout Breakdown

```
┌─────────────────────────────────────────────────────────────┐
│ OpenJRAgent v1.0.0  │  Phase: EXECUTING  │  Online          │  ← Header (3 lines)
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 10:30:45 ... [Thinking] Analyzing task complexity...        │
│ 10:30:47 ✓ [Thinking] This is a complex task...             │  ← Activity Feed
│ 10:30:49 ... [Tool Call] code_query(...)                    │     (Scrollable)
│              Found 3 matching functions                      │
│ 10:30:51 ... [Bash] $ npm install jsonwebtoken              │
│              added 5 packages in 2.3s                        │
│              Exit code: 0                                    │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ Tasks: 3/5 | Tokens: 4.5k | Cost: $0.0045 | Iteration: 1/10│  ← Status Bar (1 line)
├─────────────────────────────────────────────────────────────┤
│ > Type your message...                                       │  ← Input Box (3 lines)
│ Enter: Send | Ctrl+C: Exit                                   │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

The demo demonstrates the following component hierarchy:

```
<App>
├─ <Header>
│  ├─ Project Info
│  ├─ Phase Indicator
│  └─ Online Status
│
├─ Activity Feed (Content Area)
│  └─ <ActivityItem> (multiple)
│     ├─ Timestamp
│     ├─ Status Icon
│     ├─ Type Label
│     ├─ Content
│     └─ Details (optional)
│
├─ <StatusBar>
│  ├─ Task Progress
│  ├─ Token Usage
│  ├─ Cost Display
│  └─ Iteration Count
│
└─ <InputBox>
   ├─ Text Input
   └─ Keyboard Hints
```

## Technical Details

- **Framework**: ink 4.4.1 (React for CLI)
- **Language**: TypeScript with JSX
- **Dependencies**:
  - react: ^18.2.0
  - ink: ^4.4.1
  - ink-spinner: ^5.0.0
  - ink-text-input: ^5.0.1

## Next Steps

After reviewing the prototype:

1. Approve the TUI architecture and design
2. Implement production components in `src/cli/tui/`
3. Integrate with actual Agent event system
4. Add comprehensive testing
5. Implement performance optimizations

## Related Documentation

- [TUI Technical Specification](../docs/dev-plan/TUI-Technical-Specification.md)
- [TUI Development Plan](../docs/dev-plan/TUI-Interface-Development-Plan.md)

## Troubleshooting

### Issue: Module not found errors

**Solution**: Ensure all dependencies are installed:
```bash
npm install
```

### Issue: JSX syntax errors

**Solution**: Make sure you're using ts-node or have proper TypeScript compilation with JSX support.

### Issue: Terminal display issues

**Solution**: Try running in different terminals (PowerShell, CMD, Windows Terminal, etc.). The demo works best in modern terminals with Unicode support.

## Feedback

Please provide feedback on:
- Overall layout and visual design
- Color scheme and readability
- Activity presentation and formatting
- Performance and responsiveness
- Any missing features or improvements

---

**Note**: This is a prototype for demonstration purposes. The production implementation will include additional features such as virtual scrolling, activity filtering, error handling, and full Agent system integration.
