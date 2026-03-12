/**
 * FileTree component for Swarm CLI TUI
 * Renders a hierarchical tree view of files and folders
 */

import React, { useMemo } from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../hooks/useTheme';
import {
  FileItem,
  getFileIcon,
  flattenTree,
} from '../types/file';

interface FileTreeProps {
  /** Root items to display */
  items: FileItem[];
  /** Currently selected item ID */
  selectedId: string | null;
  /** Set of expanded folder IDs */
  expandedIds: Set<string>;
  /** Callback when item is selected */
  onSelect?: (id: string) => void;
  /** Callback when folder is toggled */
  onToggleExpand?: (id: string) => void;
  /** Search filter to highlight matches */
  searchFilter?: string;
  /** Show hidden files */
  showHidden?: boolean;
  /** Maximum width for file names */
  maxNameWidth?: number;
  /** Indent size per level */
  indentSize?: number;
}

/**
 * Individual tree item component
 */
interface TreeItemProps {
  item: FileItem;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  searchFilter?: string;
  maxNameWidth: number;
  indentSize: number;
  colors: ReturnType<typeof useTheme>['colors'];
  onSelect?: (id: string) => void;
  onToggleExpand?: (id: string) => void;
}

function TreeItem({
  item,
  depth,
  isSelected,
  isExpanded,
  searchFilter,
  maxNameWidth,
  indentSize,
  colors,
  onSelect,
  onToggleExpand,
}: TreeItemProps): React.ReactElement | null {
  // Skip hidden files if filter is active
  if (item.isHidden && !searchFilter) {
    return null;
  }

  const icon = getFileIcon({ ...item, isExpanded });
  const indent = ' '.repeat(depth * indentSize);
  
  // Truncate name if too long
  const displayName = item.name.length > maxNameWidth
    ? item.name.substring(0, maxNameWidth - 3) + '...'
    : item.name;

  // Highlight search match
  const highlightMatch = (name: string) => {
    if (!searchFilter) {
      return React.createElement(Text, null, name);
    }
    
    const lowerName = name.toLowerCase();
    const lowerFilter = searchFilter.toLowerCase();
    const matchIndex = lowerName.indexOf(lowerFilter);
    
    if (matchIndex === -1) {
      return React.createElement(Text, null, name);
    }
    
    const before = name.substring(0, matchIndex);
    const match = name.substring(matchIndex, matchIndex + searchFilter.length);
    const after = name.substring(matchIndex + searchFilter.length);
    
    return React.createElement(
      React.Fragment,
      null,
      before && React.createElement(Text, null, before),
      React.createElement(Text, { backgroundColor: colors.warning, color: '#000000', bold: true }, match),
      after && React.createElement(Text, null, after)
    );
  };

  const handleClick = () => {
    if (item.type === 'folder') {
      onToggleExpand?.(item.id);
    }
    onSelect?.(item.id);
  };

  return React.createElement(
    Box,
    {
      key: item.id,
      flexDirection: 'row',
      paddingLeft: depth * indentSize,
    },
    // Selection indicator
    React.createElement(
      Text,
      {
        color: isSelected ? colors.primary : undefined,
        bold: isSelected,
      },
      isSelected ? '▶ ' : '  '
    ),
    // Icon
    React.createElement(Text, null, `${icon} `),
    // Name
    React.createElement(
      Text,
      {
        color: isSelected 
          ? colors.primary 
          : item.type === 'folder' 
            ? colors.secondary 
            : colors.text,
        bold: isSelected || item.type === 'folder',
        underline: isSelected,
      },
      highlightMatch(displayName)
    ),
    // Type indicator for folders
    item.type === 'folder' && React.createElement(
      Text,
      { color: colors.muted },
      isExpanded ? ' ▼' : ' ▶'
    )
  );
}

/**
 * FileTree component - Renders hierarchical file/folder tree
 */
export function FileTree({
  items,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  searchFilter,
  showHidden = false,
  maxNameWidth = 30,
  indentSize = 2,
}: FileTreeProps): React.ReactElement {
  const { colors } = useTheme();

  // Flatten tree for rendering
  const flattenedItems = useMemo(() => {
    const flat = flattenTree(items, expandedIds);
    
    // Filter hidden files if needed
    if (!showHidden) {
      return flat.filter(item => !item.isHidden);
    }
    
    // Apply search filter
    if (searchFilter) {
      const lowerFilter = searchFilter.toLowerCase();
      return flat.filter(item => 
        item.name.toLowerCase().includes(lowerFilter)
      );
    }
    
    return flat;
  }, [items, expandedIds, showHidden, searchFilter]);

  // Empty state
  if (flattenedItems.length === 0) {
    return React.createElement(
      Box,
      { flexDirection: 'column', paddingX: 1 },
      React.createElement(
        Text,
        { color: colors.muted, italic: true },
        searchFilter ? `No files matching "${searchFilter}"` : 'No files to display'
      )
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    ...flattenedItems.map((item, index) => {
      const itemWithDepth = item as FileItem & { depth: number };
      const depth = itemWithDepth.depth ?? 0;
      const isSelected = item.id === selectedId;
      const isExpanded = expandedIds.has(item.id);
      
      return React.createElement(TreeItem, {
        key: item.id,
        item,
        depth,
        isSelected,
        isExpanded,
        searchFilter,
        maxNameWidth,
        indentSize,
        colors,
        onSelect,
        onToggleExpand,
      });
    })
  );
}

/**
 * Compact file tree for sidebar display
 */
export function CompactFileTree({
  items,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  maxHeight = 15,
}: Omit<FileTreeProps, 'maxNameWidth'> & { maxHeight?: number }): React.ReactElement {
  const { colors } = useTheme();

  const flattenedItems = useMemo(() => {
    return flattenTree(items, expandedIds).slice(0, maxHeight);
  }, [items, expandedIds, maxHeight]);

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    ...flattenedItems.map(item => {
      const itemWithDepth = item as FileItem & { depth: number };
      const depth = itemWithDepth.depth ?? 0;
      const isSelected = item.id === selectedId;
      const isExpanded = expandedIds.has(item.id);
      const icon = getFileIcon({ ...item, isExpanded });
      
      return React.createElement(
        Box,
        {
          key: item.id,
          paddingLeft: depth * 1,
        },
        React.createElement(
          Text,
          {
            color: isSelected ? colors.primary : colors.text,
            bold: isSelected,
          },
          `${isSelected ? '▸' : ' '} ${icon} ${item.name}`
        )
      );
    })
  );
}

export default FileTree;
