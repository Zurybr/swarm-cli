import chalk from 'chalk';

export type OutputType = 'str' | 'json';

export interface OutputFormatter {
  print(data: unknown): void;
  printError(message: string): void;
  printSuccess(message: string): void;
  printInfo(message: string): void;
  printWarning(message: string): void;
}

class StringFormatter implements OutputFormatter {
  print(data: unknown): void {
    if (typeof data === 'string') {
      console.log(data);
    } else if (Array.isArray(data)) {
      data.forEach(item => console.log(item));
    } else if (typeof data === 'object' && data !== null) {
      console.log(this.formatObject(data as Record<string, unknown>, 0));
    } else {
      console.log(String(data));
    }
  }

  private formatObject(obj: Record<string, unknown>, indent: number): string {
    const spaces = '  '.repeat(indent);
    return Object.entries(obj)
      .map(([key, value]) => {
        if (value === null || value === undefined) {
          return `${spaces}${key}: -`;
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
          return `${spaces}${key}:\n${this.formatObject(value as Record<string, unknown>, indent + 1)}`;
        }
        if (Array.isArray(value)) {
          return `${spaces}${key}:\n${value.map(v => `${spaces}  - ${v}`).join('\n')}`;
        }
        return `${spaces}${key}: ${value}`;
      })
      .join('\n');
  }

  printError(message: string): void {
    console.error(chalk.red(`❌ ${message}`));
  }

  printSuccess(message: string): void {
    console.log(chalk.green(`✅ ${message}`));
  }

  printInfo(message: string): void {
    console.log(chalk.blue(`ℹ️  ${message}`));
  }

  printWarning(message: string): void {
    console.log(chalk.yellow(`⚠️  ${message}`));
  }
}

class JsonFormatter implements OutputFormatter {
  print(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }

  printError(message: string): void {
    console.log(JSON.stringify({ error: message, success: false }, null, 2));
  }

  printSuccess(message: string): void {
    console.log(JSON.stringify({ message, success: true }, null, 2));
  }

  printInfo(message: string): void {
    console.log(JSON.stringify({ info: message }, null, 2));
  }

  printWarning(message: string): void {
    console.log(JSON.stringify({ warning: message }, null, 2));
  }
}

export function createFormatter(outputType: OutputType): OutputFormatter {
  return outputType === 'json' ? new JsonFormatter() : new StringFormatter();
}

export function getOutputType(options: { json?: boolean; outputType?: string }): OutputType {
  // Support legacy --json flag
  if (options.json) return 'json';
  
  // Support new --output-type flag
  if (options.outputType === 'json') return 'json';
  if (options.outputType === 'str') return 'str';
  
  // Default to human-readable string output
  return 'str';
}
