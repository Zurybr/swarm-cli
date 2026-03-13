import { HttpClient } from './httpClient';
import { WebSocketClient } from './websocketClient';
import { EventEmitter, mapWebSocketMessage } from './events';
import type {
  Auth,
  Project,
  ProjectConfig,
  Session,
  SessionConfig,
  Message,
  Plan,
  File,
  FileContent,
  FileStatusResult,
  InitSessionRequest,
  ListMessagesOptions,
  MessageListResponse,
  ProjectListResponse,
  ProjectResponse,
  SessionListResponse,
  SessionResponse,
  MessageResponse,
  FileListResponse,
  FileContentResponse,
  FileStatusResponse,
  PlanListResponse,
  PlanResponse,
  WebSocketMessage,
} from './types';

export class SwarmClient {
  private httpClient: HttpClient;
  private wsClient: WebSocketClient | null = null;
  private eventEmitter: EventEmitter;
  private wsUrl: string;
  private currentProjectId: string | null = null;
  private currentSessionId: string | null = null;

  constructor(baseUrl: string = 'http://localhost:3000/api', wsUrl: string = 'ws://localhost:3000') {
    this.httpClient = new HttpClient(baseUrl, {});
    this.eventEmitter = new EventEmitter();
    this.wsUrl = wsUrl;
  }

  async connect(url: string, auth: Auth): Promise<void> {
    const baseUrl = url.replace(/\/$/, '');
    this.httpClient = new HttpClient(`${baseUrl}/api`, auth);
    this.wsUrl = baseUrl.replace('http', 'ws');
  }

  disconnect(): void {
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }
    this.currentProjectId = null;
    this.currentSessionId = null;
  }

  async listProjects(): Promise<Project[]> {
    const response = await this.httpClient.get<ProjectListResponse>('/projects');
    return response.projects;
  }

  async createProject(config: ProjectConfig & { name: string; path: string }): Promise<Project> {
    const response = await this.httpClient.post<ProjectResponse>('/projects', config);
    return response.project;
  }

  async getProject(id: string): Promise<Project> {
    const response = await this.httpClient.get<ProjectResponse>(`/projects/${id}`);
    return response.project;
  }

  async deleteProject(id: string): Promise<void> {
    await this.httpClient.delete(`/projects/${id}`);
  }

  async createSession(projectId: string, config?: SessionConfig): Promise<Session> {
    const response = await this.httpClient.post<SessionResponse>(
      `/projects/${projectId}/sessions`,
      { config }
    );
    return response.session;
  }

  async listSessions(projectId: string): Promise<Session[]> {
    const response = await this.httpClient.get<SessionListResponse>(
      `/projects/${projectId}/sessions`
    );
    return response.sessions;
  }

  async getSession(projectId: string, sessionId: string): Promise<Session> {
    const response = await this.httpClient.get<SessionResponse>(
      `/projects/${projectId}/sessions/${sessionId}`
    );
    return response.session;
  }

  async deleteSession(projectId: string, sessionId: string): Promise<void> {
    await this.httpClient.delete(`/projects/${projectId}/sessions/${sessionId}`);
  }

  async initSession(projectId: string, sessionId: string, spec?: string): Promise<Session> {
    const request: InitSessionRequest = spec ? { spec } : {};
    const response = await this.httpClient.post<SessionResponse>(
      `/projects/${projectId}/sessions/${sessionId}/init`,
      request
    );
    return response.session;
  }

  async abortSession(projectId: string, sessionId: string): Promise<Session> {
    const response = await this.httpClient.post<SessionResponse>(
      `/projects/${projectId}/sessions/${sessionId}/abort`
    );
    return response.session;
  }

  async pauseSession(projectId: string, sessionId: string): Promise<Session> {
    const response = await this.httpClient.post<SessionResponse>(
      `/projects/${projectId}/sessions/${sessionId}/pause`
    );
    return response.session;
  }

  async resumeSession(projectId: string, sessionId: string): Promise<Session> {
    const response = await this.httpClient.post<SessionResponse>(
      `/projects/${projectId}/sessions/${sessionId}/resume`
    );
    return response.session;
  }

  async listMessages(projectId: string, sessionId: string, options?: ListMessagesOptions): Promise<MessageListResponse> {
    const params: Record<string, string> = {};
    if (options?.limit) params.limit = String(options.limit);
    if (options?.offset) params.offset = String(options.offset);
    if (options?.role) params.role = options.role;

    return this.httpClient.get<MessageListResponse>(
      `/projects/${projectId}/sessions/${sessionId}/messages`,
      Object.keys(params).length > 0 ? params : undefined
    );
  }

  async sendMessage(projectId: string, sessionId: string, message: { role: string; content: string; metadata?: Record<string, unknown> }): Promise<Message> {
    const response = await this.httpClient.post<MessageResponse>(
      `/projects/${projectId}/sessions/${sessionId}/messages`,
      message
    );
    return response.message;
  }

  async listFiles(projectId: string, sessionId: string): Promise<File[]> {
    const response = await this.httpClient.get<FileListResponse>(
      `/projects/${projectId}/sessions/${sessionId}/files`
    );
    return response.files;
  }

  async getFileContent(projectId: string, sessionId: string, path: string): Promise<FileContent> {
    const encodedPath = encodeURIComponent(path);
    return this.httpClient.get<FileContentResponse>(
      `/projects/${projectId}/sessions/${sessionId}/files/${encodedPath}`
    );
  }

  async getFileStatus(projectId: string, sessionId: string): Promise<FileStatusResult[]> {
    const response = await this.httpClient.get<FileStatusResponse>(
      `/projects/${projectId}/sessions/${sessionId}/files/status`
    );
    return response.files;
  }

  async listPlans(projectId: string): Promise<Plan[]> {
    const response = await this.httpClient.get<PlanListResponse>(
      `/projects/${projectId}/plans`
    );
    return response.plans;
  }

  async executePlan(projectId: string, planId: string): Promise<Plan> {
    const response = await this.httpClient.post<PlanResponse>(
      `/projects/${projectId}/plans/${planId}/execute`
    );
    return response.plan;
  }

  async getPlanStatus(projectId: string, planId: string): Promise<Plan> {
    const response = await this.httpClient.get<PlanResponse>(
      `/projects/${projectId}/plans/${planId}/status`
    );
    return response.plan;
  }

  async cancelPlan(projectId: string, planId: string): Promise<Plan> {
    const response = await this.httpClient.post<PlanResponse>(
      `/projects/${projectId}/plans/${planId}/cancel`
    );
    return response.plan;
  }

  onMessage(handler: (msg: Message) => void): void {
    this.eventEmitter.handleMessage = handler;
  }

  onPlanUpdate(handler: (update: { planId: string; status: string; tasks?: Plan['tasks'] }) => void): void {
    this.eventEmitter.handlePlanUpdate = handler as (update: { planId: string; status: string }) => void;
  }

  onFileChange(handler: (change: { path: string; status: string; type: 'add' | 'modify' | 'delete' }) => void): void {
    this.eventEmitter.handleFileChange = handler as (change: { path: string; status: string; type: string }) => void;
  }

  onSessionStatus(handler: (status: { sessionId: string; status: string }) => void): void {
    this.eventEmitter.handleSessionStatus = handler as (status: { sessionId: string; status: string }) => void;
  }

  onAgentEvent(handler: (event: { agentId: string; name: string; role: string; status?: string }) => void): void {
    this.eventEmitter.handleAgentEvent = handler as (event: { agentId: string; name: string; role: string; status?: string }) => void;
  }

  onTaskEvent(handler: (event: { taskId: string; title?: string; assignedTo?: string; status?: string; result?: { success: boolean; output?: string; error?: string } }) => void): void {
    this.eventEmitter.handleTaskEvent = handler as (event: { taskId: string; title?: string; status?: string }) => void;
  }

  onError(handler: (error: Error) => void): void {
    this.eventEmitter.handleError = handler;
  }

  async subscribeToSession(projectId: string, sessionId: string): Promise<void> {
    if (this.wsClient) {
      this.wsClient.disconnect();
    }

    this.currentProjectId = projectId;
    this.currentSessionId = sessionId;
    this.wsClient = new WebSocketClient(this.wsUrl);

    this.wsClient.on('message:new', (data: WebSocketMessage) => {
      if (data.message) {
        this.eventEmitter.handleMessage(data.message as Message);
      }
    });

    this.wsClient.on('plan:status', (data: WebSocketMessage) => {
      this.eventEmitter.handlePlanUpdate(data as unknown as { planId: string; status: string });
    });

    this.wsClient.on('file:change', (data: WebSocketMessage) => {
      this.eventEmitter.handleFileChange(data as unknown as { path: string; status: string; type: 'add' | 'modify' | 'delete' });
    });

    this.wsClient.on('session:status', (data: WebSocketMessage) => {
      this.eventEmitter.handleSessionStatus(data as unknown as { sessionId: string; status: 'initializing' | 'running' | 'paused' | 'completed' | 'aborted' | 'error' });
    });

    this.wsClient.on('agent:spawned', (data: WebSocketMessage) => {
      this.eventEmitter.handleAgentEvent(data as unknown as { agentId: string; name: string; role: string });
    });

    this.wsClient.on('agent:status', (data: WebSocketMessage) => {
      this.eventEmitter.handleAgentEvent(data as unknown as { agentId: string; name?: string; role?: string; status?: string });
    });

    this.wsClient.on('task:started', (data: WebSocketMessage) => {
      this.eventEmitter.handleTaskEvent(data as unknown as { taskId: string; title?: string; status: string });
    });

    this.wsClient.on('task:completed', (data: WebSocketMessage) => {
      this.eventEmitter.handleTaskEvent(data as unknown as { taskId: string; status: string });
    });

    this.wsClient.on('task:failed', (data: WebSocketMessage) => {
      this.eventEmitter.handleTaskEvent(data as unknown as { taskId: string; status: string });
    });

    this.wsClient.onError((error: Error) => {
      this.eventEmitter.handleError(error);
    });

    await this.wsClient.connect(projectId, sessionId);
  }

  unsubscribeFromSession(): void {
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }
  }
}

export { HttpClient } from './httpClient';
export { WebSocketClient } from './websocketClient';
export * from './types';
