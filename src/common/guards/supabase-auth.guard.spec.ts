import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SupabaseAuthGuard } from './supabase-auth.guard.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ALLOW_UNREGISTERED_KEY } from '../decorators/allow-unregistered.decorator.js';
import { AccountStatus } from '../../generated/prisma/client.js';

const { mockJwtVerify } = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
}));

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn().mockReturnValue(vi.fn()),
  jwtVerify: mockJwtVerify,
}));

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;
  const mockReflector = {
    getAllAndOverride: vi.fn(),
  };
  const mockConfig = {
    get: vi.fn().mockReturnValue('https://example.supabase.co/auth/v1/.well-known/jwks.json'),
  };
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
  };

  function createMockContext(authorization?: string) {
    const request: any = {
      headers: authorization ? { authorization } : {},
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.get.mockReturnValue('https://example.supabase.co/auth/v1/.well-known/jwks.json');
    guard = new SupabaseAuthGuard(
      mockReflector as unknown as Reflector,
      mockConfig as unknown as ConfigService,
      mockPrisma as any,
    );
  });

  it('allows public routes without token', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key: string) => key === IS_PUBLIC_KEY);
    const { context } = createMockContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    const { context } = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException if user is not in local DB and @AllowUnregistered is absent', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'uid-missing', email: 'new@example.com' } });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const { context } = createMockContext('Bearer valid-jwt');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('allows unregistered user when @AllowUnregistered is set and attaches accessToken', async () => {
    mockReflector.getAllAndOverride.mockImplementation(
      (key: string) => key === ALLOW_UNREGISTERED_KEY,
    );
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'uid-new', email: 'new@example.com' } });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const { context, request } = createMockContext('Bearer valid-jwt');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.accessToken).toBe('valid-jwt');
    expect(request.user).toEqual({
      supabaseUid: 'uid-new',
      email: 'new@example.com',
      isRegistered: false,
    });
  });

  it('throws ForbiddenException for SUSPENDED and REJECTED accounts', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'uid-1', email: 'u@example.com' } });
    const { context } = createMockContext('Bearer valid-jwt');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'db-1',
      supabaseUid: 'uid-1',
      statutCompte: AccountStatus.SUSPENDED,
    });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'db-1',
      supabaseUid: 'uid-1',
      statutCompte: AccountStatus.REJECTED,
    });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
