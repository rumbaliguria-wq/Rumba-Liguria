import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FROM = process.env.EMAIL_FROM || (GMAIL_USER ? `Rumba Liguria <${GMAIL_USER}>` : undefined);

// Un único transporter con conexiones reutilizables (pool): así el segundo
// correo no paga otra vez el handshake TLS + AUTH con Gmail. Los timeouts
// evitan que una conexión colgada bloquee la petición indefinidamente.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !FROM) {
    throw new Error("Gmail SMTP no está configurado. Define GMAIL_USER y GMAIL_APP_PASSWORD.");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      pool: true,
      maxConnections: 2,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  return getTransporter().sendMail({
    from: FROM,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    html,
  });
}

export function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }) {
  return sendEmail({
    to,
    subject: "Recupera tu contraseña de Rumba Liguria",
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#05050b;font-family:Arial,sans-serif;color:#fff;">
      <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
        <div style="background:#0b0b15;border:1px solid #26263a;border-radius:20px;padding:32px;text-align:center;">
          <img src="${resetUrl.split("/reset-password")[0]}/icon-192.png" width="64" height="64" style="border-radius:16px;" alt="Rumba Liguria" />
          <p style="color:#60a5fa;font-size:12px;font-weight:bold;letter-spacing:2px;margin:18px 0 6px;">RUMBA LIGURIA</p>
          <h1 style="font-size:24px;margin:0 0 14px;">Restablece tu contraseña</h1>
          <p style="color:#b0b0c0;line-height:1.6;margin:0 0 24px;">Recibimos una solicitud para cambiar la contraseña de tu cuenta. Este enlace es válido durante una hora y solo puede usarse una vez.</p>
          <a href="${resetUrl}" style="display:block;background:linear-gradient(90deg,#2563eb,#60a5fa);border-radius:12px;color:white;padding:14px 18px;text-decoration:none;font-weight:bold;">Crear nueva contraseña</a>
          <p style="color:#77778b;font-size:12px;line-height:1.5;margin:24px 0 0;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
        </div>
      </div>
    </body></html>`,
  });
}

export function sendAdminCodeEmail({ to, code }: { to: string; code: string }) {
  return sendEmail({
    to,
    subject: `Codice di accesso Rumba Liguria: ${code}`,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#05050b;font-family:Arial,sans-serif;color:#fff;">
      <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
        <div style="background:#0b0b15;border:1px solid #26263a;border-radius:20px;padding:32px;text-align:center;">
          <p style="color:#60a5fa;font-size:12px;font-weight:bold;letter-spacing:2px;margin:0 0 6px;">RUMBA LIGURIA — AREA RISERVATA</p>
          <h1 style="font-size:22px;margin:0 0 14px;">Codice di verifica</h1>
          <p style="color:#b0b0c0;line-height:1.6;margin:0 0 20px;">Usa questo codice per completare l'accesso al pannello di amministrazione. Scade tra 10 minuti.</p>
          <div style="font-size:34px;font-weight:bold;letter-spacing:10px;background:#101020;border:1px solid #26263a;border-radius:12px;padding:18px 0;margin:0 0 20px;">${code}</div>
          <p style="color:#77778b;font-size:12px;line-height:1.5;margin:0;">Se non hai richiesto tu questo accesso, cambia subito la password del pannello.</p>
        </div>
      </div>
    </body></html>`,
  });
}

export function eventAnnouncementHtml(event: {
  title: string;
  details?: string;
  price?: string;
  flyer_url?: string;
  siteUrl: string;
}) {
  const priceLabel =
    !event.price || event.price === "free" ? "Ingresso Libero 🎉" : `Prezzo: ${event.price}`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;font-family:sans-serif;color:#fff;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <img src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/659b52a5-69ae-4783-b222-bf54f8c81855/logo-1771260580239.png?width=200&height=200&resize=contain"
        width="64" height="64" style="border-radius:50%;border:2px solid #3b82f6;" alt="Rumba Liguria" />
      <h1 style="color:#3b82f6;font-size:22px;margin:12px 0 4px;">Rumba Liguria Events</h1>
    </div>
    <div style="background:#0a0a12;border:1px solid #1e3a5f;border-radius:16px;overflow:hidden;">
      ${event.flyer_url ? `<img src="${event.flyer_url}" alt="${event.title}" style="width:100%;display:block;" />` : ""}
      <div style="padding:24px;">
        <h2 style="color:#fff;font-size:24px;margin:0 0 12px;">${event.title}</h2>
        ${event.details ? `<p style="color:#9ca3af;white-space:pre-line;margin:0 0 16px;line-height:1.6;">${event.details}</p>` : ""}
        <div style="display:inline-block;background:#1e3a5f;color:#60a5fa;padding:6px 16px;border-radius:999px;font-size:14px;margin-bottom:24px;">${priceLabel}</div>
        <a href="${event.siteUrl}" style="display:block;background:linear-gradient(90deg,#2563eb,#3b82f6);color:#fff;text-align:center;padding:14px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;">
          Prenota il tuo posto →
        </a>
      </div>
    </div>
    <p style="text-align:center;color:#4b5563;font-size:12px;margin-top:20px;">
      Hai ricevuto questa email perché sei registrato su Rumba Liguria Events.
    </p>
  </div>
</body>
</html>`;
}

export function qrTicketHtml(opts: {
  eventTitle: string;
  userEmail: string;
  guestCount: number;
  tickets: { code: string; verifyUrl: string; qrImageUrl: string }[];
}) {
  const ticketsHtml = opts.tickets.map((ticket, index) => `
    <div style="background:#0a0a12;border:1px solid #1e3a5f;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
      <div style="background:#22c55e20;border:1px solid #22c55e40;border-radius:12px;padding:12px;margin-bottom:20px;">
        <p style="color:#4ade80;font-size:16px;font-weight:600;margin:0;">🎟️ Biglietto ${index + 1} di ${opts.guestCount}</p>
      </div>
      <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">${opts.eventTitle}</h2>
      <p style="color:#9ca3af;margin:0 0 4px;">${opts.userEmail}</p>
      <div style="background:#fff;border-radius:12px;padding:16px;display:inline-block;margin-bottom:16px;">
        <img src="${ticket.qrImageUrl}" width="200" height="200" alt="QR Code" style="display:block;" />
      </div>
      <p style="color:#6b7280;font-size:12px;margin:0 0 8px;">Codice: <strong style="color:#9ca3af;font-family:monospace;">${ticket.code}</strong></p>
      <p style="color:#6b7280;font-size:12px;margin:0 0 20px;">Mostra questo QR all'ingresso</p>
      <a href="${ticket.verifyUrl}" style="display:block;background:linear-gradient(90deg,#2563eb,#3b82f6);color:#fff;text-align:center;padding:12px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;">
        Verifica Biglietto
      </a>
    </div>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;font-family:sans-serif;color:#fff;">
  <div style="max-width:480px;margin:0 auto;padding:24px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <img src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/659b52a5-69ae-4783-b222-bf54f8c81855/logo-1771260580239.png?width=200&height=200&resize=contain"
        width="64" height="64" style="border-radius:50%;border:2px solid #3b82f6;" alt="Rumba Liguria" />
      <h1 style="color:#3b82f6;font-size:22px;margin:12px 0 4px;">La tua Prenotazione</h1>
      <p style="color:#9ca3af;font-size:14px;margin-bottom:24px;">Hai prenotato per ${opts.guestCount} ${opts.guestCount === 1 ? "persona" : "persone"}. Trovi qui sotto tutti i tuoi biglietti.</p>
    </div>
    
    ${ticketsHtml}

    <p style="text-align:center;color:#4b5563;font-size:12px;margin-top:20px;">
      Conserva questa email — ogni QR è valido per una singola entrata.
    </p>
  </div>
</body>
</html>`;
}
