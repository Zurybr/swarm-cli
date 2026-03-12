/**
 * FilePreview component for Swarm CLI TUI
 * Displays file content preview in a panel
 */

import React, { useMemo } from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../hooks/useTheme';
import {
  FileItem,
  FilePreview,
  getFileIcon,
  isTextFile,
  formatFileSize,
} from '../types/file';

interface FilePreviewProps {
  /** File to preview */
  file: FileItem | null;
  /** File content (if already loaded) */
  content?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Error message if preview failed */
  error?: string;
  /** Maximum number of lines to show */
  maxLines?: number;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Show file header */
  showHeader?: boolean;
  /** Width of preview panel */
  width?: number;
}

/**
 * Syntax highlighting helper (basic)
 */
function highlightSyntax(line: string, extension?: string): React.ReactNode {
  // Basic syntax highlighting for common patterns
  const parts: Array<{ text: string; color?: string }> = [];
  
  // Keywords
  const keywords = /\b(const|let|var|function|return|if|else|for|while|class|interface|type|import|export|from|async|await|try|catch|throw|new|this|super|extends|implements)\b/g;
  
  // Strings
  const strings = /(['"`])(?:(?!\1)[^\\]|\\.)*\1/g;
  
  // Comments
  const comments = /(\/\/.*$|\/\*[\s\S]*?\*\/)/g;
  
  // Numbers
  const numbers = /\b(\d+\.?\d*)\b/g;
  
  // Simple approach: just return the line for now
  // In a real implementation, you'd use a proper syntax highlighter
  return line;
}

/**
 * FilePreview component - Shows file content in a panel
 */
export function FilePreview({
  file,
  content,
  isLoading = false,
  error,
  maxLines = 20,
  showLineNumbers = true,
  showHeader = true,
  width = 50,
}: FilePreviewProps): React.ReactElement {
  const { colors } = useTheme();

  // No file selected state
  if (!file) {
    return React.createElement(
      Box,
      {
        flexDirection: 'column',
        borderStyle: 'single',
        borderColor: colors.border,
        paddingX: 1,
        width,
      },
      React.createElement(
        Text,
        { color: colors.muted, italic: true },
        'Select a file to preview'
      )
    );
  }

  // Loading state
  if (isLoading) {
    return React.createElement(
      Box,
      {
        flexDirection: 'column',
        borderStyle: 'single',
        borderColor: colors.border,
        paddingX: 1,
        width,
      },
      showHeader && React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { bold: true, color: colors.secondary }, 'Preview:'),
        React.createElement(Text, { color: colors.muted }, ' Loading...')
      ),
      React.createElement(
        Text,
        { color: colors.muted },
        '⏳ Loading file content...'
      )
    );
  }

  // Error state
  if (error) {
    return React.createElement(
      Box,
      {
        flexDirection: 'column',
        borderStyle: 'single',
        borderColor: colors.error,
        paddingX: 1,
        width,
      },
      showHeader && React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { bold: true, color: colors.secondary }, 'Preview:'),
        React.createElement(Text, { color: colors.error }, ` ${file.name}`)
      ),
      React.createElement(
        Text,
        { color: colors.error },
        `❌ ${error}`
      )
    );
  }

  // Parse content into lines
  const lines = useMemo(() => {
    if (!content) return [];
    return content.split('\n').slice(0, maxLines);
  }, [content, maxLines]);

  const icon = getFileIcon(file);
  const lineNumberWidth = String(Math.min(lines.length, maxLines)).length + 1;

  // Check if binary file
  const isBinary = file.extension && !isTextFile(file.name);

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: colors.border,
      paddingX: 1,
      width,
    },
    // Header
    showHeader && React.createElement(
      Box,
      { 
        flexDirection: 'row',
        marginBottom: 1,
        justifyContent: 'space-between',
      },
      React.createElement(
        Box,
        { flexDirection: 'row' },
        React.createElement(Text, { bold: true, color: colors.secondary }, 'Preview:'),
        React.createElement(Text, null, ` ${icon} `),
        React.createElement(Text, { bold: true }, file.name)
      ),
      lines.length > 0 && React.createElement(
        Text,
        { color: colors.muted },
        `${lines.length} lines`
      )
    ),
    // Content
    React.createElement(
      Box,
      { flexDirection: 'column' },
      isBinary
        ? React.createElement(
            Text,
            { color: colors.muted, italic: true },
            '📄 Binary file - cannot preview'
          )
        : lines.length === 0
          ? React.createElement(
              Text,
              { color: colors.muted, italic: true },
              'Empty file'
            )
          : React.createElement(
              Box,
              { flexDirection: 'column' },
              ...lines.map((line, index) =>
                React.createElement(
                  Box,
                  { key: index, flexDirection: 'row' },
                  // Line number
                  showLineNumbers && React.createElement(
                    Text,
                    {
                      color: colors.muted,
                      dimColor: true,
                    },
                    `${String(index + 1).padStart(lineNumberWidth)} │ `
                  ),
                  // Line content
                  React.createElement(
                    Text,
                    {
                      color: line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('/*')
                        ? colors.muted
                        : colors.text,
                    },
                    line || ' '
                  )
                )
              ),
              // Show truncation indicator
              content && content.split('\n').length > maxLines && React.createElement(
                Text,
                { color: colors.muted, dimColor: true },
                `... (${content.split('\n').length - maxLines} more lines)`
              )
            )
    ),
    // File info footer
    file.size !== undefined && React.createElement(
      Box,
      { marginTop: 1, flexDirection: 'row', justifyContent: 'space-between' },
      React.createElement(
        Text,
        { color: colors.muted, dimColor: true },
        `Size: ${formatFileSize(file.size)}`
      ),
      file.modifiedAt && React.createElement(
        Text,
        { color: colors.muted, dimColor: true },
        `Modified: ${new Date(file.modifiedAt).toLocaleDateString()}`
      )
    )
  );
}

/**
 * Compact preview for sidebar
 */
export function CompactFilePreview({
  file,
  content,
  maxLines = 10,
}: Omit<FilePreviewProps, 'showLineNumbers' | 'showHeader' | 'width'>): React.ReactElement {
  const { colors } = useTheme();

  if (!file) {
    return React.createElement(
      Text,
      { color: colors.muted, italic: true },
      'No file selected'
    );
  }

  const icon = getFileIcon(file);
  const lines = content?.split('\n').slice(0, maxLines) || [];

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    // File name
    React.createElement(
      Text,
      { bold: true, color: colors.secondary },
      `${icon} ${file.name}`
    ),
    // Preview lines
    ...lines.map((line, index) =>
      React.createElement(
        Text,
        {
          key: index,
          color: colors.muted,
          dimColor: true,
        },
        line.substring(0, 40) + (line.length > 40 ? '...' : '')
      )
    )
  );
}

/**
 * Code preview with minimal syntax highlighting
 */
export function CodePreview({
  file,
  content,
  maxLines = 20,
}: Omit<FilePreviewProps, 'showLineNumbers' | 'showHeader' | 'width'>): React.ReactElement {
  const { colors } = useTheme();

  if (!file || !content) {
    return React.createElement(
      Text,
      { color: colors.muted },
      'No content'
    );
  }

  const lines = content.split('\n').slice(0, maxLines);

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    ...lines.map((line, index) => {
      // Detect line type for coloring
      let lineColor = colors.text;
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
        lineColor = colors.muted;
      } else if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('export ')) {
        lineColor = colors.info;
      } else if (/^(const|let|var|function|class|interface|type)\s/.test(trimmedLine)) {
        lineColor = colors.secondary;
      }

      return React.createElement(
        Text,
        { key: index, color: lineColor },
        line || ' '
      );
    })
  );
}

export default FilePreview;
