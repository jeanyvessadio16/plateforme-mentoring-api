import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';

const mockSendMail = vi.fn();
const mockResendSend = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

vi.mock('resend', () => ({
  Resend: vi.fn(function MockResend() {
    return {
      emails: {
        send: mockResendSend,
      },
    };
  }),
}));

function makeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('MailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back safely to log mode when neither RESEND_API_KEY nor SMTP_HOST is set', async () => {
    const service = new MailService(makeConfig({}));
    const result = await service.sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result).toEqual({ delivered: false, provider: 'log' });
  });

  it('sends email through Resend when RESEND_API_KEY is configured', async () => {
    mockResendSend.mockResolvedValue({ data: { id: 're_123' }, error: null });
    const service = new MailService(
      makeConfig({
        RESEND_API_KEY: 're_test_key',
        MAIL_FROM: 'ACCEENT <noreply@acceent.org>',
      }),
    );

    const result = await service.sendEmail({
      to: 'user@example.com',
      subject: 'Bienvenue',
      html: '<p>OK</p>',
      text: 'OK',
    });

    expect(result).toEqual({ delivered: true, provider: 'resend' });
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'ACCEENT <noreply@acceent.org>',
        to: ['user@example.com'],
        subject: 'Bienvenue',
      }),
    );
  });

  it('sends email through SMTP nodemailer when SMTP_HOST is configured', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'smtp_1' });
    const service = new MailService(
      makeConfig({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'mailer',
        SMTP_PASS: 'secret',
      }),
    );

    const result = await service.sendEmail({
      to: 'mentor@example.com',
      subject: 'Rendez-vous',
      html: '<p>Session</p>',
      text: 'Session',
    });

    expect(result).toEqual({ delivered: true, provider: 'smtp' });
    expect(mockSendMail).toHaveBeenCalledOnce();
  });

  it('escapes HTML entities in sendNotificationEmail to block XSS injection', async () => {
    mockResendSend.mockResolvedValue({ data: { id: 're_xss' }, error: null });
    const service = new MailService(makeConfig({ RESEND_API_KEY: 're_test_key' }));

    await service.sendNotificationEmail(
      'user@example.com',
      '<b>Alice</b>',
      '<script>alert(1)</script>',
      'Message & "details"',
    );

    const callArg = mockResendSend.mock.calls[0][0] as { html: string };
    expect(callArg.html).not.toContain('<script>');
    expect(callArg.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(callArg.html).toContain('&lt;b&gt;Alice&lt;/b&gt;');
    expect(callArg.html).toContain('Message &amp; &quot;details&quot;');
  });
});
