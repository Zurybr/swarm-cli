import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';

const logger = new Logger('Worktree');

export interface Worktree {
  path: string;
  branch: string;
  issueNumber: number;
  isActive: boolean;
}

export class WorktreeManager {
  constructor(private basePath: string) {
    // Ensure worktrees directory exists
    const worktreesDir = path.join(basePath, '.worktrees');
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }
  }

  createWorktree(issueNumber: number, branchName?: string): Worktree {
    const actualBranchName = branchName || `issue-${issueNumber}`;
    const worktreePath = path.join(this.basePath, '.worktrees', `issue-${issueNumber}`);
    
    try {
      // Check if branch exists locally
      const branches = execSync('git branch --list', { 
        cwd: this.basePath,
        encoding: 'utf-8'
      });
      
      const branchExists = branches.split('\n').some(b => b.trim() === actualBranchName || b.trim() === `* ${actualBranchName}`);
      
      if (!branchExists) {
        // Create branch from current HEAD
        execSync(`git branch ${actualBranchName}`, { cwd: this.basePath });
        logger.info(`Created branch: ${actualBranchName}`);
      }
      
      // Check if worktree already exists
      if (fs.existsSync(worktreePath)) {
        logger.warn(`Worktree for issue #${issueNumber} already exists at ${worktreePath}`);
        return {
          path: worktreePath,
          branch: actualBranchName,
          issueNumber,
          isActive: true
        };
      }
      
      // Create worktree
      execSync(`git worktree add ${worktreePath} ${actualBranchName}`, { 
        cwd: this.basePath,
        stdio: 'pipe'
      });
      
      logger.info(`Created worktree for issue #${issueNumber} at ${worktreePath}`);
      
      return {
        path: worktreePath,
        branch: actualBranchName,
        issueNumber,
        isActive: true
      };
    } catch (error) {
      logger.error(`Failed to create worktree for issue #${issueNumber}`, error);
      throw error;
    }
  }

  removeWorktree(issueNumber: number): void {
    const worktreePath = path.join(this.basePath, '.worktrees', `issue-${issueNumber}`);
    
    try {
      if (!fs.existsSync(worktreePath)) {
        logger.warn(`Worktree for issue #${issueNumber} does not exist`);
        return;
      }
      
      // Remove worktree
      execSync(`git worktree remove ${worktreePath}`, { 
        cwd: this.basePath,
        stdio: 'pipe'
      });
      
      logger.info(`Removed worktree for issue #${issueNumber}`);
    } catch (error) {
      logger.error(`Failed to remove worktree for issue #${issueNumber}`, error);
      throw error;
    }
  }

  mergeWorktree(
    issueNumber: number, 
    targetBranch: string = 'main',
    deleteAfterMerge: boolean = false
  ): void {
    const worktree = this.getWorktree(issueNumber);
    
    if (!worktree) {
      throw new Error(`Worktree for issue #${issueNumber} not found`);
    }
    
    try {
      // Ensure target branch exists and checkout
      execSync(`git checkout ${targetBranch}`, { 
        cwd: this.basePath,
        stdio: 'pipe'
      });
      
      // Merge worktree branch
      execSync(
        `git merge ${worktree.branch} --no-ff -m "Merge worktree for issue #${issueNumber}"`, 
        { cwd: this.basePath, stdio: 'pipe' }
      );
      
      logger.info(`Merged worktree for issue #${issueNumber} into ${targetBranch}`);
      
      // Optionally remove worktree after merge
      if (deleteAfterMerge) {
        this.removeWorktree(issueNumber);
      }
    } catch (error) {
      logger.error(`Failed to merge worktree for issue #${issueNumber}`, error);
      
      // Attempt to abort merge if in progress
      try {
        execSync('git merge --abort', { cwd: this.basePath, stdio: 'pipe' });
        logger.info('Merge aborted');
      } catch {
        // Ignore abort error
      }
      
      throw error;
    }
  }

  listWorktrees(): Worktree[] {
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: this.basePath,
        encoding: 'utf-8'
      });
      
      const worktrees: Worktree[] = [];
      const entries = output.split('\n\n');
      
      for (const entry of entries) {
        const lines = entry.split('\n');
        const worktreeLine = lines.find(l => l.startsWith('worktree '));
        const branchLine = lines.find(l => l.startsWith('branch '));
        
        if (worktreeLine) {
          const worktreePath = worktreeLine.replace('worktree ', '');
          const branch = branchLine ? branchLine.replace('branch refs/heads/', '') : 'unknown';
          
          // Extract issue number from path
          const match = worktreePath.match(/issue-(\d+)$/);
          const issueNumber = match ? parseInt(match[1]) : 0;
          
          if (issueNumber > 0) {
            worktrees.push({
              path: worktreePath,
              branch,
              issueNumber,
              isActive: fs.existsSync(worktreePath)
            });
          }
        }
      }
      
      return worktrees;
    } catch (error) {
      logger.error('Failed to list worktrees', error);
      return [];
    }
  }

  private getWorktree(issueNumber: number): Worktree | null {
    const worktrees = this.listWorktrees();
    return worktrees.find(w => w.issueNumber === issueNumber) || null;
  }

  cleanInactiveWorktrees(): void {
    const worktrees = this.listWorktrees();
    
    for (const worktree of worktrees) {
      if (!worktree.isActive) {
        try {
          this.removeWorktree(worktree.issueNumber);
        } catch (error) {
          logger.error(`Failed to clean worktree for issue #${worktree.issueNumber}`, error);
        }
      }
    }
  }
}
