import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { SupabaseService } from '../../core/supabase/supabase.service.js';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userProfile: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    mentorProfile: {
      update: vi.fn(),
    },
  };

  const mockSupabaseService = {
    getSupabaseUrl: vi.fn().mockReturnValue('https://example.supabase.co'),
    getAdminClient: vi.fn(),
    uploadFile: vi.fn(),
    removeFile: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSupabaseService.getSupabaseUrl.mockReturnValue('https://example.supabase.co');
    mockSupabaseService.removeFile.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('rejects unsupported image bytes during uploadAvatar', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      profile: null,
      mentorProfile: null,
    });

    const invalidBase64 = Buffer.from('not-an-image').toString('base64');
    await expect(service.uploadAvatar('u1', invalidBase64)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockSupabaseService.uploadFile).not.toHaveBeenCalled();
  });

  it('uploads PNG avatar, updates UserProfile + MentorProfile and cleans old avatar', async () => {
    const oldUrl =
      'https://example.supabase.co/storage/v1/object/public/plateforme-images/avatars/u1/old.png';
    const newUrl =
      'https://example.supabase.co/storage/v1/object/public/plateforme-images/avatars/u1/avatar-123.png';

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      profile: { photoUrl: oldUrl },
      mentorProfile: { id: 'mp1' },
    });
    mockSupabaseService.uploadFile.mockResolvedValue(newUrl);
    mockPrisma.userProfile.upsert.mockResolvedValue({});
    mockPrisma.mentorProfile.update.mockResolvedValue({});

    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    const res = await service.uploadAvatar(
      'u1',
      `data:image/png;base64,${pngHeader.toString('base64')}`,
    );

    expect(res.photoUrl).toBe(newUrl);
    expect(mockPrisma.userProfile.upsert).toHaveBeenCalled();
    expect(mockPrisma.mentorProfile.update).toHaveBeenCalled();
    expect(mockSupabaseService.removeFile).toHaveBeenCalledWith(
      'plateforme-images',
      'avatars/u1/old.png',
    );
  });

  it('throws NotFoundException when deleting avatar for unknown user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.deleteAvatar('unknown')).rejects.toThrow(NotFoundException);
  });
});
