import { projectService } from '../services/projectService';
import { sessionService } from '../services/sessionService';
import { planService } from '../services/planService';

describe('ProjectService', () => {
  beforeEach(() => {
    (projectService as unknown as { projects: Map<string, unknown> }).projects.clear();
  });

  test('should create a project', async () => {
    const project = await projectService.create({
      name: 'test-project',
      path: '/home/user/test-project',
      config: { maxAgents: 5 }
    });

    expect(project.id).toMatch(/^proj_/);
    expect(project.name).toBe('test-project');
    expect(project.path).toBe('/home/user/test-project');
    expect(project.config.maxAgents).toBe(5);
  });

  test('should list projects', async () => {
    await projectService.create({ name: 'proj1', path: '/path/1' });
    await projectService.create({ name: 'proj2', path: '/path/2' });

    const projects = await projectService.list();
    expect(projects).toHaveLength(2);
  });

  test('should get a project by id', async () => {
    const created = await projectService.create({ name: 'test', path: '/test' });
    const retrieved = await projectService.get(created.id);

    expect(retrieved?.name).toBe('test');
  });

  test('should delete a project', async () => {
    const created = await projectService.create({ name: 'test', path: '/test' });
    const deleted = await projectService.delete(created.id);

    expect(deleted).toBe(true);
    expect(await projectService.get(created.id)).toBeNull();
  });
});

describe('SessionService', () => {
  beforeEach(() => {
    (sessionService as unknown as { sessions: Map<string, unknown> }).sessions.clear();
    (sessionService as unknown as { messages: Map<string, unknown> }).messages.clear();
  });

  test('should create a session', async () => {
    const session = await sessionService.create('proj_123', { maxAgents: 3 });

    expect(session.id).toMatch(/^ses_/);
    expect(session.projectId).toBe('proj_123');
    expect(session.status).toBe('initializing');
    expect(session.config.maxAgents).toBe(3);
  });

  test('should update session status', async () => {
    const session = await sessionService.create('proj_123');
    const updated = await sessionService.updateStatus(session.id, 'running');

    expect(updated?.status).toBe('running');
  });

  test('should add and list messages', async () => {
    const session = await sessionService.create('proj_123');
    
    await sessionService.addMessage(session.id, {
      role: 'user',
      content: 'Hello'
    });

    const result = await sessionService.listMessages(session.id);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe('Hello');
  });
});

describe('PlanService', () => {
  beforeEach(() => {
    (planService as unknown as { plans: Map<string, unknown> }).plans.clear();
  });

  test('should create a plan with tasks', async () => {
    const plan = await planService.create('proj_123', [
      { title: 'Task 1', status: 'pending', priority: 'high', dependencies: [] },
      { title: 'Task 2', status: 'pending', priority: 'medium', dependencies: [] }
    ]);

    expect(plan.id).toMatch(/^plan_/);
    expect(plan.tasks).toHaveLength(2);
    expect(plan.status).toBe('pending');
  });

  test('should update plan status', async () => {
    const plan = await planService.create('proj_123', [
      { title: 'Task 1', status: 'pending', priority: 'high', dependencies: [] }
    ]);

    const updated = await planService.updateStatus(plan.id, 'running');
    expect(updated?.status).toBe('running');
  });

  test('should update task status', async () => {
    const plan = await planService.create('proj_123', [
      { title: 'Task 1', status: 'pending', priority: 'high', dependencies: [] }
    ]);

    const taskId = plan.tasks[0].id;
    const updated = await planService.updateTask(plan.id, taskId, { status: 'in_progress' });

    expect(updated?.tasks[0].status).toBe('in_progress');
  });
});
