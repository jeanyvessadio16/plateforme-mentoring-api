import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { UserRole } from '../../generated/prisma/client.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  const mockReflector = {
    getAllAndOverride: vi.fn(),
  };

  function createContext(user?: { role?: UserRole }) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new RolesGuard(mockReflector as unknown as Reflector);
  });

  it('allows access when no @Roles metadata is set', () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(createContext({ role: UserRole.BENEFICIAIRE }))).toBe(true);
  });

  it('allows access when user role matches required role', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.MENTOR]);
    expect(guard.canActivate(createContext({ role: UserRole.MENTOR }))).toBe(true);
  });

  it('throws ForbiddenException when user role does not match', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.MENTOR]);
    expect(() => guard.canActivate(createContext({ role: UserRole.BENEFICIAIRE }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows ADMIN regardless of required roles', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.MENTOR]);
    expect(guard.canActivate(createContext({ role: UserRole.ADMIN }))).toBe(true);
  });
});
