/**
 * Type declarations for Ink module
 * This file helps TypeScript resolve Ink types with moduleResolution: "node"
 */

declare module 'ink' {
  import { ComponentType, ReactNode } from 'react';

  // Box component props
  interface BoxProps {
    children?: ReactNode;
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around';
    alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    width?: number | string;
    height?: number | string;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number | string;
    maxHeight?: number | string;
    flexGrow?: number;
    flexShrink?: number;
    flexBasis?: number | string;
    alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    padding?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingX?: number;
    paddingY?: number;
    margin?: number;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginX?: number;
    marginY?: number;
    gap?: number;
    rowGap?: number;
    columnGap?: number;
    borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';
    borderColor?: string;
    dimmedBorderColor?: boolean;
    overflowX?: 'visible' | 'hidden';
    overflowY?: 'visible' | 'hidden';
  }

  // Text component props
  interface TextProps {
    children?: ReactNode;
    color?: string;
    backgroundColor?: string;
    dimColor?: boolean;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    inverse?: boolean;
    wrap?: 'wrap' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';
  }

  // Key object from useInput
  interface Key {
    upArrow?: boolean;
    downArrow?: boolean;
    leftArrow?: boolean;
    rightArrow?: boolean;
    pageDown?: boolean;
    pageUp?: boolean;
    return?: boolean;
    escape?: boolean;
    tab?: boolean;
    backspace?: boolean;
    delete?: boolean;
    ctrl?: boolean;
    shift?: boolean;
    meta?: boolean;
  }

  // useInput callback
  type InputHandler = (input: string, key: Key) => void;

  // useInput options
  interface UseInputOptions {
    isActive?: boolean;
  }

  // Render options
  interface RenderOptions {
    stdout?: NodeJS.WriteStream;
    stdin?: NodeJS.ReadStream;
    stderr?: NodeJS.WriteStream;
    debug?: boolean;
    exitOnCtrlC?: boolean;
    patchConsole?: boolean;
  }

  // Render result
  interface RenderResult {
    rerender: (node: ReactNode) => void;
    unmount: () => void;
    waitUntilExit: () => Promise<void>;
    cleanup: () => void;
    clear: () => void;
  }

  // App hook
  interface App {
    exit: (error?: Error) => void;
    waitUntilExit: () => Promise<void>;
  }

  // Stdout hook result
  interface Stdout {
    write: (data: string) => boolean;
    columns: number;
    rows: number;
  }

  // Stdin hook result
  interface Stdin {
    setRawMode: (mode: boolean) => void;
    isTTY: boolean;
  }

  // Export components
  export const Box: ComponentType<BoxProps>;
  export const Text: ComponentType<TextProps>;
  export const Static: ComponentType<{ children: ReactNode; style?: any }>;
  export const Transform: ComponentType<{ children: ReactNode; transform: (children: string) => string }>;

  // Export hooks
  export function useInput(inputHandler: InputHandler, options?: UseInputOptions): void;
  export function useApp(): App;
  export function useStdout(): { stdout: Stdout; write: (data: string) => void };
  export function useStdin(): Stdin;
  export function useStderr(): { stderr: Stdout; write: (data: string) => void };
  export function useFocus(options?: { autoFocus?: boolean }): { isFocused: boolean };
  export function useTheme<T = any>(): T;

  // Export render function
  export function render(node: ReactNode, options?: RenderOptions): RenderResult;

  // Export types
  export { Key, BoxProps, TextProps, UseInputOptions, RenderOptions, RenderResult, App, Stdout, Stdin };
}
