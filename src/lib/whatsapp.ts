// Envío de mensajes de WhatsApp a través de CallMeBot (https://www.callmebot.com/blog/free-api-whatsapp-messages/).
// Cada número receptor necesita su propia apikey: se obtiene enviando
// "I allow callmebot to send me messages" al +34 644 51 95 23 desde ese número.

export async function sendWhatsApp({
  phone,
  text,
  apikey,
}: {
  phone: string;
  text: string;
  apikey: string;
}) {
  // CallMeBot espera el número sin "+" ni espacios.
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cleanPhone)}` +
    `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;

  const res = await fetch(url, { method: "GET" });
  const body = await res.text();

  // CallMeBot a veces responde 200 con un cuerpo de error (apikey inválida, número no autorizado…).
  const ok = res.ok && /queued|message to system|sent|will be delivered/i.test(body);
  if (!ok) {
    throw new Error(`CallMeBot no pudo enviar el WhatsApp: ${body.slice(0, 200)}`);
  }
  return body;
}
