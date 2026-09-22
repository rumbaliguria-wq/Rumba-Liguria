"use client";

import Image from "next/image";
import { use, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, CheckCircle2, Clock, LockKeyhole, RotateCcw, Users, XCircle } from "lucide-react";

interface CardResult {
  full_name: string;
  id_type: string | null;
  card_number: number | null;
  photo_url: string | null;
}

interface TodayEntry {
  full_name: string;
  scanned_at: string;
}

function typeLabel(idType: string | null): string {
  if (!idType) return "";
  if (idType.startsWith("OTRO:")) return idType.slice(5);
  const known: Record<string, string> = { ERASMUS: "Erasmus", UNIVERSITARIO: "Universitario", ALTRO: "Altro", VIP: "VIP", CLIENTE: "Cliente" };
  return known[idType] || idType;
}

export default function ColaboradorPage({ params }: { params: Promise<{ name: string }> }) {
  // Next no decodifica el segmento dinámico de la URL — si el nombre tiene
  // un espacio (p. ej. "Bar Onda"), sin esto llegaría literal como
  // "Bar%20Onda" y el PIN nunca coincidiría con el guardado.
  const { name: rawName } = use(params);
  const name = decodeURIComponent(rawName);
  const [pin, setPin] = useState("");
  const [loginStatus, setLoginStatus] = useState<"idle" | "loading" | "error">("idle");
  const [loginError, setLoginError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [todayList, setTodayList] = useState<TodayEntry[]>([]);
  const [showTodayList, setShowTodayList] = useState(false);

  const [showScanner, setShowScanner] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ card: CardResult; valid: boolean } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScannedRef = useRef<string | null>(null);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoginStatus("loading");
    try {
      const res = await fetch("/api/colaborador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin: pin.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Link o PIN non corretti");
        setLoginStatus("error");
        return;
      }
      setTodayCount(data.today_count || 0);
      setTodayList(data.today_list || []);
      setLoggedIn(true);
    } catch {
      setLoginError("Impossibile connettersi al server. Riprova.");
      setLoginStatus("error");
    }
  }

  const stopScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      clearTimeout(scanIntervalRef.current as unknown as ReturnType<typeof setTimeout>);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  const handleDetectedCode = useCallback(async (raw: string) => {
    if (lastScannedRef.current === raw) return;
    lastScannedRef.current = raw;
    let code = raw.trim();
    try {
      const url = new URL(raw);
      const parts = url.pathname.split("/").filter(Boolean);
      code = parts[parts.length - 1] || code;
    } catch {}

    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    setScanLoading(true);
    setScanError(null);
    setScanResult(null);
    try {
      const res = await fetch("/api/colaborador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin: pin.trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || "Tessera non trovata");
        return;
      }
      setScanResult({ card: data.card, valid: data.valid });
      setTodayCount(data.today_count ?? todayCount);
      if (data.today_list) setTodayList(data.today_list);
    } catch {
      setScanError("Errore di connessione");
    } finally {
      setScanLoading(false);
    }
  }, [name, pin, todayCount]);

  const startDetectionLoop = useCallback(async () => {
    const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
    if (hasBarcodeDetector) {
      // @ts-expect-error BarcodeDetector is not in the TS DOM lib yet
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        const vid = videoRef.current;
        if (!vid || vid.readyState < 2 || !streamRef.current) return;
        try {
          const barcodes = await detector.detect(vid);
          if (barcodes.length > 0 && barcodes[0].rawValue) { await handleDetectedCode(barcodes[0].rawValue); return; }
        } catch {}
        if (streamRef.current) scanIntervalRef.current = setTimeout(tick, 250) as unknown as ReturnType<typeof setInterval>;
      };
      scanIntervalRef.current = setTimeout(tick, 500) as unknown as ReturnType<typeof setInterval>;
    } else {
      const jsQR = (await import("jsqr")).default;
      const canvas = canvasRef.current;
      scanIntervalRef.current = setInterval(() => {
        const vid = videoRef.current;
        if (!vid || !canvas || vid.readyState < 2) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        canvas.width = vid.videoWidth || 640;
        canvas.height = vid.videoHeight || 480;
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (qr?.data) handleDetectedCode(qr.data);
      }, 300);
    }
  }, [handleDetectedCode]);

  const startScanner = useCallback(async () => {
    setScanResult(null);
    setScanError(null);
    lastScannedRef.current = null;
    stopScanner();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => {});
      }
      await startDetectionLoop();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Permission") || msg.includes("NotAllowed")) setScanError("Permesso fotocamera negato. Abilita la fotocamera nelle impostazioni del telefono.");
      else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) setScanError("Nessuna fotocamera trovata su questo dispositivo.");
      else setScanError("Non è stato possibile accedere alla fotocamera.");
    }
  }, [stopScanner, startDetectionLoop]);

  const resumeScanning = useCallback(() => {
    lastScannedRef.current = null;
    setScanResult(null);
    setScanError(null);
    if (streamRef.current) startDetectionLoop();
    else startScanner();
  }, [startDetectionLoop, startScanner]);

  useEffect(() => {
    if (showScanner) startScanner();
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showScanner]);

  return (
    <main className="min-h-screen bg-[#05050b] text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute w-96 h-96 rounded-full bg-blue-600/20 blur-3xl -top-28 -left-20" />
      <div className="absolute w-80 h-80 rounded-full bg-fuchsia-600/15 blur-3xl -bottom-32 -right-20" />
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b15]/90 backdrop-blur-xl p-7 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Image src="/icon-512.png" alt="Rumba Liguria" width={54} height={54} className="rounded-2xl ring-1 ring-white/10" priority />
          <div>
            <p className="text-xs uppercase tracking-[.22em] text-blue-400 font-semibold">Rumba Liguria — Colaboratore</p>
            <h1 className="text-xl font-bold">{name}</h1>
          </div>
        </div>

        {!loggedIn ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-sm text-gray-400 leading-relaxed">Inserisci il PIN che ti ha dato Rumba Liguria per validare le tessere dei clienti.</p>
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
            {loginStatus === "error" && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{loginError}</p>}
            <button disabled={loginStatus === "loading" || !pin.trim()} className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-400 py-3.5 font-semibold disabled:opacity-50">
              {loginStatus === "loading" ? "Verifica..." : "Entra"}
            </button>
          </form>
        ) : !showScanner ? (
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-1">Persone validate oggi</p>
            <p className="text-4xl font-extrabold mb-6">{todayCount}</p>
            <button
              onClick={() => setShowScanner(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-400 py-4 font-semibold active:scale-[0.98] transition-all"
            >
              <Camera size={18} /> Scansiona tessera
            </button>

            {todayCount > 0 && (
              <div className="mt-4 text-left">
                <button
                  onClick={() => setShowTodayList((v) => !v)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 py-2"
                >
                  <Users size={13} />
                  {showTodayList ? "Nascondi elenco" : "Vedi chi ho validato oggi"}
                </button>
                {showTodayList && (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    {todayList.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
                        <span className="text-sm text-gray-200 truncate">{entry.full_name}</span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0">
                          <Clock size={11} />
                          {new Date(entry.scanned_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square mb-4">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
              <canvas ref={canvasRef} className="hidden" />
              {!scanResult && !scanError && !scanLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 border-2 border-blue-400/70 rounded-2xl" />
                </div>
              )}
              {scanLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {scanResult && (
                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center ${scanResult.valid ? "bg-green-950/90" : "bg-yellow-950/90"}`}>
                  {scanResult.card.photo_url ? (
                    <Image src={scanResult.card.photo_url} alt="" width={64} height={64} className="w-16 h-16 rounded-full object-cover border border-white/20" />
                  ) : scanResult.valid ? (
                    <CheckCircle2 size={40} className="text-green-400" />
                  ) : (
                    <XCircle size={40} className="text-yellow-400" />
                  )}
                  <h2 className="text-lg font-bold">{scanResult.card.full_name}</h2>
                  {typeLabel(scanResult.card.id_type) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">{typeLabel(scanResult.card.id_type)}</span>
                  )}
                  <p className={`text-sm font-semibold ${scanResult.valid ? "text-green-400" : "text-yellow-400"}`}>
                    {scanResult.valid ? "✅ Valida" : "⚠️ Già usata oggi"}
                  </p>
                </div>
              )}
              {scanError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-red-950/90">
                  <XCircle size={40} className="text-red-400" />
                  <p className="text-sm font-semibold text-red-300">{scanError}</p>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-gray-500 mb-4">Persone validate oggi: <span className="text-white font-bold">{todayCount}</span></p>

            <div className="flex gap-2">
              {(scanResult || scanError) && (
                <button onClick={resumeScanning} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-3 font-semibold active:scale-[0.98] transition-all">
                  <RotateCcw size={16} /> Scansiona ancora
                </button>
              )}
              <button
                onClick={() => { stopScanner(); setShowScanner(false); setScanResult(null); setScanError(null); }}
                className="flex-1 rounded-xl bg-white/5 border border-white/10 py-3 font-semibold hover:bg-white/10 transition-all"
              >
                Chiudi
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
