/**
 * Context Injector
 *
 * Handles strategic injection of critical information into the context.
 * Supports injection at various points: start, end, before related info,
 * after related info, on demand, and at milestones.
 */

import {
  ContextChunk,
  InjectionPayload,
  InjectionResult,
  InjectionPoint,
  InjectionTrigger,
  InjectionCondition,
} from './types';

/**
 * Manages strategic information injection into context
 */
export class ContextInjector {
  private injections: Map<string, InjectionPayload> = new Map();
  private injectionHistory: Array<{ id: string; timestamp: number; position: number }> = [];

  /**
   * Register an injection payload
   */
  register(payload: InjectionPayload): void {
    this.injections.set(payload.id, {
      ...payload,
      injectionCount: payload.injectionCount || 0,
    });
  }

  /**
   * Unregister an injection
   */
  unregister(injectionId: string): boolean {
    return this.injections.delete(injectionId);
  }

  /**
   * Process injections for a given point
   */
  processInjections(
    point: InjectionPoint,
    chunks: ContextChunk[],
    contextString: string
  ): InjectionResult[] {
    const results: InjectionResult[] = [];

    for (const injection of Array.from(this.injections.values())) {
      const result = this.evaluateInjection(injection, point, chunks, contextString);
      results.push(result);
      if (result.injected) {
        // Update injection count
        injection.injectionCount = (injection.injectionCount || 0) + 1;
      }
    }

    return results;
  }

  /**
   * Evaluate if an injection should be applied
   */
  private evaluateInjection(
    payload: InjectionPayload,
    point: InjectionPoint,
    chunks: ContextChunk[],
    contextString: string
  ): InjectionResult {
    const trigger = payload.trigger;

    // Check if point matches
    if (trigger.point !== point) {
      return {
        injected: false,
        injectionId: payload.id,
        reason: `Point mismatch: expected ${trigger.point}, got ${point}`,
      };
    }

    // Check max injections
    if (payload.maxInjections && (payload.injectionCount || 0) >= payload.maxInjections) {
      return {
        injected: false,
        injectionId: payload.id,
        reason: 'Max injections reached',
      };
    }

    // Check condition if present
    if (trigger.condition && !this.evaluateCondition(trigger.condition, chunks, contextString)) {
      return {
        injected: false,
        injectionId: payload.id,
        reason: 'Condition not met',
      };
    }

    // Determine injection position
    const position = this.calculateInjectionPosition(payload, point, chunks, contextString);

    // Record injection
    this.injectionHistory.push({
      id: payload.id,
      timestamp: Date.now(),
      position,
    });

    return {
      injected: true,
      position,
      content: payload.content,
      injectionId: payload.id,
      reason: `Injected at ${point}`,
    };
  }

  /**
   * Evaluate an injection condition
   */
  private evaluateCondition(
    condition: InjectionCondition,
    chunks: ContextChunk[],
    contextString: string
  ): boolean {
    // Check keywords
    if (condition.keywords) {
      const contextLower = contextString.toLowerCase();
      const hasKeyword = condition.keywords.some((kw) =>
        contextLower.includes(kw.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // Check context type
    if (condition.contextType) {
      const hasType = chunks.some((c) => c.type === condition.contextType);
      if (!hasType) return false;
    }

    // Check source pattern
    if (condition.sourcePattern) {
      const matchesPattern = chunks.some((c) =>
        condition.sourcePattern!.test(c.source)
      );
      if (!matchesPattern) return false;
    }

    // Custom condition (if provided as function string, would need eval - use sparingly)
    if (condition.custom) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const customFn = new Function('chunks', 'context', condition.custom);
        return customFn(chunks, contextString) as boolean;
      } catch {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate the position for injection
   */
  private calculateInjectionPosition(
    payload: InjectionPayload,
    point: InjectionPoint,
    chunks: ContextChunk[],
    contextString: string
  ): number {
    switch (point) {
      case 'start':
        return 0;

      case 'end':
        return contextString.length;

      case 'before_related':
        return this.findRelatedPosition(payload, chunks, contextString, 'before');

      case 'after_related':
        return this.findRelatedPosition(payload, chunks, contextString, 'after');

      case 'on_demand':
      case 'milestone':
        // These are triggered explicitly, use end as default
        return contextString.length;

      default:
        return contextString.length;
    }
  }

  /**
   * Find position near related content
   */
  private findRelatedPosition(
    payload: InjectionPayload,
    chunks: ContextChunk[],
    contextString: string,
    placement: 'before' | 'after'
  ): number {
    // Extract keywords from payload content
    const keywords = payload.content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    let bestMatchIndex = -1;
    let bestMatchScore = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkWords = chunk.content.toLowerCase().split(/\s+/);
      let matchCount = 0;

      for (const keyword of keywords) {
        if (chunkWords.some((w) => w.includes(keyword))) {
          matchCount++;
        }
      }

      const score = matchCount / keywords.length;
      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatchIndex = i;
      }
    }

    if (bestMatchIndex === -1) {
      return placement === 'before' ? 0 : contextString.length;
    }

    // Calculate position in context string
    let position = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (i === bestMatchIndex) {
        if (placement === 'before') {
          return position;
        } else {
          position += chunks[i].content.length;
          return position;
        }
      }
      position += chunks[i].content.length + 1; // +1 for separator
    }

    return contextString.length;
  }

  /**
   * Inject content at a specific position in context
   */
  injectAtPosition(context: string, content: string, position: number): string {
    if (position <= 0) {
      return content + '\n\n' + context;
    }
    if (position >= context.length) {
      return context + '\n\n' + content;
    }
    return (
      context.substring(0, position) +
      '\n\n' +
      content +
      '\n\n' +
      context.substring(position)
    );
  }

  /**
   * Apply all pending injections to context
   */
  applyInjections(
    context: string,
    chunks: ContextChunk[],
    point: InjectionPoint
  ): { context: string; results: InjectionResult[] } {
    const results = this.processInjections(point, chunks, context);
    let modifiedContext = context;

    // Sort results by position (descending) to apply from end to start
    // This prevents position shifts from affecting subsequent injections
    const sortedResults = [...results]
      .filter((r) => r.injected)
      .sort((a, b) => (b.position || 0) - (a.position || 0));

    for (const result of sortedResults) {
      if (result.content && result.position !== undefined) {
        modifiedContext = this.injectAtPosition(
          modifiedContext,
          result.content,
          result.position
        );
      }
    }

    return { context: modifiedContext, results };
  }

  /**
   * Create a critical information injection
   */
  injectCritical(
    content: string,
    point: InjectionPoint = 'start',
    condition?: InjectionCondition
  ): InjectionResult {
    const payload: InjectionPayload = {
      id: `critical-${Date.now()}`,
      content,
      trigger: {
        point,
        condition,
        priority: 100,
      },
      critical: true,
      maxInjections: 1,
    };

    this.register(payload);

    return {
      injected: true,
      injectionId: payload.id,
      reason: 'Critical information registered for injection',
    };
  }

  /**
   * Create a milestone injection
   */
  injectAtMilestone(
    content: string,
    milestone: string,
    condition?: InjectionCondition
  ): InjectionPayload {
    const payload: InjectionPayload = {
      id: `milestone-${milestone}-${Date.now()}`,
      content,
      trigger: {
        point: 'milestone',
        condition: {
          ...condition,
          keywords: [...(condition?.keywords || []), milestone],
        },
        priority: 50,
      },
      critical: false,
      maxInjections: 1,
    };

    this.register(payload);
    return payload;
  }

  /**
   * Get injection statistics
   */
  getStats(): {
    totalRegistered: number;
    totalInjected: number;
    injectionHistory: typeof this.injectionHistory;
  } {
    const totalInjected = this.injectionHistory.length;
    return {
      totalRegistered: this.injections.size,
      totalInjected,
      injectionHistory: this.injectionHistory,
    };
  }

  /**
   * Clear all injections and history
   */
  clear(): void {
    this.injections.clear();
    this.injectionHistory = [];
  }

  /**
   * Get all registered injections
   */
  getInjections(): InjectionPayload[] {
    return Array.from(this.injections.values());
  }

  /**
   * Get injection by ID
   */
  getInjection(id: string): InjectionPayload | undefined {
    return this.injections.get(id);
  }
}

/**
 * Create an injection trigger
 */
export function createTrigger(
  point: InjectionPoint,
  priority: number = 50,
  condition?: InjectionCondition
): InjectionTrigger {
  return {
    point,
    priority,
    condition,
  };
}

/**
 * Create an injection condition
 */
export function createCondition(
  options: {
    keywords?: string[];
    contextType?: ContextChunk['type'];
    sourcePattern?: RegExp;
  }
): InjectionCondition {
  return {
    keywords: options.keywords,
    contextType: options.contextType,
    sourcePattern: options.sourcePattern,
  };
}

/**
 * Create an injection payload
 */
export function createInjection(
  content: string,
  trigger: InjectionTrigger,
  options: {
    id?: string;
    critical?: boolean;
    maxInjections?: number;
  } = {}
): InjectionPayload {
  return {
    id: options.id || `injection-${Date.now()}`,
    content,
    trigger,
    critical: options.critical ?? false,
    maxInjections: options.maxInjections,
  };
}

/**
 * Predefined injection patterns
 */
export const InjectionPatterns = {
  /**
   * Inject at the very beginning of context
   */
  atStart(content: string, priority: number = 100): InjectionPayload {
    return createInjection(content, createTrigger('start', priority), {
      critical: true,
    });
  },

  /**
   * Inject at the end of context
   */
  atEnd(content: string, priority: number = 10): InjectionPayload {
    return createInjection(content, createTrigger('end', priority));
  },

  /**
   * Inject when specific keywords are present
   */
  whenKeywords(
    content: string,
    keywords: string[],
    priority: number = 50
  ): InjectionPayload {
    return createInjection(
      content,
      createTrigger('before_related', priority, createCondition({ keywords }))
    );
  },

  /**
   * Inject when working with specific file types
   */
  whenFileType(
    content: string,
    extension: string,
    priority: number = 50
  ): InjectionPayload {
    return createInjection(
      content,
      createTrigger(
        'before_related',
        priority,
        createCondition({ sourcePattern: new RegExp(`\\.${extension}$`) })
      )
    );
  },

  /**
   * Inject at a milestone
   */
  atMilestone(content: string, milestone: string, priority: number = 50): InjectionPayload {
    return createInjection(
      content,
      createTrigger('milestone', priority, createCondition({ keywords: [milestone] }))
    );
  },

  /**
   * Inject on demand (manual trigger)
   */
  onDemand(content: string, priority: number = 75): InjectionPayload {
    return createInjection(
      content,
      createTrigger('on_demand', priority),
      { maxInjections: 1 }
    );
  },
};

/**
 * Utility to batch register injections
 */
export function registerInjections(
  injector: ContextInjector,
  payloads: InjectionPayload[]
): void {
  for (const payload of payloads) {
    injector.register(payload);
  }
}

/**
 * Utility to create context-aware injections
 */
export function createContextAwareInjections(
  taskContext: string,
  currentFile?: string
): InjectionPayload[] {
  const injections: InjectionPayload[] = [];

  // Always inject task context at start
  injections.push(
    InjectionPatterns.atStart(`Current Task: ${taskContext}`, 100)
  );

  // Inject file-specific guidance if working with a file
  if (currentFile) {
    injections.push(
      InjectionPatterns.whenFileType(
        `Working with file: ${currentFile}`,
        currentFile.split('.').pop() || '',
        60
      )
    );
  }

  return injections;
}
