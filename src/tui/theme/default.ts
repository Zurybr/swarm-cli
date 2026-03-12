/**
 * Default theme for Swarm CLI TUI
 * A modern dark theme with orange brand color
 */

import { Theme } from './types';

export const defaultTheme: Theme = {
  name: 'default',
  displayName: 'Default',
  description: 'Swarm CLI default theme with orange brand color',

  colors: {
    primary: '#FF6B35',     // Orange - Swarm brand color
    secondary: '#4ECDC4',   // Teal - accent
    success: '#28A745',     // Green
    warning: '#FFC107',     // Yellow
    error: '#DC3545',       // Red
    info: '#17A2B8',        // Cyan
    muted: '#6C757D',       // Gray
    background: '#1A1A2E',  // Dark blue-black
    text: '#FFFFFF',        // White
    border: '#333355',      // Dark purple-gray
    foreground: '#F8F8F2',  // Light white
  },

  components: {
    task: {
      pending: {
        color: '#6C757D',
        modifier: 'dim',
        icon: '○',
      },
      running: {
        color: '#FFC107',
        modifier: 'bold',
        icon: '◐',
      },
      completed: {
        color: '#28A745',
        modifier: undefined,
        icon: '●',
      },
      failed: {
        color: '#DC3545',
        modifier: undefined,
        icon: '✗',
      },
      blocked: {
        color: '#FF6B35',
        modifier: undefined,
        icon: '⊘',
      },
      cancelled: {
        color: '#6C757D',
        modifier: 'strikethrough',
        icon: '⊘',
      },
    },
    header: {
      background: '#16161A',
      text: '#FFFFFF',
      border: '#333355',
    },
    status: {
      active: '#28A745',
      inactive: '#6C757D',
    },
    input: {
      background: '#0F0F14',
      text: '#FFFFFF',
      placeholder: '#6C757D',
      border: '#333355',
      focusBorder: '#FF6B35',
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
    style: 'single',
  },
};

/**
 * Convert hex color to RGB components for terminal
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Get ANSI color code for a hex color
 */
export function getAnsiColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';
  return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m`;
}

export default defaultTheme;
