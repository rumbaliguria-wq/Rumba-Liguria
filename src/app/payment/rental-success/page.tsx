"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

type Outcome = "loading" | "failed" | "paid";

function RentalSuccessContent() {
  const sessionId = useSearchParams().get("session_id");
  const [accent, setAccent] = useState("#3b82f6");
  const [outcome, setOutcome] = useState<Outcome>("loading");

  useEffect(() => {
    try {
      const a = localStorage.getItem("rumba_accent");
      if (a) setAccent(a);
    } catch {}
  }, []);

  useEffect(() => {
    if (!sessionId) { setOutcome("failed"); return; }
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/checkout/rental-status?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.status === "paid") { setOutcome("paid"); return; }
        if (res.ok && data.status === "unpaid" && attempts < 10) {
          setTimeout(poll, 1500);
          return;
        }
      } catch {}
      if (!cancelled) setOutcome("failed");
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-md mx-auto text-center py-20">
        {outcome === "loading" && (
          <>
            <Loader2 size={36} className="mx-auto mb-4 animate-spin" style={{ color: accent }} />
            <p className="text-gray-300">Stiamo confermando il pagamento...</p>
          </>
        )}
        {outcome === "failed" && (
          <>
            <XCircle size={44} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-2xl font-bold mb-2">Pagamento non trovato</h1>
            <p className="text-gray-400 text-sm mb-6">Se hai già pagato, contattaci per conferma.</p>
          </>
        )}
        {outcome === "paid" && (
          <>
            <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
            <h1 className="text-2xl sm:text-3xl font-extrabold">Pagamento confermato!</h1>
            <p className="text-gray-400 text-sm mt-2">Riceverai una email con la conferma e la fattura.</p>
          </>
        )}
        <div className="mt-8">
          <Link href="/" className="inline-block px-6 py-3 rounded-xl font-semibold" style={{ background: accent }}>
            Torna al sito
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function RentalSuccessPage() {
  return (
    <Suspense fallback={null}>
      <RentalSuccessContent />
    </Suspense>
  );
}
