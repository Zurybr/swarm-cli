/**
 * Hive Example Usage
 *
 * Demonstrates the key features of the Hive git-backed persistence system.
 */

import { Hive, Cell, CellStatus } from './index';

async function example() {
  // Initialize Hive
  const hive = new Hive({
    baseDir: '.hive',
    enableGit: true,
    autoCommit: true,
  });
  await hive.init();

  try {
    // Create an epic (large body of work)
    const epic = await hive.createCell({
      title: 'Implement User Authentication',
      description: 'Full authentication system with login, signup, and password reset',
      type: 'epic',
      priority: 10,
      tags: ['auth', 'security', 'backend'],
    });

    console.log(`Created epic: ${epic.id} - ${epic.title}`);

    // Create tasks under the epic
    const loginTask = await hive.createCell({
      title: 'Implement login endpoint',
      type: 'task',
      parentId: epic.id,
      priority: 9,
      tags: ['auth', 'api'],
      owner: 'backend-dev',
    });

    const signupTask = await hive.createCell({
      title: 'Implement signup endpoint',
      type: 'task',
      parentId: epic.id,
      priority: 9,
      tags: ['auth', 'api'],
      owner: 'backend-dev',
    });

    console.log(`Created tasks: ${loginTask.id}, ${signupTask.id}`);

    // Transition task status
    await hive.transitionStatus(loginTask.id, 'in_progress', 'Starting work', 'backend-dev');
    console.log(`Task ${loginTask.id} is now in progress`);

    // Query open tasks
    const openTasks = await hive.query({
      status: 'open',
      type: 'task',
    });
    console.log(`Open tasks: ${openTasks.length}`);

    // Get next ready task (highest priority)
    const nextTask = await hive.getNextReady();
    console.log(`Next ready task: ${nextTask?.title}`);

    // Get statistics
    const stats = await hive.getStats();
    console.log('Hive stats:', stats);

    // Update task
    await hive.updateCell(loginTask.id, {
      status: 'completed',
      statusReason: 'Implementation done, tests passing',
    }, 'backend-dev');

    // Clone a task
    const clonedTask = await hive.cloneCell(signupTask.id, {
      title: 'Clone: Implement signup endpoint',
    });
    console.log(`Cloned task: ${clonedTask.id}`);

    // Get git status
    const gitStatus = await hive.getGitStatus();
    console.log('Git status:', gitStatus);

    // Manual commit example (when autoCommit is false)
    // await hive.commit('Manual commit message');

  } finally {
    // Cleanup
    await hive.close();
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
}

export { example };
