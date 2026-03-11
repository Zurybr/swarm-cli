/**
 * Solarized Themes (Dark and Light)
 * Precision color scheme for terminals
 * Features: Carefully chosen colors for optimal readability
 */

import { Theme } from './types';

/**
 * Solarized Dark Theme
 */
export const solarizedDarkTheme: Theme = {
  name: 'solarized-dark',
  displayName: 'Solarized Dark',
  description: 'Precision colors for machines and people',

  colors: {
    primary: '#268bd2',      // Blue
    secondary: '#6c71c4',    // Violet
    success: '#859900',      // Green
    warning: '#b58900',      // Yellow
    error: '#dc322f',        // Red
    info: '#2aa198',         // Cyan
    muted: '#586e75',        // Base01
    background: '#002b36',   // Base03 - Dark background
    text: '#839496',         // Base0 - Primary content
    border: '#073642',       // Base02 - Background highlight
    foreground: '#93a1a1',   // Base1 - Body text
  },

  components: {
    task: {
      pending: {
        color: '#586e75',
        modifier: 'dim',
        icon: '○',
      },
      running: {
        color: '#b58900',
        modifier: 'bold',
        icon: '◐',
      },
      completed: {
        color: '#859900',
        modifier: undefined,
        icon: '●',
      },
      failed: {
        color: '#dc322f',
        modifier: undefined,
        icon: '✗',
      },
      blocked: {
        color: '#cb4b16',
        modifier: undefined,
        icon: '⊘',
      },
      cancelled: {
        color: '#586e75',
        modifier: 'strikethrough',
        icon: '⊘',
      },
    },
    header: {
      background: '#073642',
      text: '#93a1a1',
      border: '#094653',
    },
    status: {
      active: '#859900',
      inactive: '#586e75',
    },
    input: {
      background: '#00232c',
      text: '#93a1a1',
      placeholder: '#586e75',
      border: '#094653',
      focusBorder: '#268bd2',
    },
  },

  spacing: {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
  },

  borders: {
    radius: 'rounded',
    style: 'round',
  },
};

/**
 * Solarized Light Theme
 */
export const solarizedLightTheme: Theme = {
  name: 'solarized-light',
  displayName: 'Solarized Light',
  description: 'Precision colors for machines and people - light variant',

  colors: {
    primary: '#268bd2',      // Blue
    secondary: '#6c71c4',    // Violet
    success: '#859900',      // Green
    warning: '#b58900',      // Yellow
    error: '#dc322f',        // Red
    info: '#2aa198',         // Cyan
    muted: '#93a1a1',        // Base1
    background: '#fdf6e3',   // Base3 - Light background
    text: '#657b83',         // Base00 - Primary content
    border: '#eee8d5',       // Base2 - Background highlight
    foreground: '#586e75',   // Base01 - Body text
  },

  components: {
    task: {
      pending: {
        color: '#93a1a1',
        modifier: 'dim',
        icon: '○',
      },
      running: {
        color: '#b58900',
        modifier: 'bold',
        icon: '◐',
      },
      completed: {
        color: '#859900',
        modifier: undefined,
        icon: '●',
      },
      failed: {
        color: '#dc322f',
        modifier: undefined,
        icon: '✗',
      },
      blocked: {
        color: '#cb4b16',
        modifier: undefined,
        icon: '⊘',
      },
      cancelled: {
        color: '#93a1a1',
        modifier: 'strikethrough',
        icon: '⊘',
      },
    },
    header: {
      background: '#eee8d5',
      text: '#586e75',
      border: '#e4ddc8',
    },
    status: {
      active: '#859900',
      inactive: '#93a1a1',
    },
    input: {
      background: '#f5f0e1',
      text: '#586e75',
      placeholder: '#93a1a1',
      border: '#e4ddc8',
      focusBorder: '#268bd2',
    },
  },

  spacing: {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
  },

  borders: {
    radius: 'rounded',
    style: 'round',
  },
};

export default {
  dark: solarizedDarkTheme,
  light: solarizedLightTheme,
};
