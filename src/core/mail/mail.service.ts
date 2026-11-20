import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  delivered: boolean;
  provider: 'resend' | 'smtp' | 'log';
  error?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resendClient: Resend | null = null;
  private readonly smtpTransporter: Transporter | null = null;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress =
      this.configService.get<string>('MAIL_FROM') ||
      'ACCEENT Mentoring <onboarding@resend.dev>';

    const resendApiKey = this.configService.get<string>('RESEND_API_KEY')?.trim();
    if (resendApiKey) {
      this.resendClient = new Resend(resendApiKey);
    }

    const smtpHost = this.configService.get<string>('SMTP_HOST')?.trim();
    if (smtpHost) {
      const smtpPort = Number(this.configService.get<string>('SMTP_PORT')) || 587;
      const smtpSecure = this.configService.get<string>('SMTP_SECURE') === 'true';
      const smtpUser = this.configService.get<string>('SMTP_USER')?.trim();
      const smtpPass = this.configService.get<string>('SMTP_PASS');

      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        ...(smtpUser
          ? {
              auth: {
                user: smtpUser,
                pass: smtpPass || '',
              },
            }
          : {}),
      });
    }
  }

  escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (this.resendClient) {
      try {
        const { error } = await this.resendClient.emails.send({
          from: this.fromAddress,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        });

        if (!error) {
          return { delivered: true, provider: 'resend' };
        }

        this.logger.warn(`Échec envoi Resend vers ${params.to}: ${error.message}`);
        if (!this.smtpTransporter) {
          return { delivered: false, provider: 'resend', error: error.message };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Exception envoi Resend vers ${params.to}: ${message}`);
        if (!this.smtpTransporter) {
          return { delivered: false, provider: 'resend', error: message };
        }
      }
    }

    if (this.smtpTransporter) {
      try {
        await this.smtpTransporter.sendMail({
          from: this.fromAddress,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
        });
        return { delivered: true, provider: 'smtp' };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Échec envoi SMTP vers ${params.to}: ${message}`);
        return { delivered: false, provider: 'smtp', error: message };
      }
    }

    this.logger.debug(
      `[MailFallback] Aucun transport configuré. Destinataire=${params.to} | Sujet="${params.subject}"`,
    );
    return { delivered: false, provider: 'log' };
  }

  async sendNotificationEmail(
    to: string,
    recipientName: string,
    titre: string,
    message: string,
  ): Promise<SendEmailResult> {
    const safeName = this.escapeHtml(recipientName || 'Membre ACCEENT');
    const safeTitle = this.escapeHtml(titre);
    const safeMessage = this.escapeHtml(message).replaceAll('\n', '<br />');

    const html = `<!DOCTYPE html>
<html lang="fr">
  <body style="font-family: Arial, sans-serif; color: #0f172a; background: #f8fafc; padding: 24px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px;">
      <p style="font-size: 12px; font-weight: 700; color: #0f766e; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px 0;">
        ACCEENT Mentoring
      </p>
      <h1 style="font-size: 18px; margin: 0 0 12px 0; color: #0f172a;">${safeTitle}</h1>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">Bonjour ${safeName},</p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">${safeMessage}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #64748b; margin: 0;">
        Connectez-vous à votre espace personnel ACCEENT Mentoring pour consulter les détails et répondre.
      </p>
    </div>
  </body>
</html>`;

    const text = `ACCEENT Mentoring\n\n${titre}\n\nBonjour ${recipientName || 'Membre ACCEENT'},\n\n${message}\n`;

    return this.sendEmail({
      to,
      subject: `[ACCEENT Mentoring] ${titre}`,
      html,
      text,
    });
  }
}
