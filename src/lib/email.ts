const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM = "Rumba Liguria <onboarding@resend.dev>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return res.json();
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
