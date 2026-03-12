/**
 * Theme loader and registry for Swarm CLI TUI
 * Manages built-in themes and custom theme loading
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { 
  Theme, 
  ThemeConfig, 
  ThemeName, 
  BuiltinThemeName,
  ThemeColors,
  ComponentStyles,
  TaskStateStyles 
} from './types';

// Import built-in themes
import { tokyoNightTheme } from './tokyo-night';
import { draculaTheme } from './dracula';
import { nordTheme } from './nord';
import { solarizedDarkTheme, solarizedLightTheme } from './solarized';
import { defaultTheme } from './default';

/**
 * Registry of all built-in themes
 */
export const builtinThemes: Record<BuiltinThemeName, Theme> = {
  'tokyo-night': tokyoNightTheme,
  'dracula': draculaTheme,
  'nord': nordTheme,
  'solarized-dark': solarizedDarkTheme,
  'solarized-light': solarizedLightTheme,
};

/**
 * Get a built-in theme by name
 */
export function getBuiltinTheme(name: BuiltinThemeName): Theme | undefined {
  return builtinThemes[name];
}

/**
 * Get all available built-in theme names
 */
export function getBuiltinThemeNames(): BuiltinThemeName[] {
  return Object.keys(builtinThemes) as BuiltinThemeName[];
}

/**
 * Get all built-in themes
 */
export function getAllBuiltinThemes(): Theme[] {
  return Object.values(builtinThemes);
}

/**
 * Check if a theme name is a built-in theme
 */
export function isBuiltinTheme(name: string): name is BuiltinThemeName {
  return name in builtinThemes;
}

/**
 * Merge partial theme config with a base theme
 */
export function mergeThemeConfig(baseTheme: Theme, config: ThemeConfig): Theme {
  const merged: Theme = {
    ...baseTheme,
    name: config.name || baseTheme.name,
    colors: {
      ...baseTheme.colors,
      ...(config.colors || {}),
    },
    components: {
      ...baseTheme.components,
      ...(config.components || {}),
    },
  };

  return merged;
}

/**
 * Load theme configuration from YAML file
 */
export function loadThemeFromYaml(filePath: string): ThemeConfig | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const config = parseYaml(content) as { theme?: ThemeConfig };
    
    return config.theme || null;
  } catch (error) {
    console.error(`Failed to load theme config from ${filePath}:`, error);
    return null;
  }
}

/**
 * Load and resolve a theme by name or config
 */
export function loadTheme(
  themeNameOrConfig: ThemeName | ThemeConfig,
  configPath?: string
): Theme {
  // If it's already a ThemeConfig object
  if (typeof themeNameOrConfig === 'object') {
    const config = themeNameOrConfig;
    
    // If the config specifies a base theme, merge with it
    if (config.name && isBuiltinTheme(config.name)) {
      const baseTheme = builtinThemes[config.name];
      return mergeThemeConfig(baseTheme, config);
    }
    
    // Otherwise, merge with default theme
    return mergeThemeConfig(defaultTheme, config);
  }

  // It's a theme name string
  const name = themeNameOrConfig;
  
  // Check if it's a built-in theme
  if (isBuiltinTheme(name)) {
    return builtinThemes[name];
  }

  // Try to load from config file
  if (configPath) {
    const config = loadThemeFromYaml(configPath);
    if (config) {
      return loadTheme(config);
    }
  }

  // Fallback to default theme
  console.warn(`Theme "${name}" not found, falling back to default theme`);
  return defaultTheme;
}

/**
 * Get the default config file path
 */
export function getDefaultConfigPath(): string {
  return path.join(process.cwd(), 'src', 'tui', 'config', 'theme.yaml');
}

/**
 * Load theme from default config location
 */
export function loadThemeFromDefaultConfig(): Theme {
  const configPath = getDefaultConfigPath();
  const config = loadThemeFromYaml(configPath);
  
  if (config) {
    return loadTheme(config);
  }
  
  return tokyoNightTheme; // Tokyo Night as the new default
}

/**
 * Create a custom theme by extending a built-in theme
 */
export function createCustomTheme(
  baseName: BuiltinThemeName,
  overrides: Partial<Theme>
): Theme {
  const baseTheme = builtinThemes[baseName] || defaultTheme;
  
  return {
    ...baseTheme,
    ...overrides,
    name: overrides.name || `custom-${baseName}`,
    colors: {
      ...baseTheme.colors,
      ...(overrides.colors || {}),
    },
    components: {
      ...baseTheme.components,
      ...(overrides.components || {}),
    },
    spacing: {
      ...baseTheme.spacing,
      ...(overrides.spacing || {}),
    },
  };
}

/**
 * Export theme colors as CSS-like object for styling
 */
export function themeColorsToStyle(theme: Theme): Record<string, string> {
  const { colors } = theme;
  return {
    '--color-primary': colors.primary,
    '--color-secondary': colors.secondary,
    '--color-success': colors.success,
    '--color-warning': colors.warning,
    '--color-error': colors.error,
    '--color-info': colors.info,
    '--color-muted': colors.muted,
    '--color-background': colors.background,
    '--color-text': colors.text,
    '--color-border': colors.border,
    '--color-foreground': colors.foreground,
  };
}

// Re-export types
export type { Theme, ThemeColors, ComponentStyles, TaskStateStyles, ThemeConfig, ThemeName, BuiltinThemeName };
