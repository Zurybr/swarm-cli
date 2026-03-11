export interface TemperatureProfile {
  /** Base temperature for general tasks (0.0-1.0) */
  base: number;
  /** Temperature for factual/code tasks (lower = more deterministic) */
  factual: number;
  /** Temperature for creative tasks (higher = more diverse) */
  creative: number;
  /** Temperature for reasoning tasks */
  reasoning: number;
}

export interface DynamicTemperatureOptions {
  /** Enable dynamic temperature adjustment */
  enabled: boolean;
  /** Base temperature profile */
  profile: TemperatureProfile;
  /** Override with specific temperature */
  override?: number;
}

/** Default temperature profiles for different workflow phases */
export const TEMPERATURE_PROFILES: Record<string, TemperatureProfile> = {
  // High precision for coding/facts
  coding: { base: 0.7, factual: 0.1, creative: 0.3, reasoning: 0.2 },
  // Balanced for general tasks
  balanced: { base: 0.7, factual: 0.3, creative: 0.7, reasoning: 0.5 },
  // Creative for brainstorming/design
  creative: { base: 0.7, factual: 0.4, creative: 0.9, reasoning: 0.6 },
  // Research for analysis/synthesis
  research: { base: 0.7, factual: 0.2, creative: 0.5, reasoning: 0.7 },
};

/**
 * Detect the current workflow phase based on context
 */
export function detectWorkflowPhase(
  prompt: string,
  taskType?: string
): 'factual' | 'creative' | 'reasoning' {
  if (taskType) {
    const lower = taskType.toLowerCase();
    if (lower.includes('code') || lower.includes('fact') || lower.includes('data')) {
      return 'factual';
    }
    if (lower.includes('creative') || lower.includes('design') || lower.includes('brainstorm')) {
      return 'creative';
    }
    if (lower.includes('reason') || lower.includes('analyze') || lower.includes('synthesize')) {
      return 'reasoning';
    }
  }

  // Analyze prompt content
  const lowerPrompt = prompt.toLowerCase();
  
  const factualKeywords = ['code', 'implement', 'fix', 'debug', 'verify', 'calculate', 'extract'];
  const creativeKeywords = ['create', 'design', 'imagine', 'brainstorm', 'generate ideas', 'concept'];
  const reasoningKeywords = ['analyze', 'explain', 'why', 'compare', 'evaluate', 'synthesize'];

  let factualScore = factualKeywords.filter(k => lowerPrompt.includes(k)).length;
  let creativeScore = creativeKeywords.filter(k => lowerPrompt.includes(k)).length;
  let reasoningScore = reasoningKeywords.filter(k => lowerPrompt.includes(k)).length;

  if (factualScore >= creativeScore && factualScore >= reasoningScore) {
    return 'factual';
  }
  if (creativeScore >= factualScore && creativeScore >= reasoningScore) {
    return 'creative';
  }
  return 'reasoning';
}

/**
 * Calculate dynamic temperature for a task
 */
export function calculateTemperature(
  options: DynamicTemperatureOptions,
  prompt: string,
  taskType?: string
): number {
  // Return override if specified
  if (options.override !== undefined) {
    return Math.max(0, Math.min(2, options.override));
  }

  if (!options.enabled) {
    return options.profile.base;
  }

  const phase = detectWorkflowPhase(prompt, taskType);
  return options.profile[phase];
}

/**
 * Create temperature manager for a workflow
 */
export class TemperatureManager {
  private options: DynamicTemperatureOptions;
  private history: Array<{ phase: string; temp: number; timestamp: number }> = [];

  constructor(options: DynamicTemperatureOptions) {
    this.options = options;
  }

  /**
   * Get temperature for current task
   */
  getTemperature(prompt: string, taskType?: string): number {
    const temp = calculateTemperature(this.options, prompt, taskType);
    const phase = detectWorkflowPhase(prompt, taskType);
    
    this.history.push({
      phase,
      temp,
      timestamp: Date.now(),
    });

    // Keep only last 100 entries
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }

    return temp;
  }

  /**
   * Get average temperature over recent tasks
   */
  getAverageTemperature(window: number = 10): number {
    const recent = this.history.slice(-window);
    if (recent.length === 0) return this.options.profile.base;
    
    const sum = recent.reduce((acc, h) => acc + h.temp, 0);
    return sum / recent.length;
  }

  /**
   * Get temperature history
   */
  getHistory(): Array<{ phase: string; temp: number; timestamp: number }> {
    return [...this.history];
  }

  /**
   * Adjust profile on the fly
   */
  updateProfile(profile: Partial<TemperatureProfile>): void {
    this.options.profile = { ...this.options.profile, ...profile };
  }
}

/**
 * Parse CLI flags for dynamic temperature
 */
export function parseDynamicTemperatureFlags(flags: {
  dynamicTemperatureEnabled?: boolean;
  dynamicTemperature?: boolean;
  temperatureProfile?: string;
  temperature?: string;
}): DynamicTemperatureOptions {
  const profileName = flags.temperatureProfile || 'balanced';
  const profile = TEMPERATURE_PROFILES[profileName] || TEMPERATURE_PROFILES.balanced;

  return {
    enabled: flags.dynamicTemperatureEnabled === true || flags.dynamicTemperature === true,
    profile,
    override: flags.temperature ? parseFloat(flags.temperature) : undefined,
  };
}
