export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  constructor(private context: string, private level: LogLevel = LogLevel.INFO) {}

  debug(msg: string, meta?: any) {
    if (this.level <= LogLevel.DEBUG) this.log('DEBUG', msg, meta);
  }

  info(msg: string, meta?: any) {
    if (this.level <= LogLevel.INFO) this.log('INFO', msg, meta);
  }

  warn(msg: string, meta?: any) {
    if (this.level <= LogLevel.WARN) this.log('WARN', msg, meta);
  }

  error(msg: string, meta?: any) {
    if (this.level <= LogLevel.ERROR) this.log('ERROR', msg, meta);
  }

  private log(level: string, msg: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const output = `[${timestamp}] [${level}] [${this.context}] ${msg}`;
    console.log(output, meta ? JSON.stringify(meta) : '');
  }
}

export const logger = new Logger('SwarmCLI');
