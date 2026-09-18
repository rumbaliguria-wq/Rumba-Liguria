"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { type Lang, t } from "@/lib/translations";
import { formatEUR } from "@/lib/pricing";
import type { PaymentResult } from "@/lib/payments";

type Outcome =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "done"; result: PaymentResult };

function SuccessContent() {
  const sessionId = useSearchParams().get("session_id");
  const [lang, setLang] = useState<Lang>("it");
  const [accent, setAccent] = useState("#8b5cf6");
  const [outcome, setOutcome] = useState<Outcome>({ state: "loading" });

  useEffect(() => {
    try {
      const l = localStorage.getItem("rumba_lang");
      if (l === "it" || l === "es" || l === "en") setLang(l);
      const a = localStorage.getItem("rumba_accent");
      if (a) setAccent(a);
    } catch {}
  }, []);

  useEffect(() => {
    if (!sessionId) { setOutcome({ state: "failed" }); return; }
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.result) {
          try { localStorage.removeItem("rumba_cart"); } catch {}
          setOutcome({ state: "done", result: data.result });
          return;
        }
        // "processing": otro proceso (el webhook) está entregando las entradas.
        if (res.ok && data.status === "processing" && attempts < 10) {
          setTimeout(poll, 1500);
          return;
        }
      } catch {}
      if (!cancelled) setOutcome({ state: "failed" });
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-xl mx-auto">
        {outcome.state === "loading" && (
          <div className="text-center py-24">
            <Loader2 size={36} className="mx-auto mb-4 animate-spin" style={{ color: accent }} />
            <p className="text-gray-300">{t(lang, "payment.verifying")}</p>
          </div>
        )}

        {outcome.state === "failed" && (
          <div className="text-center py-20">
            <XCircle size={44} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-2xl font-bold mb-2">{t(lang, "payment.failed.title")}</h1>
            <p className="text-gray-400 text-sm mb-6">{t(lang, "payment.failed.desc")}</p>
            <Link href="/" className="inline-block px-6 py-3 rounded-xl font-semibold" style={{ background: accent }}>
              {t(lang, "payment.backHome")}
            </Link>
          </div>
        )}

        {outcome.state === "done" && (
          <div>
            <div className="text-center mb-8">
              <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
              <h1 className="text-2xl sm:text-3xl font-extrabold">{t(lang, "payment.success.title")}</h1>
              <p className="text-gray-400 text-sm mt-2">{t(lang, "payment.success.subtitle")}</p>
            </div>

            {outcome.result.rejected.map((r) => (
              <p key={r.event_id} className="mb-4 p-3 rounded-xl text-sm text-yellow-300 bg-yellow-500/10 border border-yellow-500/20">
                {t(lang, "payment.refunded", { event: r.event_title, amount: formatEUR(r.refunded_cents) })}
              </p>
            ))}

            <div className="space-y-6">
              {outcome.result.tickets.map((tk) => (
                <section key={tk.event_id} className="p-5 rounded-2xl bg-[#0a0a12] border border-white/10">
                  <h2 className="text-lg font-bold">{tk.event_title}</h2>
                  {tk.ticket_type && <p className="text-xs text-gray-400 mb-3">{tk.ticket_type}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    {tk.codes.map((code, i) => (
                      <div key={code} className="text-center">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">
                          {t(lang, "payment.ticket")} {i + 1}
                        </p>
                        <div className="inline-block p-3 bg-white rounded-xl">
                          <QRCodeSVG value={`${origin}/verify/${code}`} size={160} level="M" />
                        </div>
                        <p className="font-mono text-xs text-gray-400 mt-2">{code}</p>
                        <p className="text-[11px] text-gray-500">{t(lang, "payment.showQr")}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="text-center mt-8">
              <Link href="/" className="inline-block px-6 py-3 rounded-xl font-semibold" style={{ background: accent }}>
                {t(lang, "payment.backHome")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
