/**
 * Main App component for Swarm CLI TUI
 * Root application with layout and state management
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';
import { Header } from './Header';
import { MainContent } from './MainContent';
import { InputBox } from './InputBox';
import { StatusBar } from './StatusBar';
import { useInput } from '../hooks/useInput';
import { ThemeProvider, useTheme } from '../hooks/useTheme';

interface OutputLine {
  id: number;
  text: string;
  type: 'input' | 'output' | 'error' | 'info';
}

export interface AppProps {
  title?: string;
  onCommand?: (command: string) => Promise<string | void>;
  initialMessage?: string;
}

/**
 * Inner App component (needs theme context)
 */
function AppContent({
  title = 'Swarm CLI',
  onCommand,
  initialMessage,
}: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { colors } = useTheme();
  
  const [outputLines, setOutputLines] = useState<OutputLine[]>(() => {
    if (initialMessage) {
      return [{ id: 0, text: initialMessage, type: 'info' }];
    }
    return [];
  });
  const [statusText, setStatusText] = useState('Ready');
  const [statusColor, setStatusColor] = useState<'success' | 'warning' | 'error' | 'info'>('success');
  const [lineId, setLineId] = useState(1);

  // Handle command submission
  const handleCommandSubmit = useCallback(async (command: string) => {
    // Add input to output
    setOutputLines(prev => [...prev, { id: lineId, text: `> ${command}`, type: 'input' }]);
    setLineId(prev => prev + 1);

    // Handle built-in commands
    const trimmedCmd = command.trim().toLowerCase();
    
    if (trimmedCmd === 'exit' || trimmedCmd === 'quit' || trimmedCmd === 'q') {
      setStatusText('Exiting...');
      setStatusColor('info');
      setTimeout(() => exit(), 500);
      return;
    }

    if (trimmedCmd === 'clear') {
      setOutputLines([]);
      setStatusText('Cleared');
      setStatusColor('success');
      return;
    }

    if (trimmedCmd === 'help') {
      const helpText = `
Available commands:
  help    - Show this help message
  clear   - Clear the output
  exit    - Exit the TUI
  quit    - Exit the TUI (alias)
      `;
      setOutputLines(prev => [...prev, { id: lineId + 1, text: helpText, type: 'output' }]);
      setLineId(prev => prev + 2);
      return;
    }

    // Call external command handler if provided
    if (onCommand) {
      setStatusText('Processing...');
      setStatusColor('warning');
      
      try {
        const result = await onCommand(command);
        if (result) {
          setOutputLines(prev => [...prev, { id: lineId, text: result, type: 'output' }]);
        }
        setStatusText('Ready');
        setStatusColor('success');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setOutputLines(prev => [...prev, { id: lineId, text: `Error: ${errorMessage}`, type: 'error' }]);
        setStatusText('Error');
        setStatusColor('error');
      }
      setLineId(prev => prev + 1);
    } else {
      setOutputLines(prev => [...prev, { 
        id: lineId, 
        text: `Command not recognized: ${command}. Type 'help' for available commands.`, 
        type: 'info' 
      }]);
      setLineId(prev => prev + 1);
    }
  }, [exit, lineId, onCommand]);

  const { inputValue, cursorPosition, handleSubmit } = useInput({
    onSubmit: handleCommandSubmit,
  });

  // Get terminal height for layout
  const terminalHeight = stdout.rows || 24;
  const contentMaxHeight = Math.max(5, terminalHeight - 10); // Reserve space for header, input, status

  return React.createElement(
    Box,
    { flexDirection: 'column', height: terminalHeight },
    // Header
    React.createElement(Header, {
      title,
      subtitle: 'Agent Orchestration',
      showStatus: true,
      statusText,
      statusColor,
    }),
    // Main content area
    React.createElement(
      Box,
      { flexDirection: 'column', flexGrow: 1, paddingY: 1 },
      React.createElement(
        MainContent,
        { title: 'Output', maxHeight: contentMaxHeight },
        outputLines.length > 0
          ? outputLines.map(line =>
              React.createElement(
                Box,
                { key: line.id, marginBottom: 0 },
                React.createElement(
                  Text,
                  {
                    color: line.type === 'error' ? colors.error 
                      : line.type === 'input' ? colors.secondary
                      : line.type === 'info' ? colors.info
                      : colors.text,
                    dimColor: line.type === 'info',
                  },
                  line.text
                )
              )
            )
          : undefined
      )
    ),
    // Input box
    React.createElement(InputBox, {
      value: inputValue,
      cursorPosition,
      onSubmit: handleSubmit,
    }),
    // Status bar
    React.createElement(StatusBar, {
      message: undefined,
      keyBindings: [
        { key: 'Ctrl+C', description: 'Quit' },
        { key: 'Enter', description: 'Send' },
        { key: '↑↓', description: 'History' },
      ],
    })
  );
}

/**
 * Main App component with theme provider
 */
export function App(props: AppProps): React.ReactElement {
  return React.createElement(
    ThemeProvider,
    null,
    React.createElement(AppContent, props)
  );
}

export default App;
