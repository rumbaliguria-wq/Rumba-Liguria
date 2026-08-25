"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Camera,
  X,
  Save,
  Trash2,
  Edit3,
  Download,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  History,
  Upload,
  BarChart2,
  Ban,
  RotateCcw,
  IdCard,
  Globe,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import { ID_TYPE_PRESETS, encodeIdType, decodeIdType } from "@/lib/cardTypes";

interface Card {
  id: string;
  code: string;
  full_name: string;
  country: string | null;
  city: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  id_type: string | null;
  photo_url: string | null;
  notes: string | null;
  gender: string | null;
  active: boolean;
  inactive_reason: string | null;
  created_at: string;
  visit_count?: number;
  last_visit?: string | null;
}

interface ScanRecord {
  id: string;
  scanned_at: string;
  event_id: string | null;
  events?: { title: string } | null;
}

interface EventOption {
  id: string;
  title: string;
}

interface Stats {
  total_cards: number;
  total_scans: number;
  scans_today: number;
  by_type: Record<string, number>;
}

const EMPTY_FORM = {
  full_name: "",
  country: "",
  city: "",
  birth_date: "",
  phone: "",
  email: "",
  id_number: "",
  id_type_preset: "",
  id_type_custom: "",
  photo_url: "",
  notes: "",
  gender: "",
};

export default function CardsPanel({ autoOpenScannerTrigger }: { autoOpenScannerTrigger?: number }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [detailCard, setDetailCard] = useState<(Card & { scans: ScanRecord[] }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [events, setEvents] = useState<EventOption[]>([]);

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanEventId, setScanEventId] = useState("");
  const [scanResult, setScanResult] = useState<{ card: Card; visit_count: number; logged: boolean; scan: { scanned_at: string; events?: { title: string } | null } } | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScannedRef = useRef<string | null>(null);

  // Manual check-in state (for when a client doesn't have their card/phone on hand)
  const [showManualCheckin, setShowManualCheckin] = useState(false);
  const [manualEventId, setManualEventId] = useState("");
  const [manualSearch, setManualSearch] = useState("");
  const [manualCheckinLoadingId, setManualCheckinLoadingId] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cards");
      const data = await res.json();
      if (Array.isArray(data)) setCards(data);
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/cards/stats");
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (Array.isArray(data)) setEvents(data.map((e: { id: string; title: string }) => ({ id: e.id, title: e.title })));
    } catch {}
  }, []);

  useEffect(() => {
    fetchCards();
    fetchStats();
    fetchEvents();
  }, [fetchCards, fetchStats, fetchEvents]);

  // ─── Form ───

  const openCreateForm = () => {
    setEditingCard(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (card: Card) => {
    const decoded = decodeIdType(card.id_type);
    setEditingCard(card);
    setFormData({
      full_name: card.full_name || "",
      country: card.country || "",
      city: card.city || "",
      birth_date: card.birth_date || "",
      phone: card.phone || "",
      email: card.email || "",
      id_number: card.id_number || "",
      id_type_preset: decoded.preset,
      id_type_custom: decoded.custom,
      photo_url: card.photo_url || "",
      notes: card.notes || "",
      gender: card.gender || "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCard(null);
    setFormData(EMPTY_FORM);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/cards/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setFormData((p) => ({ ...p, photo_url: data.url }));
        toast.success("Foto caricata!");
      } else {
        toast.error(data.error || "Errore upload");
      }
    } catch {
      toast.error("Errore upload");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const handleSaveCard = async () => {
    if (!formData.full_name.trim()) {
      toast.error("Il nome e cognome sono obbligatori");
      return;
    }
    if (formData.id_type_preset === "OTRO" && !formData.id_type_custom.trim()) {
      toast.error("Specifica il tipo di tessera");
      return;
    }
    setSaving(true);
    const body = {
      full_name: formData.full_name.trim(),
      country: formData.country.trim(),
      city: formData.city.trim(),
      birth_date: formData.birth_date || null,
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      id_number: formData.id_number.trim(),
      id_type: formData.id_type_preset ? encodeIdType(formData.id_type_preset, formData.id_type_custom) : "",
      photo_url: formData.photo_url,
      notes: formData.notes.trim(),
      gender: formData.gender,
    };
    try {
      const res = editingCard
        ? await fetch(`/api/cards/${editingCard.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (res.ok) {
        toast.success(editingCard ? "Tessera aggiornata!" : "Tessera creata!");
        closeForm();
        fetchCards();
        fetchStats();
      } else {
        const data = await res.json();
        toast.error(data.error || "Errore");
      }
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm("Eliminare definitivamente questa tessera? Verrà eliminato anche lo storico accessi. L'azione non può essere annullata.")) return;
    const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Tessera eliminata!");
      setDetailCard(null);
      fetchCards();
      fetchStats();
    } else {
      toast.error("Errore eliminazione");
    }
  };

  const handleToggleActive = async (card: Card) => {
    const newActive = !card.active;
    let reason: string | null = null;
    if (!newActive) {
      const input = window.prompt("Motivo della disattivazione (facoltativo):", "");
      if (input === null) return; // cancelled
      reason = input.trim() || null;
    }
    const res = await fetch(`/api/cards/${card.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: card.full_name, active: newActive, inactive_reason: newActive ? null : reason }),
    });
    if (res.ok) {
      toast.success(newActive ? "Tessera riattivata!" : "Tessera disattivata!");
      fetchCards();
      if (detailCard?.id === card.id) setDetailCard({ ...detailCard, active: newActive, inactive_reason: newActive ? null : reason });
    } else {
      toast.error("Errore");
    }
  };

  const openDetail = async (card: Card) => {
    setDetailLoading(true);
    setDetailCard({ ...card, scans: [] });
    try {
      const res = await fetch(`/api/cards/${card.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailCard(data);
      }
    } catch {
      toast.error("Errore caricamento tessera");
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Downloadable card image ───

  const formatBirthDate = (raw: string | null): string => {
    if (!raw) return "";
    const [y, m, d] = raw.split("-").map(Number);
    if (!y || !m || !d) return raw;
    const str = new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    return str.replace(/ de (\p{L})/u, (full, letter) => ` de ${letter.toUpperCase()}`);
  };

  const BRAND_LOGO_URL = "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/659b52a5-69ae-4783-b222-bf54f8c81855/logo-1771260580239.png?width=200&height=200&resize=contain";

  const downloadCardImage = async (card: Card) => {
    try {
      // Compute rows first so we can size the canvas to fit everything —
      // otherwise the QR can end up positioned past the canvas's fixed height.
      const rows: { icon: "calendar" | "globe" | "pin" | "id"; label: string; value: string }[] = [
        { icon: "calendar" as const, label: "DÍA DE NACIMIENTO", value: formatBirthDate(card.birth_date) },
        { icon: "globe" as const, label: "PAÍS", value: card.country || "" },
        { icon: "pin" as const, label: "CIUDAD", value: card.city || "" },
        { icon: "id" as const, label: "TIPO DE TARJETA", value: decodeIdType(card.id_type).label },
      ].filter((r) => r.value && r.value !== "—");

      const W = 640, RADIUS = 24;
      const splitY = 260;
      const photoR = 140;
      // Name sits below the photo's halo (photoR + 8px ring), never overlapping it —
      // otherwise dark clothing/hair in the photo can swallow the (near-black) name text.
      const nameY = splitY + photoR + 8 + 55;
      const pillY = nameY + 55, pillH = 56;
      const rowsStartY = pillY + pillH + 50;
      const rowGap = 68;
      const qrSize = 260;
      const qrY = rowsStartY + rows.length * rowGap + 20;

      // Notes are printed as a footer below the QR so whoever holds the card
      // can always read them (e.g. revocation terms) — measured on a scratch
      // context since the real canvas isn't sized yet.
      const notesFontSize = 13;
      const notesLineHeight = 18;
      const notesMaxWidth = W - 80;
      let notesLines: string[] = [];
      if (card.notes && card.notes.trim()) {
        const measureCtx = document.createElement("canvas").getContext("2d")!;
        measureCtx.font = `${notesFontSize}px Arial`;
        notesLines = wrapTextLines(measureCtx, card.notes.trim(), notesMaxWidth);
      }
      const notesTopPad = notesLines.length ? 34 : 0;
      const notesBlockHeight = notesLines.length ? notesTopPad + notesLines.length * notesLineHeight : 0;

      const H = qrY + qrSize + 60 + notesBlockHeight;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.textAlign = "center";

      // Clip everything to the rounded card outline
      roundRect(ctx, 0, 0, W, H, RADIUS);
      ctx.clip();

      // White base + black top panel (its straight bottom edge forms the divide)
      const topColor = card.gender === "M" ? "#0f2a5c" : card.gender === "F" ? "#7a1f4b" : "#111111";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = topColor;
      ctx.fillRect(0, 0, W, splitY);

      // Faint watermark, visible on both the black and white halves
      ctx.save();
      ctx.translate(W / 2, splitY - 10);
      ctx.rotate(-0.05);
      ctx.font = "italic 64px 'Segoe Script', 'Brush Script MT', cursive";
      ctx.strokeStyle = "rgba(160,160,160,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeText("Rumba Liguria", 0, 0);
      ctx.restore();

      // Photo straddling the black/white divide
      const photoCx = W / 2, photoCy = splitY;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(photoCx, photoCy, photoR + 8, 0, Math.PI * 2);
      ctx.fill();

      let photoDrawn = false;
      if (card.photo_url) {
        try {
          const img = await loadImage(card.photo_url);
          ctx.save();
          ctx.beginPath();
          ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          const side = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, photoCx - photoR, photoCy - photoR, photoR * 2, photoR * 2);
          ctx.restore();
          photoDrawn = true;
        } catch {
          photoDrawn = false;
        }
      }
      if (!photoDrawn) {
        ctx.fillStyle = "#e5e5e5";
        ctx.beginPath();
        ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#888888";
        ctx.font = "bold 56px Arial";
        const initials = (card.full_name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
        ctx.fillText(initials || "?", photoCx, photoCy + 20);
      }

      // Name, in script
      ctx.fillStyle = "#111111";
      ctx.font = "56px 'Segoe Script', 'Brush Script MT', cursive";
      wrapCenteredText(ctx, card.full_name, W / 2, nameY, W - 60, 60);

      // Black pill badge with brand
      ctx.font = "700 12px Arial";
      const line1 = "TARJETA";
      ctx.font = "700 20px Arial";
      const line2 = "Rumba Liguria";
      const line2Width = ctx.measureText(line2).width;
      const line1Width = (() => { ctx.font = "700 12px Arial"; return ctx.measureText(line1).width; })();
      const textBlockWidth = Math.max(line1Width, line2Width);
      const iconR = 16;
      const pillW = iconR * 2 + 20 + textBlockWidth + 44;
      const pillX = W / 2 - pillW / 2;
      ctx.fillStyle = "#111111";
      roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fill();

      const logoCx = pillX + 22 + iconR, logoCy = pillY + pillH / 2;
      let logoDrawn = false;
      try {
        const logoImg = await loadImage(BRAND_LOGO_URL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoCx, logoCy, iconR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(logoImg, logoCx - iconR, logoCy - iconR, iconR * 2, iconR * 2);
        ctx.restore();
        logoDrawn = true;
      } catch {
        logoDrawn = false;
      }
      if (!logoDrawn) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(logoCx, logoCy, iconR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111111";
        ctx.font = "bold 16px Georgia";
        ctx.fillText("R", logoCx, logoCy + 6);
      }

      const textX = logoCx + iconR + 14;
      ctx.textAlign = "left";
      ctx.fillStyle = "#d1d1d1";
      ctx.font = "700 11px Arial";
      ctx.letterSpacing = "1px";
      ctx.fillText(line1, textX, pillY + 23);
      ctx.letterSpacing = "0px";
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 20px Arial";
      ctx.fillText(line2, textX, pillY + 44);
      ctx.textAlign = "center";

      // Info rows: icon badge + label + value
      const rowIconX = 82;
      const rowTextX = 122;
      ctx.textAlign = "left";
      rows.forEach((row, i) => {
        const rowY = rowsStartY + i * rowGap;
        ctx.fillStyle = "#111111";
        ctx.beginPath();
        ctx.arc(rowIconX, rowY, 24, 0, Math.PI * 2);
        ctx.fill();
        drawRowIcon(ctx, row.icon, rowIconX, rowY);

        ctx.fillStyle = "#111111";
        ctx.font = "700 14px Arial";
        ctx.fillText(row.label, rowTextX, rowY - 5);
        ctx.fillStyle = "#666666";
        ctx.font = "18px Arial";
        ctx.fillText(row.value, rowTextX, rowY + 18);
      });
      ctx.textAlign = "center";

      // QR code with a "SCAN ME" cutout in the middle
      const qrDataUrl = await QRCode.toDataURL(card.code, { width: qrSize, margin: 1, errorCorrectionLevel: "H", color: { dark: "#111111", light: "#ffffff" } });
      const qrImg = await loadImage(qrDataUrl);
      const qrX = W / 2 - qrSize / 2;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      const cutoutSize = qrSize * 0.3;
      const cutoutX = W / 2 - cutoutSize / 2, cutoutY = qrY + qrSize / 2 - cutoutSize / 2;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, cutoutX, cutoutY, cutoutSize, cutoutSize, 8);
      ctx.fill();
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2;
      roundRect(ctx, cutoutX, cutoutY, cutoutSize, cutoutSize, 8);
      ctx.stroke();
      ctx.fillStyle = "#111111";
      ctx.font = "700 12px Arial";
      ctx.fillText("SCAN", W / 2, qrY + qrSize / 2 - 4);
      ctx.font = "700 14px Arial";
      ctx.fillText("ME", W / 2, qrY + qrSize / 2 + 14);

      // Notes footer
      if (notesLines.length) {
        const lineY = qrY + qrSize + notesTopPad;
        ctx.strokeStyle = "#e5e5e5";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(50, lineY - 20);
        ctx.lineTo(W - 50, lineY - 20);
        ctx.stroke();
        ctx.fillStyle = "#888888";
        ctx.font = `italic ${notesFontSize}px Arial`;
        ctx.textAlign = "center";
        notesLines.forEach((line, i) => {
          ctx.fillText(line, W / 2, lineY + i * notesLineHeight);
        });
      }

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("toBlob failed");
      const link = document.createElement("a");
      link.download = `tessera-${slugify(card.full_name)}-${card.code}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error("Impossibile generare l'immagine della tessera");
    }
  };

  // ─── Manual check-in ───

  const closeManualCheckin = () => {
    setShowManualCheckin(false);
    setManualEventId("");
    setManualSearch("");
  };

  const handleManualCheckin = async (card: Card) => {
    if (!manualEventId) return;
    setManualCheckinLoadingId(card.id);
    try {
      const res = await fetch("/api/cards/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: card.code, event_id: manualEventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Errore check-in");
        return;
      }
      toast.success(data.logged ? `Check-in registrato per ${card.full_name}!` : `${card.full_name} era già entrato/a in questo evento`);
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, visit_count: data.visit_count } : c)));
      fetchStats();
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setManualCheckinLoadingId(null);
    }
  };

  // ─── Scanner ───

  const stopScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      clearTimeout(scanIntervalRef.current as unknown as ReturnType<typeof setTimeout>);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const closeScanner = useCallback(() => {
    stopScanner();
    setShowScanner(false);
    setScanResult(null);
    setScanError(null);
    setScanLoading(false);
    lastScannedRef.current = null;
  }, [stopScanner]);

  const handleDetectedCode = useCallback(async (raw: string) => {
    if (!scanEventId) return; // event is required — the scanner shouldn't even be running without one
    if (lastScannedRef.current === raw) return;
    lastScannedRef.current = raw;
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanLoading(true);
    setScanError(null);
    setScanResult(null);
    try {
      const res = await fetch("/api/cards/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: raw.trim(), event_id: scanEventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || "Tessera non trovata");
        return;
      }
      setScanResult({ card: data.card, visit_count: data.visit_count, logged: data.logged, scan: data.scan });
      fetchCards();
      fetchStats();
    } catch {
      setScanError("Errore di connessione");
    } finally {
      setScanLoading(false);
    }
  }, [scanEventId, fetchCards, fetchStats]);

  // Starts the detection loop against the already-open camera stream —
  // does NOT re-request camera permission, so it's safe to call repeatedly
  // between scans without a flicker/delay.
  const startDetectionLoop = useCallback(async () => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

    if (hasBarcodeDetector) {
      // @ts-expect-error BarcodeDetector is not in the TS DOM lib yet
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        const vid = videoRef.current;
        if (!vid || vid.readyState < 2 || !streamRef.current) return;
        try {
          const barcodes = await detector.detect(vid);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            await handleDetectedCode(barcodes[0].rawValue);
            return;
          }
        } catch {}
        if (streamRef.current) {
          scanIntervalRef.current = setTimeout(tick, 250) as unknown as ReturnType<typeof setInterval>;
        }
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

  const resumeScanning = useCallback(() => {
    lastScannedRef.current = null;
    setScanResult(null);
    setScanError(null);
    if (streamRef.current) startDetectionLoop();
  }, [startDetectionLoop]);

  const startScanner = useCallback(async () => {
    setScanResult(null);
    setScanError(null);
    setScanLoading(false);
    lastScannedRef.current = null;
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.setAttribute("muted", "true");
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => {});
      }

      await startDetectionLoop();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setScanError("Permesso fotocamera negato. Abilita la fotocamera nelle impostazioni.");
      } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
        setScanError("Nessuna fotocamera trovata su questo dispositivo.");
      } else {
        setScanError("Non è stato possibile accedere alla fotocamera.");
      }
    }
  }, [startDetectionLoop]);

  useEffect(() => {
    // Camera only starts once an event is selected — entries are always logged against one.
    if (showScanner && scanEventId) startScanner();
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showScanner, scanEventId]);

  // Opens the scanner when the unified "Scan" chooser in the admin header routes here.
  useEffect(() => {
    if (autoOpenScannerTrigger) setShowScanner(true);
  }, [autoOpenScannerTrigger]);

  // ─── Derived ───

  const filteredCards = cards.filter((c) => {
    const matchesSearch =
      !search.trim() ||
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.id_number || "").toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase());
    const decoded = decodeIdType(c.id_type);
    const matchesType = !typeFilter || decoded.preset === typeFilter;
    return matchesSearch && matchesType;
  });

  const manualFilteredCards = cards.filter((c) => {
    if (!c.active) return false;
    if (!manualSearch.trim()) return true;
    const q = manualSearch.toLowerCase();
    return c.full_name.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="p-3 sm:p-4 rounded-xl bg-[#0a0a12] border border-blue-500/10 glow-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <IdCard size={18} className="text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-white">{stats?.total_cards ?? "—"}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Tessere</p>
            </div>
          </div>
        </div>
        <div className="p-3 sm:p-4 rounded-xl bg-[#0a0a12] border border-blue-500/10 glow-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <BarChart2 size={18} className="text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-white">{stats?.total_scans ?? "—"}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Accessi totali</p>
            </div>
          </div>
        </div>
        <div className="p-3 sm:p-4 rounded-xl bg-[#0a0a12] border border-green-500/10 glow-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-white">{stats?.scans_today ?? "—"}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Accessi oggi</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, email, documento o codice..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/40 transition-all text-sm"
        >
          <option value="" className="bg-[#0a0a12] text-white">Tutti i tipi</option>
          {ID_TYPE_PRESETS.map((p) => (
            <option key={p} value={p} className="bg-[#0a0a12] text-white">{decodeIdType(p).label}</option>
          ))}
          <option value="OTRO" className="bg-[#0a0a12] text-white">Altro</option>
        </select>
        <button
          onClick={() => setShowScanner(true)}
          className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-all text-xs sm:text-sm font-medium active:scale-95 flex-shrink-0"
        >
          <Camera size={16} />
          Scansiona
        </button>
        <button
          onClick={() => setShowManualCheckin(true)}
          className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 transition-all text-xs sm:text-sm font-medium active:scale-95 flex-shrink-0"
        >
          <CheckCircle size={16} />
          Check-in Manuale
        </button>
        <button
          onClick={openCreateForm}
          className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all text-xs sm:text-sm font-medium glow-blue-sm active:scale-95 flex-shrink-0"
        >
          <Plus size={16} />
          Nuova Tessera
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <IdCard size={40} className="mx-auto mb-3 opacity-40" />
          <p>{cards.length === 0 ? "Nessuna tessera creata" : "Nessun risultato per questa ricerca"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCards.map((card) => {
            const typeInfo = decodeIdType(card.id_type);
            return (
              <button
                key={card.id}
                onClick={() => openDetail(card)}
                className={`text-left p-4 rounded-xl bg-[#0a0a12] border transition-all hover:border-blue-500/30 ${
                  card.active ? "border-white/10" : "border-red-500/20 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  {card.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.photo_url} alt={card.full_name} className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-white/10" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <User size={20} className="text-blue-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{card.full_name}</p>
                    {typeInfo.label !== "—" && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-500/15 text-blue-300 border border-blue-500/25">
                        {typeInfo.label}
                      </span>
                    )}
                    {!card.active && (
                      <span className="inline-block mt-1 ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-500/15 text-red-300 border border-red-500/25">
                        Disattivata
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span className="truncate">{[card.city, card.country].filter(Boolean).join(", ") || "—"}</span>
                  <span className="flex items-center gap-1 text-blue-400 font-semibold flex-shrink-0">
                    <CheckCircle size={12} />
                    {card.visit_count ?? 0}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create/Edit form modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0a0a12] border border-blue-500/20 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingCard ? "Modifica Tessera" : "Nuova Tessera"}</h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
                <X size={18} />
              </button>
            </div>

            {/* Photo */}
            <div className="flex items-center gap-3">
              {formData.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={formData.photo_url} alt="" className="w-16 h-16 rounded-full object-cover border border-white/10" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <User size={24} className="text-gray-500" />
                </div>
              )}
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 cursor-pointer text-xs sm:text-sm transition-all">
                <Upload size={14} />
                {photoUploading ? "Caricamento..." : "Foto (facoltativa)"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={photoUploading} />
              </label>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nome e Cognome *</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 text-sm"
                placeholder="Mario Rossi"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Paese</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 text-sm"
                  placeholder="Italia"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Città</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 text-sm"
                  placeholder="La Spezia"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Data di nascita</label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData((p) => ({ ...p, birth_date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/40 text-sm [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Telefono</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 text-sm"
                  placeholder="+39 347 000 0000"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 text-sm"
                placeholder="mario.rossi@email.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Numero Documento</label>
                <input
                  type="text"
                  value={formData.id_number}
                  onChange={(e) => setFormData((p) => ({ ...p, id_number: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 text-sm"
                  placeholder="Facoltativo"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Tipo Tessera</label>
                <select
                  value={formData.id_type_preset}
                  onChange={(e) => setFormData((p) => ({ ...p, id_type_preset: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/40 text-sm"
                >
                  <option value="" className="bg-[#0a0a12] text-white">Seleziona...</option>
                  {ID_TYPE_PRESETS.map((p) => (
                    <option key={p} value={p} className="bg-[#0a0a12] text-white">{decodeIdType(p).label}</option>
                  ))}
                  <option value="OTRO" className="bg-[#0a0a12] text-white">Altro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Genere</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData((p) => ({ ...p, gender: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/40 text-sm"
              >
                <option value="" className="bg-[#0a0a12] text-white">Non specificato</option>
                <option value="M" className="bg-[#0a0a12] text-white">Uomo</option>
                <option value="F" className="bg-[#0a0a12] text-white">Donna</option>
              </select>
            </div>

            {formData.id_type_preset === "OTRO" && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Specifica il tipo</label>
                <input
                  type="text"
                  value={formData.id_type_custom}
                  onChange={(e) => setFormData((p) => ({ ...p, id_type_custom: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 text-sm"
                  placeholder="es. Staff, Sponsor..."
                />
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Note aggiuntive</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 text-sm resize-none"
                placeholder="Facoltativo"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={closeForm}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-all text-sm font-medium"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveCard}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-all text-sm font-medium"
              >
                <Save size={14} />
                {saving ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Detail modal */}
      {detailCard && createPortal(
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0a0a12] border border-blue-500/20 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold truncate pr-2">{detailCard.full_name}</h2>
              <button onClick={() => setDetailCard(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 flex-shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 py-2">
              {detailCard.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detailCard.photo_url} alt="" className="w-20 h-20 rounded-full object-cover border border-white/10" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <User size={30} className="text-blue-400" />
                </div>
              )}
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG value={detailCard.code} size={160} />
              </div>
              <p className="text-xs font-mono text-gray-500">{detailCard.code}</p>
              {!detailCard.active && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-red-500/15 text-red-300 border border-red-500/25">
                  Tessera disattivata
                </span>
              )}
              {!detailCard.active && detailCard.inactive_reason && (
                <p className="text-xs text-red-300/80 text-center max-w-[260px]">Motivo: {detailCard.inactive_reason}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow icon={Globe} label="Paese" value={detailCard.country} />
              <InfoRow icon={MapPin} label="Città" value={detailCard.city} />
              <InfoRow icon={Calendar} label="Nascita" value={detailCard.birth_date} />
              <InfoRow icon={Phone} label="Telefono" value={detailCard.phone} />
              <InfoRow icon={Mail} label="Email" value={detailCard.email} />
              <InfoRow icon={CreditCard} label="Documento" value={detailCard.id_number} />
            </div>

            {detailCard.notes && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300">
                {detailCard.notes}
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
              <span className="text-sm text-gray-400 flex items-center gap-2">
                <History size={16} className="text-blue-400" />
                Ingressi registrati
              </span>
              <span className="text-xl font-bold text-blue-400">{detailCard.visit_count ?? detailCard.scans?.length ?? 0}</span>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : detailCard.scans && detailCard.scans.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {detailCard.scans.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 text-xs">
                    <span className="text-gray-300">
                      {new Date(s.scanned_at).toLocaleString("it-IT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {s.events?.title && <span className="text-blue-400 truncate ml-2">{s.events.title}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 text-sm py-2">Nessun ingresso registrato ancora</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => downloadCardImage(detailCard)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all text-sm font-medium"
              >
                <Download size={14} />
                Scarica
              </button>
              <button
                onClick={() => { openEditForm(detailCard); setDetailCard(null); }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-all text-sm font-medium"
              >
                <Edit3 size={14} />
                Modifica
              </button>
              <button
                onClick={() => handleToggleActive(detailCard)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all text-sm font-medium"
              >
                {detailCard.active ? <Ban size={14} /> : <RotateCcw size={14} />}
                {detailCard.active ? "Disattiva" : "Riattiva"}
              </button>
              <button
                onClick={() => handleDeleteCard(detailCard.id)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-sm font-medium"
              >
                <Trash2 size={14} />
                Elimina
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Manual check-in modal */}
      {showManualCheckin && createPortal(
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0a0a12] border border-blue-500/20 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle size={18} className="text-yellow-400" />
                Check-in Manuale
              </h2>
              <button onClick={closeManualCheckin} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Usa questo se il cliente non ha con sé la tessera o il telefono: cerca il nome e registra l&apos;ingresso manualmente.
            </p>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Evento *</label>
              <select
                value={manualEventId}
                onChange={(e) => setManualEventId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/40 text-sm"
              >
                <option value="" className="bg-[#0a0a12] text-white">Seleziona un evento...</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id} className="bg-[#0a0a12] text-white">{ev.title}</option>
                ))}
              </select>
            </div>

            {!manualEventId ? (
              <p className="text-center text-gray-500 text-sm py-6">Seleziona prima un evento per cercare le tessere.</p>
            ) : (
              <>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    placeholder="Cerca per nome, email o codice..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-sm"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {manualFilteredCards.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm py-6">Nessuna tessera trovata</p>
                  ) : (
                    manualFilteredCards.map((card) => (
                      <div key={card.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {card.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.photo_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/10" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                              <User size={16} className="text-blue-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{card.full_name}</p>
                            <p className="text-[10px] text-gray-500 truncate">{card.visit_count ?? 0} ingressi totali</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleManualCheckin(card)}
                          disabled={manualCheckinLoadingId === card.id}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 border border-yellow-500/20 transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                        >
                          <CheckCircle size={13} />
                          {manualCheckinLoadingId === card.id ? "..." : "Check-in"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Scanner modal */}
      {showScanner && createPortal(
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="font-bold flex items-center gap-2">
              <Camera size={18} className="text-blue-400" />
              Scansiona Tessera
            </h2>
            <button onClick={closeScanner} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
              <X size={20} />
            </button>
          </div>

          <div className="p-3 border-b border-white/10">
            <label className="text-xs text-gray-400 mb-1 block">Evento (obbligatorio per registrare l&apos;ingresso)</label>
            <select
              value={scanEventId}
              onChange={(e) => setScanEventId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/40"
            >
              <option value="" className="bg-[#0a0a12] text-white">Seleziona un evento...</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-[#0a0a12] text-white">{ev.title}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            {!scanEventId ? (
              <div className="max-w-xs w-full text-center space-y-3 p-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                  <Calendar size={28} className="text-blue-400" />
                </div>
                <p className="text-gray-300 font-medium">
                  {events.length === 0
                    ? "Crea prima un evento nella scheda Eventi per poter registrare gli ingressi."
                    : "Seleziona un evento qui sopra per iniziare a scansionare."}
                </p>
              </div>
            ) : (
              <>
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                {!scanResult && !scanError && !scanLoading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-2 border-blue-400/60 rounded-2xl" />
                  </div>
                )}

                {scanLoading && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {scanError && (
                  <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-4">
                    <div className="max-w-xs w-full text-center space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <XCircle size={30} className="text-red-400" />
                      </div>
                      <p className="text-red-400 font-semibold">{scanError}</p>
                      <button onClick={resumeScanning} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium">
                        Scansiona di nuovo
                      </button>
                    </div>
                  </div>
                )}

                {scanResult && (
                  <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-4 animate-fade-in">
                    <div className="max-w-xs w-full text-center space-y-4">
                      <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center animate-scale-in ${
                        scanResult.logged ? "bg-green-500/15 border border-green-500/40" : "bg-yellow-500/15 border border-yellow-500/40"
                      }`}>
                        <CheckCircle size={38} className={scanResult.logged ? "text-green-400" : "text-yellow-400"} />
                      </div>
                      {scanResult.card.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={scanResult.card.photo_url} alt="" className="w-16 h-16 rounded-full object-cover mx-auto border border-white/20" />
                      ) : null}
                      <h1 className="text-2xl font-bold text-white">{scanResult.card.full_name}</h1>
                      {decodeIdType(scanResult.card.id_type).label !== "—" && (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/25">
                          {decodeIdType(scanResult.card.id_type).label}
                        </span>
                      )}
                      <p className={`text-sm font-medium ${scanResult.logged ? "text-green-400" : "text-yellow-400"}`}>
                        {scanResult.logged ? "Ingresso registrato!" : "Già entrato/a pochi secondi fa"}
                      </p>
                      {scanResult.scan?.events?.title && (
                        <p className="text-white font-semibold text-sm">{scanResult.scan.events.title}</p>
                      )}
                      {scanResult.scan?.scanned_at && (
                        <p className="text-gray-400 text-xs">
                          {new Date(scanResult.scan.scanned_at).toLocaleString("it-IT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      <p className="text-gray-400 text-sm">Ingressi totali: <span className="text-white font-bold">{scanResult.visit_count}</span></p>
                      <button onClick={resumeScanning} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all">
                        Scansiona un&apos;altra tessera
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-gray-200 truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

function drawRowIcon(ctx: CanvasRenderingContext2D, icon: "calendar" | "globe" | "pin" | "id", cx: number, cy: number) {
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (icon === "calendar") {
    ctx.strokeRect(cx - 9, cy - 7, 18, 16);
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy - 2);
    ctx.lineTo(cx + 9, cy - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 10);
    ctx.lineTo(cx - 4, cy - 5);
    ctx.moveTo(cx + 4, cy - 10);
    ctx.lineTo(cx + 4, cy - 5);
    ctx.stroke();
  } else if (icon === "globe") {
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 4, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (icon === "pin") {
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 7, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.lineTo(cx, cy + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeRect(cx - 10, cy - 7, 20, 14);
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 2.5);
    ctx.lineTo(cx + 10, cy - 2.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy + 2.5);
    ctx.lineTo(cx + 2, cy + 2.5);
    ctx.stroke();
  }
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapCenteredText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxWidth: number, lineHeight: number) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lineHeight));
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function slugify(text: string): string {
  return (text || "cliente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "cliente";
}
