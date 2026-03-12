/**
 * Theme context hook for Swarm CLI TUI
 * Provides theme values and color utilities throughout the app
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { 
  Theme, 
  ThemeColors, 
  ComponentStyles,
  TaskStateStyles,
  TaskStyle,
  ThemeName,
  BuiltinThemeName 
} from '../theme/types';
import { 
  loadTheme, 
  loadThemeFromYaml,
  loadThemeFromDefaultConfig,
  getBuiltinThemeNames,
  isBuiltinTheme,
  builtinThemes 
} from '../theme';
import { defaultTheme } from '../theme/default';

interface ThemeContextValue {
  theme: Theme;
  colors: ThemeColors;
  components: ComponentStyles;
  taskStyles: TaskStateStyles;
  setTheme: (themeName: ThemeName) => void;
  setThemeObject: (theme: Theme) => void;
  resetTheme: () => void;
  getPrimaryColor: () => string;
  getColor: (colorKey: keyof ThemeColors) => string;
  getTaskStyle: (state: keyof TaskStateStyles) => TaskStyle;
  loadThemeFromConfig: (configPath: string) => void;
  availableThemes: BuiltinThemeName[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
  configPath?: string;
}

/**
 * Theme Provider component
 * Wrap your app with this to provide theme context
 */
export function ThemeProvider({ 
  children, 
  initialTheme,
  configPath 
}: ThemeProviderProps): React.ReactElement {
  // Try to load theme from config, or use initialTheme, or fallback to default
  const getInitialTheme = (): Theme => {
    if (initialTheme) return initialTheme;
    if (configPath) {
      const config = loadThemeFromYaml(configPath);
      if (config) {
        return loadTheme(config);
      }
    }
    // Try default config location
    return loadThemeFromDefaultConfig();
  };

  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((themeName: ThemeName) => {
    const loadedTheme = loadTheme(themeName);
    setThemeState(loadedTheme);
  }, []);

  const setThemeObject = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const resetTheme = useCallback(() => {
    setThemeState(defaultTheme);
  }, []);

  const getPrimaryColor = useCallback(() => {
    return theme.colors.primary;
  }, [theme]);

  const getColor = useCallback((colorKey: keyof ThemeColors) => {
    return theme.colors[colorKey];
  }, [theme]);

  const getTaskStyle = useCallback((state: keyof TaskStateStyles) => {
    return theme.components.task[state];
  }, [theme]);

  const loadThemeFromConfigHandler = useCallback((configPath: string) => {
    const config = loadThemeFromYaml(configPath);
    if (config) {
      const loadedTheme = loadTheme(config);
      setThemeState(loadedTheme);
    }
  }, []);

  const value: ThemeContextValue = {
    theme,
    colors: theme.colors,
    components: theme.components,
    taskStyles: theme.components.task,
    setTheme,
    setThemeObject,
    resetTheme,
    getPrimaryColor,
    getColor,
    getTaskStyle,
    loadThemeFromConfig: loadThemeFromConfigHandler,
    availableThemes: getBuiltinThemeNames(),
  };

  return React.createElement(ThemeContext.Provider, { value }, children);
}

/**
 * Hook to access theme context
 * @returns Theme context value with colors and utilities
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}

/**
 * Hook to get just the colors (lighter weight when you only need colors)
 */
export function useColors(): ThemeColors {
  const { colors } = useTheme();
  return colors;
}

/**
 * Hook to get task state styles
 */
export function useTaskStyles(): TaskStateStyles {
  const { taskStyles } = useTheme();
  return taskStyles;
}

/**
 * Hook to get a specific task state style
 */
export function useTaskStyle(state: keyof TaskStateStyles): TaskStyle {
  const { getTaskStyle } = useTheme();
  return getTaskStyle(state);
}

export default useTheme;
