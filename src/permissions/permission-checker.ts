import {
  PermissionConfig,
  PermissionLevel,
  getPermissionFromHierarchy,
  getRememberedChoice,
} from './permission-config';

export interface PermissionContext {
  tool: string;
  args?: any;
  role?: string;
  sessionId?: string;
  userId?: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason: string;
  level: PermissionLevel;
  requiresPrompt: boolean;
}

export class PermissionChecker {
  private config: PermissionConfig;
  private heuristics: Map<string, (ctx: PermissionContext) => boolean>;

  constructor(config: PermissionConfig) {
    this.config = config;
    this.heuristics = new Map();
    this.registerDefaultHeuristics();
  }

  private registerDefaultHeuristics(): void {
    this.heuristics.set('read', (ctx) => {
      return ctx.args?.path && !ctx.args.path.includes('secret');
    });

    this.heuristics.set('write', (ctx) => {
      return ctx.args?.path && !ctx.args.path.includes('.env');
    });

    this.heuristics.set('execute', (ctx) => {
      return ctx.args?.command && !ctx.args.command.includes('rm -rf');
    });

    this.heuristics.set('delete', (ctx) => {
      return false;
    });

    this.heuristics.set('network', (ctx) => {
      return ctx.args?.url && ctx.args.url.startsWith('https://');
    });
  }

  registerHeuristic(tool: string, fn: (ctx: PermissionContext) => boolean): void {
    this.heuristics.set(tool, fn);
  }

  check(context: PermissionContext): PermissionResult {
    const remembered = getRememberedChoice(this.config, context.tool);
    if (remembered !== null) {
      return {
        allowed: remembered,
        reason: remembered ? 'Previously allowed' : 'Previously denied',
        level: remembered ? true : false,
        requiresPrompt: false,
      };
    }

    const level = getPermissionFromHierarchy(this.config, context.tool, context.role);

    switch (level) {
      case true:
        return {
          allowed: true,
          reason: 'Allowed by config (true)',
          level,
          requiresPrompt: false,
        };

      case false:
        return {
          allowed: false,
          reason: 'Denied by config (false)',
          level,
          requiresPrompt: false,
        };

      case 'ask':
        return {
          allowed: false,
          reason: 'Requires user prompt',
          level,
          requiresPrompt: true,
        };

      case 'auto':
        return this.applyHeuristics(context);

      default:
        return {
          allowed: false,
          reason: 'Unknown permission level',
          level: 'ask',
          requiresPrompt: true,
        };
    }
  }

  private applyHeuristics(context: PermissionContext): PermissionResult {
    const heuristic = this.heuristics.get(context.tool);
    
    if (!heuristic) {
      return {
        allowed: false,
        reason: 'No heuristic available for tool',
        level: 'auto',
        requiresPrompt: true,
      };
    }

    const allowed = heuristic(context);
    return {
      allowed,
      reason: allowed ? 'Allowed by heuristics' : 'Denied by heuristics',
      level: 'auto',
      requiresPrompt: !allowed,
    };
  }

  updateConfig(config: PermissionConfig): void {
    this.config = config;
  }

  getConfig(): PermissionConfig {
    return this.config;
  }
}

export function createPermissionChecker(config: PermissionConfig): PermissionChecker {
  return new PermissionChecker(config);
}
