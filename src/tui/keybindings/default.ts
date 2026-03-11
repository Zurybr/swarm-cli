/**
 * Default keybindings configuration for Swarm CLI TUI
 * Defines all keyboard shortcuts organized by context
 */

/**
 * Keybinding definition
 */
export interface KeyBinding {
  /** Key or key combination (e.g., 'ctrl+c', 'enter', 'j') */
  key: string;
  /** Human-readable description */
  description: string;
  /** Action identifier */
  action: string;
  /** Whether this keybinding is enabled */
  enabled?: boolean;
}

/**
 * Keybindings group by context
 */
export interface KeyBindingGroup {
  /** Group name for display */
  name: string;
  /** Keybindings in this group */
  bindings: KeyBinding[];
}

/**
 * Complete keybindings configuration
 */
export interface KeyBindingsConfig {
  /** Configuration name */
  name: string;
  /** Configuration description */
  description: string;
  /** Global keybindings (always active) */
  global: KeyBinding[];
  /** Navigation keybindings */
  navigation: KeyBinding[];
  /** Plan view specific keybindings */
  planView: KeyBinding[];
  /** Kanban view specific keybindings */
  kanban: KeyBinding[];
  /** Input mode keybindings */
  input: KeyBinding[];
}

/**
 * Default keybindings matching the specification
 */
export const defaultKeyBindings: KeyBindingsConfig = {
  name: 'default',
  description: 'Default Swarm CLI keybindings',
  
  global: [
    { key: 'tab', description: 'Switch agent (build/plan)', action: 'switchAgent' },
    { key: 'ctrl+c', description: 'Cancel current operation', action: 'cancel' },
    { key: 'ctrl+d', description: 'Exit application', action: 'exit' },
    { key: '?', description: 'Show help screen', action: 'showHelp' },
    { key: 'escape', description: 'Close overlay/cancel', action: 'escape' },
  ],

  navigation: [
    { key: 'j', description: 'Move down', action: 'moveDown' },
    { key: 'downArrow', description: 'Move down', action: 'moveDown' },
    { key: 'k', description: 'Move up', action: 'moveUp' },
    { key: 'upArrow', description: 'Move up', action: 'moveUp' },
    { key: 'h', description: 'Move left', action: 'moveLeft' },
    { key: 'leftArrow', description: 'Move left', action: 'moveLeft' },
    { key: 'l', description: 'Move right', action: 'moveRight' },
    { key: 'rightArrow', description: 'Move right', action: 'moveRight' },
    { key: 'enter', description: 'Select/open item', action: 'select' },
    { key: 'q', description: 'Quit/close view', action: 'quitView' },
    { key: 'g', description: 'Go to top', action: 'goTop' },
    { key: 'G', description: 'Go to bottom', action: 'goBottom' },
  ],

  planView: [
    { key: 'space', description: 'Toggle task details', action: 'toggleDetails' },
    { key: 'r', description: 'Refresh status', action: 'refresh' },
    { key: 'l', description: 'View task logs', action: 'viewLogs' },
    { key: 'a', description: 'Abort plan', action: 'abortPlan' },
    { key: 'p', description: 'Pause/resume execution', action: 'togglePause' },
    { key: 's', description: 'Skip current task', action: 'skipTask' },
    { key: 'e', description: 'Expand all tasks', action: 'expandAll' },
    { key: 'c', description: 'Collapse all tasks', action: 'collapseAll' },
  ],

  kanban: [
    { key: 'tab', description: 'Next column', action: 'nextColumn' },
    { key: 'shift+tab', description: 'Previous column', action: 'prevColumn' },
    { key: 'm', description: 'Move task', action: 'moveTask' },
    { key: 'n', description: 'New task', action: 'newTask' },
    { key: 'd', description: 'Delete task', action: 'deleteTask' },
    { key: 'e', description: 'Edit task', action: 'editTask' },
    { key: 'enter', description: 'Open task details', action: 'openTask' },
    { key: '1', description: 'Go to Todo column', action: 'gotoTodo' },
    { key: '2', description: 'Go to In Progress column', action: 'gotoInProgress' },
    { key: '3', description: 'Go to Done column', action: 'gotoDone' },
  ],

  input: [
    { key: 'enter', description: 'Submit input', action: 'submit' },
    { key: 'backspace', description: 'Delete character before cursor', action: 'backspace' },
    { key: 'delete', description: 'Delete character at cursor', action: 'delete' },
    { key: 'leftArrow', description: 'Move cursor left', action: 'cursorLeft' },
    { key: 'rightArrow', description: 'Move cursor right', action: 'cursorRight' },
    { key: 'home', description: 'Move cursor to start', action: 'cursorHome' },
    { key: 'end', description: 'Move cursor to end', action: 'cursorEnd' },
    { key: 'ctrl+a', description: 'Move cursor to start', action: 'cursorHome' },
    { key: 'ctrl+e', description: 'Move cursor to end', action: 'cursorEnd' },
    { key: 'ctrl+u', description: 'Clear line before cursor', action: 'clearBeforeCursor' },
    { key: 'ctrl+k', description: 'Clear line after cursor', action: 'clearAfterCursor' },
    { key: 'ctrl+w', description: 'Delete word before cursor', action: 'deleteWord' },
    { key: 'upArrow', description: 'Previous history item', action: 'historyUp' },
    { key: 'downArrow', description: 'Next history item', action: 'historyDown' },
  ],
};

/**
 * Get all keybindings as groups for display
 */
export function getKeyBindingGroups(config: KeyBindingsConfig = defaultKeyBindings): KeyBindingGroup[] {
  return [
    { name: 'Global', bindings: config.global },
    { name: 'Navigation', bindings: config.navigation },
    { name: 'Plan View', bindings: config.planView },
    { name: 'Kanban', bindings: config.kanban },
    { name: 'Input', bindings: config.input },
  ];
}

/**
 * Format a key for display
 */
export function formatKey(key: string): string {
  const replacements: Record<string, string> = {
    'ctrl+': 'Ctrl+',
    'shift+': 'Shift+',
    'alt+': 'Alt+',
    'upArrow': '↑',
    'downArrow': '↓',
    'leftArrow': '←',
    'rightArrow': '→',
    'enter': 'Enter',
    'backspace': '⌫',
    'delete': 'Del',
    'escape': 'Esc',
    'tab': 'Tab',
    'space': 'Space',
    'home': 'Home',
    'end': 'End',
  };

  let formatted = key;
  for (const [search, replace] of Object.entries(replacements)) {
    formatted = formatted.replace(search, replace);
  }
  
  return formatted.toUpperCase();
}

export default defaultKeyBindings;
