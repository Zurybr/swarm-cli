import crypto from 'crypto';
import { Plan, PlanTask, PlanStatus } from '../../types/api';

function generateId(prefix: string): string {
  const randomBytes = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${randomBytes}`;
}

class PlanService {
  private plans: Map<string, Plan> = new Map();

  async list(projectId: string): Promise<Plan[]> {
    return Array.from(this.plans.values()).filter(p => p.projectId === projectId);
  }

  async get(projectId: string, planId: string): Promise<Plan | null> {
    const plan = this.plans.get(planId);
    return plan && plan.projectId === projectId ? plan : null;
  }

  async create(projectId: string, tasks: Omit<PlanTask, 'id'>[]): Promise<Plan> {
    const now = new Date().toISOString();
    const plan: Plan = {
      id: generateId('plan'),
      projectId,
      status: 'pending',
      tasks: tasks.map(t => ({ ...t, id: generateId('task') })),
      wave: 1,
      createdAt: now,
      updatedAt: now
    };
    
    this.plans.set(plan.id, plan);
    return plan;
  }

  async updateStatus(planId: string, status: PlanStatus): Promise<Plan | null> {
    const plan = this.plans.get(planId);
    if (!plan) return null;
    
    plan.status = status;
    plan.updatedAt = new Date().toISOString();
    return plan;
  }

  async updateTask(planId: string, taskId: string, updates: Partial<PlanTask>): Promise<Plan | null> {
    const plan = this.plans.get(planId);
    if (!plan) return null;
    
    const taskIndex = plan.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return null;
    
    plan.tasks[taskIndex] = { ...plan.tasks[taskIndex], ...updates };
    plan.updatedAt = new Date().toISOString();
    return plan;
  }

  async delete(projectId: string, planId: string): Promise<boolean> {
    const plan = this.plans.get(planId);
    if (!plan || plan.projectId !== projectId) return false;
    
    return this.plans.delete(planId);
  }
}

export const planService = new PlanService();
