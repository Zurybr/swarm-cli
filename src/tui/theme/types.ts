/**
 * Theme type definitions for Swarm CLI TUI
 * Extends base colors with component-specific styles
 */

/**
 * Base color palette for themes
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  background: string;
  text: string;
  border: string;
  foreground: string; // Added for compatibility
}

/**
 * Task state styling options
 * Maps task states to visual styles
 */
export interface TaskStateStyles {
  pending: TaskStyle;
  running: TaskStyle;
  completed: TaskStyle;
  failed: TaskStyle;
  blocked: TaskStyle;
  cancelled: TaskStyle;
}

/**
 * Individual task style configuration
 */
export interface TaskStyle {
  color: string;
  modifier?: 'bold' | 'dim' | 'italic' | 'underline' | 'strikethrough';
  icon?: string;
}

/**
 * Component-specific theme styles
 */
export interface ComponentStyles {
  task: TaskStateStyles;
  header: {
    background: string;
    text: string;
    border: string;
  };
  status: {
    active: string;
    inactive: string;
  };
  input: {
    background: string;
    text: string;
    placeholder: string;
    border: string;
    focusBorder: string;
  };
}

/**
 * Complete theme definition
 */
export interface Theme {
  name: string;
  displayName: string;
  description: string;
  colors: ThemeColors;
  components: ComponentStyles;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
  };
  borders: {
    radius: 'none' | 'rounded' | 'sharp';
    style: 'single' | 'double' | 'round';
  };
}

/**
 * Theme configuration from YAML
 */
export interface ThemeConfig {
  name: string;
  colors?: Partial<ThemeColors>;
  components?: Partial<ComponentStyles>;
}

/**
 * Built-in theme names
 */
export type BuiltinThemeName = 
  | 'tokyo-night'
  | 'dracula'
  | 'nord'
  | 'solarized-dark'
  | 'solarized-light';

/**
 * All available theme names including custom
 */
export type ThemeName = BuiltinThemeName | string;
