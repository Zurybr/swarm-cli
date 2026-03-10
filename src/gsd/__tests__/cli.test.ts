/**
 * Tests for GSD CLI Commands
 */

import { Command } from 'commander';
import { createGSDCommand } from '../cli';

describe('GSD CLI', () => {
  describe('createGSDCommand', () => {
    it('should create a Command instance', () => {
      const cmd = createGSDCommand();
      expect(cmd).toBeInstanceOf(Command);
      expect(cmd.name()).toBe('gsd');
    });

    it('should have init command', () => {
      const cmd = createGSDCommand();
      const initCmd = cmd.commands.find(c => c.name() === 'init');
      expect(initCmd).toBeDefined();
    });

    it('should have status command', () => {
      const cmd = createGSDCommand();
      const statusCmd = cmd.commands.find(c => c.name() === 'status');
      expect(statusCmd).toBeDefined();
    });

    it('should have validate command', () => {
      const cmd = createGSDCommand();
      const validateCmd = cmd.commands.find(c => c.name() === 'validate');
      expect(validateCmd).toBeDefined();
    });

    it('should have milestone subcommand', () => {
      const cmd = createGSDCommand();
      const milestoneCmd = cmd.commands.find(c => c.name() === 'milestone');
      expect(milestoneCmd).toBeDefined();
    });

    it('should have phase subcommand', () => {
      const cmd = createGSDCommand();
      const phaseCmd = cmd.commands.find(c => c.name() === 'phase');
      expect(phaseCmd).toBeDefined();
    });

    it('should have task subcommand', () => {
      const cmd = createGSDCommand();
      const taskCmd = cmd.commands.find(c => c.name() === 'task');
      expect(taskCmd).toBeDefined();
    });

    it('should have roadmap subcommand', () => {
      const cmd = createGSDCommand();
      const roadmapCmd = cmd.commands.find(c => c.name() === 'roadmap');
      expect(roadmapCmd).toBeDefined();
    });
  });

  describe('milestone commands', () => {
    it('should have milestone add command', () => {
      const cmd = createGSDCommand();
      const milestoneCmd = cmd.commands.find(c => c.name() === 'milestone');
      const addCmd = milestoneCmd!.commands.find(c => c.name() === 'add');
      expect(addCmd).toBeDefined();
    });

    it('should have milestone list command', () => {
      const cmd = createGSDCommand();
      const milestoneCmd = cmd.commands.find(c => c.name() === 'milestone');
      const listCmd = milestoneCmd!.commands.find(c => c.name() === 'list');
      expect(listCmd).toBeDefined();
    });

    it('should have milestone remove command', () => {
      const cmd = createGSDCommand();
      const milestoneCmd = cmd.commands.find(c => c.name() === 'milestone');
      const removeCmd = milestoneCmd!.commands.find(c => c.name() === 'remove');
      expect(removeCmd).toBeDefined();
    });
  });

  describe('phase commands', () => {
    it('should have phase add command', () => {
      const cmd = createGSDCommand();
      const phaseCmd = cmd.commands.find(c => c.name() === 'phase');
      const addCmd = phaseCmd!.commands.find(c => c.name() === 'add');
      expect(addCmd).toBeDefined();
    });

    it('should have phase list command', () => {
      const cmd = createGSDCommand();
      const phaseCmd = cmd.commands.find(c => c.name() === 'phase');
      const listCmd = phaseCmd!.commands.find(c => c.name() === 'list');
      expect(listCmd).toBeDefined();
    });
  });

  describe('task commands', () => {
    it('should have task add command', () => {
      const cmd = createGSDCommand();
      const taskCmd = cmd.commands.find(c => c.name() === 'task');
      const addCmd = taskCmd!.commands.find(c => c.name() === 'add');
      expect(addCmd).toBeDefined();
    });

    it('should have task complete command', () => {
      const cmd = createGSDCommand();
      const taskCmd = cmd.commands.find(c => c.name() === 'task');
      const completeCmd = taskCmd!.commands.find(c => c.name() === 'complete');
      expect(completeCmd).toBeDefined();
    });

    it('should have task list command', () => {
      const cmd = createGSDCommand();
      const taskCmd = cmd.commands.find(c => c.name() === 'task');
      const listCmd = taskCmd!.commands.find(c => c.name() === 'list');
      expect(listCmd).toBeDefined();
    });
  });

  describe('roadmap commands', () => {
    it('should have roadmap show command', () => {
      const cmd = createGSDCommand();
      const roadmapCmd = cmd.commands.find(c => c.name() === 'roadmap');
      const showCmd = roadmapCmd!.commands.find(c => c.name() === 'show');
      expect(showCmd).toBeDefined();
    });

    it('should have roadmap export command', () => {
      const cmd = createGSDCommand();
      const roadmapCmd = cmd.commands.find(c => c.name() === 'roadmap');
      const exportCmd = roadmapCmd!.commands.find(c => c.name() === 'export');
      expect(exportCmd).toBeDefined();
    });

    it('should have roadmap upcoming command', () => {
      const cmd = createGSDCommand();
      const roadmapCmd = cmd.commands.find(c => c.name() === 'roadmap');
      const upcomingCmd = roadmapCmd!.commands.find(c => c.name() === 'upcoming');
      expect(upcomingCmd).toBeDefined();
    });

    it('should have roadmap critical command', () => {
      const cmd = createGSDCommand();
      const roadmapCmd = cmd.commands.find(c => c.name() === 'roadmap');
      const criticalCmd = roadmapCmd!.commands.find(c => c.name() === 'critical');
      expect(criticalCmd).toBeDefined();
    });
  });
});
