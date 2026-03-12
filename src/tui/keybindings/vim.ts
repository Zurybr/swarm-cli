/**
 * Vim-style keybindings preset for Swarm CLI TUI
 * Provides familiar vim navigation and editing shortcuts
 */

import { KeyBindingsConfig } from './default';

/**
 * Vim-style keybindings configuration
 * Extends default with vim-specific mappings
 */
export const vimKeyBindings: KeyBindingsConfig = {
  name: 'vim',
  description: 'Vim-style keybindings for power users',
  
  global: [
    { key: 'tab', description: 'Switch agent (build/plan)', action: 'switchAgent' },
    { key: 'ctrl+c', description: 'Cancel current operation', action: 'cancel' },
    { key: 'ctrl+d', description: 'Exit application', action: 'exit' },
    { key: '?', description: 'Show help screen', action: 'showHelp' },
    { key: 'escape', description: 'Close overlay/cancel', action: 'escape' },
    { key: ':', description: 'Command mode', action: 'commandMode' },
    { key: 'Z+Z', description: 'Save and quit', action: 'saveQuit' },
    { key: 'Z+Q', description: 'Quit without saving', action: 'forceQuit' },
  ],

  navigation: [
    // Vim-style movement
    { key: 'j', description: 'Move down', action: 'moveDown' },
    { key: 'downArrow', description: 'Move down', action: 'moveDown' },
    { key: 'k', description: 'Move up', action: 'moveUp' },
    { key: 'upArrow', description: 'Move up', action: 'moveUp' },
    { key: 'h', description: 'Move left', action: 'moveLeft' },
    { key: 'leftArrow', description: 'Move left', action: 'moveLeft' },
    { key: 'l', description: 'Move right', action: 'moveRight' },
    { key: 'rightArrow', description: 'Move right', action: 'moveRight' },
    
    // Vim motion commands
    { key: 'w', description: 'Next item/word', action: 'nextItem' },
    { key: 'b', description: 'Previous item/word', action: 'prevItem' },
    { key: 'e', description: 'End of item/word', action: 'endItem' },
    { key: '0', description: 'Start of line', action: 'lineStart' },
    { key: '$', description: 'End of line', action: 'lineEnd' },
    { key: 'g+g', description: 'Go to top', action: 'goTop' },
    { key: 'G', description: 'Go to bottom', action: 'goBottom' },
    { key: 'ctrl+u', description: 'Half page up', action: 'halfPageUp' },
    { key: 'ctrl+d', description: 'Half page down', action: 'halfPageDown' },
    { key: 'ctrl+b', description: 'Full page up', action: 'pageUp' },
    { key: 'ctrl+f', description: 'Full page down', action: 'pageDown' },
    
    // Vim selection
    { key: 'enter', description: 'Select/open item', action: 'select' },
    { key: 'q', description: 'Quit/close view', action: 'quitView' },
    { key: 'v', description: 'Visual mode', action: 'visualMode' },
    { key: 'V', description: 'Visual line mode', action: 'visualLineMode' },
  ],

  planView: [
    { key: 'space', description: 'Toggle task details', action: 'toggleDetails' },
    { key: 'r', description: 'Refresh status', action: 'refresh' },
    { key: 'L', description: 'View task logs', action: 'viewLogs' },
    { key: 'a', description: 'Abort plan', action: 'abortPlan' },
    { key: 'p', description: 'Pause/resume execution', action: 'togglePause' },
    { key: 's', description: 'Skip current task', action: 'skipTask' },
    { key: 'E', description: 'Expand all tasks', action: 'expandAll' },
    { key: 'C', description: 'Collapse all tasks', action: 'collapseAll' },
    { key: 'z+o', description: 'Open fold (expand)', action: 'expandTask' },
    { key: 'z+c', description: 'Close fold (collapse)', action: 'collapseTask' },
    { key: 'z+O', description: 'Open all folds', action: 'expandAll' },
    { key: 'z+C', description: 'Close all folds', action: 'collapseAll' },
  ],

  kanban: [
    { key: 'tab', description: 'Next column', action: 'nextColumn' },
    { key: 'shift+tab', description: 'Previous column', action: 'prevColumn' },
    { key: 'm', description: 'Move task', action: 'moveTask' },
    { key: 'n', description: 'New task', action: 'newTask' },
    { key: 'd', description: 'Delete task', action: 'deleteTask' },
    { key: 'e', description: 'Edit task', action: 'editTask' },
    { key: 'i', description: 'Insert mode (edit)', action: 'editTask' },
    { key: 'o', description: 'Open task below', action: 'newTaskBelow' },
    { key: 'O', description: 'Open task above', action: 'newTaskAbove' },
    { key: 'enter', description: 'Open task details', action: 'openTask' },
    { key: '1', description: 'Go to Todo column', action: 'gotoTodo' },
    { key: '2', description: 'Go to In Progress column', action: 'gotoInProgress' },
    { key: '3', description: 'Go to Done column', action: 'gotoDone' },
    { key: 'ctrl+n', description: 'Next column', action: 'nextColumn' },
    { key: 'ctrl+p', description: 'Previous column', action: 'prevColumn' },
  ],

  input: [
    { key: 'enter', description: 'Submit input', action: 'submit' },
    { key: 'backspace', description: 'Delete character before cursor', action: 'backspace' },
    { key: 'delete', description: 'Delete character at cursor', action: 'delete' },
    { key: 'leftArrow', description: 'Move cursor left', action: 'cursorLeft' },
    { key: 'rightArrow', description: 'Move cursor right', action: 'cursorRight' },
    { key: 'home', description: 'Move cursor to start', action: 'cursorHome' },
    { key: 'end', description: 'Move cursor to end', action: 'cursorEnd' },
    
    // Vim insert mode navigation
    { key: 'ctrl+a', description: 'Move cursor to start', action: 'cursorHome' },
    { key: 'ctrl+e', description: 'Move cursor to end', action: 'cursorEnd' },
    { key: 'ctrl+b', description: 'Move cursor left', action: 'cursorLeft' },
    { key: 'ctrl+f', description: 'Move cursor right', action: 'cursorRight' },
    { key: 'ctrl+h', description: 'Delete character before cursor', action: 'backspace' },
    { key: 'ctrl+w', description: 'Delete word before cursor', action: 'deleteWord' },
    { key: 'ctrl+u', description: 'Clear line before cursor', action: 'clearBeforeCursor' },
    { key: 'ctrl+k', description: 'Clear line after cursor', action: 'clearAfterCursor' },
    { key: 'upArrow', description: 'Previous history item', action: 'historyUp' },
    { key: 'downArrow', description: 'Next history item', action: 'historyDown' },
    { key: 'ctrl+p', description: 'Previous history item', action: 'historyUp' },
    { key: 'ctrl+n', description: 'Next history item', action: 'historyDown' },
  ],
};

export default vimKeyBindings;
