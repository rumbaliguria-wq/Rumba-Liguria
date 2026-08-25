"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, XCircle, Users, Calendar, Ticket, Ban, Clock, PartyPopper } from "lucide-react";

interface Reservation {
  id: string;
  code: string;
  event_id: string;
  user_email: string;
  user_name: string;
  guest_count: number;
  status: string;
  created_at: string;
  events: {
    title: string;
    details: string;
    flyer_url: string | null;
    event_date_iso: string | null;
  };
}

function formatDisplayName(name: string | null | undefined, email: string): string {
  if (!name || name.includes("@")) {
    return email
      .split("@")[0]
      .replace(/[._0-9]/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\s+/g, " ")
      .trim() || email;
  }
  return name;
}

function isExpired(eventDateIso: string | null | undefined): boolean {
  if (!eventDateIso) return false;
  // Expire at 05:00 Rome time the day after the event
  const [ey, em, ed] = eventDateIso.split("-").map(Number);
  const nextDate = new Date(Date.UTC(ey, em - 1, ed + 1));
  const ny = nextDate.getUTCFullYear();
  const nm = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(nextDate.getUTCDate()).padStart(2, "0");
  const targetRome = `${ny}-${nm}-${nd} 05:00`;
  const approx = Date.UTC(ey, em - 1, ed + 1, 3, 0, 0);
  let lo = approx - 4 * 3600000;
  let hi = approx + 4 * 3600000;
  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const romeAtMid = new Date(mid).toLocaleString("en-CA", { timeZone: "Europe/Rome", hour12: false }).replace(",", "").slice(0, 16);
    if (romeAtMid <= targetRome) lo = mid + 1;
    else hi = mid;
  }
  return Date.now() > lo;
}

export default function VerifyPage() {
  const params = useParams();
  const code = params.code as string;
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reservations/${code}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setReservation(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [code]);

  const handleConfirm = async () => {
    if (!reservation || confirming) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/reservations/${code}`, { method: "PATCH" });
      const data = await res.json();
      if (res.ok) {
        setReservation({ ...reservation, status: "used" });
        setConfirmed(true);
      } else {
        setConfirmError(data.error || "Errore di conferma");
      }
    } catch {
      setConfirmError("Errore di connessione");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <XCircle size={40} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-red-400">Non trovata</h1>
          <p className="text-gray-400">Questo codice QR non corrisponde a nessuna prenotazione valida.</p>
          <a href="/" className="inline-block mt-4 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-all">
            Torna alla home
          </a>
        </div>
      </div>
    );
  }

  const isUsed = reservation.status === "used";
  const isCancelled = reservation.status === "cancelled";
  const expired = isExpired(reservation.events?.event_date_iso);
  const isInvalid = isUsed || isCancelled || expired;
  const displayName = formatDisplayName(reservation.user_name, reservation.user_email);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white flex items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-5">

        {/* Status header */}
        <div className="text-center space-y-3">
          {confirmed ? (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center animate-scale-in">
                <PartyPopper size={38} className="text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-green-400">Benvenuto/a!</h1>
              <p className="text-gray-400 text-sm">Prenotazione confermata. Buona serata!</p>
            </>
          ) : isUsed ? (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-gray-500/10 border border-gray-500/30 flex items-center justify-center">
                <CheckCircle size={40} className="text-gray-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-300">Già Utilizzata</h1>
              <p className="text-gray-500 text-sm">Questa prenotazione è già stata usata all&apos;ingresso.</p>
            </>
          ) : isCancelled ? (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Ban size={40} className="text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-red-400">Cancellata</h1>
              <p className="text-gray-400 text-sm">Questa prenotazione è stata cancellata e non è più valida.</p>
            </>
          ) : expired ? (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                <Clock size={40} className="text-orange-400" />
              </div>
              <h1 className="text-2xl font-bold text-orange-400">QR Scaduto</h1>
              <p className="text-gray-400 text-sm">Questo QR non è più valido. L&apos;evento è già terminato.</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center animate-scale-in">
                <Ticket size={40} className="text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Prenotazione Attiva</h1>
              <p className="text-gray-400 text-sm">Conferma la prenotazione all&apos;ingresso.</p>
            </>
          )}
        </div>

        {/* Reservation card */}
        <div className={`border rounded-2xl p-5 space-y-4 ${
          confirmed ? "bg-green-500/5 border-green-500/25" :
          isInvalid ? "bg-white/3 border-white/8" :
          "bg-white/5 border-white/10"
        }`}>
          {reservation.events.flyer_url && (
            <div className="relative w-full rounded-xl overflow-hidden bg-black flex justify-center">
              <img
                src={reservation.events.flyer_url}
                alt={reservation.events.title}
                className="w-full h-auto object-contain max-h-[60vh]"
              />
            </div>
          )}

          <div className="space-y-3">
            {/* Event name */}
            <div className="flex items-start gap-3">
              <Ticket size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Evento</p>
                <p className="text-lg font-bold text-white">{reservation.events.title}</p>
              </div>
            </div>

            {/* Guest */}
            <div className="flex items-start gap-3">
              <Users size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Prenotato da</p>
                <p className="text-white font-semibold">{displayName}</p>
                <p className="text-gray-400 text-sm">{reservation.user_email}</p>
              </div>
            </div>

            {/* Person count */}
            <div className="flex items-start gap-3">
              <Users size={18} className="text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Persone</p>
                <p className="text-3xl font-bold text-green-400">{reservation.guest_count}</p>
              </div>
            </div>

            {/* Date */}
            <div className="flex items-start gap-3">
              <Calendar size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Data prenotazione</p>
                <p className="text-gray-300 text-sm">
                  {new Date(reservation.created_at).toLocaleDateString("it-IT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Codice</p>
              <p className="text-sm font-mono text-blue-400 tracking-widest">{reservation.code}</p>
            </div>

            {/* Status badge */}
            <div className="pt-2 border-t border-white/10">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                confirmed || isUsed ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                isCancelled ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                expired ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              }`}>
                {confirmed ? "Confermata ✓" : isCancelled ? "Cancellata" : isUsed ? "Utilizzata" : expired ? "Scaduta" : "Attiva"}
              </span>
            </div>
          </div>
        </div>

        {/* Confirm button — only if active and not expired */}
        {!isInvalid && !confirmed && (
          <div className="space-y-2">
            {confirmError && (
              <p className="text-center text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl py-2 px-4">{confirmError}</p>
            )}
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {confirming ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle size={22} />
                  Conferma Prenotazione
                </>
              )}
            </button>
          </div>
        )}

        <a href="/" className="block text-center text-sm text-gray-500 hover:text-gray-300 transition-all">
          Torna alla home
        </a>
      </div>
    </div>
  );
}
