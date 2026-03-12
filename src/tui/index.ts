/**
 * TUI Entry Point for Swarm CLI
 * Exports the main launcher and components
 */

import React from 'react';
import { render, RenderOptions } from 'ink';
import { App, AppProps } from './components/App';

// Components
export { App } from './components/App';
export { Header } from './components/Header';
export { MainContent } from './components/MainContent';
export { InputBox } from './components/InputBox';
export { StatusBar } from './components/StatusBar';
export { PlanView, PlanViewEmpty, PlanViewLoading } from './components/PlanView';
export { TaskList, TaskSummary } from './components/TaskList';
export { ProgressBar, ProgressBarWithStatus, SegmentedProgressBar } from './components/ProgressBar';
export { SessionList } from './components/SessionList';
export { SessionTree } from './components/SessionTree';
export { HelpScreen, HelpOverlay } from './components/HelpScreen';
export { KanbanBoard } from './components/KanbanBoard';
export { KanbanColumn } from './components/KanbanColumn';
export { TaskCard } from './components/TaskCard';
export { FileBrowser, EmbeddedFileBrowser, QuickFilePicker } from './components/FileBrowser';
export { FileTree, CompactFileTree } from './components/FileTree';
export { FilePreview, CompactFilePreview, CodePreview } from './components/FilePreview';

// Hooks
export { useInput } from './hooks/useInput';
export { useTheme, ThemeProvider, useColors, useTaskStyles, useTaskStyle } from './hooks/useTheme';
export { usePlanExecution } from './hooks/usePlanExecution';
export { useSessions } from './hooks/useSessions';
export { useKeybindings } from './hooks/useKeybindings';
export type { ViewContext, KeyActionHandler, UseKeybindingsOptions, UseKeybindingsReturn } from './hooks/useKeybindings';
export { useKanban } from './hooks/useKanban';
export type { UseKanbanOptions } from './hooks/useKanban';
export { useFileTree, createFileItem, buildFileTree } from './hooks/useFileTree';

// Theme - built-in themes
export { defaultTheme, hexToRgb, getAnsiColor } from './theme/default';
export { tokyoNightTheme } from './theme/tokyo-night';
export { draculaTheme } from './theme/dracula';
export { nordTheme } from './theme/nord';
export { solarizedDarkTheme, solarizedLightTheme } from './theme/solarized';

// Theme - loader and utilities
export {
  loadTheme,
  loadThemeFromYaml,
  loadThemeFromDefaultConfig,
  getBuiltinTheme,
  getBuiltinThemeNames,
  getAllBuiltinThemes,
  isBuiltinTheme,
  mergeThemeConfig,
  createCustomTheme,
  themeColorsToStyle,
  builtinThemes,
} from './theme';

// Theme types
export type {
  Theme,
  ThemeColors,
  ComponentStyles,
  TaskStateStyles,
  TaskStyle,
  ThemeConfig,
  ThemeName,
  BuiltinThemeName,
} from './theme/types';

// Types - Plan
export type {
  Task,
  TaskStatus,
  Wave,
  Phase,
  Plan,
  PlanExecutionState,
  PlanExecutionActions,
  UsePlanExecutionReturn,
} from './types/plan';
export {
  STATUS_ICONS,
  STATUS_COLORS,
  formatDuration,
  calculateProgress,
  calculateETA,
} from './types/plan';

// Types - Session
export type {
  Session,
  SubAgent,
  SessionStatus,
  AgentRole,
  SessionNavigationState,
  SessionNavigationActions,
  UseSessionsReturn,
} from './types/session';
export {
  SESSION_STATUS_ICONS,
  SESSION_STATUS_COLORS,
  AGENT_ROLE_ICONS,
  generateSessionId,
  generateSubAgentId,
  formatPreview,
  formatRelativeTime,
} from './types/session';

// Types - Kanban
export type {
  KanbanStatus,
  TaskPriority,
  KanbanTask,
  KanbanColumn as KanbanColumnType,
  KanbanPosition,
  KanbanLayout,
  KanbanAction,
  KanbanState,
  KanbanActions,
  UseKanbanReturn,
} from './types/kanban';
export {
  COLUMN_CONFIG,
  STATUS_ICONS as KANBAN_STATUS_ICONS,
  PRIORITY_ICONS,
} from './types/kanban';

// Types - File
export type {
  FileType,
  FileItem,
  FileTreeState,
  FileTreeActions,
  UseFileTreeReturn,
  FilePreview as FilePreviewType,
  FileSortOption,
  FileTreeOptions,
} from './types/file';
export {
  FILE_ICONS,
  DEFAULT_FILE_TREE_OPTIONS,
  getFileIcon,
  flattenTree,
  findItemById,
  getParentFolder,
  isTextFile,
  formatFileSize,
} from './types/file';

// Keybindings - configurations and presets
export {
  defaultKeyBindings,
  vimKeyBindings,
  keyBindingPresets,
  getKeyBindingPreset,
  listKeyBindingPresets,
  mergeKeyBindings,
  getKeyBindingGroups,
  formatKey,
} from './keybindings';
export type {
  KeyBinding,
  KeyBindingGroup,
  KeyBindingsConfig,
} from './keybindings';

/**
 * Launch the TUI application
 */
export function launchTUI(options: AppProps = {}): void {
  const { title, onCommand, initialMessage } = options;

  // Default initial message
  const defaultMessage = `
Welcome to Swarm CLI TUI!

Type 'help' for available commands.
Type 'exit' or 'quit' to leave the TUI.
  `.trim();

  const app = React.createElement(App, {
    title: title || 'Swarm CLI',
    onCommand,
    initialMessage: initialMessage || defaultMessage,
  });

  render(app);
}

/**
 * Create a TUI instance with custom configuration
 */
export function createTUI(props: AppProps, renderOptions?: RenderOptions): ReturnType<typeof render> {
  const app = React.createElement(App, props);
  return render(app, renderOptions);
}

export default {
  launchTUI,
  createTUI,
  App,
};
