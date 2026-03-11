/**
 * useKeybindings hook for Swarm CLI TUI
 * Provides keybinding management and action handling
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useInput as useInkInput, Key, useApp } from 'ink';
import {
  KeyBindingsConfig,
  KeyBinding,
  defaultKeyBindings,
  getKeyBindingPreset,
  mergeKeyBindings,
  formatKey,
} from '../keybindings';

/**
 * View context for keybindings
 */
export type ViewContext = 'global' | 'navigation' | 'planView' | 'kanban' | 'input';

/**
 * Keybinding action handler
 */
export type KeyActionHandler = (action: string, context: ViewContext) => void | Promise<void>;

/**
 * Options for useKeybindings hook
 */
export interface UseKeybindingsOptions {
  /** Keybinding preset name or config */
  preset?: string | KeyBindingsConfig;
  /** Custom keybindings to merge */
  customBindings?: Partial<KeyBindingsConfig>;
  /** Current view context */
  context?: ViewContext;
  /** Action handler */
  onAction?: KeyActionHandler;
  /** Whether keybindings are enabled */
  enabled?: boolean;
}

/**
 * Keybinding state
 */
export interface KeybindingState {
  /** Current preset name */
  presetName: string;
  /** Whether help is visible */
  showHelp: boolean;
  /** Last triggered action */
  lastAction: string | null;
  /** Last key pressed */
  lastKey: string | null;
}

/**
 * Return type for useKeybindings hook
 */
export interface UseKeybindingsReturn extends KeybindingState {
  /** Current keybindings config */
  keybindings: KeyBindingsConfig;
  /** Toggle help screen */
  toggleHelp: () => void;
  /** Show help screen */
  showHelpScreen: () => void;
  /** Hide help screen */
  hideHelpScreen: () => void;
  /** Change keybinding preset */
  setPreset: (preset: string | KeyBindingsConfig) => void;
  /** Get formatted key for an action */
  getKeyForAction: (action: string, context?: ViewContext) => string | undefined;
  /** Get all keybindings for a context */
  getBindingsForContext: (context: ViewContext) => KeyBinding[];
  /** Format a key for display */
  formatKey: (key: string) => string;
}

/**
 * Parse a key string into components
 */
function parseKey(keyString: string): {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
} {
  const parts = keyString.toLowerCase().split('+');
  const key = parts.pop() || '';
  
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key,
  };
}

/**
 * Check if an ink key matches a keybinding
 */
function matchesKeybinding(input: string, inkKey: Key, binding: KeyBinding): boolean {
  const parsed = parseKey(binding.key);
  
  // Handle special keys - mapping to ink Key properties
  const keyMap: Record<string, string> = {
    'enter': 'return',
    'uparrow': 'upArrow',
    'downarrow': 'downArrow',
    'leftarrow': 'leftArrow',
    'rightarrow': 'rightArrow',
    'escape': 'escape',
    'tab': 'tab',
    'backspace': 'backspace',
    'delete': 'delete',
    'space': 'return', // Space handled specially
    // Note: 'home' and 'end' may not be supported by all terminals/ink versions
  };
  
  const normalizedBindingKey = parsed.key.toLowerCase();
  const mappedKey = keyMap[normalizedBindingKey];
  
  // Check modifier keys
  if (parsed.ctrl !== (inkKey.ctrl || false)) return false;
  if (parsed.shift !== (inkKey.shift || false)) return false;
  if (parsed.alt !== (inkKey.meta || false)) return false;
  
  // Check the main key
  if (mappedKey) {
    return (inkKey as unknown as Record<string, boolean>)[mappedKey] === true;
  }
  
  // Handle home/end via input (some terminals send escape sequences)
  if (normalizedBindingKey === 'home' || normalizedBindingKey === 'end') {
    // These may be handled via escape sequences or not supported
    return false;
  }
  
  // Regular character comparison
  return input.toLowerCase() === normalizedBindingKey;
}

/**
 * Hook for managing keybindings in TUI
 */
export function useKeybindings(options: UseKeybindingsOptions = {}): UseKeybindingsReturn {
  const {
    preset = 'default',
    customBindings,
    context = 'global',
    onAction,
    enabled = true,
  } = options;

  const { exit } = useApp();
  
  // Track key sequences (for multi-key bindings like 'gg')
  const keySequenceRef = useRef<string[]>([]);
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get the keybinding configuration
  const keybindings = useMemo(() => {
    let config: KeyBindingsConfig;
    
    if (typeof preset === 'string') {
      config = getKeyBindingPreset(preset) || defaultKeyBindings;
    } else {
      config = preset;
    }
    
    if (customBindings) {
      config = mergeKeyBindings(config, customBindings);
    }
    
    return config;
  }, [preset, customBindings]);

  const [state, setState] = useState<KeybindingState>({
    presetName: keybindings.name,
    showHelp: false,
    lastAction: null,
    lastKey: null,
  });

  // Clear key sequence after timeout
  const clearKeySequence = useCallback(() => {
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
    }
    sequenceTimeoutRef.current = setTimeout(() => {
      keySequenceRef.current = [];
    }, 500);
  }, []);

  // Get bindings for current context
  const getContextBindings = useCallback((ctx: ViewContext): KeyBinding[] => {
    switch (ctx) {
      case 'global':
        return keybindings.global;
      case 'navigation':
        return [...keybindings.global, ...keybindings.navigation];
      case 'planView':
        return [...keybindings.global, ...keybindings.navigation, ...keybindings.planView];
      case 'kanban':
        return [...keybindings.global, ...keybindings.navigation, ...keybindings.kanban];
      case 'input':
        return [...keybindings.global, ...keybindings.input];
      default:
        return keybindings.global;
    }
  }, [keybindings]);

  // Handle key press
  const handleKeyPress = useCallback((input: string, inkKey: Key) => {
    if (!enabled) return;
    
    const currentBindings = getContextBindings(context);
    
    // Track key sequence
    keySequenceRef.current.push(input);
    if (keySequenceRef.current.length > 2) {
      keySequenceRef.current = keySequenceRef.current.slice(-2);
    }
    clearKeySequence();
    
    // Find matching binding
    for (const binding of currentBindings) {
      if (binding.enabled === false) continue;
      
      // Handle multi-key sequences (e.g., 'gg', 'ZZ')
      if (binding.key.includes('+') && !binding.key.includes('ctrl') && !binding.key.includes('shift')) {
        const sequence = binding.key.split('+');
        if (
          keySequenceRef.current.length >= sequence.length &&
          keySequenceRef.current.slice(-sequence.length).join('+').toLowerCase() === binding.key.toLowerCase()
        ) {
          // Match found for sequence
          setState(prev => ({
            ...prev,
            lastAction: binding.action,
            lastKey: binding.key,
          }));
          
          // Handle built-in actions
          if (binding.action === 'showHelp') {
            setState(prev => ({ ...prev, showHelp: true }));
          } else if (binding.action === 'exit') {
            exit();
          } else {
            onAction?.(binding.action, context);
          }
          
          keySequenceRef.current = [];
          return;
        }
      } else if (matchesKeybinding(input, inkKey, binding)) {
        // Single key match
        setState(prev => ({
          ...prev,
          lastAction: binding.action,
          lastKey: binding.key,
        }));
        
        // Handle built-in actions
        if (binding.action === 'showHelp') {
          setState(prev => ({ ...prev, showHelp: true }));
        } else if (binding.action === 'escape') {
          setState(prev => ({ ...prev, showHelp: false }));
        } else if (binding.action === 'exit') {
          exit();
        } else {
          onAction?.(binding.action, context);
        }
        
        keySequenceRef.current = [];
        return;
      }
    }
  }, [enabled, context, getContextBindings, onAction, exit, clearKeySequence]);

  // Set up ink input handler
  useInkInput(handleKeyPress, { isActive: enabled });

  // Toggle help
  const toggleHelp = useCallback(() => {
    setState(prev => ({ ...prev, showHelp: !prev.showHelp }));
  }, []);

  const showHelpScreen = useCallback(() => {
    setState(prev => ({ ...prev, showHelp: true }));
  }, []);

  const hideHelpScreen = useCallback(() => {
    setState(prev => ({ ...prev, showHelp: false }));
  }, []);

  // Set preset
  const setPreset = useCallback((newPreset: string | KeyBindingsConfig) => {
    const config = typeof newPreset === 'string' 
      ? getKeyBindingPreset(newPreset) || defaultKeyBindings
      : newPreset;
    setState(prev => ({ ...prev, presetName: config.name }));
  }, []);

  // Get key for action
  const getKeyForAction = useCallback((action: string, ctx?: ViewContext): string | undefined => {
    const bindings = getContextBindings(ctx || context);
    const binding = bindings.find(b => b.action === action);
    return binding ? formatKey(binding.key) : undefined;
  }, [context, getContextBindings]);

  // Get bindings for context
  const getBindingsForContext = useCallback((ctx: ViewContext): KeyBinding[] => {
    return getContextBindings(ctx);
  }, [getContextBindings]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    keybindings,
    toggleHelp,
    showHelpScreen,
    hideHelpScreen,
    setPreset,
    getKeyForAction,
    getBindingsForContext,
    formatKey,
  };
}

export default useKeybindings;
