/**
 * Tokyo Night Theme
 * A dark theme inspired by the Tokyo Night VSCode theme
 * Features: Blue/purple palette with warm accents
 */

import { Theme } from './types';

export const tokyoNightTheme: Theme = {
  name: 'tokyo-night',
  displayName: 'Tokyo Night',
  description: 'A clean, dark theme with blue and purple tones',

  colors: {
    primary: '#7aa2f7',      // Blue
    secondary: '#bb9af7',    // Purple
    success: '#9ece6a',      // Green
    warning: '#e0af68',      // Orange
    error: '#f7768e',        // Red
    info: '#7dcfff',         // Cyan
    muted: '#565f89',        // Dark blue-gray
    background: '#1a1b26',   // Dark blue-black
    text: '#a9b1d6',         // Light blue-gray
    border: '#292e42',       // Darker blue
    foreground: '#c0caf5',   // Light blue-white
  },

  components: {
    task: {
      pending: {
        color: '#565f89',
        modifier: 'dim',
        icon: '○',
      },
      running: {
        color: '#e0af68',
        modifier: 'bold',
        icon: '◐',
      },
      completed: {
        color: '#9ece6a',
        modifier: undefined,
        icon: '●',
      },
      failed: {
        color: '#f7768e',
        modifier: undefined,
        icon: '✗',
      },
      blocked: {
        color: '#ff9e64',
        modifier: undefined,
        icon: '⊘',
      },
      cancelled: {
        color: '#565f89',
        modifier: 'strikethrough',
        icon: '⊘',
      },
    },
    header: {
      background: '#1f2335',
      text: '#c0caf5',
      border: '#3b4261',
    },
    status: {
      active: '#9ece6a',
      inactive: '#565f89',
    },
    input: {
      background: '#16161e',
      text: '#c0caf5',
      placeholder: '#565f89',
      border: '#3b4261',
      focusBorder: '#7aa2f7',
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

export default tokyoNightTheme;
