import * as readline from 'readline';
import { PermissionContext, PermissionResult } from './permission-checker';
import { PermissionConfig, rememberChoice, savePermissionConfig } from './permission-config';

export interface PromptOptions {
  remember?: boolean;
  always?: boolean;
  never?: boolean;
}

export interface PromptResult {
  allowed: boolean;
  remember: boolean;
}

export class PermissionPrompt {
  private rl: readline.Interface | null = null;
  private config: PermissionConfig;
  private configPath?: string;

  constructor(config: PermissionConfig, configPath?: string) {
    this.config = config;
    this.configPath = configPath;
  }

  async prompt(context: PermissionContext, result: PermissionResult): Promise<PromptResult> {
    if (!result.requiresPrompt) {
      return { allowed: result.allowed, remember: false };
    }

    console.log(`\n⚠️  Permission Request`);
    console.log(`Tool: ${context.tool}`);
    if (context.args) {
      console.log(`Args: ${JSON.stringify(context.args)}`);
    }
    console.log(`Reason: ${result.reason}`);
    console.log('');

    const answer = await this.ask('Allow this action? (y/n/a=always/n=never): ');
    
    let allowed: boolean;
    let remember = false;

    switch (answer.toLowerCase()) {
      case 'y':
      case 'yes':
        allowed = true;
        const rememberAns = await this.ask('Remember this choice? (y/n): ');
        remember = rememberAns.toLowerCase() === 'y';
        break;
      case 'a':
      case 'always':
        allowed = true;
        remember = true;
        break;
      case 'n':
      case 'no':
        allowed = false;
        break;
      case 'never':
        allowed = false;
        remember = true;
        break;
      default:
        allowed = false;
        console.log('Invalid response, defaulting to deny.');
    }

    if (remember) {
      this.config = rememberChoice(this.config, context.tool, allowed);
      savePermissionConfig(this.config, this.configPath);
      console.log(`✓ Choice remembered for ${context.tool}`);
    }

    return { allowed, remember };
  }

  private ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      this.rl.question(question, (answer) => {
        this.rl?.close();
        this.rl = null;
        resolve(answer);
      });
    });
  }

  updateConfig(config: PermissionConfig): void {
    this.config = config;
  }
}

export async function promptUser(
  context: PermissionContext,
  result: PermissionResult,
  config: PermissionConfig,
  configPath?: string
): Promise<PromptResult> {
  const prompter = new PermissionPrompt(config, configPath);
  return prompter.prompt(context, result);
}

export async function autoApproveIfSafe(result: PermissionResult): Promise<boolean> {
  if (result.level === 'auto' && result.allowed) {
    return true;
  }
  return false;
}
