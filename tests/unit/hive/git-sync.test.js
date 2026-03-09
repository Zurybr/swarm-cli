"use strict";
/**
 * GitSync unit tests
 *
 * Tests for the GitSync class including commit operations,
 * rollback, and status checks.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const git_sync_1 = require("@/hive/git-sync");
const cell_1 = require("@/hive/cell");
const types_1 = require("@/hive/types");
const child_process_1 = require("child_process");
describe('GitSync', () => {
    let gitSync;
    let testDir;
    let config;
    beforeEach(async () => {
        // Create a temp directory for testing
        testDir = path.join(process.cwd(), '.hive-test-git', `test-${Date.now()}`);
        fs.mkdirSync(testDir, { recursive: true });
        // Initialize a git repo
        (0, child_process_1.execSync)('git init', { cwd: testDir });
        (0, child_process_1.execSync)('git config user.email "test@test.com"', { cwd: testDir });
        (0, child_process_1.execSync)('git config user.name "Test User"', { cwd: testDir });
        // Create initial commit
        fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');
        (0, child_process_1.execSync)('git add README.md', { cwd: testDir });
        (0, child_process_1.execSync)('git commit -m "Initial commit"', { cwd: testDir });
        // Create hive directory
        const hiveDir = path.join(testDir, '.hive');
        fs.mkdirSync(hiveDir, { recursive: true });
        config = {
            ...types_1.DEFAULT_STORAGE_CONFIG,
            baseDir: hiveDir,
            enableGit: true,
            autoCommit: true,
        };
        gitSync = new git_sync_1.GitSync(config, testDir);
        await gitSync.init();
    });
    afterEach(async () => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            await fs.promises.rm(testDir, { recursive: true, force: true });
        }
    });
    describe('init', () => {
        it('should detect git repository', async () => {
            expect(gitSync.isEnabled()).toBe(true);
        });
        it('should detect non-git directory', async () => {
            const nonGitDir = path.join(process.cwd(), '.hive-test-no-git', `test-${Date.now()}`);
            fs.mkdirSync(nonGitDir, { recursive: true });
            const sync = new git_sync_1.GitSync(config, nonGitDir);
            await sync.init();
            expect(sync.isEnabled()).toBe(false);
            await fs.promises.rm(nonGitDir, { recursive: true, force: true });
        });
        it('should be disabled when enableGit is false', async () => {
            const disabledConfig = { ...config, enableGit: false };
            const sync = new git_sync_1.GitSync(disabledConfig, testDir);
            await sync.init();
            expect(sync.isEnabled()).toBe(false);
        });
    });
    describe('hasChanges', () => {
        it('should return false when no changes', async () => {
            const hasChanges = await gitSync.hasChanges();
            expect(hasChanges).toBe(false);
        });
        it('should return true when there are changes', async () => {
            // Create a file in the hive directory
            fs.writeFileSync(path.join(config.baseDir, 'test.txt'), 'test');
            const hasChanges = await gitSync.hasChanges();
            expect(hasChanges).toBe(true);
        });
    });
    describe('stageChanges', () => {
        it('should stage changes in hive directory', async () => {
            fs.writeFileSync(path.join(config.baseDir, 'test.txt'), 'test');
            const result = await gitSync.stageChanges();
            expect(result.success).toBe(true);
            // Check that file is staged
            const status = (0, child_process_1.execSync)('git status --porcelain', { cwd: testDir, encoding: 'utf-8' });
            expect(status).toContain('.hive/test.txt');
        });
        it('should succeed when no changes', async () => {
            const result = await gitSync.stageChanges();
            expect(result.success).toBe(true);
        });
        it('should succeed when disabled', async () => {
            const disabledConfig = { ...config, enableGit: false };
            const sync = new git_sync_1.GitSync(disabledConfig, testDir);
            await sync.init();
            const result = await sync.stageChanges();
            expect(result.success).toBe(true);
        });
    });
    describe('commit', () => {
        it('should commit changes with generated message', async () => {
            const cell = cell_1.Cell.create({ title: 'Test Cell' });
            fs.writeFileSync(path.join(config.baseDir, 'test.txt'), 'test');
            const result = await gitSync.commit(cell, 'create');
            expect(result.success).toBe(true);
            expect(result.commitHash).toBeDefined();
            // Verify commit was made with the cell's actual ID
            const log = (0, child_process_1.execSync)('git log -1 --format=%s', { cwd: testDir, encoding: 'utf-8' });
            expect(log).toContain(`hive(${cell.id}): create Test Cell`);
        });
        it('should use custom message when provided', async () => {
            const cell = cell_1.Cell.create({ title: 'Test Cell', id: 'test-123' });
            fs.writeFileSync(path.join(config.baseDir, 'test.txt'), 'test');
            const result = await gitSync.commit(cell, 'update', 'Custom commit message');
            expect(result.success).toBe(true);
            const log = (0, child_process_1.execSync)('git log -1 --format=%s', { cwd: testDir, encoding: 'utf-8' });
            expect(log.trim()).toBe('Custom commit message');
        });
        it('should succeed when no changes', async () => {
            const cell = cell_1.Cell.create({ title: 'Test Cell' });
            const result = await gitSync.commit(cell, 'create');
            expect(result.success).toBe(true);
        });
        it('should succeed when disabled', async () => {
            const disabledConfig = { ...config, enableGit: false };
            const sync = new git_sync_1.GitSync(disabledConfig, testDir);
            await sync.init();
            const cell = cell_1.Cell.create({ title: 'Test Cell' });
            const result = await sync.commit(cell, 'create');
            expect(result.success).toBe(true);
        });
    });
    describe('rollback', () => {
        it('should rollback to previous commit', async () => {
            // Create initial state
            fs.writeFileSync(path.join(config.baseDir, 'file1.txt'), 'content1');
            (0, child_process_1.execSync)('git add .', { cwd: testDir });
            (0, child_process_1.execSync)('git commit -m "First commit"', { cwd: testDir });
            const firstCommit = (0, child_process_1.execSync)('git rev-parse HEAD', { cwd: testDir, encoding: 'utf-8' }).trim();
            // Create second state
            fs.writeFileSync(path.join(config.baseDir, 'file2.txt'), 'content2');
            (0, child_process_1.execSync)('git add .', { cwd: testDir });
            (0, child_process_1.execSync)('git commit -m "Second commit"', { cwd: testDir });
            // Verify second file exists
            expect(fs.existsSync(path.join(config.baseDir, 'file2.txt'))).toBe(true);
            // Rollback to first commit
            const result = await gitSync.rollback(firstCommit);
            expect(result.success).toBe(true);
            expect(fs.existsSync(path.join(config.baseDir, 'file2.txt'))).toBe(false);
            expect(fs.existsSync(path.join(config.baseDir, 'file1.txt'))).toBe(true);
        });
        it('should fail when disabled', async () => {
            const disabledConfig = { ...config, enableGit: false };
            const sync = new git_sync_1.GitSync(disabledConfig, testDir);
            await sync.init();
            const result = await sync.rollback('abc123');
            expect(result.success).toBe(false);
            expect(result.error).toContain('not enabled');
        });
    });
    describe('getStatus', () => {
        it('should return git status', async () => {
            const status = await gitSync.getStatus();
            expect(status.isRepo).toBe(true);
            expect(status.enabled).toBe(true);
            expect(status.hasChanges).toBe(false);
            expect(status.currentBranch).toBeDefined();
        });
        it('should detect changes in status', async () => {
            fs.writeFileSync(path.join(config.baseDir, 'test.txt'), 'test');
            const status = await gitSync.getStatus();
            expect(status.hasChanges).toBe(true);
        });
        it('should return non-repo status for non-git directory', async () => {
            const nonGitDir = path.join(process.cwd(), '.hive-test-no-git', `test-${Date.now()}`);
            fs.mkdirSync(nonGitDir, { recursive: true });
            const sync = new git_sync_1.GitSync(config, nonGitDir);
            await sync.init();
            const status = await sync.getStatus();
            expect(status.isRepo).toBe(false);
            expect(status.enabled).toBe(false);
            await fs.promises.rm(nonGitDir, { recursive: true, force: true });
        });
    });
    describe('getLastHiveCommit', () => {
        it('should return undefined when no hive commits', async () => {
            const hash = await gitSync.getLastHiveCommit();
            expect(hash).toBeUndefined();
        });
        it('should return hash of last hive commit', async () => {
            const cell = cell_1.Cell.create({ title: 'Test Cell' });
            fs.writeFileSync(path.join(config.baseDir, 'test.txt'), 'test');
            await gitSync.commit(cell, 'create');
            const hash = await gitSync.getLastHiveCommit();
            expect(hash).toBeDefined();
            expect(hash.length).toBe(40); // Full SHA hash
        });
    });
    describe('createBackupBranch', () => {
        it('should create backup branch with custom name', async () => {
            const result = await gitSync.createBackupBranch('my-backup');
            expect(result.success).toBe(true);
            const branches = (0, child_process_1.execSync)('git branch', { cwd: testDir, encoding: 'utf-8' });
            expect(branches).toContain('my-backup');
        });
        it('should create backup branch with generated name', async () => {
            const result = await gitSync.createBackupBranch();
            expect(result.success).toBe(true);
            const branches = (0, child_process_1.execSync)('git branch', { cwd: testDir, encoding: 'utf-8' });
            expect(branches).toContain('hive-backup-');
        });
        it('should succeed when disabled', async () => {
            const disabledConfig = { ...config, enableGit: false };
            const sync = new git_sync_1.GitSync(disabledConfig, testDir);
            await sync.init();
            const result = await sync.createBackupBranch('test');
            expect(result.success).toBe(true);
        });
    });
    describe('syncWithRemote', () => {
        it('should succeed when no remote configured', async () => {
            const result = await gitSync.syncWithRemote();
            expect(result.success).toBe(true);
        });
        it('should succeed when disabled', async () => {
            const disabledConfig = { ...config, enableGit: false };
            const sync = new git_sync_1.GitSync(disabledConfig, testDir);
            await sync.init();
            const result = await sync.syncWithRemote();
            expect(result.success).toBe(true);
        });
    });
});
//# sourceMappingURL=git-sync.test.js.map