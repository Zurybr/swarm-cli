# Swarm CLI API Quick Reference

## Base URL
```
http://localhost:3000/api
```

## Authentication

```bash
# API Key
curl -H "X-API-Key: your-api-key" ...

# JWT
curl -H "Authorization: Bearer your-jwt-token" ...
```

---

## Projects

```bash
# List projects
curl http://localhost:3000/api/projects

# Create project
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "my-project", "path": "/path/to/project"}'

# Get project
curl http://localhost:3000/api/projects/:id

# Delete project
curl -X DELETE http://localhost:3000/api/projects/:id
```

---

## Sessions

```bash
# List sessions
curl http://localhost:3000/api/projects/:projectId/sessions

# Create session
curl -X POST http://localhost:3000/api/projects/:projectId/sessions \
  -H "Content-Type: application/json" \
  -d '{"config": {"maxAgents": 5}}'

# Get session
curl http://localhost:3000/api/projects/:projectId/sessions/:sessionId

# Delete session
curl -X DELETE http://localhost:3000/api/projects/:projectId/sessions/:sessionId
```

---

## Session Control

```bash
# Initialize session
curl -X POST http://localhost:3000/api/projects/:projectId/sessions/:sessionId/init \
  -H "Content-Type: application/json" \
  -d '{"spec": "implement auth"}'

# Abort session
curl -X POST http://localhost:3000/api/projects/:projectId/sessions/:sessionId/abort

# Pause session
curl -X POST http://localhost:3000/api/projects/:projectId/sessions/:sessionId/pause

# Resume session
curl -X POST http://localhost:3000/api/projects/:projectId/sessions/:sessionId/resume
```

---

## Messages

```bash
# List messages
curl "http://localhost:3000/api/projects/:projectId/sessions/:sessionId/messages?limit=50"

# Send message
curl -X POST http://localhost:3000/api/projects/:projectId/sessions/:sessionId/messages \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "Hello"}'

# Get message
curl http://localhost:3000/api/projects/:projectId/sessions/:sessionId/messages/:messageId
```

---

## Files

```bash
# List files
curl http://localhost:3000/api/projects/:projectId/sessions/:sessionId/files

# Get file content
curl "http://localhost:3000/api/projects/:projectId/sessions/:sessionId/files/src/index.ts"

# Get file status
curl http://localhost:3000/api/projects/:projectId/sessions/:sessionId/files/status
```

---

## Plans

```bash
# List plans
curl http://localhost:3000/api/projects/:projectId/plans

# Execute plan
curl -X POST http://localhost:3000/api/projects/:projectId/plans/:planId/execute

# Get plan status
curl http://localhost:3000/api/projects/:projectId/plans/:planId/status

# Cancel plan
curl -X POST http://localhost:3000/api/projects/:projectId/plans/:planId/cancel
```

---

## WebSocket

```javascript
const socket = new WebSocket('ws://localhost:3000/projects/proj_abc/sessions/ses_xyz/stream');

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data);
};
```

---

## Health Check

```bash
curl http://localhost:3000/health
```
