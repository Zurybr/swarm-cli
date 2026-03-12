/**
 * Hook for file tree state management
 * Provides state and actions for navigating and manipulating file trees
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  FileItem,
  FileTreeState,
  FileTreeActions,
  UseFileTreeReturn,
  flattenTree,
  findItemById,
} from '../types/file';

interface UseFileTreeOptions {
  /** Initial root items */
  initialItems?: FileItem[];
  /** Root path being browsed */
  rootPath?: string;
  /** Show hidden files by default */
  showHidden?: boolean;
  /** Callback when file is selected */
  onFileSelect?: (file: FileItem) => void;
  /** Callback when folder is toggled */
  onFolderToggle?: (folder: FileItem, isExpanded: boolean) => void;
}

/**
 * Hook for managing file tree state
 */
export function useFileTree(options: UseFileTreeOptions = {}): UseFileTreeReturn {
  const {
    initialItems = [],
    rootPath = '.',
    showHidden = false,
    onFileSelect,
    onFolderToggle,
  } = options;

  // State
  const [rootItems, setRootItems] = useState<FileItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilterState] = useState('');
  const [showHiddenState, setShowHidden] = useState(showHidden);

  // Flatten tree for navigation
  const flattenedItems = useMemo(() => {
    const items = flattenTree(rootItems, expandedIds);
    
    // Apply search filter
    if (searchFilter) {
      const lowerFilter = searchFilter.toLowerCase();
      return items.filter(item => 
        item.name.toLowerCase().includes(lowerFilter)
      );
    }
    
    // Apply hidden filter
    if (!showHiddenState) {
      return items.filter(item => !item.isHidden);
    }
    
    return items;
  }, [rootItems, expandedIds, searchFilter, showHiddenState]);

  // Get currently selected item
  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return findItemById(rootItems, selectedId);
  }, [rootItems, selectedId]);

  // Select a file/folder by ID
  const select = useCallback((id: string) => {
    setSelectedId(id);
    
    const item = findItemById(rootItems, id);
    if (item && onFileSelect) {
      onFileSelect(item);
    }
  }, [rootItems, onFileSelect]);

  // Toggle folder expansion
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });

    const item = findItemById(rootItems, id);
    if (item && item.type === 'folder' && onFolderToggle) {
      onFolderToggle(item, !expandedIds.has(id));
    }
  }, [rootItems, expandedIds, onFolderToggle]);

  // Expand a folder
  const expand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
  }, []);

  // Collapse a folder
  const collapse = useCallback((id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  // Expand all folders
  const expandAll = useCallback(() => {
    const allFolderIds = new Set<string>();
    
    function collectFolderIds(items: FileItem[]) {
      for (const item of items) {
        if (item.type === 'folder') {
          allFolderIds.add(item.id);
          if (item.children) {
            collectFolderIds(item.children);
          }
        }
      }
    }
    
    collectFolderIds(rootItems);
    setExpandedIds(allFolderIds);
  }, [rootItems]);

  // Collapse all folders
  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // Set search filter
  const setSearchFilter = useCallback((filter: string) => {
    setSearchFilterState(filter);
  }, []);

  // Toggle hidden files visibility
  const toggleHidden = useCallback(() => {
    setShowHidden(prev => !prev);
  }, []);

  // Navigate to next item
  const navigateNext = useCallback(() => {
    const currentIndex = flattenedItems.findIndex(item => item.id === selectedId);
    
    if (currentIndex < flattenedItems.length - 1) {
      const nextItem = flattenedItems[currentIndex + 1];
      setSelectedId(nextItem.id);
      if (onFileSelect) {
        onFileSelect(nextItem);
      }
    }
  }, [flattenedItems, selectedId, onFileSelect]);

  // Navigate to previous item
  const navigatePrevious = useCallback(() => {
    const currentIndex = flattenedItems.findIndex(item => item.id === selectedId);
    
    if (currentIndex > 0) {
      const prevItem = flattenedItems[currentIndex - 1];
      setSelectedId(prevItem.id);
      if (onFileSelect) {
        onFileSelect(prevItem);
      }
    }
  }, [flattenedItems, selectedId, onFileSelect]);

  // Navigate into folder or select file
  const navigateInto = useCallback(() => {
    if (!selectedItem) return;
    
    if (selectedItem.type === 'folder') {
      expand(selectedItem.id);
    }
  }, [selectedItem, expand]);

  // Navigate out of folder
  const navigateOut = useCallback(() => {
    if (!selectedItem) return;
    
    if (selectedItem.type === 'folder' && expandedIds.has(selectedItem.id)) {
      collapse(selectedItem.id);
    }
  }, [selectedItem, expandedIds, collapse]);

  // Refresh the file tree
  const refresh = useCallback(() => {
    // This would typically re-read from filesystem
    // For now, it's a no-op that can be overridden
  }, []);

  // Select first item when items change
  useEffect(() => {
    if (flattenedItems.length > 0 && !selectedId) {
      setSelectedId(flattenedItems[0].id);
    }
  }, [flattenedItems, selectedId]);

  // Build return object
  const state: FileTreeState = {
    rootItems,
    selectedId,
    expandedIds,
    searchFilter,
    showHidden: showHiddenState,
    rootPath,
  };

  const actions: FileTreeActions = {
    select,
    toggleExpand,
    expand,
    collapse,
    expandAll,
    collapseAll,
    setSearchFilter,
    toggleHidden,
    navigateNext,
    navigatePrevious,
    navigateInto,
    navigateOut,
    refresh,
    setRootItems,
  };

  return {
    ...state,
    ...actions,
  };
}

/**
 * Create a FileItem from a file system entry
 */
export function createFileItem(
  name: string,
  path: string,
  type: 'file' | 'folder',
  children?: FileItem[]
): FileItem {
  const extension = type === 'file' ? name.split('.').pop()?.toLowerCase() : undefined;
  
  return {
    id: path,
    name,
    type,
    path,
    children,
    isExpanded: false,
    extension,
    isHidden: name.startsWith('.'),
  };
}

/**
 * Build a file tree from a flat list of paths
 */
export function buildFileTree(paths: string[]): FileItem[] {
  const root: Map<string, FileItem> = new Map();

  // Sort paths to ensure consistent ordering
  const sortedPaths = [...paths].sort();

  for (const path of sortedPaths) {
    const parts = path.split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!current.has(part)) {
        const item: FileItem = {
          id: currentPath,
          name: part,
          type: isLast ? 'file' : 'folder',
          path: currentPath,
          children: isLast ? undefined : [],
          isExpanded: false,
          extension: isLast ? part.split('.').pop()?.toLowerCase() : undefined,
          isHidden: part.startsWith('.'),
        };
        current.set(part, item);
      }

      if (!isLast) {
        const item = current.get(part)!;
        if (!item.children) {
          item.children = [];
        }
        current = new Map(item.children.map(c => [c.name, c]));
      }
    }
  }

  // Convert map to array and build children recursively
  function mapToArray(map: Map<string, FileItem>): FileItem[] {
    const result: FileItem[] = [];
    
    for (const item of map.values()) {
      if (item.type === 'folder' && item.children) {
        const childMap = new Map(item.children.map(c => [c.name, c]));
        item.children = mapToArray(childMap);
      }
      result.push(item);
    }

    // Sort: folders first, then files, alphabetically
    return result.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  return mapToArray(root);
}

export default useFileTree;
