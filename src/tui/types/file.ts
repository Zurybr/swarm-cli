/**
 * TypeScript types for File Browser data
 * Defines the structure for files, folders, and file tree state
 */

/**
 * File or folder type
 */
export type FileType = 'file' | 'folder';

/**
 * Individual file or folder item
 */
export interface FileItem {
  /** Unique identifier (usually full path) */
  id: string;
  /** Display name */
  name: string;
  /** File or folder type */
  type: FileType;
  /** Full path to the file/folder */
  path: string;
  /** Child items (only for folders) */
  children?: FileItem[];
  /** Whether the folder is expanded (only for folders) */
  isExpanded?: boolean;
  /** File extension (only for files) */
  extension?: string;
  /** File size in bytes */
  size?: number;
  /** Last modified timestamp */
  modifiedAt?: number;
  /** Whether this item is hidden (starts with .) */
  isHidden?: boolean;
}

/**
 * File tree state
 */
export interface FileTreeState {
  /** Root items in the tree */
  rootItems: FileItem[];
  /** Currently selected item ID */
  selectedId: string | null;
  /** Currently expanded folder IDs */
  expandedIds: Set<string>;
  /** Search filter string */
  searchFilter: string;
  /** Whether to show hidden files */
  showHidden: boolean;
  /** Root path being browsed */
  rootPath: string;
}

/**
 * File tree actions
 */
export interface FileTreeActions {
  /** Select a file/folder by ID */
  select: (id: string) => void;
  /** Toggle folder expansion */
  toggleExpand: (id: string) => void;
  /** Expand a folder */
  expand: (id: string) => void;
  /** Collapse a folder */
  collapse: (id: string) => void;
  /** Expand all folders */
  expandAll: () => void;
  /** Collapse all folders */
  collapseAll: () => void;
  /** Set search filter */
  setSearchFilter: (filter: string) => void;
  /** Toggle hidden files visibility */
  toggleHidden: () => void;
  /** Navigate to next item */
  navigateNext: () => void;
  /** Navigate to previous item */
  navigatePrevious: () => void;
  /** Navigate into folder or select file */
  navigateInto: () => void;
  /** Navigate out of folder */
  navigateOut: () => void;
  /** Refresh the file tree */
  refresh: () => void;
  /** Set root items */
  setRootItems: (items: FileItem[]) => void;
}

/**
 * Combined hook return type
 */
export type UseFileTreeReturn = FileTreeState & FileTreeActions;

/**
 * File icon mapping by extension
 */
export const FILE_ICONS: Record<string, string> = {
  // Folders
  folder: '📁',
  folderOpen: '📂',
  
  // Common file types
  ts: '📘',
  tsx: '⚛️',
  js: '📒',
  jsx: '⚛️',
  json: '📋',
  md: '📝',
  txt: '📄',
  
  // Config files
  yaml: '⚙️',
  yml: '⚙️',
  toml: '⚙️',
  env: '🔐',
  
  // Web files
  html: '🌐',
  css: '🎨',
  scss: '🎨',
  
  // Images
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
  gif: '🖼️',
  svg: '🖼️',
  
  // Data files
  csv: '📊',
  xml: '📄',
  
  // Build/Package files
  lock: '🔒',
  
  // Default
  default: '📄',
};

/**
 * Get icon for a file based on extension
 */
export function getFileIcon(item: FileItem): string {
  if (item.type === 'folder') {
    return item.isExpanded ? FILE_ICONS.folderOpen : FILE_ICONS.folder;
  }
  
  if (!item.extension) {
    // Check for special filenames
    if (item.name === 'package.json') return '📦';
    if (item.name === 'tsconfig.json') return '📘';
    if (item.name === '.gitignore') return '🙈';
    if (item.name === '.env') return '🔐';
    if (item.name === 'README.md') return '📖';
    if (item.name === 'LICENSE') return '📜';
    return FILE_ICONS.default;
  }
  
  return FILE_ICONS[item.extension] || FILE_ICONS.default;
}

/**
 * File preview content
 */
export interface FilePreview {
  /** File being previewed */
  file: FileItem;
  /** File content (for text files) */
  content?: string;
  /** Whether the file is binary */
  isBinary?: boolean;
  /** Error message if preview failed */
  error?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Number of lines */
  lineCount?: number;
  /** Line numbers to display */
  lineNumbers?: number[];
}

/**
 * Sort options for file tree
 */
export type FileSortOption = 'name' | 'type' | 'modified' | 'size';

/**
 * File tree display options
 */
export interface FileTreeOptions {
  /** Show hidden files */
  showHidden: boolean;
  /** Sort by field */
  sortBy: FileSortOption;
  /** Sort ascending */
  sortAscending: boolean;
  /** Maximum preview lines */
  maxPreviewLines: number;
  /** Indent size for nesting */
  indentSize: number;
}

/**
 * Default file tree options
 */
export const DEFAULT_FILE_TREE_OPTIONS: FileTreeOptions = {
  showHidden: false,
  sortBy: 'name',
  sortAscending: true,
  maxPreviewLines: 20,
  indentSize: 2,
};

/**
 * Flatten a file tree to a linear list (for navigation)
 */
export function flattenTree(items: FileItem[], expandedIds: Set<string>): FileItem[] {
  const result: FileItem[] = [];
  
  function traverse(item: FileItem, depth: number) {
    result.push({ ...item, depth } as FileItem & { depth: number });
    
    if (item.type === 'folder' && item.children && expandedIds.has(item.id)) {
      for (const child of item.children) {
        traverse(child, depth + 1);
      }
    }
  }
  
  for (const item of items) {
    traverse(item, 0);
  }
  
  return result;
}

/**
 * Find an item in the tree by ID
 */
export function findItemById(items: FileItem[], id: string): FileItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get parent folder of an item
 */
export function getParentFolder(items: FileItem[], targetId: string): FileItem | null {
  function search(items: FileItem[], parent: FileItem | null): FileItem | null {
    for (const item of items) {
      if (item.id === targetId) return parent;
      if (item.children) {
        const found = search(item.children, item);
        if (found) return found;
      }
    }
    return null;
  }
  return search(items, null);
}

/**
 * Check if a file is a text file (can be previewed)
 */
export function isTextFile(filename: string): boolean {
  const textExtensions = [
    'txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'html',
    'yaml', 'yml', 'xml', 'toml', 'ini', 'env', 'sh', 'bash', 'zsh',
    'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp',
    'gitignore', 'dockerignore', 'editorconfig', 'prettierrc', 'eslintrc',
  ];
  
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return textExtensions.includes(ext) || filename.startsWith('.');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}
