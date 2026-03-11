/**
 * Nord Theme
 * An arctic, bluish-cyan clean theme
 * Features: Cold blue tones with subtle warmth
 */

import { Theme } from './types';

export const nordTheme: Theme = {
  name: 'nord',
  displayName: 'Nord',
  description: 'An arctic, bluish-cyan clean theme',

  colors: {
    primary: '#88c0d0',      // Frost cyan
    secondary: '#81a1c1',    // Frost blue
    success: '#a3be8c',      // Aurora green
    warning: '#ebcb8b',      // Aurora yellow
    error: '#bf616a',        // Aurora red
    info: '#8fbcbb',         // Frost teal
    muted: '#4c566a',        // Polar night gray
    background: '#2e3440',   // Polar night dark
    text: '#eceff4',         // Snow storm white
    border: '#3b4252',       // Polar night medium
    foreground: '#d8dee9',   // Snow storm light
  },

  components: {
    task: {
      pending: {
        color: '#4c566a',
        modifier: 'dim',
        icon: '○',
      },
      running: {
        color: '#ebcb8b',
        modifier: 'bold',
        icon: '◐',
      },
      completed: {
        color: '#a3be8c',
        modifier: undefined,
        icon: '●',
      },
      failed: {
        color: '#bf616a',
        modifier: undefined,
        icon: '✗',
      },
      blocked: {
        color: '#d08770',
        modifier: undefined,
        icon: '⊘',
      },
      cancelled: {
        color: '#4c566a',
        modifier: 'strikethrough',
        icon: '⊘',
      },
    },
    header: {
      background: '#242933',
      text: '#eceff4',
      border: '#3b4252',
    },
    status: {
      active: '#a3be8c',
      inactive: '#4c566a',
    },
    input: {
      background: '#242933',
      text: '#eceff4',
      placeholder: '#4c566a',
      border: '#3b4252',
      focusBorder: '#88c0d0',
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

export default nordTheme;
