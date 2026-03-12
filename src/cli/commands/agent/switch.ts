import { Command } from 'commander';
import { primaryAgentManager, PrimaryAgentType } from '../../../agents/primary';

export function createSwitchCommand(): Command {
  const command = new Command('switch')
    .description('Switch between Build and Plan agents')
    .argument('<agent>', 'Agent type: build or plan')
    .option('--run-id <id>', 'Run ID for the agent session', 'default')
    .action(async (agent: string, options) => {
      const validAgents: PrimaryAgentType[] = ['build', 'plan'];
      
      if (!validAgents.includes(agent as PrimaryAgentType)) {
        console.error(`❌ Invalid agent type: ${agent}`);
        console.log(`   Valid options: ${validAgents.join(', ')}`);
        process.exit(1);
      }

      const agentType = agent as PrimaryAgentType;

      try {
        const currentType = primaryAgentManager.getCurrentType();
        
        if (!currentType) {
          primaryAgentManager.initialize(options.runId, agentType);
          console.log(`✅ Initialized ${agentType} agent for run: ${options.runId}`);
        } else {
          const state = primaryAgentManager.switchAgent(agentType);
          console.log(`✅ Switched from ${currentType} to ${state.currentAgent}`);
        }

        console.log(`   Prompt indicator: ${primaryAgentManager.getPromptIndicator()}`);
        
        if (agentType === 'build') {
          console.log('   Tools: write, edit, read, bash, glob, grep, webfetch');
        } else {
          console.log('   Tools: read, glob, grep, webfetch');
          console.log('   Note: Bash permission can be requested separately');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to switch agent: ${errorMessage}`);
        process.exit(1);
      }
    });

  return command;
}

export function registerSwitchCommand(program: Command): void {
  const switchCommand = createSwitchCommand();
  program.addCommand(switchCommand);
}

export default createSwitchCommand;
