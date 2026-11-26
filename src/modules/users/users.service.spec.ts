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
    report: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const mockAdminDeleteUser = vi.fn().mockResolvedValue({ error: null });

  const mockSupabaseService = {
    getSupabaseUrl: vi.fn().mockReturnValue('https://example.supabase.co'),
    getAdminClient: vi.fn(() => ({
      auth: {
        admin: {
          deleteUser: mockAdminDeleteUser,
        },
      },
    })),
    uploadFile: vi.fn(),
    removeFile: vi.fn().mockResolvedValue(undefined),
    listFolderPaths: vi.fn().mockResolvedValue([]),
    removeFilesBestEffort: vi.fn().mockResolvedValue(0),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSupabaseService.getSupabaseUrl.mockReturnValue('https://example.supabase.co');
    mockSupabaseService.removeFile.mockResolvedValue(undefined);
    mockSupabaseService.listFolderPaths.mockResolvedValue([]);
    mockSupabaseService.removeFilesBestEffort.mockResolvedValue(0);
    mockAdminDeleteUser.mockResolvedValue({ error: null });

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

  it('purges avatar, CV, message attachments, hosted resources, Auth user and DB records on deleteAccount', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      supabaseUid: 'sub-u1',
      profile: {
        photoUrl:
          'https://example.supabase.co/storage/v1/object/public/plateforme-images/avatars/u1/avatar-1.png',
      },
      mentorProfile: {
        id: 'mp-u1',
        photoUrl:
          'https://example.supabase.co/storage/v1/object/public/plateforme-images/avatars/u1/avatar-1.png',
        cvUrl: 'cvs/u1/cv-mentor.pdf',
      },
      conversations1: [
        {
          id: 'conv-1',
          messages: [
            {
              attachments: [
                {
                  fileUrl:
                    'https://example.supabase.co/storage/v1/object/sign/mentor-documents/messages/conv-1/doc-1.pdf?token=abc',
                },
              ],
            },
          ],
        },
      ],
      conversations2: [],
      messagesSent: [],
      programsAsMentor: [
        {
          resources: [
            {
              url: 'https://example.supabase.co/storage/v1/object/public/mentor-documents/resources/prog-1/guide.pdf',
            },
            {
              url: 'https://youtube.com/watch?v=external-link',
            },
          ],
        },
      ],
      programsAsMentee: [],
    });
    mockPrisma.user.delete.mockResolvedValue({ id: 'u1' });
    mockSupabaseService.listFolderPaths.mockImplementation(
      async (bucket: string, prefix: string) => {
        if (bucket === 'mentor-documents' && prefix === 'cvs/u1') {
          return ['cvs/u1/cv-mentor.pdf', 'cvs/u1/cv-old-draft.pdf'];
        }
        return [];
      },
    );

    const result = await service.deleteAccount('u1');

    expect(mockAdminDeleteUser).toHaveBeenCalledWith('sub-u1');
    expect(mockPrisma.report.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ reportedUserId: 'u1' }, { targetId: { in: ['u1', 'mp-u1'] } }],
      },
    });
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(mockSupabaseService.removeFilesBestEffort).toHaveBeenCalledWith(
      'plateforme-images',
      ['avatars/u1/avatar-1.png'],
    );
    expect(mockSupabaseService.removeFilesBestEffort).toHaveBeenCalledWith(
      'mentor-documents',
      expect.arrayContaining([
        'cvs/u1/cv-mentor.pdf',
        'cvs/u1/cv-old-draft.pdf',
        'messages/conv-1/doc-1.pdf',
        'resources/prog-1/guide.pdf',
      ]),
    );
    expect(result.message).toContain('documents associés supprimés');
  });
});
