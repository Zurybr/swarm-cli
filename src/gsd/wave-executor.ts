/**
 * Wave-Based Parallel Execution - Issue #16
 * Ejecución paralela basada en olas con grafos de dependencias
 */

import { 
  DependencyGraph, 
  PlanNode, 
  PlanEdge, 
  WaveExecutionPlan,
  PlanFrontmatter 
} from '../types';
import { StateManager } from './state-manager';
import { GSDStatus } from './types';

export interface ExecutionHooks {
  onTaskStart?: (planId: string) => void | Promise<void>;
  onTaskComplete?: (planId: string, result: any) => void | Promise<void>;
  onTaskFail?: (planId: string, error: Error) => void | Promise<void>;
  onPlanComplete?: (planId: string) => void | Promise<void>;
  onPhaseComplete?: (phaseId: string) => void | Promise<void>;
  onBlockerEncountered?: (blocker: { planId: string; reason: string }) => void | Promise<void>;
}

export class WaveExecutor {
  private graph: DependencyGraph = { nodes: [], edges: [], waves: new Map() };
  private stateManager?: StateManager;
  private hooks: ExecutionHooks = {};
  
  /**
   * Construye el grafo de dependencias desde planes
   */
  buildDependencyGraph(plans: PlanFrontmatter[]): DependencyGraph {
    // Crear nodos
    const nodes: PlanNode[] = plans.map(plan => ({
      id: `${plan.phase}-${String(plan.plan).padStart(2, '0')}`,
      phase: plan.phase,
      plan: plan.plan,
      wave: plan.wave,
      dependencies: plan.depends_on || [],
      dependents: []
    }));
    
    // Crear mapa para búsqueda rápida
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Calcular dependents
    for (const node of nodes) {
      for (const depId of node.dependencies) {
        const depNode = nodeMap.get(depId);
        if (depNode) {
          depNode.dependents.push(node.id);
        }
      }
    }
    
    // Crear aristas
    const edges: PlanEdge[] = [];
    for (const node of nodes) {
      for (const depId of node.dependencies) {
        edges.push({ from: depId, to: node.id });
      }
    }
    
    // Detectar ciclos
    const cycle = this.detectCycle(nodes, edges);
    if (cycle) {
      throw new Error(`Ciclo detectado en dependencias: ${cycle.join(' -> ')}`);
    }
    
    // Asignar waves automáticamente si no están definidos
    this.assignWaves(nodes);
    
    // Agrupar por waves
    const waves = this.groupByWaves(nodes);
    
    this.graph = { nodes, edges, waves };
    return this.graph;
  }
  
  /**
   * Detecta ciclos en el grafo usando DFS
   */
  private detectCycle(nodes: PlanNode[], edges: PlanEdge[]): string[] | null {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const adj = this.buildAdjacencyList(edges);
    
    const dfs = (nodeId: string, path: string[]): string[] | null => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const neighbors = adj.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const cycle = dfs(neighbor, [...path, neighbor]);
          if (cycle) return cycle;
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          return [...path.slice(cycleStart), neighbor];
        }
      }
      
      recursionStack.delete(nodeId);
      return null;
    };
    
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const cycle = dfs(node.id, [node.id]);
        if (cycle) return cycle;
      }
    }
    
    return null;
  }
  
  /**
   * Construye lista de adyacencia
   */
  private buildAdjacencyList(edges: PlanEdge[]): Map<string, string[]> {
    const adj = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adj.has(edge.from)) {
        adj.set(edge.from, []);
      }
      adj.get(edge.from)!.push(edge.to);
    }
    return adj;
  }
  
  /**
   * Asigna números de wave basados en dependencias
   */
  private assignWaves(nodes: PlanNode[]): void {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Calcular profundidad máxima para cada nodo
    const calculateDepth = (nodeId: string, visited: Set<string>): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);
      
      const node = nodeMap.get(nodeId);
      if (!node || node.dependencies.length === 0) return 1;
      
      let maxDepth = 0;
      for (const depId of node.dependencies) {
        maxDepth = Math.max(maxDepth, calculateDepth(depId, new Set(visited)));
      }
      
      return maxDepth + 1;
    };
    
    for (const node of nodes) {
      if (node.wave === 0 || node.wave === undefined) {
        node.wave = calculateDepth(node.id, new Set());
      }
    }
  }
  
  /**
   * Agrupa nodos por waves
   */
  private groupByWaves(nodes: PlanNode[]): Map<number, PlanNode[]> {
    const waves = new Map<number, PlanNode[]>();
    
    for (const node of nodes) {
      const waveNum = node.wave || 1;
      if (!waves.has(waveNum)) {
        waves.set(waveNum, []);
      }
      waves.get(waveNum)!.push(node);
    }
    
    return waves;
  }
  
  /**
   * Obtiene el plan de ejecución por waves
   */
  getExecutionPlan(): WaveExecutionPlan[] {
    const sortedWaves = Array.from(this.graph.waves.entries())
      .sort(([a], [b]) => a - b);
    
    return sortedWaves.map(([waveNum, plans]) => ({
      waveNumber: waveNum,
      plans,
      canExecuteInParallel: plans.length > 1
    }));
  }
  
  /**
   * Ejecuta las waves secuencialmente
   */
  async executeWaves<T>(
    executor: (plan: PlanNode) => Promise<T>,
    onWaveStart?: (waveNum: number, totalWaves: number) => void,
    onWaveComplete?: (waveNum: number, results: T[]) => void
  ): Promise<Map<number, T[]>> {
    const executionPlan = this.getExecutionPlan();
    const results = new Map<number, T[]>();
    
    for (const wave of executionPlan) {
      onWaveStart?.(wave.waveNumber, executionPlan.length);
      
      // Ejecutar planes en paralelo dentro de la wave
      const waveResults = await Promise.all(
        wave.plans.map(plan => executor(plan))
      );
      
      results.set(wave.waveNumber, waveResults);
      onWaveComplete?.(wave.waveNumber, waveResults);
    }
    
    return results;
  }
  
  /**
   * Obtiene los planes que pueden ejecutarse (todas sus dependencias completadas)
   */
  getExecutablePlans(completedPlanIds: string[]): PlanNode[] {
    return this.graph.nodes.filter(node => {
      // Ya completado
      if (completedPlanIds.includes(node.id)) return false;
      
      // Todas las dependencias completadas
      return node.dependencies.every(depId => completedPlanIds.includes(depId));
    });
  }

  /**
   * Configura el StateManager para auto-actualización
   */
  setStateManager(stateManager: StateManager): void {
    this.stateManager = stateManager;
  }

  /**
   * Configura los hooks de ejecución
   */
  setHooks(hooks: ExecutionHooks): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  /**
   * Actualiza el estado automáticamente
   */
  private async updateStateOnComplete(planId: string): Promise<void> {
    if (!this.stateManager) return;

    const [phase, planNum] = planId.split('-');
    const currentPos = this.stateManager.getState().current_position;

    if (currentPos.current_phase === phase && currentPos.current_plan === planNum) {
      this.stateManager.updatePosition({
        current_task: (currentPos.current_task || 0) + 1,
      });
    }

    this.stateManager.updateProgress({
      plans_completed: (this.stateManager.getState().progress_summary.plans_completed || 0) + 1,
    });

    await this.stateManager.save();
  }

  /**
   * Marca un plan como completado en el estado
   */
  async markPlanComplete(planId: string): Promise<void> {
    if (!this.stateManager) return;

    const [phase, plan] = planId.split('-');
    
    const completedPlans = this.stateManager.getCompletedPlans();
    if (!completedPlans.includes(planId)) {
      this.stateManager.completePhase(phase, [...completedPlans, planId]);
    }

    await this.updateStateOnComplete(planId);
    this.hooks.onPlanComplete?.(planId);
  }

  /**
   * Registra un blocker en el estado
   */
  async addBlocker(planId: string, reason: string): Promise<void> {
    if (!this.stateManager) return;
    
    console.warn(`⚠ Blocker detected for ${planId}: ${reason}`);
    this.hooks.onBlockerEncountered?.({ planId, reason });
  }

  /**
   * Obtiene la posición actual del estado
   */
  getCurrentPosition(): { phase: string; plan: string; task: number; status: GSDStatus } | null {
    if (!this.stateManager) return null;
    
    const state = this.stateManager.getState();
    return {
      phase: state.current_position.current_phase,
      plan: state.current_position.current_plan,
      task: state.current_position.current_task,
      status: state.current_position.status,
    };
  }
  
  /**
   * Obtiene el orden topológico de los planes
   */
  getTopologicalOrder(): PlanNode[] {
    const visited = new Set<string>();
    const result: PlanNode[] = [];
    const nodeMap = new Map(this.graph.nodes.map(n => [n.id, n]));
    
    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = nodeMap.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          visit(depId);
        }
        result.push(node);
      }
    };
    
    for (const node of this.graph.nodes) {
      visit(node.id);
    }
    
    return result;
  }
  
  /**
   * Visualiza el grafo de dependencias (para debugging)
   */
  visualizeGraph(): string {
    const lines: string[] = ['Dependency Graph:'];
    
    for (const [waveNum, plans] of this.graph.waves) {
      lines.push(`\nWave ${waveNum}:`);
      for (const plan of plans) {
        const deps = plan.dependencies.length > 0 
          ? ` (depends on: ${plan.dependencies.join(', ')})` 
          : '';
        lines.push(`  - ${plan.id}${deps}`);
      }
    }
    
    return lines.join('\n');
  }
}
