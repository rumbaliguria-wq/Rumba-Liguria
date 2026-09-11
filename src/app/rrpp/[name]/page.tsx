"use client";

import Image from "next/image";
import { use, useState, type FormEvent } from "react";
import { CheckCircle2, Circle, Clock, LockKeyhole, Ticket, Users } from "lucide-react";

interface Person {
  name: string;
  entered: boolean;
}

interface Stats {
  event_title: string;
  event_date: string | null;
  total: number;
  entered: number;
  people: Person[];
}

export default function RrppPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "expired" | "ok">("idle");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pin.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/rrpp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin: pin.trim() }),
      });
      const data = await res.json();
      if (res.status === 410) {
        setStatus("expired");
        return;
      }
      if (!res.ok) {
        setMessage(data.error || "Link o PIN non corretti");
        setStatus("error");
        return;
      }
      setStats(data);
      setStatus("ok");
    } catch {
      setMessage("Impossibile connettersi al server. Riprova.");
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#05050b] text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute w-96 h-96 rounded-full bg-blue-600/20 blur-3xl -top-28 -left-20" />
      <div className="absolute w-80 h-80 rounded-full bg-fuchsia-600/15 blur-3xl -bottom-32 -right-20" />
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b15]/90 backdrop-blur-xl p-7 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Image src="/icon-512.png" alt="Rumba Liguria" width={54} height={54} className="rounded-2xl ring-1 ring-white/10" priority />
          <div>
            <p className="text-xs uppercase tracking-[.22em] text-blue-400 font-semibold">Rumba Liguria — RR.PP.</p>
            <h1 className="text-xl font-bold">{name}</h1>
          </div>
        </div>

        {status === "expired" ? (
          <div className="text-center py-6">
            <Clock size={44} className="mx-auto mb-4 text-gray-500" />
            <h2 className="text-lg font-bold">Statistiche non più disponibili</h2>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed">
              Sono passate più di 24 ore dalla fine dell&apos;evento — queste statistiche non si vedono più qui.
            </p>
          </div>
        ) : status === "ok" && stats ? (
          <div>
            <p className="text-sm text-gray-400 mb-1">Evento</p>
            <h2 className="text-lg font-bold mb-1">{stats.event_title}</h2>
            {stats.event_date && <p className="text-xs text-gray-500 mb-5">{stats.event_date}</p>}

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <Ticket size={18} className="mx-auto mb-1.5 text-blue-400" />
                <p className="text-2xl font-extrabold">{stats.total}</p>
                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Prenotati</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <Users size={18} className="mx-auto mb-1.5 text-emerald-400" />
                <p className="text-2xl font-extrabold">{stats.entered}</p>
                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Entrati</p>
              </div>
            </div>

            {stats.people.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-6">Ancora nessuna prenotazione con il tuo link.</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {stats.people.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                    <span className="text-sm text-gray-200 truncate">{p.name}</span>
                    {p.entered ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 flex-shrink-0"><CheckCircle2 size={14} /> Entrato</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0"><Circle size={14} /> In attesa</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-400 leading-relaxed">Inserisci il PIN che ti ha dato Rumba Liguria per vedere chi ha prenotato con il tuo link.</p>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-300"><LockKeyhole size={14} />PIN</label>
              <input
                type="text"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
            {status === "error" && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{message}</p>}
            <button disabled={status === "loading" || !pin.trim()} className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-400 py-3.5 font-semibold disabled:opacity-50">
              {status === "loading" ? "Verifica..." : "Entra"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
