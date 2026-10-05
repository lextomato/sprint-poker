import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

interface PasswordResetEmail {
  email: string;
  displayName: string;
  token: string;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]!);
}

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  async sendPasswordReset({ email, displayName, token }: PasswordResetEmail) {
    const host = this.config.get<string>("SMTP_HOST") || "smtp.gmail.com";
    const port = Number(this.config.get<string>("SMTP_PORT") || 587);
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASSWORD");
    if (!user || !pass) throw new Error("SMTP_USER and SMTP_PASSWORD must be configured.");

    const appUrl = this.config.get<string>("WEB_APP_URL") || "http://localhost:3000";
    const resetUrl = new URL("/reset-password", appUrl);
    resetUrl.hash = token;
    const from = this.config.get<string>("SMTP_FROM") || `Sprint Poker <${user}>`;
    const name = escapeHtml(displayName);
    const link = escapeHtml(resetUrl.toString());

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.config.get<string>("SMTP_SECURE") === "true",
      auth: { user, pass }
    });
    await transporter.sendMail({
      from,
      to: email,
      subject: "Recupera tu contrasena | Sprint Poker",
      text: `Hola ${displayName},\n\nRecibimos una solicitud para cambiar la contrasena de tu cuenta Sprint Poker. Abre este enlace antes de 30 minutos:\n${resetUrl}\n\nSi no lo solicitaste, puedes ignorar este mensaje.`,
      html: this.passwordResetTemplate(name, link)
    });
  }

  private passwordResetTemplate(name: string, link: string) {
    return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#172b3a">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Recupera el acceso a tu cuenta de Sprint Poker.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:36px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #dbe5e8;border-radius:12px;overflow:hidden">
          <tr><td style="padding:24px 32px;background:#0f766e;color:#fff">
            <div style="font-size:12px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;opacity:.85">Sprint Poker</div>
            <div style="margin-top:5px;font-size:23px;font-weight:700">Recupera tu cuenta</div>
          </td></tr>
          <tr><td style="padding:32px">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6">Hola ${name},</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569">Recibimos una solicitud para cambiar la contrasena de tu cuenta. Usa el boton para elegir una nueva; el enlace vence en 30 minutos.</p>
            <p style="margin:0 0 26px"><a href="${link}" style="display:inline-block;padding:13px 20px;border-radius:7px;background:#0f766e;color:#fff;text-decoration:none;font-size:15px;font-weight:700">Crear nueva contrasena</a></p>
            <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#64748b">Si el boton no funciona, abre este enlace en tu navegador:</p>
            <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.6"><a href="${link}" style="color:#0f766e">${link}</a></p>
            <hr style="margin:26px 0;border:0;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b">Si no solicitaste este cambio, ignora este correo. Tu contrasena actual seguira funcionando.</p>
          </td></tr>
          <tr><td style="padding:16px 32px;background:#f8fafc;font-size:11px;color:#64748b">Planning poker, retrospectivas y trabajo en equipo.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  }
}
