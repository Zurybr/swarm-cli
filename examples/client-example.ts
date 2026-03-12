import { SwarmClient, Auth } from '../src/client';

async function main() {
  const auth: Auth = {
    apiKey: process.env.SWARM_API_KEY,
    token: process.env.SWARM_TOKEN,
  };

  const client = new SwarmClient('http://localhost:3000/api');

  await client.connect('http://localhost:3000', auth);

  client.onMessage((msg) => {
    console.log('[Message]', msg.role, ':', msg.content);
  });

  client.onTaskEvent((event) => {
    console.log('[Task]', event.taskId, event.status);
  });

  client.onSessionStatus((status) => {
    console.log('[Session]', status.sessionId, '->', status.status);
  });

  client.onError((error) => {
    console.error('[Error]', error.message);
  });

  console.log('Listing projects...');
  const projects = await client.listProjects();
  console.log(`Found ${projects.length} projects`);

  if (projects.length > 0) {
    const project = projects[0];
    console.log(`\nUsing project: ${project.name}`);

    const sessions = await client.listSessions(project.id);
    console.log(`Found ${sessions.length} sessions`);

    if (sessions.length > 0) {
      const session = sessions[0];
      console.log(`\nSubscribing to session: ${session.id}`);
      await client.subscribeToSession(project.id, session.id);

      const messages = await client.listMessages(project.id, session.id);
      console.log(`Found ${messages.messages.length} messages`);

      const files = await client.listFiles(project.id, session.id);
      console.log(`Found ${files.length} files`);

      const fileStatus = await client.getFileStatus(project.id, session.id);
      console.log(`File status retrieved for ${fileStatus.length} files`);

      client.unsubscribeFromSession();
    }

    const plans = await client.listPlans(project.id);
    console.log(`Found ${plans.length} plans`);
  }

  client.disconnect();
  console.log('\nDone!');
}

main().catch(console.error);
