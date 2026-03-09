/**
 * Swarm Mail - Reservations
 * File locking system for exclusive editing access
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  FileReservation,
  ReservationStatus,
  ReservationQuery,
  ReservationRequest,
  ConflictCheck
} from './types';

export class ReservationManager {
  private reservationsPath: string;
  private defaultTTLSeconds: number = 3600; // 1 hour

  constructor(storagePath: string) {
    this.reservationsPath = path.join(storagePath, 'reservations');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.reservationsPath)) {
      fs.mkdirSync(this.reservationsPath, { recursive: true });
    }
  }

  private getReservationPath(reservationId: string): string {
    return path.join(this.reservationsPath, `${reservationId}.json`);
  }

  private getPathIndexPath(): string {
    return path.join(this.reservationsPath, 'path-index.json');
  }

  private generateId(): string {
    return `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check for conflicts before reserving
   */
  checkConflicts(paths: string | string[], agentName: string): ConflictCheck {
    const pathList = Array.isArray(paths) ? paths : [paths];
    const conflicts: FileReservation[] = [];

    for (const filePath of pathList) {
      const existing = this.findByPath(filePath);
      if (existing && existing.agentName !== agentName && existing.status === 'active') {
        // Check if expired
        if (existing.expiresAt > Date.now()) {
          conflicts.push(existing);
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      message: conflicts.length > 0
        ? `Conflicts found with: ${conflicts.map(c => `${c.agentName} on ${c.path}`).join(', ')}`
        : 'No conflicts'
    };
  }

  /**
   * Reserve files for exclusive access
   */
  reserve(
    agentName: string,
    request: ReservationRequest
  ): { success: boolean; reservations: FileReservation[]; conflicts: ConflictCheck } {
    const paths = Array.isArray(request.paths) ? request.paths : [request.paths];
    const ttlSeconds = request.ttlSeconds || this.defaultTTLSeconds;

    // Check conflicts first
    const conflictCheck = this.checkConflicts(paths, agentName);
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        reservations: [],
        conflicts: conflictCheck
      };
    }

    const reservations: FileReservation[] = [];
    const now = Date.now();

    for (const filePath of paths) {
      const reservation: FileReservation = {
        id: this.generateId(),
        path: filePath,
        agentName,
        status: 'active',
        createdAt: now,
        expiresAt: now + (ttlSeconds * 1000),
        reason: request.reason,
        exclusive: request.exclusive ?? true
      };

      this.save(reservation);
      this.updatePathIndex(filePath, reservation.id);
      reservations.push(reservation);
    }

    return {
      success: true,
      reservations,
      conflicts: conflictCheck
    };
  }

  /**
   * Release a reservation
   */
  release(reservationId: string, agentName: string): boolean {
    const reservation = this.get(reservationId);
    if (!reservation) {
      return false;
    }

    if (reservation.agentName !== agentName) {
      throw new Error(`Cannot release reservation owned by ${reservation.agentName}`);
    }

    reservation.status = 'released';
    reservation.releasedAt = Date.now();
    this.save(reservation);

    // Update path index
    this.removeFromPathIndex(reservation.path, reservationId);

    return true;
  }

  /**
   * Release all reservations for an agent
   */
  releaseAll(agentName: string): number {
    const active = this.query({ agentName, status: 'active' });
    let released = 0;

    for (const reservation of active) {
      reservation.status = 'released';
      reservation.releasedAt = Date.now();
      this.save(reservation);
      this.removeFromPathIndex(reservation.path, reservation.id);
      released++;
    }

    return released;
  }

  /**
   * Get a reservation by ID
   */
  get(reservationId: string): FileReservation | undefined {
    const reservationPath = this.getReservationPath(reservationId);
    if (!fs.existsSync(reservationPath)) {
      return undefined;
    }

    try {
      const data = fs.readFileSync(reservationPath, 'utf-8');
      return JSON.parse(data) as FileReservation;
    } catch {
      return undefined;
    }
  }

  /**
   * Find reservation by file path
   */
  findByPath(filePath: string): FileReservation | undefined {
    const index = this.getPathIndex();
    const reservationId = index[filePath];
    if (!reservationId) {
      return undefined;
    }

    const reservation = this.get(reservationId);
    if (!reservation || reservation.status !== 'active' || reservation.expiresAt <= Date.now()) {
      return undefined;
    }

    return reservation;
  }

  /**
   * Query reservations
   */
  query(query: ReservationQuery = {}): FileReservation[] {
    const reservations: FileReservation[] = [];

    if (!fs.existsSync(this.reservationsPath)) {
      return reservations;
    }

    const files = fs.readdirSync(this.reservationsPath);

    for (const file of files) {
      if (!file.endsWith('.json') || file === 'path-index.json') continue;

      const reservationPath = path.join(this.reservationsPath, file);
      try {
        const data = fs.readFileSync(reservationPath, 'utf-8');
        const reservation = JSON.parse(data) as FileReservation;

        if (this.matchesQuery(reservation, query)) {
          reservations.push(reservation);
        }
      } catch {
        // Skip invalid files
      }
    }

    return reservations;
  }

  private matchesQuery(reservation: FileReservation, query: ReservationQuery): boolean {
    if (query.agentName && reservation.agentName !== query.agentName) {
      return false;
    }

    if (query.path && reservation.path !== query.path) {
      return false;
    }

    if (query.status && reservation.status !== query.status) {
      return false;
    }

    if (query.activeOnly && (reservation.status !== 'active' || reservation.expiresAt <= Date.now())) {
      return false;
    }

    return true;
  }

  /**
   * Extend a reservation's expiration
   */
  extend(reservationId: string, agentName: string, additionalSeconds: number): boolean {
    const reservation = this.get(reservationId);
    if (!reservation) {
      return false;
    }

    if (reservation.agentName !== agentName) {
      throw new Error(`Cannot extend reservation owned by ${reservation.agentName}`);
    }

    if (reservation.status !== 'active') {
      return false;
    }

    reservation.expiresAt += additionalSeconds * 1000;
    this.save(reservation);

    return true;
  }

  /**
   * Clean up expired reservations
   */
  cleanupExpired(): number {
    const active = this.query({ status: 'active' });
    const now = Date.now();
    let cleaned = 0;

    for (const reservation of active) {
      if (reservation.expiresAt <= now) {
        reservation.status = 'expired';
        this.save(reservation);
        this.removeFromPathIndex(reservation.path, reservation.id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Check if an agent can edit a file
   */
  canEdit(filePath: string, agentName: string): boolean {
    const reservation = this.findByPath(filePath);
    if (!reservation) {
      return true; // No reservation, free to edit
    }

    return reservation.agentName === agentName;
  }

  /**
   * Get active reservations for an agent
   */
  getForAgent(agentName: string): FileReservation[] {
    return this.query({ agentName, activeOnly: true });
  }

  private save(reservation: FileReservation): void {
    const reservationPath = this.getReservationPath(reservation.id);
    fs.writeFileSync(reservationPath, JSON.stringify(reservation, null, 2));
  }

  private getPathIndex(): Record<string, string> {
    const indexPath = this.getPathIndexPath();
    if (!fs.existsSync(indexPath)) {
      return {};
    }

    try {
      const data = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private updatePathIndex(filePath: string, reservationId: string): void {
    const index = this.getPathIndex();
    index[filePath] = reservationId;

    const indexPath = this.getPathIndexPath();
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }

  private removeFromPathIndex(filePath: string, reservationId: string): void {
    const index = this.getPathIndex();
    if (index[filePath] === reservationId) {
      delete index[filePath];
      const indexPath = this.getPathIndexPath();
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    }
  }
}
