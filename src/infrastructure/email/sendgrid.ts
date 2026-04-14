import sgMail from '@sendgrid/mail';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/config/logger';

sgMail.setApiKey(env.SENDGRID_API_KEY);

type OtpType = 'EMAIL_VERIFICATION' | 'TWO_FACTOR' | 'PASSWORD_RESET';

const OTP_SUBJECTS: Record<OtpType, string> = {
  EMAIL_VERIFICATION: 'Verifica tu email',
  TWO_FACTOR: 'Tu código de acceso',
  PASSWORD_RESET: 'Recupera tu contraseña',
};

const OTP_MESSAGES: Record<OtpType, string> = {
  EMAIL_VERIFICATION: 'para verificar tu cuenta',
  TWO_FACTOR: 'para iniciar sesión',
  PASSWORD_RESET: 'para restablecer tu contraseña',
};

interface SendOtpOptions {
  to: string;
  otp: string;
  type: OtpType;
  username: string;
}

export async function sendOtpEmail({ to, otp, type, username }: SendOtpOptions) {
  const subject = OTP_SUBJECTS[type];
  const actionText = OTP_MESSAGES[type];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, sans-serif; background: #f4f4f5; margin: 0; padding: 40px 0; }
        .card { background: white; max-width: 480px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
        .header { background: #1a1a2e; padding: 32px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 600; }
        .body { padding: 40px 32px; }
        .greeting { color: #374151; font-size: 16px; margin-bottom: 16px; }
        .otp-box { background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0; }
        .otp-label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
        .otp-code { font-size: 42px; font-weight: 700; letter-spacing: 10px; color: #111827; font-variant-numeric: tabular-nums; }
        .expires { color: #9ca3af; font-size: 13px; margin-top: 16px; }
        .warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; color: #92400e; font-size: 13px; margin-top: 24px; }
        .footer { background: #f9fafb; padding: 20px 32px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>${env.APP_NAME}</h1>
        </div>
        <div class="body">
          <p class="greeting">Hola <strong>${username}</strong>,</p>
          <p style="color:#6b7280;">Este es tu código ${actionText}:</p>
          <div class="otp-box">
            <div class="otp-label">Código de verificación</div>
            <div class="otp-code">${otp}</div>
            <div class="expires">Válido por ${env.OTP_EXPIRES_IN_MINUTES} minutos</div>
          </div>
          <div class="warning">
            ⚠️ Nunca compartas este código. Nuestro equipo jamás te lo pedirá.
          </div>
        </div>
        <div class="footer">
          Si no realizaste esta acción, puedes ignorar este mensaje.<br>
          © ${new Date().getFullYear()} ${env.APP_NAME}
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await sgMail.send({
      to,
      from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
      subject,
      html,
    });
    logger.info({ to, type }, 'OTP email sent');
  } catch (err) {
    logger.error({ err, to, type }, 'Failed to send OTP email');
    throw new Error('No se pudo enviar el email. Intenta de nuevo.');
  }
}

export async function sendWelcomeEmail(to: string, username: string) {
  try {
    await sgMail.send({
      to,
      from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
      subject: `¡Bienvenido a ${env.APP_NAME}, ${username}!`,
      html: `<p>Bienvenido <strong>${username}</strong>. Tu cuenta está lista.</p>`,
    });
  } catch (err) {
    logger.error({ err, to }, 'Failed to send welcome email');
  }
}
