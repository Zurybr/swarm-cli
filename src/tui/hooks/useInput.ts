/**
 * Input handling hook for Swarm CLI TUI
 * Provides keyboard input handling with key mapping and command history
 */

import { useState, useCallback, useEffect } from 'react';
import { useInput as useInkInput, Key } from 'ink';

export interface InputState {
  inputValue: string;
  cursorPosition: number;
  history: string[];
  historyIndex: number;
}

export interface InputActions {
  setValue: (value: string) => void;
  appendChar: (char: string) => void;
  backspace: () => void;
  delete: () => void;
  moveCursor: (delta: number) => void;
  moveToStart: () => void;
  moveToEnd: () => void;
  submit: () => void;
  historyUp: () => void;
  historyDown: () => void;
  clear: () => void;
}

export interface UseInputOptions {
  onSubmit?: (value: string) => void;
  onChange?: (value: string) => void;
  maxLength?: number;
  enabled?: boolean;
}

export interface UseInputReturn extends InputState, InputActions {
  handleSubmit: () => void;
}

/**
 * Enhanced input hook with history and cursor support
 */
export function useInput(options: UseInputOptions = {}): UseInputReturn {
  const {
    onSubmit,
    onChange,
    maxLength = 1000,
    enabled = true,
  } = options;

  const [inputValue, setInputValue] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const setValue = useCallback((value: string) => {
    const truncated = value.slice(0, maxLength);
    setInputValue(truncated);
    setCursorPosition(truncated.length);
    onChange?.(truncated);
  }, [maxLength, onChange]);

  const appendChar = useCallback((char: string) => {
    if (inputValue.length >= maxLength) return;
    
    const newValue = 
      inputValue.slice(0, cursorPosition) + char + inputValue.slice(cursorPosition);
    setInputValue(newValue);
    setCursorPosition(prev => prev + 1);
    onChange?.(newValue);
  }, [inputValue, cursorPosition, maxLength, onChange]);

  const backspace = useCallback(() => {
    if (cursorPosition === 0) return;
    
    const newValue = 
      inputValue.slice(0, cursorPosition - 1) + inputValue.slice(cursorPosition);
    setInputValue(newValue);
    setCursorPosition(prev => prev - 1);
    onChange?.(newValue);
  }, [inputValue, cursorPosition, onChange]);

  const delete_ = useCallback(() => {
    if (cursorPosition >= inputValue.length) return;
    
    const newValue = 
      inputValue.slice(0, cursorPosition) + inputValue.slice(cursorPosition + 1);
    setInputValue(newValue);
    onChange?.(newValue);
  }, [inputValue, cursorPosition, onChange]);

  const moveCursor = useCallback((delta: number) => {
    setCursorPosition(prev => {
      const newPos = prev + delta;
      return Math.max(0, Math.min(inputValue.length, newPos));
    });
  }, [inputValue.length]);

  const moveToStart = useCallback(() => {
    setCursorPosition(0);
  }, []);

  const moveToEnd = useCallback(() => {
    setCursorPosition(inputValue.length);
  }, [inputValue.length]);

  const handleSubmit = useCallback(() => {
    if (inputValue.trim()) {
      setHistory(prev => [...prev, inputValue]);
      setHistoryIndex(-1);
      onSubmit?.(inputValue);
    }
  }, [inputValue, onSubmit]);

  const historyUp = useCallback(() => {
    if (history.length === 0) return;
    
    const newIndex = historyIndex < history.length - 1 
      ? historyIndex + 1 
      : historyIndex;
    
    if (newIndex !== historyIndex) {
      setHistoryIndex(newIndex);
      const historicalValue = history[history.length - 1 - newIndex];
      setInputValue(historicalValue);
      setCursorPosition(historicalValue.length);
    }
  }, [history, historyIndex]);

  const historyDown = useCallback(() => {
    if (historyIndex <= 0) {
      setHistoryIndex(-1);
      setInputValue('');
      setCursorPosition(0);
      return;
    }
    
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    const historicalValue = history[history.length - 1 - newIndex];
    setInputValue(historicalValue);
    setCursorPosition(historicalValue.length);
  }, [history, historyIndex]);

  const clear = useCallback(() => {
    setInputValue('');
    setCursorPosition(0);
    onChange?.('');
  }, [onChange]);

  // Handle keyboard input
  useInkInput((input: string, key: Key) => {
    if (!enabled) return;

    if (key.return) {
      handleSubmit();
    } else if (key.backspace) {
      backspace();
    } else if (key.delete) {
      delete_();
    } else if (key.leftArrow) {
      moveCursor(-1);
    } else if (key.rightArrow) {
      moveCursor(1);
    } else if (key.upArrow) {
      historyUp();
    } else if (key.downArrow) {
      historyDown();
    } else if (!key.ctrl && !key.meta && input.length === 1) {
      appendChar(input);
    }
  }, { isActive: enabled });

  return {
    inputValue,
    cursorPosition,
    history,
    historyIndex,
    setValue,
    appendChar,
    backspace,
    delete: delete_,
    moveCursor,
    moveToStart,
    moveToEnd,
    submit: handleSubmit,
    historyUp,
    historyDown,
    clear,
    handleSubmit,
  };
}

export default useInput;
