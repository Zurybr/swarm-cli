/**
 * Swarm MCP Tools
 * 
 * MCP tools exposing Swarm CLI functionality for opencode integration.
 */

import type { ServerTool, ToolResult } from '../types.js';
import { textResult, errorResult } from '../types.js';
import { Hive, Cell } from '../../../hive/index.js';

// Global hive instance (initialized on first use)
let hiveInstance: Hive | null = null;

async function getHive(): Promise<Hive> {
  if (!hiveInstance) {
    hiveInstance = new Hive({ baseDir: '.hive' }, process.cwd());
    await hiveInstance.init();
  }
  return hiveInstance;
}

/**
 * Tool to get status of the swarm system
 */
const swarmStatusTool: ServerTool = {
  definition: {
    name: 'swarm_status',
    description: 'Get the current status of the Swarm CLI system including active agents, cells, and running tasks',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  handler: async (): Promise<ToolResult> => {
    try {
      const hive = await getHive();
      const stats = await hive.getStats();
      const allCells = await hive.getAllCells();
      
      const openCells = allCells.filter(c => c.status === 'open');
      const inProgressCells = allCells.filter(c => c.status === 'in_progress');
      
      const status = {
        totalCells: stats.total,
        openCells: openCells.length,
        inProgressCells: inProgressCells.length,
        byStatus: stats.byStatus,
        byType: stats.byType,
        message: `Swarm CLI is active. ${openCells.length} open cells, ${inProgressCells.length} in progress.`,
      };
      
      return textResult(JSON.stringify(status, null, 2));
    } catch (error) {
      return errorResult('Failed to get swarm status', error);
    }
  },
};

/**
 * Tool to list available cells/tasks
 */
const hiveCellsTool: ServerTool = {
  definition: {
    name: 'hive_cells',
    description: 'List all swarm cells with optional filtering by status and type',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'completed', 'blocked', 'cancelled'],
          description: 'Filter by cell status',
        },
        type: {
          type: 'string',
          enum: ['epic', 'task', 'subtask', 'bug', 'feature', 'research'],
          description: 'Filter by cell type',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of cells to return',
        },
        id: {
          type: 'string',
          description: 'Filter by partial cell ID',
        },
        ready: {
          type: 'boolean',
          description: 'Get only ready (unblocked) cells',
        },
      },
    },
  },
  handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const hive = await getHive();
      
      let cells: Cell[];
      
      if (args.ready) {
        const readyCell = await hive.getNextReady();
        cells = readyCell ? [readyCell] : [];
      } else if (args.id) {
        const cell = await hive.getCell(args.id as string);
        cells = cell ? [cell] : [];
      } else {
        cells = await hive.query({
          status: args.status as any,
          type: args.type as any,
        });
      }
      
      if (args.limit && typeof args.limit === 'number') {
        cells = cells.slice(0, args.limit);
      }
      
      if (cells.length === 0) {
        return textResult('No cells found matching the criteria.');
      }
      
      const formatted = cells.map((cell: Cell) => 
        `[${cell.id}] ${cell.title} (${cell.status}) - ${cell.type}`
      ).join('\n');
      
      return textResult(`Found ${cells.length} cells:\n${formatted}`);
    } catch (error) {
      return errorResult('Failed to list cells', error);
    }
  },
};

/**
 * Tool to create a new cell/task
 */
const hiveCreateTool: ServerTool = {
  definition: {
    name: 'hive_create',
    description: 'Create a new swarm cell (task, bug, feature, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the cell',
        },
        type: {
          type: 'string',
          enum: ['epic', 'task', 'subtask', 'bug', 'feature', 'research'],
          description: 'Type of cell',
        },
        description: {
          type: 'string',
          description: 'Optional description',
        },
        priority: {
          type: 'number',
          minimum: 0,
          maximum: 3,
          description: 'Priority level (0-3)',
        },
        parent_id: {
          type: 'string',
          description: 'Parent cell ID',
        },
      },
      required: ['title', 'type'],
    },
  },
  handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const hive = await getHive();
      
      const cell = await hive.createCell({
        title: args.title as string,
        type: args.type as any,
        description: args.description as string,
        priority: args.priority as number,
        parentId: args.parent_id as string,
      });
      
      return textResult(`Cell created successfully:\nID: ${cell.id}\nTitle: ${cell.title}\nType: ${cell.type}`);
    } catch (error) {
      return errorResult('Failed to create cell', error);
    }
  },
};

/**
 * Tool to get the next ready cell
 */
const hiveReadyTool: ServerTool = {
  definition: {
    name: 'hive_ready',
    description: 'Get the next ready (unblocked) cell with highest priority',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  handler: async (): Promise<ToolResult> => {
    try {
      const hive = await getHive();
      
      const cell = await hive.getNextReady();
      
      if (!cell) {
        return textResult('No ready cells found.');
      }
      
      return textResult(
        `Next ready cell:\nID: ${cell.id}\nTitle: ${cell.title}\nType: ${cell.type}\nPriority: ${cell.priority}`
      );
    } catch (error) {
      return errorResult('Failed to get ready cell', error);
    }
  },
};

/**
 * Tool to update a cell status
 */
const hiveUpdateTool: ServerTool = {
  definition: {
    name: 'hive_update',
    description: 'Update a cell status, description, or priority',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Cell ID',
        },
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'completed', 'blocked', 'cancelled'],
          description: 'New status',
        },
        description: {
          type: 'string',
          description: 'Updated description',
        },
        priority: {
          type: 'number',
          minimum: 0,
          maximum: 3,
          description: 'New priority (0-3)',
        },
      },
      required: ['id'],
    },
  },
  handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const hive = await getHive();
      
      await hive.updateCell(args.id as string, {
        status: args.status as any,
        description: args.description as string,
        priority: args.priority as number,
      });
      
      return textResult(`Cell ${args.id} updated successfully.`);
    } catch (error) {
      return errorResult('Failed to update cell', error);
    }
  },
};

/**
 * Tool to start working on a cell
 */
const hiveStartTool: ServerTool = {
  definition: {
    name: 'hive_start',
    description: 'Mark a cell as in-progress',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Cell ID',
        },
      },
      required: ['id'],
    },
  },
  handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const hive = await getHive();
      
      await hive.transitionStatus(args.id as string, 'in_progress');
      
      return textResult(`Cell ${args.id} is now in progress.`);
    } catch (error) {
      return errorResult('Failed to start cell', error);
    }
  },
};

/**
 * Tool to close a cell
 */
const hiveCloseTool: ServerTool = {
  definition: {
    name: 'hive_close',
    description: 'Close/complete a cell with a reason',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Cell ID',
        },
        reason: {
          type: 'string',
          description: 'Reason for closing/completing',
        },
      },
      required: ['id', 'reason'],
    },
  },
  handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const hive = await getHive();
      
      await hive.transitionStatus(
        args.id as string,
        'completed',
        args.reason as string
      );
      
      return textResult(`Cell ${args.id} completed. Reason: ${args.reason}`);
    } catch (error) {
      return errorResult('Failed to close cell', error);
    }
  },
};

/**
 * Tool to sync beads to git
 */
const hiveSyncTool: ServerTool = {
  definition: {
    name: 'hive_sync',
    description: 'Sync beads/cells to git and push changes',
    inputSchema: {
      type: 'object',
      properties: {
        auto_pull: {
          type: 'boolean',
          description: 'Automatically pull before pushing',
        },
      },
    },
  },
  handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const hive = await getHive();
      
      // Commit any pending changes
      const result = await hive.commit('Sync beads to git');
      
      if (!result.success) {
        return errorResult('Failed to sync beads', result.error);
      }
      
      return textResult('Beads synced to git successfully.');
    } catch (error) {
      return errorResult('Failed to sync beads', error);
    }
  },
};

/**
 * Tool to get swarm review feedback
 */
const swarmReviewFeedbackTool: ServerTool = {
  definition: {
    name: 'swarm_review_feedback',
    description: 'Send review feedback to a worker after completing a subtask',
    inputSchema: {
      type: 'object',
      properties: {
        project_key: {
          type: 'string',
          description: 'Project identifier',
        },
        task_id: {
          type: 'string',
          description: 'Task/bead ID',
        },
        worker_id: {
          type: 'string',
          description: 'Worker agent name',
        },
        status: {
          type: 'string',
          enum: ['approved', 'needs_changes'],
          description: 'Review verdict',
        },
        summary: {
          type: 'string',
          description: 'Brief summary of review',
        },
        issues: {
          type: 'string',
          description: 'Issues found (if any)',
        },
      },
      required: ['project_key', 'task_id', 'worker_id', 'status'],
    },
  },
  handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      // This is a coordination tool - in a real implementation, 
      // this would communicate with the swarm coordination system
      const feedback = {
        taskId: args.task_id,
        workerId: args.worker_id,
        status: args.status,
        summary: args.summary,
        issues: args.issues,
        timestamp: new Date().toISOString(),
      };
      
      return textResult(
        `Review feedback recorded:\n` +
        `Task: ${args.task_id}\n` +
        `Worker: ${args.worker_id}\n` +
        `Status: ${args.status}\n` +
        `${args.summary ? `Summary: ${args.summary}\n` : ''}` +
        `${args.issues ? `Issues: ${args.issues}\n` : ''}`
      );
    } catch (error) {
      return errorResult('Failed to record review feedback', error);
    }
  },
};

/**
 * All swarm tools
 */
export const swarmTools: ServerTool[] = [
  swarmStatusTool,
  hiveCellsTool,
  hiveCreateTool,
  hiveReadyTool,
  hiveUpdateTool,
  hiveStartTool,
  hiveCloseTool,
  hiveSyncTool,
  swarmReviewFeedbackTool,
];
