/**
 * Dracula Theme
 * A dark theme with vibrant purple and green accents
 * Features: High contrast with neon-like colors
 */

import { Theme } from './types';

export const draculaTheme: Theme = {
  name: 'dracula',
  displayName: 'Dracula',
  description: 'A dark theme with vibrant purple and green accents',

  colors: {
    primary: '#bd93f9',      // Purple
    secondary: '#ff79c6',    // Pink
    success: '#50fa7b',      // Green
    warning: '#ffb86c',      // Orange
    error: '#ff5555',        // Red
    info: '#8be9fd',         // Cyan
    muted: '#6272a4',        // Blue-gray
    background: '#282a36',   // Dark purple-black
    text: '#f8f8f2',         // White
    border: '#44475a',       // Dark purple-gray
    foreground: '#f8f8f2',   // White
  },

  components: {
    task: {
      pending: {
        color: '#6272a4',
        modifier: 'dim',
        icon: '○',
      },
      running: {
        color: '#ffb86c',
        modifier: 'bold',
        icon: '◐',
      },
      completed: {
        color: '#50fa7b',
        modifier: undefined,
        icon: '●',
      },
      failed: {
        color: '#ff5555',
        modifier: undefined,
        icon: '✗',
      },
      blocked: {
        color: '#ff79c6',
        modifier: undefined,
        icon: '⊘',
      },
      cancelled: {
        color: '#6272a4',
        modifier: 'strikethrough',
        icon: '⊘',
      },
    },
    header: {
      background: '#21222c',
      text: '#f8f8f2',
      border: '#44475a',
    },
    status: {
      active: '#50fa7b',
      inactive: '#6272a4',
    },
    input: {
      background: '#1e1f29',
      text: '#f8f8f2',
      placeholder: '#6272a4',
      border: '#44475a',
      focusBorder: '#bd93f9',
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

export default draculaTheme;
