/**
 * FileBrowser component for Swarm CLI TUI
 * Main container combining FileTree and FilePreview panels
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Text, Box, useInput, useStdout } from 'ink';
import { useTheme } from '../hooks/useTheme';
import { FileTree } from './FileTree';
import { FilePreview } from './FilePreview';
import { useFileTree, buildFileTree } from '../hooks/useFileTree';
import {
  FileItem,
  findItemById,
  isTextFile,
} from '../types/file';

interface FileBrowserProps {
  /** Initial root path to browse */
  rootPath?: string;
  /** Initial file items (if already loaded) */
  initialItems?: FileItem[];
  /** Callback when a file is selected */
  onFileSelect?: (file: FileItem) => void;
  /** Callback when a file is opened */
  onFileOpen?: (file: FileItem) => void;
  /** Show preview panel */
  showPreview?: boolean;
  /** Maximum height of browser */
  maxHeight?: number;
  /** Width of tree panel */
  treeWidth?: number;
  /** Show search input */
  showSearch?: boolean;
  /** Enable keyboard navigation */
  enableKeyboardNav?: boolean;
  /** Custom empty message */
  emptyMessage?: string;
}

/**
 * Sample file tree for demo purposes
 */
const SAMPLE_FILES: FileItem[] = [
  {
    id: 'src',
    name: 'src',
    type: 'folder',
    path: 'src',
    isExpanded: true,
    children: [
      {
        id: 'src/components',
        name: 'components',
        type: 'folder',
        path: 'src/components',
        children: [
          { id: 'src/components/Auth.tsx', name: 'Auth.tsx', type: 'file', path: 'src/components/Auth.tsx', extension: 'tsx' },
          { id: 'src/components/User.tsx', name: 'User.tsx', type: 'file', path: 'src/components/User.tsx', extension: 'tsx' },
          { id: 'src/components/Header.tsx', name: 'Header.tsx', type: 'file', path: 'src/components/Header.tsx', extension: 'tsx' },
        ],
      },
      {
        id: 'src/api',
        name: 'api',
        type: 'folder',
        path: 'src/api',
        children: [
          { id: 'src/api/users.ts', name: 'users.ts', type: 'file', path: 'src/api/users.ts', extension: 'ts' },
          { id: 'src/api/auth.ts', name: 'auth.ts', type: 'file', path: 'src/api/auth.ts', extension: 'ts' },
        ],
      },
      { id: 'src/index.ts', name: 'index.ts', type: 'file', path: 'src/index.ts', extension: 'ts' },
      { id: 'src/App.tsx', name: 'App.tsx', type: 'file', path: 'src/App.tsx', extension: 'tsx' },
    ],
  },
  {
    id: 'tests',
    name: 'tests',
    type: 'folder',
    path: 'tests',
    children: [
      { id: 'tests/app.test.ts', name: 'app.test.ts', type: 'file', path: 'tests/app.test.ts', extension: 'ts' },
    ],
  },
  { id: 'package.json', name: 'package.json', type: 'file', path: 'package.json', extension: 'json' },
  { id: 'README.md', name: 'README.md', type: 'file', path: 'README.md', extension: 'md' },
  { id: '.gitignore', name: '.gitignore', type: 'file', path: '.gitignore', isHidden: true },
];

/**
 * Sample file contents for demo
 */
const SAMPLE_CONTENTS: Record<string, string> = {
  'src/components/Auth.tsx': `export function Auth() {
  const [user, setUser] = useState(null);
  
  return (
    <div className="auth-container">
      <h1>Authentication</h1>
      {/* Login form */}
    </div>
  );
}`,
  'src/components/User.tsx': `interface UserProps {
  id: string;
  name: string;
}

export function User({ id, name }: UserProps) {
  return (
    <div className="user-card">
      <h2>{name}</h2>
      <span>ID: {id}</span>
    </div>
  );
}`,
  'src/api/users.ts': `export async function getUsers() {
  const response = await fetch('/api/users');
  return response.json();
}

export async function getUser(id: string) {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}`,
  'src/api/auth.ts': `export async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}`,
  'src/index.ts': `import { App } from './App';
import { render } from 'ink';

render(<App />);`,
  'src/App.tsx': `import React from 'react';
import { Box, Text } from 'ink';

export function App() {
  return (
    <Box flexDirection="column">
      <Text>Welcome to Swarm CLI!</Text>
    </Box>
  );
}`,
  'package.json': `{
  "name": "swarm-cli",
  "version": "0.1.0",
  "description": "Agent orchestration CLI",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  }
}`,
  'README.md': `# Swarm CLI

A powerful agent orchestration CLI for managing
distributed AI agent workflows.

## Features

- Multi-agent coordination
- Task decomposition
- Progress tracking
`,
};

/**
 * FileBrowser component - Main file browser with tree and preview
 */
export function FileBrowser({
  rootPath = '.',
  initialItems,
  onFileSelect,
  onFileOpen,
  showPreview = true,
  maxHeight = 20,
  treeWidth = 35,
  showSearch = true,
  enableKeyboardNav = true,
  emptyMessage = 'No files to display',
}: FileBrowserProps): React.ReactElement {
  const { colors } = useTheme();
  const { stdout } = useStdout();
  
  // Use sample files if no initial items provided
  const [fileItems] = useState<FileItem[]>(initialItems || SAMPLE_FILES);
  
  // File tree state
  const fileTree = useFileTree({
    initialItems: fileItems,
    rootPath,
    onFileSelect,
  });
  
  // Preview state
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Search filter state
  const [searchActive, setSearchActive] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  
  // Get selected file
  const selectedFile = useMemo(() => {
    if (!fileTree.selectedId) return null;
    return findItemById(fileItems, fileTree.selectedId);
  }, [fileItems, fileTree.selectedId]);
  
  // Load preview content when file is selected
  useEffect(() => {
    if (selectedFile && selectedFile.type === 'file') {
      setPreviewLoading(true);
      
      // Simulate async file loading
      const timer = setTimeout(() => {
        const content = SAMPLE_CONTENTS[selectedFile.path] || '// File content not available';
        setPreviewContent(content);
        setPreviewLoading(false);
      }, 100);
      
      return () => clearTimeout(timer);
    } else {
      setPreviewContent('');
    }
  }, [selectedFile]);
  
  // Keyboard navigation
  useInput((input, key) => {
    if (!enableKeyboardNav) return;
    
    // Search mode
    if (searchActive) {
      if (key.escape) {
        setSearchActive(false);
        setSearchInput('');
        fileTree.setSearchFilter('');
      } else if (key.return) {
        setSearchActive(false);
      } else if (key.backspace || key.delete) {
        const newInput = searchInput.slice(0, -1);
        setSearchInput(newInput);
        fileTree.setSearchFilter(newInput);
      } else if (input && input.length === 1) {
        const newInput = searchInput + input;
        setSearchInput(newInput);
        fileTree.setSearchFilter(newInput);
      }
      return;
    }
    
    // Normal navigation
    if (key.upArrow || input === 'k') {
      fileTree.navigatePrevious();
    } else if (key.downArrow || input === 'j') {
      fileTree.navigateNext();
    } else if (key.leftArrow || input === 'h') {
      fileTree.navigateOut();
    } else if (key.rightArrow || input === 'l') {
      if (selectedFile?.type === 'folder') {
        fileTree.toggleExpand(selectedFile.id);
      } else if (selectedFile?.type === 'file' && onFileOpen) {
        onFileOpen(selectedFile);
      }
    } else if (key.return) {
      if (selectedFile) {
        if (selectedFile.type === 'folder') {
          fileTree.toggleExpand(selectedFile.id);
        } else if (onFileOpen) {
          onFileOpen(selectedFile);
        }
      }
    } else if (input === '/') {
      setSearchActive(true);
    } else if (input === 'e') {
      fileTree.expandAll();
    } else if (input === 'c') {
      fileTree.collapseAll();
    } else if (input === '.') {
      fileTree.toggleHidden();
    }
  }, { isActive: enableKeyboardNav && !searchActive });
  
  // Calculate layout
  const terminalWidth = stdout.columns || 80;
  const previewWidth = terminalWidth - treeWidth - 4;
  
  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: colors.border,
      paddingX: 1,
    },
    // Header
    React.createElement(
      Box,
      {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 1,
      },
      React.createElement(
        Text,
        { bold: true, color: colors.primary },
        `📁 File Browser`
      ),
      React.createElement(
        Text,
        { color: colors.muted, dimColor: true },
        `${rootPath}`
      )
    ),
    // Search bar (if active)
    showSearch && React.createElement(
      Box,
      { marginBottom: 1 },
      searchActive
        ? React.createElement(
            Box,
            { flexDirection: 'row' },
            React.createElement(Text, { color: colors.secondary }, 'Search: '),
            React.createElement(
              Text,
              { backgroundColor: colors.primary, color: '#000000' },
              searchInput + '▋'
            )
          )
        : React.createElement(
            Text,
            { color: colors.muted, dimColor: true },
            'Press / to search, ↑↓ to navigate, Enter to open'
          )
    ),
    // Main content: Tree + Preview
    React.createElement(
      Box,
      { flexDirection: 'row', flexGrow: 1 },
      // File tree panel
      React.createElement(
        Box,
        {
          flexDirection: 'column',
          width: treeWidth,
          paddingRight: 1,
          borderStyle: 'single',
          borderColor: colors.border,
        },
        React.createElement(
          Box,
          { marginBottom: 1 },
          React.createElement(
            Text,
            { bold: true, color: colors.secondary },
            'Files'
          )
        ),
        React.createElement(
          Box,
          { flexDirection: 'column', maxHeight: maxHeight - 6 },
          React.createElement(FileTree, {
            items: fileItems,
            selectedId: fileTree.selectedId,
            expandedIds: fileTree.expandedIds,
            onSelect: fileTree.select,
            onToggleExpand: fileTree.toggleExpand,
            searchFilter: fileTree.searchFilter,
            showHidden: fileTree.showHidden,
            maxNameWidth: treeWidth - 6,
          })
        )
      ),
      // Preview panel
      showPreview && React.createElement(
        Box,
        { flexDirection: 'column', flexGrow: 1, paddingLeft: 1 },
        React.createElement(FilePreview, {
          file: selectedFile,
          content: previewContent,
          isLoading: previewLoading,
          maxLines: maxHeight - 8,
          width: previewWidth,
        })
      )
    ),
    // Status bar
    React.createElement(
      Box,
      {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 1,
      },
      React.createElement(
        Text,
        { color: colors.muted, dimColor: true },
        selectedFile
          ? `Selected: ${selectedFile.name}`
          : 'No file selected'
      ),
      React.createElement(
        Box,
        { flexDirection: 'row' },
        React.createElement(Text, { color: colors.muted }, 'e: expand all │ '),
        React.createElement(Text, { color: colors.muted }, 'c: collapse all │ '),
        React.createElement(Text, { color: colors.muted }, '.: toggle hidden')
      )
    )
  );
}

/**
 * Standalone file browser for embedding in other components
 */
export function EmbeddedFileBrowser({
  items,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  maxHeight = 15,
}: {
  items: FileItem[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect?: (id: string) => void;
  onToggleExpand?: (id: string) => void;
  maxHeight?: number;
}): React.ReactElement {
  const { colors } = useTheme();

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: colors.border,
    },
    React.createElement(
      Text,
      { bold: true, color: colors.secondary },
      '📁 Files'
    ),
    React.createElement(
      Box,
      { flexDirection: 'column', maxHeight },
      React.createElement(FileTree, {
        items,
        selectedId,
        expandedIds,
        onSelect,
        onToggleExpand,
        maxNameWidth: 25,
      })
    )
  );
}

/**
 * Quick file picker component
 */
export function QuickFilePicker({
  items,
  onSelect,
  onCancel,
  placeholder = 'Select a file...',
}: {
  items: FileItem[];
  onSelect: (file: FileItem) => void;
  onCancel?: () => void;
  placeholder?: string;
}): React.ReactElement {
  const { colors } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Flatten items for quick navigation
  const flatItems = useMemo(() => {
    return items.flatMap(item => 
      item.type === 'folder' && item.children 
        ? [item, ...item.children]
        : [item]
    );
  }, [items]);
  
  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex(i => Math.min(flatItems.length - 1, i + 1));
    } else if (key.return) {
      onSelect(flatItems[selectedIndex]);
    } else if (key.escape && onCancel) {
      onCancel();
    }
  });
  
  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: colors.border,
      paddingX: 1,
    },
    React.createElement(
      Text,
      { color: colors.muted, italic: true },
      placeholder
    ),
    ...flatItems.slice(0, 10).map((item, index) =>
      React.createElement(
        Text,
        {
          key: item.id,
          color: index === selectedIndex ? colors.primary : colors.text,
          bold: index === selectedIndex,
        },
        `${index === selectedIndex ? '▸ ' : '  '}${item.type === 'folder' ? '📁' : '📄'} ${item.name}`
      )
    )
  );
}

export default FileBrowser;
