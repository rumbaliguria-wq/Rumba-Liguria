"use client";

import Image from "next/image";
import { use, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, CheckCircle2, Clock, LockKeyhole, RotateCcw, Ticket, Users, XCircle } from "lucide-react";

interface ScanResult {
  valid: boolean;
  already_used: boolean;
  name: string;
  guest_count: number;
}

export default function IngressoPage({ params }: { params: Promise<{ name: string }> }) {
  // Next no decodifica el segmento dinámico de la URL — si el nombre tiene
  // un espacio, sin esto llegaría literal como "Entrata%202" y el PIN nunca
  // coincidiría con el guardado (mismo bug ya corregido en /rrpp y /colaborador).
  const { name: rawName } = use(params);
  const name = decodeURIComponent(rawName);

  const [pin, setPin] = useState("");
  const [loginStatus, setLoginStatus] = useState<"idle" | "loading" | "error" | "expired">("idle");
  const [loginError, setLoginError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [checkedInCount, setCheckedInCount] = useState(0);

  const [showScanner, setShowScanner] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

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
      const res = await fetch("/api/ingresso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin: pin.trim() }),
      });
      const data = await res.json();
      if (res.status === 410) { setLoginStatus("expired"); return; }
      if (!res.ok) {
        setLoginError(data.error || "Link o PIN non corretti");
        setLoginStatus("error");
        return;
      }
      setEventTitle(data.event_title || "");
      setCheckedInCount(data.checked_in_count || 0);
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
      const res = await fetch("/api/ingresso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin: pin.trim(), code }),
      });
      const data = await res.json();
      if (res.status === 410) {
        setScanError("L'evento è terminato — questo accesso non funziona più.");
        return;
      }
      if (!res.ok) {
        setScanError(data.error || "Ticket non trovato");
        return;
      }
      setScanResult({ valid: data.valid, already_used: data.already_used, name: data.name, guest_count: data.guest_count });
      if (typeof data.checked_in_count === "number") setCheckedInCount(data.checked_in_count);
    } catch {
      setScanError("Errore di connessione");
    } finally {
      setScanLoading(false);
    }
  }, [name, pin]);

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
            <p className="text-xs uppercase tracking-[.22em] text-blue-400 font-semibold">Rumba Liguria — Ingresso</p>
            <h1 className="text-xl font-bold">{name}</h1>
          </div>
        </div>

        {loginStatus === "expired" ? (
          <div className="text-center py-6">
            <Clock size={44} className="mx-auto mb-4 text-gray-500" />
            <h2 className="text-lg font-bold">Accesso scaduto</h2>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed">
              L&apos;evento di questo accesso è già finito — non è più utilizzabile.
            </p>
          </div>
        ) : !loggedIn ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-sm text-gray-400 leading-relaxed">Inserisci il PIN che ti ha dato Rumba Liguria per scansionare i ticket.</p>
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
            <p className="text-sm text-gray-400 mb-1">{eventTitle}</p>
            <p className="text-xs text-gray-500 mb-1">Ingressi registrati</p>
            <p className="text-4xl font-extrabold mb-6">{checkedInCount}</p>
            <button
              onClick={() => setShowScanner(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-400 py-4 font-semibold active:scale-[0.98] transition-all"
            >
              <Camera size={18} /> Scansiona ticket
            </button>
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
                  {scanResult.valid ? <CheckCircle2 size={44} className="text-green-400" /> : <XCircle size={44} className="text-yellow-400" />}
                  <h2 className="text-lg font-bold">{scanResult.name}</h2>
                  <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                    <Users size={12} /> {scanResult.guest_count} {scanResult.guest_count === 1 ? "persona" : "persone"}
                  </span>
                  <p className={`text-sm font-semibold ${scanResult.valid ? "text-green-400" : "text-yellow-400"}`}>
                    {scanResult.valid ? "✅ Ingresso registrato!" : "⚠️ Già utilizzato"}
                  </p>
                </div>
              )}
              {scanError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-red-950/90">
                  <Ticket size={40} className="text-red-400" />
                  <p className="text-sm font-semibold text-red-300">{scanError}</p>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-gray-500 mb-4">Ingressi registrati: <span className="text-white font-bold">{checkedInCount}</span></p>

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
