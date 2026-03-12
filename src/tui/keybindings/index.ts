/**
 * Keybindings module for Swarm CLI TUI
 * Main export for all keybinding configurations and utilities
 */

export {
  defaultKeyBindings,
  getKeyBindingGroups,
  formatKey,
} from './default';

export type {
  KeyBinding,
  KeyBindingGroup,
  KeyBindingsConfig,
} from './default';

export { vimKeyBindings } from './vim';

/**
 * Available keybinding presets
 */
import { defaultKeyBindings, KeyBindingsConfig } from './default';
import { vimKeyBindings } from './vim';

export const keyBindingPresets: Record<string, KeyBindingsConfig> = {
  default: defaultKeyBindings,
  vim: vimKeyBindings,
};

/**
 * Get a keybinding preset by name
 */
export function getKeyBindingPreset(name: string): KeyBindingsConfig | undefined {
  return keyBindingPresets[name.toLowerCase()];
}

/**
 * List available preset names
 */
export function listKeyBindingPresets(): string[] {
  return Object.keys(keyBindingPresets);
}

/**
 * Merge custom keybindings with a preset
 */
export function mergeKeyBindings(
  preset: KeyBindingsConfig,
  custom: Partial<KeyBindingsConfig>
): KeyBindingsConfig {
  return {
    name: custom.name || preset.name,
    description: custom.description || preset.description,
    global: custom.global ? [...preset.global, ...custom.global] : preset.global,
    navigation: custom.navigation ? [...preset.navigation, ...custom.navigation] : preset.navigation,
    planView: custom.planView ? [...preset.planView, ...custom.planView] : preset.planView,
    kanban: custom.kanban ? [...preset.kanban, ...custom.kanban] : preset.kanban,
    input: custom.input ? [...preset.input, ...custom.input] : preset.input,
  };
}
