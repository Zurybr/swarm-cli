/**
 * Expert CLI Commands
 *
 * Provides CLI commands for expert analysis:
 * - security-scan: Scan code for security vulnerabilities and secrets
 * - perf-analyze: Analyze code complexity and identify performance bottlenecks
 * - doc-check: Check documentation coverage and detect drift
 */

import { Command } from 'commander';
import { securityScanCommand } from './commands/security-scan';
import { perfAnalyzeCommand } from './commands/perf-analyze';
import { docCheckCommand } from './commands/doc-check';

/**
 * Register all expert commands with the CLI program
 * @param program - Commander program instance
 */
export function registerExpertCommands(program: Command): void {
  securityScanCommand(program);
  perfAnalyzeCommand(program);
  docCheckCommand(program);
}

// Re-export individual commands for testing
export { securityScanCommand } from './commands/security-scan';
export { perfAnalyzeCommand } from './commands/perf-analyze';
export { docCheckCommand } from './commands/doc-check';
