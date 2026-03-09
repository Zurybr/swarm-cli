/**
 * Reservation tests for Swarm Mail
 */

import * as fs from 'fs';
import * as path from 'path';
import { ReservationManager } from '../reservations';

describe('ReservationManager', () => {
  const testStoragePath = path.join(__dirname, '.test-reservations');
  let reservations: ReservationManager;

  beforeEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true });
    }

    reservations = new ReservationManager(testStoragePath);
  });

  afterEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true });
    }
  });

  describe('reserve', () => {
    it('should reserve a single file', () => {
      const result = reservations.reserve('agent-1', {
        paths: '/path/to/file.ts',
        reason: 'Editing'
      });

      expect(result.success).toBe(true);
      expect(result.reservations).toHaveLength(1);
      expect(result.reservations[0].path).toBe('/path/to/file.ts');
      expect(result.reservations[0].agentName).toBe('agent-1');
      expect(result.reservations[0].status).toBe('active');
    });

    it('should reserve multiple files', () => {
      const result = reservations.reserve('agent-1', {
        paths: ['/path/file1.ts', '/path/file2.ts'],
        reason: 'Refactoring'
      });

      expect(result.success).toBe(true);
      expect(result.reservations).toHaveLength(2);
    });

    it('should detect conflicts with existing reservations', () => {
      // First reservation
      reservations.reserve('agent-1', {
        paths: '/path/to/file.ts',
        reason: 'First'
      });

      // Second reservation attempt
      const result = reservations.reserve('agent-2', {
        paths: '/path/to/file.ts',
        reason: 'Second'
      });

      expect(result.success).toBe(false);
      expect(result.conflicts.hasConflict).toBe(true);
      expect(result.conflicts.conflicts).toHaveLength(1);
    });

    it('should allow same agent to reserve again', () => {
      reservations.reserve('agent-1', {
        paths: '/path/to/file.ts',
        reason: 'First'
      });

      const result = reservations.reserve('agent-1', {
        paths: '/path/to/file.ts',
        reason: 'Second'
      });

      expect(result.success).toBe(true);
    });

    it('should set custom TTL', () => {
      const result = reservations.reserve('agent-1', {
        paths: '/path/to/file.ts',
        ttlSeconds: 7200
      });

      const reservation = result.reservations[0];
      const expectedExpiry = reservation.createdAt + (7200 * 1000);
      expect(reservation.expiresAt).toBe(expectedExpiry);
    });
  });

  describe('release', () => {
    it('should release a reservation', () => {
      const reserveResult = reservations.reserve('agent-1', {
        paths: '/path/to/file.ts'
      });

      const reservationId = reserveResult.reservations[0].id;
      const result = reservations.release(reservationId, 'agent-1');

      expect(result).toBe(true);

      const reservation = reservations.get(reservationId);
      expect(reservation!.status).toBe('released');
      expect(reservation!.releasedAt).toBeDefined();
    });

    it('should throw when releasing another agent\'s reservation', () => {
      const reserveResult = reservations.reserve('agent-1', {
        paths: '/path/to/file.ts'
      });

      const reservationId = reserveResult.reservations[0].id;

      expect(() => {
        reservations.release(reservationId, 'agent-2');
      }).toThrow('Cannot release reservation owned by agent-1');
    });

    it('should return false for non-existent reservation', () => {
      const result = reservations.release('non-existent', 'agent-1');
      expect(result).toBe(false);
    });
  });

  describe('releaseAll', () => {
    it('should release all reservations for an agent', () => {
      reservations.reserve('agent-1', { paths: ['/path/file1.ts', '/path/file2.ts'] });

      const released = reservations.releaseAll('agent-1');

      expect(released).toBe(2);

      const active = reservations.getForAgent('agent-1');
      expect(active).toHaveLength(0);
    });
  });

  describe('get', () => {
    it('should retrieve a reservation by ID', () => {
      const reserveResult = reservations.reserve('agent-1', {
        paths: '/path/to/file.ts'
      });

      const reservationId = reserveResult.reservations[0].id;
      const reservation = reservations.get(reservationId);

      expect(reservation).toBeDefined();
      expect(reservation!.id).toBe(reservationId);
    });

    it('should return undefined for non-existent reservation', () => {
      const reservation = reservations.get('non-existent');
      expect(reservation).toBeUndefined();
    });
  });

  describe('findByPath', () => {
    it('should find active reservation by path', () => {
      reservations.reserve('agent-1', { paths: '/path/to/file.ts' });

      const reservation = reservations.findByPath('/path/to/file.ts');

      expect(reservation).toBeDefined();
      expect(reservation!.path).toBe('/path/to/file.ts');
      expect(reservation!.agentName).toBe('agent-1');
    });

    it('should return undefined for unreserved path', () => {
      const reservation = reservations.findByPath('/unreserved/path.ts');
      expect(reservation).toBeUndefined();
    });

    it('should return undefined for released reservation', () => {
      const result = reservations.reserve('agent-1', { paths: '/path/to/file.ts' });
      reservations.release(result.reservations[0].id, 'agent-1');

      const reservation = reservations.findByPath('/path/to/file.ts');
      expect(reservation).toBeUndefined();
    });
  });

  describe('query', () => {
    beforeEach(() => {
      reservations.reserve('agent-1', { paths: '/path/file1.ts' });
      reservations.reserve('agent-1', { paths: '/path/file2.ts' });
      reservations.reserve('agent-2', { paths: '/path/file3.ts' });
    });

    it('should query by agent name', () => {
      const results = reservations.query({ agentName: 'agent-1' });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.agentName === 'agent-1')).toBe(true);
    });

    it('should query by path', () => {
      const results = reservations.query({ path: '/path/file1.ts' });
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('/path/file1.ts');
    });

    it('should query active only', () => {
      const allResults = reservations.query({ activeOnly: true });
      expect(allResults.length).toBeGreaterThanOrEqual(0);
      expect(allResults.every(r => r.status === 'active')).toBe(true);
    });
  });

  describe('extend', () => {
    it('should extend reservation expiration', () => {
      const result = reservations.reserve('agent-1', {
        paths: '/path/to/file.ts',
        ttlSeconds: 3600
      });

      const reservationId = result.reservations[0].id;
      const originalExpiry = result.reservations[0].expiresAt;

      const extendResult = reservations.extend(reservationId, 'agent-1', 1800);

      expect(extendResult).toBe(true);

      const reservation = reservations.get(reservationId);
      expect(reservation!.expiresAt).toBe(originalExpiry + (1800 * 1000));
    });

    it('should throw when extending another agent\'s reservation', () => {
      const result = reservations.reserve('agent-1', { paths: '/path/to/file.ts' });

      expect(() => {
        reservations.extend(result.reservations[0].id, 'agent-2', 1800);
      }).toThrow('Cannot extend reservation owned by agent-1');
    });
  });

  describe('cleanupExpired', () => {
    it('should clean up expired reservations', () => {
      // Create a reservation with very short TTL
      const result = reservations.reserve('agent-1', {
        paths: '/path/to/file.ts',
        ttlSeconds: 0 // Expires immediately
      });

      const reservationId = result.reservations[0].id;

      // Manually expire the reservation by modifying the file
      const reservationPath = path.join(testStoragePath, 'reservations', `${reservationId}.json`);
      const data = JSON.parse(fs.readFileSync(reservationPath, 'utf-8'));
      data.expiresAt = Date.now() - 1000; // Expired 1 second ago
      fs.writeFileSync(reservationPath, JSON.stringify(data, null, 2));

      const cleaned = reservations.cleanupExpired();
      expect(cleaned).toBe(1);

      const updated = reservations.get(reservationId);
      expect(updated!.status).toBe('expired');
    });
  });

  describe('canEdit', () => {
    it('should return true when no reservation exists', () => {
      const canEdit = reservations.canEdit('/unreserved/path.ts', 'agent-1');
      expect(canEdit).toBe(true);
    });

    it('should return true for owner', () => {
      reservations.reserve('agent-1', { paths: '/path/to/file.ts' });

      const canEdit = reservations.canEdit('/path/to/file.ts', 'agent-1');
      expect(canEdit).toBe(true);
    });

    it('should return false for non-owner', () => {
      reservations.reserve('agent-1', { paths: '/path/to/file.ts' });

      const canEdit = reservations.canEdit('/path/to/file.ts', 'agent-2');
      expect(canEdit).toBe(false);
    });
  });

  describe('getForAgent', () => {
    it('should return active reservations for an agent', () => {
      reservations.reserve('agent-1', { paths: ['/path/file1.ts', '/path/file2.ts'] });

      const active = reservations.getForAgent('agent-1');
      expect(active).toHaveLength(2);
    });
  });

  describe('checkConflicts', () => {
    it('should return no conflict for unreserved paths', () => {
      const check = reservations.checkConflicts('/unreserved/path.ts', 'agent-1');
      expect(check.hasConflict).toBe(false);
    });

    it('should return conflict for reserved path', () => {
      reservations.reserve('agent-1', { paths: '/path/to/file.ts' });

      const check = reservations.checkConflicts('/path/to/file.ts', 'agent-2');
      expect(check.hasConflict).toBe(true);
      expect(check.conflicts).toHaveLength(1);
    });

    it('should check multiple paths', () => {
      reservations.reserve('agent-1', { paths: '/path/file1.ts' });

      const check = reservations.checkConflicts(['/path/file1.ts', '/path/file2.ts'], 'agent-2');
      expect(check.hasConflict).toBe(true);
      expect(check.conflicts).toHaveLength(1);
    });
  });
});
