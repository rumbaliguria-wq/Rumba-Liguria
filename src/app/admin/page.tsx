"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import { toast } from "sonner";
import {
    Lock,
    Plus,
    Trash2,
    Edit3,
    Upload,
    Users,
    Calendar,
    X,
    Save,
    LogOut,
    Eye,
    EyeOff,
    Image as ImageIcon,
    MessageCircle,
    Settings,
    Ticket,
    CheckCircle,
    XCircle,
    Mail,
    Bell,
    MapPin,
    Star,
    Video,
    Images,
    Archive,
    ArchiveRestore,
    Camera,
    Search,
    Package,
    Phone,
    PencilLine,
    RotateCcw,
    BarChart2,
    ChevronLeft,
    ChevronRight,
    CreditCard,
  } from "lucide-react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import CardsPanel from "@/components/CardsPanel";

interface Event {
  id: string;
  title: string;
  details: string;
  price: string;
  flyer_url: string;
  flyer_ratio: string;
  maps_url?: string;
  is_popular?: boolean;
  organizer?: string;
    archived?: boolean;
    publish_at?: string;
    event_date?: string;
    event_date_iso?: string;
    event_time?: string;
    event_time_end?: string;
  max_tickets?: number;
  max_per_person?: number;
  dress_code?: string;
  min_age?: number;
  sale_start?: string;
  sale_end?: string;
  archive_at?: string;
  ticket_types?: { name: string; color: string }[];
  created_at: string;
  reservation_total?: number;
  reservation_used?: number;
}

interface User {
  id: string;
  email: string;
  phone: string | null;
  created_at: string;
  name?: string | null;
  userType?: string | null;
  source?: "registered" | "reservation";
}

  interface Reservation {
    id: string;
    code: string;
    event_id: string;
    user_email: string;
    user_name: string;
    guest_count: number;
    status: string;
    created_at: string;
    events: { title: string; event_date_iso?: string; archived?: boolean } | null;
  }

interface GalleryItem {
  id: string;
  url: string;
  type: "image" | "video";
  created_at: string;
}

interface RentalItem {
  id: string;
  name: string;
  description: string;
  price: string;
  duration: string;
  photos: string[];
  contact_phone: string;
  contact_email: string;
  available: boolean;
  archived?: boolean;
  created_at: string;
}

interface RentalConfig {
  items: RentalItem[];
  section_name: string;
  button_name: string;
  enabled: boolean;
}

// Disegna il QR VIP con il suo numero fisso al centro — usa errorCorrectionLevel
// "H" (tollera fino al ~30% di area coperta) così il badge del numero non
// rompe la leggibilità del codice.
async function drawVipQRCanvas(url: string, vipNumber: number): Promise<HTMLCanvasElement> {
  const size = 280;
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, { width: size, margin: 1, errorCorrectionLevel: "H", color: { dark: "#d4a017", light: "#ffffff" } });
  const ctx = canvas.getContext("2d")!;
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const badgeR = size * 0.16;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, badgeR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#111111";
  ctx.font = `700 ${Math.round(badgeR * (String(vipNumber).length > 2 ? 0.85 : 1.1))}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(vipNumber), cx, cy + 1);
  return canvas;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"events" | "users" | "reservations" | "gallery" | "rentals" | "cards" | "settings">("events");
  const [rentalConfig, setRentalConfig] = useState<RentalConfig>({ items: [], section_name: "Noleggio Attrezzatura", button_name: "Noleggio", enabled: true });
  const [rentalForm, setRentalForm] = useState<Partial<RentalItem> & { photosUploading?: boolean }>({ name: "", description: "", price: "", duration: "", photos: [], contact_phone: "", contact_email: "", available: true });
  const [editingRental, setEditingRental] = useState<RentalItem | null>(null);
  const [showRentalForm, setShowRentalForm] = useState(false);
  const [rentalSaving, setRentalSaving] = useState(false);
  const [editSectionName, setEditSectionName] = useState(false);
  const [editButtonName, setEditButtonName] = useState(false);
  const [credCurrentPass, setCredCurrentPass] = useState("");
  const [credNewUser, setCredNewUser] = useState("");
  const [credNewPass, setCredNewPass] = useState("");
  const [credSaving, setCredSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    details: "",
    price: "free",
    flyer_url: "",
    flyer_ratio: "16:9",
    maps_url: "",
    is_popular: false,
    organizer: "Rumba Liguria",
    event_date: "",
    event_date_iso: "",
    event_time: "",
    event_time_end: "",
    max_tickets: "",
      max_per_person: "",
      dress_code: "",
      min_age: "",
      publish_at: "",
      sale_start: "",
      sale_end: "",
      archive_at: "",
    });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifyOnPublish, setNotifyOnPublish] = useState(false);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showCredCurrentPass, setShowCredCurrentPass] = useState(false);
  const [showCredNewPass, setShowCredNewPass] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [colorSaving, setColorSaving] = useState(false);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>("all");
  const [reservationSearch, setReservationSearch] = useState("");
  const [statsEvent, setStatsEvent] = useState<Event | null>(null);
  const [statsDrilldown, setStatsDrilldown] = useState<{ label: string; list: Reservation[] } | null>(null);
  const [placeSuggestions, setPlaceSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeLoading, setPlaceLoading] = useState(false);
  const [formTicketTypes, setFormTicketTypes] = useState<{name: string; color: string}[]>([]);
  const [manualLinkMode, setManualLinkMode] = useState(false);
  const [showVipSection, setShowVipSection] = useState(false);
  const [vipEventId, setVipEventId] = useState("");
  const [vipCountInput, setVipCountInput] = useState("1");
  const [vipCodes, setVipCodes] = useState<{ code: string; vip_number: number }[]>([]);
  const [vipGenerating, setVipGenerating] = useState(false);
  const [vipName, setVipName] = useState("");
  const [vipDownloadingAll, setVipDownloadingAll] = useState(false);
  const [vipStatusList, setVipStatusList] = useState<{ id: string; code: string; vip_number: number | null; user_name: string; status: string }[]>([]);
  const [vipStatusLoading, setVipStatusLoading] = useState(false);
  const [vipDeletingCode, setVipDeletingCode] = useState<string | null>(null);
  const [vipBulkDeleting, setVipBulkDeleting] = useState(false);
  const [showLinksSection, setShowLinksSection] = useState(false);
  const [linkEventId, setLinkEventId] = useState("");
  const [linkName, setLinkName] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkGenerating, setLinkGenerating] = useState(false);
  const [allLinks, setAllLinks] = useState<{eventTitle: string; name: string; url: string}[]>([]);
  const [reassignLinkName, setReassignLinkName] = useState<string | null>(null);
  const [reassignEventId, setReassignEventId] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [showArchivedLinkStats, setShowArchivedLinkStats] = useState(false);
  const [openArchivedLinkEvent, setOpenArchivedLinkEvent] = useState<string | null>(null);
  const placeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // QR Scanner
  const [showScanChooser, setShowScanChooser] = useState(false);
  const [cardScanTrigger, setCardScanTrigger] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<{ name: string; email: string; event: string; code: string; rawCode: string; userType?: string; isVip?: boolean } | null>(null);
  const [scanConfirming, setScanConfirming] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const fetchReservationsRef = useRef<(() => Promise<void>) | null>(null);

  const stopScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      clearTimeout(scanIntervalRef.current as unknown as ReturnType<typeof setTimeout>);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    const video = videoRef.current;
    if (video) { video.srcObject = null; }
  }, []);

  const closeScanner = useCallback(() => {
    stopScanner();
    setShowScanner(false);
    setScanResult(null);
    setScanError(null);
    setScanSuccess(false);
    setScanLoading(false);
    setScanConfirming(false);
    lastScannedRef.current = null;
  }, [stopScanner]);

  const handleValidateCode = useCallback(async (raw: string) => {
    if (lastScannedRef.current === raw) return;
    lastScannedRef.current = raw;
    // QR contains full URL: https://domain.com/verify/CODE — extract just the code
    let code = raw.trim();
    try {
      const url = new URL(raw);
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("verify");
      if (idx !== -1 && parts[idx + 1]) {
        code = parts[idx + 1];
      } else if (parts.length > 0) {
        code = parts[parts.length - 1];
      }
    } catch {
      // Not a URL, use raw value
    }
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    setScanLoading(true);
    setScanError(null);
    setScanResult(null);
    try {
      // Only fetch info — do NOT confirm yet, wait for user to press confirm button
      const infoRes = await fetch(`/api/reservations/${code}`);
      if (!infoRes.ok) {
        const d = await infoRes.json();
        setScanError(d.error || "Prenotazione non trovata");
        setScanLoading(false);
        return;
      }
      const reservation = await infoRes.json();
      if (reservation.status === "used") { setScanError("Già utilizzato"); setScanLoading(false); return; }
      if (reservation.status === "cancelled") { setScanError("Prenotazione cancellata"); setScanLoading(false); return; }
      if (reservation.status === "expired") { setScanError("QR scaduto"); setScanLoading(false); return; }
      if (reservation.status === "vip_used") { setScanError("VIP già utilizzato"); setScanLoading(false); return; }
      // Show info card — user must press confirm to mark as used
      // Fetch user type for non-VIP users
      let userType: string | undefined;
      if (!reservation.is_vip && reservation.user_email && reservation.user_email !== "__vip__") {
        try {
          const uRes = await fetch(`/api/users/by-email?email=${encodeURIComponent(reservation.user_email)}`);
          if (uRes.ok) {
            const uData = await uRes.json();
            userType = uData.userType || undefined;
          }
        } catch {}
      }
      setScanResult({
        name: reservation.user_name || "—",
        email: reservation.user_email === "__vip__" ? (reservation.events?.title || "Evento") : (reservation.user_email || "—"),
        event: reservation.events?.title || "Evento",
        code,
        rawCode: code,
        userType,
        isVip: reservation.is_vip || false,
      });
    } catch { setScanError("Errore di connessione"); }
    finally { setScanLoading(false); }
  }, []);

  const handleConfirmEntry = useCallback(async () => {
    if (!scanResult) return;
    setScanConfirming(true);
    try {
      const patchRes = await fetch(`/api/reservations/${scanResult.rawCode}`, { method: "PATCH" });
      if (!patchRes.ok) {
        const d = await patchRes.json();
        setScanError(d.error || "Errore validazione");
        setScanResult(null);
        setScanConfirming(false);
        return;
      }
      setScanSuccess(true);
      fetchReservationsRef.current?.();
    } catch { setScanError("Errore di connessione"); setScanResult(null); }
    finally { setScanConfirming(false); }
  }, [scanResult]);

  const startScanner = useCallback(async () => {
    setScanResult(null); setScanError(null); setScanSuccess(false); setScanLoading(false); setScanConfirming(false);
    lastScannedRef.current = null;
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
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

      // Detectar si BarcodeDetector está disponible (Android Chrome nativo - mucho más rápido)
      const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

      if (hasBarcodeDetector) {
        // @ts-ignore
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const tick = async () => {
          const vid = videoRef.current;
          if (!vid || vid.readyState < 2 || !streamRef.current) return;
          try {
            // @ts-ignore
            const barcodes = await detector.detect(vid);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              await handleValidateCode(barcodes[0].rawValue);
              return;
            }
          } catch {}
          if (streamRef.current) {
            scanIntervalRef.current = setTimeout(tick, 250) as unknown as ReturnType<typeof setInterval>;
          }
        };
        scanIntervalRef.current = setTimeout(tick, 500) as unknown as ReturnType<typeof setInterval>;
      } else {
        // Fallback: jsqr para Safari / otros navegadores
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
          if (qr?.data) handleValidateCode(qr.data);
        }, 300);
      }
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
  }, [handleValidateCode]);

  const fetchEvents = useCallback(async () => {
    const res = await fetch("/api/admin/events");
    const data = await res.json();
    if (Array.isArray(data)) {
      // Sort: active first (by event_date_iso asc), then archived (by date desc)
      const active = data.filter((e: Event) => !e.archived).sort((a: Event, b: Event) => {
        if (a.event_date_iso && b.event_date_iso) return a.event_date_iso.localeCompare(b.event_date_iso);
        if (a.event_date_iso) return -1;
        if (b.event_date_iso) return 1;
        return 0;
      });
      const archived = data.filter((e: Event) => e.archived).sort((a: Event, b: Event) => {
        if (a.event_date_iso && b.event_date_iso) return b.event_date_iso.localeCompare(a.event_date_iso);
        if (a.event_date_iso) return -1;
        if (b.event_date_iso) return 1;
        return 0;
      });
      setEvents([...active, ...archived]);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch {}
  }, []);

    const formatDisplayName = (name: string | null | undefined, email: string): string => {
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
    };

    const fetchReservations = useCallback(async () => {
      const res = await fetch("/api/reservations");
      const data = await res.json();
      if (Array.isArray(data)) {
        const enriched = data.map((r: Reservation) => ({
          ...r,
          user_name: formatDisplayName(r.user_name, r.user_email),
        }));
        const sorted = enriched.sort((a: Reservation, b: Reservation) => {
          const archA = a.events?.archived ? 1 : 0;
          const archB = b.events?.archived ? 1 : 0;
          if (archA !== archB) return archA - archB;
          const dateA = a.events?.event_date_iso || "9999-99-99";
          const dateB = b.events?.event_date_iso || "9999-99-99";
          if (dateA !== dateB) {
            if (!archA) return dateA.localeCompare(dateB);
            return dateB.localeCompare(dateA);
          }
          const statusOrder: Record<string, number> = { "active": 0, "used": 1, "cancelled": 2 };
          const orderA = statusOrder[a.status] ?? 3;
          const orderB = statusOrder[b.status] ?? 3;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setReservations(sorted);
      }
    }, []);

    // Guardar referencia para usar en handleValidateCode
    fetchReservationsRef.current = fetchReservations;

  const fetchGallery = useCallback(async () => {
    const res = await fetch("/api/gallery");
    const data = await res.json();
    if (Array.isArray(data)) setGallery(data);
  }, []);

  const fetchRentals = useCallback(async () => {
    try {
      const res = await fetch("/api/rentals");
      const data = await res.json();
      if (data && !data.error) setRentalConfig(data as RentalConfig);
    } catch {}
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("rumba_admin");
    if (saved === "true") setAuthenticated(true);
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchEvents();
      fetchUsers();
      fetchReservations();
      fetchGallery();
      fetchRentals();
      fetch("/api/admin/color").then(r => r.json()).then(d => {
        if (d.accent_color) setAccentColor(d.accent_color);
      }).catch(() => {});
    }
  }, [authenticated, fetchEvents, fetchUsers, fetchReservations, fetchGallery, fetchRentals]);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setAuthenticated(true);
        localStorage.setItem("rumba_admin", "true");
        toast.success("Benvenuto, Admin!");
      } else {
        toast.error("Credenziali non valide");
      }
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthenticated(false);
    localStorage.removeItem("rumba_admin");
  };

  const handleCredentialsUpdate = async () => {
    if (!credCurrentPass || !credNewUser || !credNewPass) {
      toast.error("Compila tutti i campi");
      return;
    }
    setCredSaving(true);
    try {
      const res = await fetch("/api/admin/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: credCurrentPass,
          newUsername: credNewUser,
          newPassword: credNewPass,
        }),
      });
      if (res.ok) {
        toast.success("Credenziali aggiornate!");
        setCredCurrentPass("");
        setCredNewUser("");
        setCredNewPass("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Errore");
      }
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setCredSaving(false);
    }
  };

  const resizeImage = (file: File, ratio: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);

        // Just cap the longest side at 2160px, preserving aspect ratio — no cropping
        const MAX = 2160;
        let dw = img.width;
        let dh = img.height;
        if (dw > MAX || dh > MAX) {
          const scale = Math.min(MAX / dw, MAX / dh);
          dw = Math.round(dw * scale);
          dh = Math.round(dh * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = dw;
        canvas.height = dh;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, dw, dh);

        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error("Canvas toBlob failed")),
          "image/jpeg",
          0.92
        );
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Detect real image dimensions to auto-set the ratio
      const detectedRatio = await new Promise<string>((resolve) => {
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const r = img.width / img.height;
          if (r < 0.8) resolve("9:16");       // tall portrait
          else if (r > 1.2) resolve("16:9");  // wide landscape
          else resolve("1:1");                  // square
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(formData.flyer_ratio || "16:9"); };
        img.src = url;
      });

      // Upload the original file directly — no resizing, no cropping
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/events/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setFormData((prev) => ({ ...prev, flyer_url: data.url, flyer_ratio: detectedRatio }));
        toast.success(`Flyer caricato! (${detectedRatio} rilevato automaticamente)`);
      } else {
        toast.error(data.error || "Errore upload");
      }
    } catch {
      toast.error("Errore upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Il titolo è obbligatorio");
      return;
    }
    setSaving(true);
    const body = {
      ...formData,
      ticket_types: formTicketTypes.filter(tt => tt.name.trim()),
      publish_at: formData.publish_at ? new Date(formData.publish_at).toISOString() : null,
      sale_start: formData.sale_start ? new Date(formData.sale_start).toISOString() : null,
      sale_end: formData.sale_end ? new Date(formData.sale_end).toISOString() : null,
      archive_at: formData.archive_at ? new Date(formData.archive_at).toISOString() : null,
      notifyUsers: notifyOnPublish,
    };

    try {
      if (editingEvent) {
        const res = await fetch(`/api/events/${editingEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast.success("Evento aggiornato!");
          resetForm();
          fetchEvents();
        } else {
          const data = await res.json();
          toast.error(data.error || "Errore");
        }
      } else {
        const res = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        if (res.ok) {
          toast.success("Evento creato!");
          resetForm();
          fetchEvents();
        } else {
          const data = await res.json();
          toast.error(data.error || "Errore");
        }
      }
    } catch (err) {
      toast.error("Errore di connessione: " + (err instanceof Error ? err.message : "sconosciuto"));
    } finally {
      setSaving(false);
    }
  };

    const handleDelete = async (id: string) => {
      if (!confirm("Sei sicuro di voler eliminare questo evento?")) return;
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Evento eliminato!");
        fetchEvents();
      } else {
        toast.error("Errore eliminazione");
      }
    };

    const handleArchive = async (event: Event) => {
      const newArchived = !event.archived;
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...event,
          archived: newArchived,
        }),
      });
      if (res.ok) {
        toast.success(newArchived ? "Evento archiviato!" : "Evento ripristinato!");
        fetchEvents();
      } else {
        toast.error("Errore");
      }
    };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      details: event.details || "",
      price: event.price,
      flyer_url: event.flyer_url || "",
      flyer_ratio: event.flyer_ratio || "16:9",
      maps_url: event.maps_url || "",
      is_popular: event.is_popular || false,
      organizer: event.organizer || "Rumba Liguria",
        event_date: event.event_date || "",
        event_date_iso: event.event_date_iso || "",
        event_time: event.event_time || "",
        event_time_end: event.event_time_end || "",
          max_tickets: event.max_tickets ? String(event.max_tickets) : "",
          max_per_person: event.max_per_person ? String(event.max_per_person) : "",
        dress_code: event.dress_code || "",
      min_age: event.min_age ? String(event.min_age) : "",
      publish_at: event.publish_at ? (() => {
        const d = new Date(event.publish_at);
        const z = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - z).toISOString().slice(0, 16);
      })() : "",
      sale_start: event.sale_start ? (() => {
        const d = new Date(event.sale_start);
        const z = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - z).toISOString().slice(0, 16);
      })() : "",
      sale_end: event.sale_end ? (() => {
        const d = new Date(event.sale_end);
        const z = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - z).toISOString().slice(0, 16);
      })() : "",
      archive_at: event.archive_at ? (() => {
        const d = new Date(event.archive_at);
        const z = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - z).toISOString().slice(0, 16);
      })() : "",
      });
      setFormTicketTypes(event.ticket_types || []);
      setPlaceQuery(event.maps_url || "");
      setPlaceSuggestions([]);
      setShowForm(true);
  };

  const handleCancelReservation = async (id: string) => {
    if (!confirm("Sei sicuro di voler cancellare questa prenotazione?")) return;
    const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Prenotazione cancellata!");
      setReservations(prev => prev.map(x => x.id === id ? { ...x, status: "cancelled" } : x));
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Errore cancellazione");
    }
  };

  const handleRestoreReservation = async (id: string) => {
    const res = await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    if (res.ok) {
      toast.success("Prenotazione ripristinata!");
      setReservations(prev => prev.map(x => x.id === id ? { ...x, status: "active" } : x));
    } else {
      toast.error("Errore ripristino");
    }
  };

  const handleDownloadAllVip = async () => {
    if (vipCodes.length === 0) return;
    setVipDownloadingAll(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://rumbaliguria.com";
      const files: File[] = [];
      for (const item of vipCodes) {
        const url = `${origin}/verify/${item.code}`;
        const canvas = await drawVipQRCanvas(url, item.vip_number);
        const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (blob) files.push(new File([blob], `vip-${item.vip_number}-${item.code}.png`, { type: "image/png" }));
      }

      // On phones, hand the images to the native share sheet so the user can
      // save them all to Photos (or send them straight on) in one go — no zip
      // to unpack. Desktop browsers mostly don't support sharing files, so
      // fall back to triggering the downloads one after another there.
      const canShareFiles = typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files });
      if (canShareFiles) {
        await navigator.share({ files, title: "Codici VIP Rumba Liguria" });
        toast.success("Salva o condividi le immagini dal pannello aperto");
        return;
      }

      for (const file of files) {
        const link = document.createElement("a");
        link.download = file.name;
        link.href = URL.createObjectURL(file);
        link.click();
        URL.revokeObjectURL(link.href);
        await new Promise((r) => setTimeout(r, 250));
      }
      toast.success(`${files.length} QR scaricati!`);
    } catch (err) {
      // User cancelling the native share sheet throws an AbortError — not a real failure
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error("Errore durante il download");
    } finally {
      setVipDownloadingAll(false);
    }
  };

  const fetchVipStatus = async () => {
    if (!vipEventId) { toast.error("Seleziona un evento"); return; }
    setVipStatusLoading(true);
    try {
      const res = await fetch(`/api/reservations/vip?event_id=${vipEventId}`);
      const data = await res.json();
      if (res.ok) setVipStatusList(data);
      else toast.error(data.error || "Errore");
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setVipStatusLoading(false);
    }
  };

  const handleDeleteVipCode = async (code: string) => {
    if (!confirm("Eliminare definitivamente questo codice VIP?")) return;
    setVipDeletingCode(code);
    try {
      const res = await fetch("/api/reservations/vip", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        setVipStatusList((prev) => prev.filter((r) => r.code !== code));
        setVipCodes((prev) => prev.filter((c) => c.code !== code));
        toast.success("Codice eliminato!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Errore eliminazione");
      }
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setVipDeletingCode(null);
    }
  };

  const handleDeleteAllCancelledVip = async () => {
    const toDelete = vipStatusList.filter((r) => r.status === "cancelled");
    if (toDelete.length === 0) return;
    if (!confirm(`Eliminare definitivamente ${toDelete.length} codici annullati?`)) return;
    setVipBulkDeleting(true);
    try {
      const results = await Promise.all(
        toDelete.map((r) =>
          fetch("/api/reservations/vip", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: r.code }),
          }).then((res) => ({ code: r.code, ok: res.ok }))
        )
      );
      const deletedCodes = new Set(results.filter((r) => r.ok).map((r) => r.code));
      setVipStatusList((prev) => prev.filter((r) => !deletedCodes.has(r.code)));
      setVipCodes((prev) => prev.filter((c) => !deletedCodes.has(c.code)));
      const failed = results.length - deletedCodes.size;
      if (failed > 0) toast.error(`${deletedCodes.size} eliminati, ${failed} falliti`);
      else toast.success(`${deletedCodes.size} codici eliminati!`);
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setVipBulkDeleting(false);
    }
  };

  const handleToggleCheckIn = async (r: Reservation) => {
    const res = await fetch(`/api/reservations/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggle: true }),
    });
    if (res.ok) {
      const data = await res.json();
      const newStatus = data.newStatus as string;
      setReservations(prev => prev.map(x => x.id === r.id ? { ...x, status: newStatus } : x));
    } else {
      toast.error("Errore check-in");
    }
  };

  const handleReassignLink = async (name: string) => {
    if (!reassignEventId) return;
    setReassigning(true);
    try {
      const res = await fetch("/api/custom-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: reassignEventId, name }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(`Link di "${name}" riassegnato al nuovo evento!`);
        setReassignLinkName(null);
        setReassignEventId("");
        fetchUsers();
      } else toast.error(d.error || "Errore");
    } catch { toast.error("Errore di connessione"); }
    finally { setReassigning(false); }
  };

  const handleDeleteUser = async (id: string, email?: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo utente?")) return;
    // reservation-only users have fake id like "res-email@..." — delete by email from reservations
    if (id.startsWith("res-") && email) {
      const res = await fetch(`/api/users/${encodeURIComponent(email)}?type=reservation`, { method: "DELETE" });
      if (res.ok) { toast.success("Utente eliminato!"); fetchUsers(); }
      else toast.error("Errore eliminazione");
      return;
    }
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Utente eliminato!"); fetchUsers(); }
    else toast.error("Errore eliminazione");
  };

  const handleSaveRental = async () => {
    setRentalSaving(true);
    try {
      const method = editingRental ? "PUT" : "POST";
      const body = editingRental ? { ...rentalForm, id: editingRental.id } : rentalForm;
      const res = await fetch("/api/rentals", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        toast.success(editingRental ? "Attrezzatura aggiornata!" : "Attrezzatura aggiunta!");
        setShowRentalForm(false);
        setEditingRental(null);
        setRentalForm({ name: "", description: "", price: "", duration: "", photos: [], contact_phone: "", contact_email: "", available: true });
        fetchRentals();
      } else {
        const d = await res.json();
        toast.error(d.error || "Errore");
      }
    } catch { toast.error("Errore"); }
    finally { setRentalSaving(false); }
  };

  const handleDeleteRental = async (id: string) => {
    if (!confirm("Eliminare definitivamente questa attrezzatura? L'azione non può essere annullata.")) return;
    const res = await fetch("/api/rentals", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) { toast.success("Eliminata!"); fetchRentals(); }
    else toast.error("Errore eliminazione");
  };

  const handleArchiveRental = async (item: RentalItem) => {
    const newArchived = !item.archived;
    const res = await fetch("/api/rentals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, archived: newArchived }),
    });
    if (res.ok) {
      toast.success(newArchived ? "Archiviata!" : "Ripristinata!");
      setRentalConfig(prev => ({ ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, archived: newArchived } : i) }));
    } else {
      toast.error("Errore");
    }
  };

  const handleRentalPhotoUpload = async (files: FileList) => {
    const uploads: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/rentals/upload", { method: "POST", body: fd });
      if (res.ok) { const d = await res.json(); uploads.push(d.url); }
    }
    setRentalForm(p => ({ ...p, photos: [...(p.photos || []), ...uploads] }));
  };

  const handleUpdateRentalConfig = async (field: string, value: string) => {
    const res = await fetch("/api/rentals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "config", [field]: value }) });
    if (res.ok) { fetchRentals(); toast.success("Salvato!"); }
  };

  const handleNotifyEvent = async (eventId: string, eventTitle: string) => {
    if (!confirm(`Inviare una email a tutti gli utenti registrati per l'evento "${eventTitle}"?`)) return;
    setNotifying(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/notify`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Email inviata a ${data.sent} utenti!`);
      } else {
        toast.error(data.error || "Errore invio email");
      }
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setNotifying(null);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setGalleryUploading(true);
    let uploaded = 0;
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/gallery/upload", { method: "POST", body: fd });
        if (res.ok) uploaded++;
      }
      toast.success(`${uploaded} file caricati nella galleria!`);
      fetchGallery();
    } catch {
      toast.error("Errore upload galleria");
    } finally {
      setGalleryUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteGalleryItem = async (id: string) => {
    const res = await fetch(`/api/gallery/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Rimosso dalla galleria");
      fetchGallery();
    } else {
      toast.error("Errore rimozione");
    }
  };

  const handleDragStart = (id: string) => {
    dragIdRef.current = id;
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

    const handleDrop = async (targetId: string) => {
    const sourceId = dragIdRef.current;
    if (!sourceId || sourceId === targetId) {
      setDragOverId(null);
      return;
    }
    const active = events.filter(e => !e.archived);
    const sourceIdx = active.findIndex(e => e.id === sourceId);
    const targetIdx = active.findIndex(e => e.id === targetId);
    const reordered = [...active];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    // Optimistic update
    setEvents([...reordered, ...events.filter(e => e.archived)]);
    setDragOverId(null);
    dragIdRef.current = null;
    await fetch("/api/events/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map(e => e.id) }),
    });
  };

    const handlePlaceSearch = (value: string) => {
      setPlaceQuery(value);
      setFormData((p) => ({ ...p, maps_url: value }));
      setPlaceSuggestions([]);
      if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);
      if (!value.trim() || value.startsWith("http")) return;
      placeDebounceRef.current = setTimeout(async () => {
        setPlaceLoading(true);
        try {
          const key = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
          const res = await fetch(
            `https://api.geoapify.com/v2/places?categories=entertainment,leisure,tourism&filter=circle:12.49,44.06,200000&bias=proximity:12.49,44.06&limit=5&name=${encodeURIComponent(value)}&apiKey=${key}`
          );
          const data = await res.json();
          const features = data.features ?? [];
          if (features.length > 0) {
            const suggestions = features.map((f: { properties: { formatted: string; name?: string; address_line1?: string; address_line2?: string; lon: number; lat: number } }) => ({
              display_name: [f.properties.name, f.properties.address_line2].filter(Boolean).join(" — ") || f.properties.formatted || "",
              lat: String(f.properties.lat),
              lon: String(f.properties.lon),
            }));
            setPlaceSuggestions(suggestions);
          } else {
            // fallback: geocode autocomplete
            const res2 = await fetch(
              `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(value)}&limit=5&lang=it&type=amenity&apiKey=${key}`
            );
            const data2 = await res2.json();
            const features2 = data2.features ?? [];
            const suggestions2 = features2.map((f: { properties: { formatted: string; name?: string; lon: number; lat: number } }) => ({
              display_name: f.properties.name ? `${f.properties.name} — ${f.properties.formatted}` : f.properties.formatted,
              lat: String(f.properties.lat),
              lon: String(f.properties.lon),
            }));
            setPlaceSuggestions(suggestions2);
          }
        } catch {
          // ignore
        } finally {
          setPlaceLoading(false);
        }
      }, 400);
    };

  const handlePlaceSelect = (place: { display_name: string; lat: string; lon: string }) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`;
    setFormData((p) => ({ ...p, maps_url: mapsUrl }));
    setPlaceQuery(place.display_name);
    setPlaceSuggestions([]);
  };

    const handleSaveColor = async (color: string) => {
    setAccentColor(color);
    setColorSaving(true);
    try {
      await fetch("/api/admin/color", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accent_color: color }),
      });
      toast.success("Colore salvato!");
    } catch {
      toast.error("Errore salvataggio colore");
    } finally {
      setColorSaving(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingEvent(null);
    setNotifyOnPublish(false);
    setFormData({
    title: "",
      details: "",
      price: "free",
      flyer_url: "",
      flyer_ratio: "16:9",
      maps_url: "",
      is_popular: false,
      organizer: "Rumba Liguria",
        event_date: "",
        event_date_iso: "",
          event_time: "",
          event_time_end: "",
          max_tickets: "",
            max_per_person: "",
            dress_code: "",
            min_age: "",
        publish_at: "",
        sale_start: "",
        sale_end: "",
        archive_at: "",
        });
      setPlaceQuery("");
      setPlaceSuggestions([]);
      setManualLinkMode(false);
      setFormTicketTypes([]);
    };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-blue-500/5 rounded-full blur-[150px]" />
        </div>

        <div
          className="w-full max-w-md bg-[#0a0a12] border border-blue-500/15 rounded-2xl p-6 sm:p-8 glow-border relative z-10 animate-fade-in"
        >
            <div className="flex items-center justify-center mb-6">
              <Image
                src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/659b52a5-69ae-4783-b222-bf54f8c81855/logo-1771260580239.png?width=8000&height=8000&resize=contain"
                alt="Rumba Liguria"
                width={64}
                height={64}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-contain glow-blue"
              />
            </div>
          <h2 className="text-xl sm:text-2xl font-bold text-center text-white mb-2">Admin Panel</h2>
          <p className="text-center text-gray-500 text-sm mb-6">Rumba Liguria Events</p>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                placeholder="Username"
              />
            </div>
            <div>
                <label className="text-sm text-gray-400 mb-1 block">Password</label>
                <div className="relative">
                  <input
                    type={showLoginPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showLoginPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full py-3.5 sm:py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:from-blue-500 hover:to-blue-400 transition-all duration-300 disabled:opacity-50 glow-blue-sm text-base active:scale-[0.98]"
            >
              {loginLoading ? "Accesso..." : "Accedi"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] sm:w-[600px] h-[200px] sm:h-[300px] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Admin Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-blue-500/10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Image
                src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/659b52a5-69ae-4783-b222-bf54f8c81855/logo-1771260580239.png?width=8000&height=8000&resize=contain"
                alt="Rumba Liguria"
                width={40}
                height={40}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain flex-shrink-0"
              />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold text-white truncate">Admin Panel</h1>
              <p className="text-[10px] sm:text-xs text-gray-500">Rumba Liguria Events</p>
            </div>
          </div>
            <div className="flex items-center gap-1.5 sm:gap-3">
              <button
                onClick={() => setShowScanChooser(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-all text-xs sm:text-sm font-medium active:scale-95"
                title="Scansiona QR"
              >
                <Camera size={14} />
                <span className="hidden xs:inline">Scan</span>
              </button>
              <a
                href="/"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all text-xs sm:text-sm"
              >
                <Eye size={14} />
                <span className="hidden xs:inline">Sito</span>
              </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-xs sm:text-sm"
            >
              <LogOut size={14} />
              <span className="hidden xs:inline">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 relative z-10">
        {/* Stats */}
          <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="p-3 sm:p-4 rounded-xl bg-[#0a0a12] border border-blue-500/10 glow-border">
              <div className="flex items-center gap-2 sm:gap-3">
                <Calendar size={16} className="text-blue-400 flex-shrink-0 sm:hidden" />
                <Calendar size={20} className="text-blue-400 flex-shrink-0 hidden sm:block" />
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-white">{events.length}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">Eventi</p>
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-4 rounded-xl bg-[#0a0a12] border border-blue-500/10 glow-border">
              <div className="flex items-center gap-2 sm:gap-3">
                <Users size={16} className="text-blue-400 flex-shrink-0 sm:hidden" />
                <Users size={20} className="text-blue-400 flex-shrink-0 hidden sm:block" />
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-white">{users.length}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">Utenti</p>
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-4 rounded-xl bg-[#0a0a12] border border-blue-500/10 glow-border">
              <div className="flex items-center gap-2 sm:gap-3">
                <Ticket size={16} className="text-blue-400 flex-shrink-0 sm:hidden" />
                <Ticket size={20} className="text-blue-400 flex-shrink-0 hidden sm:block" />
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-white">{reservations.length}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">Prenot.</p>
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-4 rounded-xl bg-[#0a0a12] border border-blue-500/10 glow-border">
              <div className="flex items-center gap-2 sm:gap-3">
                <ImageIcon size={16} className="text-blue-400 flex-shrink-0 sm:hidden" />
                <ImageIcon size={20} className="text-blue-400 flex-shrink-0 hidden sm:block" />
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-white">{gallery.length}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">Galleria</p>
                </div>
              </div>
            </div>
          </div>

        {/* Tabs */}
        <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6 overflow-x-auto pb-1 scrollbar-none">
          {([
            { key: "events", icon: Calendar, label: "Eventi" },
            { key: "users", icon: Users, label: "Utenti" },
            { key: "reservations", icon: Ticket, label: "Prenotazioni" },
            { key: "gallery", icon: Images, label: "Galleria" },
            { key: "rentals", icon: Package, label: rentalConfig.button_name || "Noleggio" },
            { key: "cards", icon: CreditCard, label: "Tessere" },
            { key: "settings", icon: Settings, label: "Impostazioni" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); if (key === "users") fetchUsers(); }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === key
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ─── Events Tab ─── */}
        {activeTab === "events" && (
          <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-bold">Eventi ({events.filter(e => !e.archived).length}/50)</h2>
                {events.filter(e => !e.archived).length < 50 && (
                  <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all text-xs sm:text-sm font-medium glow-blue-sm active:scale-95"
                  >
                    <Plus size={14} />
                    <span className="hidden xs:inline">Nuovo</span> Evento
                  </button>
                )}
              </div>

            {/* ─── VIP Code Generator ─── */}
            <button
              onClick={() => setShowVipSection(!showVipSection)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all mb-4"
            >
              <span className="flex items-center gap-2 text-sm">
                <Star size={16} className="text-yellow-400" />
                🎟️ Genera Codici VIP
              </span>
              <span className={`text-xs text-gray-400 transition-transform ${showVipSection ? "rotate-180" : ""}`}>▼</span>
            </button>
            {showVipSection && (
              <div className="p-4 rounded-xl bg-white/5 border border-yellow-500/20 mb-4">
                <div className="flex items-end gap-3 mb-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Evento</label>
                    <select
                      value={vipEventId}
                      onChange={(e) => setVipEventId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-yellow-500/40 [color-scheme:dark]"
                    >
                      <option value="">Seleziona evento</option>
                      {events.filter(e => !e.archived).map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="text-xs text-gray-400 mb-1 block">Quantità</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={vipCountInput}
                      onChange={(e) => setVipCountInput(e.target.value)}
                      onBlur={() => setVipCountInput(String(Math.max(1, Math.min(50, parseInt(vipCountInput) || 1))))}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-center text-sm focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Nome (opzionale)</label>
                    <input
                      type="text"
                      value={vipName}
                      onChange={(e) => setVipName(e.target.value)}
                      placeholder="es. Mario Rossi"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!vipEventId) { toast.error("Seleziona un evento"); return; }
                      const count = Math.max(1, Math.min(50, parseInt(vipCountInput) || 1));
                      setVipCountInput(String(count));
                      setVipGenerating(true);
                      try {
                        const res = await fetch("/api/reservations/vip", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ event_id: vipEventId, count, name: vipName.trim() }),
                        });
                        const d = await res.json();
                        if (res.ok) {
                          setVipCodes(d.codes || []);
                          toast.success(`${d.count} codici VIP generati!`);
                          fetchVipStatus();
                        } else toast.error(d.error || "Errore");
                      } catch { toast.error("Errore"); }
                      finally { setVipGenerating(false); }
                    }}
                    disabled={vipGenerating}
                    className="px-4 py-2.5 rounded-xl bg-yellow-600 text-white font-semibold text-sm hover:bg-yellow-500 transition-all disabled:opacity-50"
                  >
                    {vipGenerating ? "..." : "Genera"}
                  </button>
                </div>
                {vipCodes.length > 0 && (
                  <div className="mt-2">
                    {vipCodes.length > 1 && (
                      <button
                        onClick={handleDownloadAllVip}
                        disabled={vipDownloadingAll}
                        className="w-full mb-3 py-2.5 rounded-xl bg-yellow-600 text-white font-semibold text-sm hover:bg-yellow-500 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {vipDownloadingAll ? "..." : `⬇️ Scarica tutti (${vipCodes.length})`}
                      </button>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {vipCodes.map((item) => {
                        const origin = typeof window !== "undefined" ? window.location.origin : "https://rumbaliguria.com";
                        const url = `${origin}/verify/${item.code}`;
                        return (
                          <div key={item.code} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 border border-yellow-500/20">
                            <div className="relative">
                              <QRCodeSVG value={url} fgColor="#d4a017" size={120} />
                              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border-2 border-yellow-600 flex items-center justify-center text-xs font-bold text-[#111111]">
                                {item.vip_number}
                              </span>
                            </div>
                            <span className="text-[9px] font-mono text-gray-400 truncate w-full text-center">{vipName || "—"}</span>
                            <button
                              onClick={async () => {
                                try {
                                  const canvas = await drawVipQRCanvas(url, item.vip_number);
                                  const link = document.createElement("a");
                                  link.download = `vip-${item.vip_number}-${item.code}.png`;
                                  link.href = canvas.toDataURL("image/png");
                                  link.click();
                                  toast.success("QR scaricato!");
                                } catch { toast.error("Errore download"); }
                              }}
                              className="w-full py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-all text-[10px] font-medium"
                            >Scarica QR Oro #{item.vip_number}</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-white/10">
                  <button
                    onClick={fetchVipStatus}
                    disabled={vipStatusLoading || !vipEventId}
                    className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all text-sm font-medium disabled:opacity-50"
                  >
                    {vipStatusLoading ? "Caricamento..." : "👀 Vedi stato ingressi VIP di questo evento"}
                  </button>
                  {vipStatusList.length > 0 && (
                    <>
                      {vipStatusList.some((r) => r.status === "cancelled") && (
                        <button
                          onClick={handleDeleteAllCancelledVip}
                          disabled={vipBulkDeleting}
                          className="w-full mt-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Trash2 size={13} />
                          {vipBulkDeleting ? "Eliminazione..." : `Elimina tutti gli annullati (${vipStatusList.filter((r) => r.status === "cancelled").length})`}
                        </button>
                      )}
                      <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
                        {vipStatusList
                          .slice()
                          .sort((a, b) => (a.vip_number ?? 0) - (b.vip_number ?? 0))
                          .map((r) => (
                            <div
                              key={r.id}
                              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs ${
                                r.status === "used"
                                  ? "bg-green-500/10 border border-green-500/20"
                                  : r.status === "cancelled"
                                  ? "bg-red-500/10 border border-red-500/20 opacity-60"
                                  : "bg-white/5 border border-white/10"
                              }`}
                            >
                              <span className="font-mono font-bold text-yellow-400 flex-shrink-0">#{r.vip_number ?? "—"}</span>
                              <span className="text-gray-300 truncate flex-1">{r.user_name || "—"}</span>
                              <span className={`flex-shrink-0 ${r.status === "used" ? "text-green-400" : r.status === "cancelled" ? "text-red-400" : "text-gray-500"}`}>
                                {r.status === "used" ? "✅ Entrato" : r.status === "cancelled" ? "🚫 Annullato" : "⏳ In attesa"}
                              </span>
                              <button
                                onClick={() => handleDeleteVipCode(r.code)}
                                disabled={vipDeletingCode === r.code}
                                title="Elimina questo codice"
                                className="flex-shrink-0 p-1 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ─── Custom Links ─── */}
            <button
              onClick={() => setShowLinksSection(!showLinksSection)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all mb-4"
            >
              <span className="flex items-center gap-2 text-sm">
                🔗 Link Personalizzati
              </span>
              <span className={`text-xs text-gray-400 transition-transform ${showLinksSection ? "rotate-180" : ""}`}>▼</span>
            </button>
            {showLinksSection && (
              <div className="p-4 rounded-xl bg-white/5 border border-blue-500/20 mb-4">
                <p className="text-[11px] text-gray-500 mb-3">
                  Se il nome esiste già, il suo link viene riassegnato a questo evento (lo stesso link che hai già dato alla persona torna a funzionare, ora per il nuovo evento).
                </p>
                <div className="flex items-end gap-3 mb-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Evento</label>
                    <select
                      value={linkEventId}
                      onChange={(e) => setLinkEventId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/40 [color-scheme:dark]"
                    >
                      <option value="">Seleziona evento</option>
                      {events.filter(e => !e.archived).map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Nome link</label>
                    <input
                      type="text"
                      value={linkName}
                      onChange={(e) => setLinkName(e.target.value)}
                      placeholder="es. Pepe"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!linkEventId) { toast.error("Seleziona un evento"); return; }
                      if (!linkName.trim()) { toast.error("Inserisci un nome per il link"); return; }
                      setLinkGenerating(true);
                      try {
                        const res = await fetch("/api/custom-links", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ event_id: linkEventId, name: linkName.trim() }),
                        });
                        const d = await res.json();
                        if (res.ok) {
                          const origin = typeof window !== "undefined" ? window.location.origin : "https://rumbaliguria.com";
                          const url = `${origin}/?ref=${encodeURIComponent(linkName.trim())}`;
                          setGeneratedLink(url);
                          toast.success(d.reassigned ? "Link riassegnato a questo evento!" : "Link creato!");
                        } else toast.error(d.error || "Errore");
                      } catch { toast.error("Errore"); }
                      finally { setLinkGenerating(false); }
                    }}
                    disabled={linkGenerating}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 transition-all disabled:opacity-50"
                  >
                    {linkGenerating ? "..." : "Crea"}
                  </button>
                </div>
                {generatedLink && (
                  <div className="p-2 rounded-lg bg-white/5 flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 flex-1 truncate">{generatedLink}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(generatedLink).then(() => toast.success("Link copiato!")); }}
                      className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-[10px] font-medium hover:bg-blue-500/30"
                    >Copia link</button>
                  </div>
                )}
                {/* Link Stats */}
                <div className="mt-4">
                  <p className="text-xs text-gray-400 mb-2 font-medium">📊 Statistiche Link</p>
                  {(() => {
                    // Grouped per RRPP name + event (not just name) — a link name
                    // can get reassigned across several events over time, and we
                    // want to know exactly how many people each one brought to
                    // each specific party, to know who to pay for which event.
                    const linkStats: Record<string, { name: string; total: number; used: number; eventId: string; eventTitle: string; archived: boolean }> = {};
                    reservations.forEach(r => {
                      const refMatch = r.user_name.match(/\[ref:([^\]]+)\]/);
                      if (refMatch) {
                        const refName = refMatch[1];
                        const key = `${refName}::${r.event_id}`;
                        if (!linkStats[key]) linkStats[key] = { name: refName, total: 0, used: 0, eventId: r.event_id, eventTitle: r.events?.title || "", archived: !!r.events?.archived };
                        linkStats[key].total += r.guest_count;
                        if (r.status === "used") linkStats[key].used += r.guest_count;
                      }
                    });
                    const all = Object.values(linkStats);
                    const active = all.filter(s => !s.archived);
                    const archived = all.filter(s => s.archived);
                    if (all.length === 0) return <p className="text-xs text-gray-500">Nessuna prenotazione da link ancora</p>;

                    // Archived stats are grouped by event — you open the event
                    // that already happened to see who brought how many people.
                    const archivedByEvent: Record<string, { eventTitle: string; entries: typeof archived }> = {};
                    archived.forEach((s) => {
                      if (!archivedByEvent[s.eventId]) archivedByEvent[s.eventId] = { eventTitle: s.eventTitle, entries: [] };
                      archivedByEvent[s.eventId].entries.push(s);
                    });
                    const archivedEvents = Object.entries(archivedByEvent);

                    return (
                      <>
                        {active.length === 0 ? (
                          <p className="text-xs text-gray-500">Nessuna prenotazione da link per eventi attivi</p>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {active.map((stats) => (
                              <div key={`${stats.name}::${stats.eventTitle}`} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-medium text-white truncate">{stats.name}</span>
                                  <span className="text-[9px] text-gray-500 truncate">{stats.eventTitle}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-[10px] text-blue-400">{stats.total} prenot.</span>
                                  <span className="text-[10px] text-green-400">{stats.used} entrati</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {archivedEvents.length > 0 && (
                          <div className="mt-2">
                            <button
                              onClick={() => setShowArchivedLinkStats(v => !v)}
                              className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-300 transition-all"
                            >
                              <Archive size={11} />
                              {showArchivedLinkStats ? "Nascondi" : "Vedi"} eventi archiviati ({archivedEvents.length})
                              <span className={`transition-transform ${showArchivedLinkStats ? "rotate-180" : ""}`}>▼</span>
                            </button>
                            {showArchivedLinkStats && (
                              <div className="space-y-1.5 mt-2">
                                {archivedEvents.map(([eventId, group]) => (
                                  <div key={eventId} className="rounded-lg bg-white/5 overflow-hidden">
                                    <button
                                      onClick={() => setOpenArchivedLinkEvent(v => v === eventId ? null : eventId)}
                                      className="w-full flex items-center justify-between p-2 text-left hover:bg-white/5 transition-all"
                                    >
                                      <span className="text-xs font-medium text-gray-300 truncate">{group.eventTitle}</span>
                                      <span className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-[10px] text-gray-500">{group.entries.length} link</span>
                                        <span className={`text-[10px] text-gray-500 transition-transform ${openArchivedLinkEvent === eventId ? "rotate-180" : ""}`}>▼</span>
                                      </span>
                                    </button>
                                    {openArchivedLinkEvent === eventId && (
                                      <div className="space-y-1.5 max-h-40 overflow-y-auto px-2 pb-2">
                                        {group.entries.map((stats) => (
                                          <div key={stats.name} className="flex items-center justify-between p-2 rounded-lg bg-black/20">
                                            <span className="text-xs font-medium text-gray-200 truncate">{stats.name}</span>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                              <span className="text-[10px] text-blue-400">{stats.total} prenot.</span>
                                              <span className="text-[10px] text-green-400">{stats.used} entrati</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Event Form Modal */}
            {showForm && (
                <div
                  className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
                  onClick={resetForm}
                >
                  <div
                    className="w-full sm:max-w-lg bg-[#0a0a12] border-t sm:border border-blue-500/20 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 glow-border max-h-[92vh] overflow-y-auto animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="sm:hidden w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

                    <div className="flex items-center justify-between mb-5 sm:mb-6">
                      <h3 className="text-lg sm:text-xl font-bold">
                        {editingEvent ? "✏️ Modifica Evento" : "➕ Nuovo Evento"}
                      </h3>
                      <button onClick={resetForm} className="p-2 rounded-full hover:bg-white/5 text-gray-400">
                        <X size={18} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Title */}
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">📌 Nome Evento *</label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base whitespace-nowrap overflow-x-auto"
                          placeholder="es. WHITE PARTY"
                        />
                      </div>

                        {/* Organizer */}
                        <div>
                          <label className="text-sm text-gray-400 mb-1 block">🎤 Organizzato da</label>
                          <input
                            type="text"
                            value={formData.organizer}
                            onChange={(e) => setFormData((p) => ({ ...p, organizer: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                            placeholder="Rumba Liguria"
                          />
                        </div>

            {/* Event Date ISO (Picker) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">📅 Seleziona Data *</label>
                <input
                  type="date"
                  value={formData.event_date_iso}
                  onChange={(e) => {
                    const iso = e.target.value; // "YYYY-MM-DD"
                    let formatted = "";
                    if (iso) {
                      // Parse the date as local (Italy) date — avoid UTC shift by using parts
                      const [y, m, d] = iso.split("-").map(Number);
                      const localDate = new Date(y, m - 1, d); // local midnight, no UTC shift
                      formatted = localDate.toLocaleDateString("it-IT", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      }).toUpperCase();
                    }
                    setFormData((p) => ({ ...p, event_date_iso: iso, event_date: formatted }));
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/40 transition-all text-base [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">🏷️ Etichetta Data (opzionale)</label>
                <input
                  type="text"
                  placeholder="es. SABATO 21 MARZO 2026"
                  value={formData.event_date}
                  onChange={(e) => setFormData((p) => ({ ...p, event_date: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-500 -mt-2">La &quot;Seleziona Data&quot; serve per l&apos;archiviazione automatica. L&apos; &quot;Etichetta&quot; è come apparirà sul sito.</p>

                          {/* Time start + Time end */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-sm text-gray-400 mb-1 block">🕐 Ora Inizio</label>
                              <input
                                type="time"
                                value={formData.event_time}
                                onChange={(e) => setFormData((p) => ({ ...p, event_time: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/40 transition-all text-base [color-scheme:dark]"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-gray-400 mb-1 block">🕐 Ora Fine</label>
                              <input
                                type="time"
                                value={formData.event_time_end}
                                onChange={(e) => setFormData((p) => ({ ...p, event_time_end: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/40 transition-all text-base [color-scheme:dark]"
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-600 -mt-2">L&apos;evento si archivia automaticamente il giorno dopo la data inserita</p>

                          {/* Scheduled publish */}
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">⏰ Pubblica automaticamente il</label>
                            <input
                              type="datetime-local"
                              value={formData.publish_at}
                              onChange={(e) => setFormData((p) => ({ ...p, publish_at: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/40 transition-all text-base [color-scheme:dark]"
                            />
                            <p className="text-[10px] text-gray-600 mt-1">Lascia vuoto per pubblicare subito. Se imposti una data, l&apos;evento sarà nascosto fino a quella data/ora.</p>
                          </div>

                          {/* Inizio / Fine vendita ticket */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-sm text-gray-400 mb-1 block">🟢 Inizio Vendita</label>
                              <input
                                type="datetime-local"
                                value={formData.sale_start}
                                onChange={(e) => setFormData((p) => ({ ...p, sale_start: e.target.value }))}
                                className="w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-green-500/40 transition-all text-sm [color-scheme:dark]"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-gray-400 mb-1 block">🔴 Fine Vendita</label>
                              <input
                                type="datetime-local"
                                value={formData.sale_end}
                                onChange={(e) => setFormData((p) => ({ ...p, sale_end: e.target.value }))}
                                className="w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-red-500/40 transition-all text-sm [color-scheme:dark]"
                              />
                            </div>
                          </div>
                          {(formData.sale_start || formData.sale_end) && (
                            <p className="text-[10px] text-gray-500 -mt-1">
                              {formData.sale_start && !formData.sale_end && "Le prenotazioni aprono dal " + new Date(formData.sale_start).toLocaleString("it-IT")}
                              {!formData.sale_start && formData.sale_end && "Le prenotazioni chiudono il " + new Date(formData.sale_end).toLocaleString("it-IT")}
                              {formData.sale_start && formData.sale_end && `Vendita: ${new Date(formData.sale_start).toLocaleString("it-IT")} → ${new Date(formData.sale_end).toLocaleString("it-IT")}`}
                            </p>
                          )}

                          {/* Archive at */}
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">📦 Archivia automaticamente il</label>
                            <input
                              type="datetime-local"
                              value={formData.archive_at}
                              onChange={(e) => setFormData((p) => ({ ...p, archive_at: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-orange-500/40 transition-all text-base [color-scheme:dark]"
                            />
                            <p className="text-[10px] text-gray-600 mt-1">
                              {formData.archive_at
                                ? `L'evento si archivierà automaticamente il ${new Date(formData.archive_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}`
                                : "Lascia vuoto per usare la logica automatica (05:00 del giorno dopo l'evento)."}
                            </p>
                          </div>

                            {/* Max tickets + Max per person + Min age */}
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-sm text-gray-400 mb-1 block">🎟️ Max Totale</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={formData.max_tickets}
                                  onChange={(e) => setFormData((p) => ({ ...p, max_tickets: e.target.value }))}
                                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                                  placeholder="es. 400"
                                />
                              </div>
                              <div>
                                <label className="text-sm text-gray-400 mb-1 block">👤 Max p/persona</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={formData.max_per_person}
                                  onChange={(e) => setFormData((p) => ({ ...p, max_per_person: e.target.value }))}
                                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                                  placeholder="es. 5"
                                />
                              </div>
                              <div>
                                <label className="text-sm text-gray-400 mb-1 block">🔞 Età Min.</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={formData.min_age}
                                  onChange={(e) => setFormData((p) => ({ ...p, min_age: e.target.value }))}
                                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                                  placeholder="es. 18"
                                />
                              </div>
                            </div>
                            {(formData.max_tickets || formData.max_per_person) && (
                              <p className="text-[10px] text-gray-500 -mt-2">
                                {formData.max_tickets && `Max ${formData.max_tickets} tickets totali`}
                                {formData.max_tickets && formData.max_per_person && " · "}
                                {formData.max_per_person && `Max ${formData.max_per_person} per persona`}
                              </p>
                            )}

                          {/* Dress Code */}
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">👗 Dress Code (opzionale)</label>
                            <input
                              type="text"
                              value={formData.dress_code}
                              onChange={(e) => setFormData((p) => ({ ...p, dress_code: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                              placeholder="es. Vestito bianco, Casual elegante..."
                            />
                          </div>

                      {/* Details */}
                      <div>
                          <label className="text-base text-gray-300 mb-2 block font-medium">📝 Dettagli / Descrizione</label>
                          <textarea
                            value={formData.details}
                            onChange={(e) => setFormData((p) => ({ ...p, details: e.target.value }))}
                            rows={8}
                            className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all resize-y text-lg leading-relaxed"
                            placeholder="Descrizione dell'evento, orari, luogo..."
                            style={{ minHeight: '180px' }}
                          />
                      </div>

                      {/* Price */}
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">💶 Prezzo</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setFormData((p) => ({ ...p, price: "free" }))}
                            className={`px-3 sm:px-4 py-2 rounded-lg text-sm transition-all flex-shrink-0 ${
                              formData.price === "free"
                                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                : "bg-white/5 text-gray-400 hover:bg-white/10"
                            }`}
                          >
                            Gratis
                          </button>
                          <input
                            type="text"
                            value={formData.price === "free" ? "" : formData.price}
                            onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value || "free" }))}
                            className="flex-1 min-w-0 px-3 sm:px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-sm"
                            placeholder="es. 10 EUR"
                          />
                        </div>
                      </div>

                        {/* Maps URL — Place Autocomplete */}
                        <div className="relative">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-sm text-gray-400">📍 Luogo / Posizione (opzionale)</label>
                            <button
                              type="button"
                              onClick={() => {
                                setManualLinkMode(!manualLinkMode);
                                setPlaceQuery("");
                                setFormData(p => ({ ...p, maps_url: "" }));
                                setPlaceSuggestions([]);
                              }}
                              className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              {manualLinkMode ? "🔍 Cerca per nome" : "🔗 Incolla link"}
                            </button>
                          </div>
                          {manualLinkMode ? (
                            <input
                              type="url"
                              value={formData.maps_url}
                              onChange={(e) => setFormData(p => ({ ...p, maps_url: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                              placeholder="https://maps.google.com/..."
                              autoComplete="off"
                            />
                          ) : (
                            <div className="relative">
                              <input
                                type="text"
                                value={placeQuery}
                                onChange={(e) => handlePlaceSearch(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base pr-10"
                                placeholder="es. Byblos Club, Riccione..."
                                autoComplete="off"
                              />
                              {placeLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                              )}
                              {placeQuery && !placeLoading && (
                                <button
                                  type="button"
                                  onClick={() => { setPlaceQuery(""); setFormData(p => ({ ...p, maps_url: "" })); setPlaceSuggestions([]); }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          )}
                          {placeSuggestions.length > 0 && !manualLinkMode && (
                            <div className="absolute z-50 w-full mt-1 bg-[#0f0f1a] border border-blue-500/20 rounded-xl overflow-hidden shadow-xl">
                              {placeSuggestions.map((place, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => handlePlaceSelect(place)}
                                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-blue-500/10 hover:text-white transition-all border-b border-white/5 last:border-0 flex items-start gap-2"
                                >
                                  <MapPin size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">{place.display_name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {formData.maps_url && formData.maps_url.startsWith("http") && (
                            <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                              <CheckCircle size={10} /> Posizione selezionata
                            </p>
                          )}
                        </div>

                      {/* Popular toggle */}
                      <div
                        onClick={() => setFormData((p) => ({ ...p, is_popular: !p.is_popular }))}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                          formData.is_popular
                            ? "bg-yellow-500/10 border-yellow-500/30"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                          formData.is_popular ? "bg-yellow-500 border-yellow-500" : "border-gray-600"
                        }`}>
                          {formData.is_popular && <span className="text-white text-[10px]">✓</span>}
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium flex items-center gap-1.5">
                            <Star size={14} className="text-yellow-400" />
                            Segna come Popolare
                          </p>
                          <p className="text-[10px] text-gray-500">Mostra un badge &quot;Popolare&quot; sull&apos;evento</p>
                        </div>
                      </div>

                      {/* ─── Ticket Types ─── */}
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">🎟️ Tipi di Biglietto (max 5)</label>
                        <p className="text-[10px] text-gray-500 mb-2">Opzionale. Se non aggiungi tipi, gli utenti potranno prenotare senza scegliere.</p>
                        <div className="space-y-2">
                          {formTicketTypes.map((tt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={tt.name}
                                onChange={(e) => {
                                  const next = [...formTicketTypes];
                                  next[i].name = e.target.value;
                                  setFormTicketTypes(next);
                                }}
                                placeholder="es. Entrada Hombre"
                                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40"
                              />
                              <input
                                type="color"
                                value={tt.color}
                                onChange={(e) => {
                                  const next = [...formTicketTypes];
                                  next[i].color = e.target.value;
                                  setFormTicketTypes(next);
                                }}
                                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 cursor-pointer [color-scheme:dark]"
                              />
                              <button
                                onClick={() => setFormTicketTypes(prev => prev.filter((_, j) => j !== i))}
                                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          {formTicketTypes.length < 5 && (
                            <button
                              onClick={() => setFormTicketTypes(prev => [...prev, { name: "", color: "#3b82f6" }])}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-all text-sm"
                            >
                              <Plus size={14} /> Aggiungi tipo
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Flyer Ratio */}
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">🖼️ Formato Flyer</label>
                        <div className="flex gap-2">
                          {["16:9", "9:16", "1:1"].map((ratio) => (
                            <button
                              key={ratio}
                              onClick={() => setFormData((p) => ({ ...p, flyer_ratio: ratio }))}
                              className={`flex-1 px-3 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-all text-center ${
                                formData.flyer_ratio === ratio
                                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                  : "bg-white/5 text-gray-400 hover:bg-white/10"
                              }`}
                            >
                              {ratio}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Flyer Upload */}
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">📸 Flyer / Copertina</label>
                        {formData.flyer_url ? (
                          <div className="relative rounded-xl overflow-hidden bg-black mb-2">
                            <img
                              src={formData.flyer_url}
                              alt="Preview"
                              className="w-full h-auto block"
                            />
                            <button
                              onClick={() => setFormData((p) => ({ ...p, flyer_url: "" }))}
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-red-500/80 transition-all"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-28 sm:h-32 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/30 transition-all cursor-pointer active:border-blue-500/40">
                            <Upload size={24} className="text-gray-500 mb-2" />
                            <span className="text-sm text-gray-500">
                              {uploading ? "Caricamento..." : "Tocca per caricare il flyer"}
                            </span>
                            <span className="text-[10px] text-gray-600 mt-1">Qualsiasi formato — si carica senza modifiche</span>
                            <input
                              type="file"
                              accept="image/*,image/png,image/jpeg,image/webp,image/heic,image/heif"
                              onChange={handleUpload}
                              className="hidden"
                              disabled={uploading}
                            />
                          </label>
                        )}
                      </div>

                        {/* Notify users toggle (only for new events) */}
                        {!editingEvent && users.length > 0 && (
                          <div
                            onClick={() => setNotifyOnPublish(!notifyOnPublish)}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                              notifyOnPublish
                                ? "bg-blue-500/10 border-blue-500/30"
                                : "bg-white/5 border-white/10 hover:border-white/20"
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                              notifyOnPublish ? "bg-blue-500 border-blue-500" : "border-gray-600"
                            }`}>
                              {notifyOnPublish && <span className="text-white text-[10px]">✓</span>}
                            </div>
                            <div>
                              <p className="text-sm text-white font-medium flex items-center gap-1.5">
                                <Mail size={14} className="text-blue-400" />
                                📧 Avvisa tutti via Email
                              </p>
                              <p className="text-[10px] text-gray-500">Manda l&apos;evento a {users.length} utenti registrati</p>
                            </div>
                          </div>
                        )}

                      {/* Submit */}
                        {formData.publish_at && new Date(formData.publish_at) > new Date() && (
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                            <span className="text-lg">⏰</span>
                            <div>
                              <p className="text-sm text-orange-300 font-medium">Pubblicazione programmata</p>
                              <p className="text-[11px] text-orange-400/70">
                                Si pubblicherà automaticamente il{" "}
                                {new Date(formData.publish_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Il cron job controlla ogni minuto — garantito ✓</p>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className={`w-full py-3.5 sm:py-3 rounded-xl text-white font-semibold transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 text-base active:scale-[0.98] ${
                            formData.publish_at && new Date(formData.publish_at) > new Date()
                              ? "bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400"
                              : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 glow-blue-sm"
                          }`}
                        >
                          {saving ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvataggio...</>
                          ) : formData.publish_at && new Date(formData.publish_at) > new Date() ? (
                            <><span>⏰</span> Programma per {new Date(formData.publish_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</>
                          ) : editingEvent ? (
                            <><Save size={18} /> Aggiorna Evento</>
                          ) : (
                            <><Save size={18} /> Pubblica Evento</>
                          )}
                        </button>
                  </div>
                </div>
              </div>
            )}

            {/* Events List */}
            <div className="space-y-2 sm:space-y-3">
              {events.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar size={40} className="mx-auto mb-3 text-gray-600" />
                  <p>Nessun evento creato</p>
                </div>
                  ) : (
                      events.filter(e => !e.archived).map((event) => (
                        <div
                          key={event.id}
                          draggable
                          onDragStart={() => handleDragStart(event.id)}
                          onDragOver={(e) => handleDragOver(e, event.id)}
                          onDrop={() => handleDrop(event.id)}
                          onDragLeave={() => setDragOverId(null)}
                          className={`p-3 sm:p-4 rounded-xl bg-[#0a0a12] border transition-all flex items-center gap-3 sm:gap-4 animate-fade-in cursor-grab active:cursor-grabbing ${
                            dragOverId === event.id
                              ? "border-blue-500/60 bg-blue-500/5"
                              : "border-blue-500/10 hover:border-blue-500/20"
                          }`}
                        >
                      <div className="text-gray-600 flex-shrink-0 touch-none select-none">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/><circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/></svg>
                      </div>
                      {event.flyer_url && (
                        <img
                          src={event.flyer_url}
                          alt={event.title}
                          className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-white truncate text-sm sm:text-base">
                            {event.title}
                          </h4>
                          {event.is_popular && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-[10px] font-medium border border-yellow-500/20 flex-shrink-0">
                              <Star size={9} /> Popolare
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-500 mt-1 flex-wrap">
                          <span className={event.price === "free" ? "text-green-400" : "text-blue-400"}>
                            {event.price === "free" ? "Gratis" : event.price}
                          </span>
                            <span>{event.organizer || "Rumba Liguria"}</span>
                            <span>{new Date(event.created_at).toLocaleDateString("it-IT")}</span>
                            {event.event_date && (
                              <span className="text-orange-400 flex items-center gap-0.5">
                                <Calendar size={9} />
                                {event.event_date}
                              </span>
                            )}
                          {event.reservation_total !== undefined && (
                            <span className="text-purple-400 flex items-center gap-0.5"><Ticket size={9} />{event.reservation_total} prenot.</span>
                          )}
                          {event.maps_url && (
                            <span className="text-blue-400 flex items-center gap-0.5"><MapPin size={9} />Mappa</span>
                          )}
                        </div>
                      </div>
                        <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleNotifyEvent(event.id, event.title)}
                            disabled={notifying === event.id}
                            title="Invia email a tutti gli utenti"
                            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all active:bg-blue-500/20 disabled:opacity-40"
                          >
                            {notifying === event.id
                              ? <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                              : <Bell size={15} />}
                          </button>
                          <button
                            onClick={() => handleEdit(event)}
                            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all active:bg-blue-500/20"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleArchive(event)}
                            title="Archivia evento"
                            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all active:bg-yellow-500/20"
                          >
                            <Archive size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all active:bg-red-500/20"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                    </div>
                  ))
                )}
              </div>

                {/* Archived Events */}
                {events.filter(e => e.archived).length > 0 && (
                  <div className="mt-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Archive size={16} className="text-gray-500" />
                      <h3 className="text-sm font-semibold text-gray-400">Archiviati ({events.filter(e => e.archived).length})</h3>
                    </div>
                    <div className="space-y-2">
                      {events.filter(e => e.archived).map((event) => (
                        <div
                          key={event.id}
                          className={`p-3 sm:p-4 rounded-xl bg-[#0a0a12] border transition-all flex items-center gap-3 sm:gap-4 ${
                            event.publish_at && new Date(event.publish_at) > new Date()
                              ? "border-orange-500/20 opacity-90 hover:opacity-100"
                              : "border-white/5 opacity-60 hover:opacity-80"
                          }`}
                        >
                          {event.flyer_url && (
                            <img src={event.flyer_url} alt={event.title} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0 ${event.publish_at && new Date(event.publish_at) > new Date() ? "" : "grayscale"}`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-gray-400 truncate text-sm">{event.title}</h4>
                              {event.publish_at && new Date(event.publish_at) > new Date() && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[10px] font-medium border border-orange-500/25 flex-shrink-0">
                                  ⏰ {new Date(event.publish_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-600 mt-0.5 flex-wrap">
                              <span>{new Date(event.created_at).toLocaleDateString("it-IT")}</span>
                              {event.reservation_total !== undefined && (
                                <span className="flex items-center gap-0.5"><Ticket size={8} />{event.reservation_total} prenot. · {event.reservation_used} entrati</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => setStatsEvent(event)}
                              title="Statistiche evento"
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all text-[11px] font-medium"
                            >
                              <BarChart2 size={13} />
                              <span className="hidden sm:inline">Statistiche</span>
                            </button>
                            {!(event.publish_at && new Date(event.publish_at) > new Date()) && (
                              <button
                                onClick={() => handleArchive(event)}
                                title="Ripristina evento"
                                className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-green-400 hover:bg-green-500/10 transition-all"
                              >
                                <ArchiveRestore size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(event)}
                              className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(event.id)}
                              className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


          </>)}

          {/* ─── Users Tab ─── */}
        {activeTab === "users" && (
          <div>
            <h2 className="text-base sm:text-lg font-bold mb-4">
              👥 Tutti gli Utenti ({users.length})
            </h2>
            {/* Search bar */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Cerca per nome, email o telefono..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all"
              />
              {userSearch && (
                <button onClick={() => setUserSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="space-y-2">
              {users.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users size={40} className="mx-auto mb-3 text-gray-600" />
                  <p>Nessun utente trovato</p>
                </div>
              ) : (
                (userSearch ? users.filter(u =>
                  (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())) ||
                  u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
                  (u.phone && u.phone.includes(userSearch))
                ) : users).map((user) => (
                    <div
                      key={user.id}
                      className="rounded-xl bg-[#0a0a12] border border-blue-500/10 animate-fade-in overflow-hidden"
                    >
                    <div className="p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs sm:text-sm font-bold flex-shrink-0">
                        {(user.name?.[0] || user.email?.[0])?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        {user.name && (
                          <span className="text-xs sm:text-sm text-white font-medium truncate block">{user.name}</span>
                        )}
                        <span className={`truncate block ${user.name ? "text-[10px] sm:text-xs text-gray-400" : "text-xs sm:text-sm text-white"}`}>{user.email}</span>
                        {user.phone && (
                          <span className="text-[10px] sm:text-xs text-gray-500">{user.phone}</span>
                        )}
                        {user.source === "reservation" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium">solo prenotazione</span>
                        )}
                        {user.userType && (
                          <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            user.userType === "ERASMUS" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                            user.userType === "UNIVERSITARIO" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                            "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          }`}>{user.userType}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <span className="text-[10px] sm:text-xs text-gray-500 hidden sm:inline">
                        {new Date(user.created_at).toLocaleDateString("it-IT")}
                      </span>
                        {user.phone ? (
                          <a
                            href={`https://wa.me/${user.phone.replace(/[^0-9+]/g, "")}?text=${encodeURIComponent(`Nuovo Evento! Guarda qui: ${typeof window !== "undefined" ? window.location.origin : "https://rumbaliguria.com"}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-all text-[10px] sm:text-xs font-medium"
                          >
                            <MessageCircle size={13} />
                            <span className="hidden xs:inline">WA</span>
                          </a>
                        ) : null}
                        {user.email?.startsWith("__link__") && (
                          <button
                            onClick={() => {
                              const opening = reassignLinkName !== user.name;
                              setReassignLinkName(opening ? (user.name ?? null) : null);
                              setReassignEventId("");
                            }}
                            title="Assegna questo link a un altro evento"
                            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all text-[10px] sm:text-xs font-medium ${
                              reassignLinkName === user.name
                                ? "bg-blue-500/25 text-blue-300"
                                : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                            }`}
                          >
                            🔗<span className="hidden xs:inline">Evento</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="p-1.5 sm:p-2 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all active:bg-red-500/20"
                        >
                          <Trash2 size={14} />
                        </button>
                    </div>
                    </div>
                    {reassignLinkName === user.name && user.email?.startsWith("__link__") && (
                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-3 border-t border-white/5 flex items-end gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-400 mb-1 block">Nuovo evento per &quot;{user.name}&quot;</label>
                          <select
                            value={reassignEventId}
                            onChange={(e) => setReassignEventId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/40 [color-scheme:dark]"
                          >
                            <option value="">Seleziona evento</option>
                            {events.filter(e => !e.archived).map(ev => (
                              <option key={ev.id} value={ev.id}>{ev.title}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => handleReassignLink(user.name!)}
                          disabled={!reassignEventId || reassigning}
                          className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-all disabled:opacity-50"
                        >
                          {reassigning ? "..." : "Conferma"}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
              {userSearch && users.length > 0 && (() => {
                const filtered = users.filter(u =>
                  (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())) ||
                  u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
                  (u.phone && u.phone.includes(userSearch))
                );
                return filtered.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Search size={40} className="mx-auto mb-3 text-gray-600" />
                    <p>Nessun utente trovato per "{userSearch}"</p>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
          )}

            {/* ─── Reservations Tab ─── */}
            {activeTab === "reservations" && (
              <div>
                {/* Search bar */}
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={reservationSearch}
                    onChange={(e) => setReservationSearch(e.target.value)}
                    placeholder="Cerca per nome o email..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all"
                  />
                  {reservationSearch && (
                    <button onClick={() => setReservationSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      <X size={14} />
                    </button>
                  )}
                </div>
                {/* Event filter tabs — active events only, sorted by date asc */}
                {(() => {
                  const activeEvents = events
                    .filter(e => !e.archived)
                    .sort((a, b) => {
                      if (a.event_date_iso && b.event_date_iso) return b.event_date_iso.localeCompare(a.event_date_iso);
                      if (a.event_date_iso) return -1;
                      return 1;
                    });
                  const activeReservations = reservations.filter(r => !r.events?.archived);
                  return (
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
                  <button
                    onClick={() => setSelectedEventFilter("all")}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedEventFilter === "all" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
                  >
                    Tutti ({activeReservations.length})
                  </button>
                  {activeEvents.map(ev => {
                    const count = activeReservations.filter(r => r.events?.title === ev.title).length;
                    return (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEventFilter(ev.id)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedEventFilter === ev.id ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
                      >
                        {ev.title} ({count})
                      </button>
                    );
                  })}
                </div>
                  );
                })()}

                {/* Stats for selected filter */}
                {(() => {
                  const activeReservations = reservations.filter(r => !r.events?.archived);
                  const byEvent = selectedEventFilter === "all"
                    ? activeReservations
                    : activeReservations.filter(r => r.events?.title === events.find(e => e.id === selectedEventFilter)?.title);
                  const q = reservationSearch.toLowerCase().trim();
                  const filtered = q
                    ? byEvent.filter(r =>
                        r.user_name?.toLowerCase().includes(q) ||
                        r.user_email?.toLowerCase().includes(q)
                      )
                    : byEvent;
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                        <div className="p-3 sm:p-4 rounded-xl bg-[#0a0a12] border border-blue-500/10 glow-border">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Ticket size={16} className="text-blue-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-lg sm:text-2xl font-bold text-white">{filtered.length}</p>
                              <p className="text-[10px] sm:text-xs text-gray-500">Totale</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 sm:p-4 rounded-xl bg-[#0a0a12] border border-green-500/10">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-lg sm:text-2xl font-bold text-green-400">{filtered.filter(r => r.status === "active").length}</p>
                              <p className="text-[10px] sm:text-xs text-gray-500">Attive</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 sm:p-4 rounded-xl bg-[#0a0a12] border border-red-500/10">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <XCircle size={16} className="text-red-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-lg sm:text-2xl font-bold text-red-400">{filtered.filter(r => r.status === "used").length}</p>
                              <p className="text-[10px] sm:text-xs text-gray-500">Entrati</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {filtered.length > 0 && (
                        <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-[#0a0a12] border border-blue-500/10 glow-border">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs sm:text-sm text-gray-400">Entrati / Prenotati</p>
                            <p className="text-xs sm:text-sm font-bold text-white">
                              {filtered.filter(r => r.status === "used").length} / {filtered.length}
                            </p>
                          </div>
                          <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
                              style={{ width: `${(filtered.filter(r => r.status === "used").length / filtered.length) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {filtered.length === 0 ? (
                        <div className="text-center py-12 sm:py-16 text-gray-500">
                          <Ticket size={40} className="mx-auto mb-3 opacity-30" />
                          <p className="text-sm sm:text-base">Nessuna prenotazione</p>
                        </div>
                      ) : (
                        <div className="space-y-2 sm:space-y-3">
                          {filtered.map((r) => (
                              <div
                                key={r.id}
                                className={`p-3 sm:p-4 rounded-xl bg-[#0a0a12] border transition-all ${r.status === "used" ? "border-green-500/30 bg-green-950/20" : r.status === "cancelled" ? "border-gray-500/20 opacity-50" : "border-blue-500/10 glow-border"}`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${r.status === "used" ? "bg-green-500/15 text-green-400" : r.status === "cancelled" ? "bg-gray-500/10 text-gray-400" : "bg-blue-500/10 text-blue-400"}`}>
                                        {r.status === "used" ? <CheckCircle size={10} /> : r.status === "cancelled" ? <XCircle size={10} /> : <Ticket size={10} />}
                                        {r.status === "used" ? "Entrato" : r.status === "cancelled" ? "Cancellata" : "Attiva"}
                                      </span>
                                      {selectedEventFilter === "all" && r.events && (
                                        <span className="text-[10px] text-gray-500 truncate">{r.events.title}</span>
                                      )}
                                    </div>
                                    <p className={`text-sm sm:text-base font-semibold truncate ${r.status === "used" ? "text-green-300" : "text-white"}`}>{r.user_name}</p>
                                    <p className="text-[10px] sm:text-xs text-gray-400 truncate">{r.user_email}</p>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                      <span className="text-[10px] sm:text-xs text-gray-400">
                                        <Users size={10} className="inline mr-1" />
                                        {r.guest_count} {r.guest_count === 1 ? "persona" : "persone"}
                                      </span>
                                      <span className="text-[10px] sm:text-xs text-gray-400 font-mono">{r.code}</span>
                                    </div>
                                  </div>
                                  {/* Botones */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {r.status === "cancelled" ? (
                                      <button
                                        onClick={() => handleRestoreReservation(r.id)}
                                        title="Ripristina prenotazione"
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20 transition-all active:scale-95"
                                      >
                                        <RotateCcw size={13} />
                                        <span className="hidden sm:inline">Ripristina</span>
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => handleToggleCheckIn(r)}
                                          title={r.status === "used" ? "Segna come non entrato" : "Segna come entrato"}
                                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                            r.status === "used"
                                              ? "bg-green-500/20 text-green-400 hover:bg-green-500/10 border border-green-500/30"
                                              : "bg-white/5 text-gray-400 hover:bg-green-500/15 hover:text-green-400 border border-white/10 hover:border-green-500/30"
                                          }`}
                                        >
                                          <CheckCircle size={14} />
                                          <span className="hidden sm:inline">{r.status === "used" ? "Entrato" : "Check-in"}</span>
                                        </button>
                                        {r.status === "active" && (
                                          <button
                                            onClick={() => handleCancelReservation(r.id)}
                                            title="Cancella prenotazione"
                                            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all active:scale-95"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

          {/* ─── Gallery Tab ─── */}
          {activeTab === "gallery" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-bold">🖼️ Galleria ({gallery.length} file)</h2>
                <label className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all text-xs sm:text-sm font-medium cursor-pointer active:scale-95">
                  <Upload size={14} />
                  {galleryUploading ? "Caricamento..." : "Aggiungi"}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleGalleryUpload}
                    className="hidden"
                    disabled={galleryUploading}
                  />
                </label>
              </div>

              <p className="text-xs text-gray-500 mb-4">Carica foto e video che appariranno nella galleria del sito. Accetta immagini e video.</p>

              {gallery.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Images size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nessun file nella galleria</p>
                  <p className="text-xs text-gray-600 mt-1">Carica foto o video dal bottone sopra</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {gallery.map((item) => (
                    <div key={item.id} className="relative rounded-xl overflow-hidden border border-white/5 bg-black">
                      {item.type === "video" ? (
                        <div className="relative aspect-square flex items-center justify-center bg-black">
                          <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                              <Video size={20} className="text-white" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-square">
                          <img src={item.url} alt="Galleria" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                      {/* Delete button — always visible on mobile */}
                      <button
                        onClick={() => {
                          if (confirm("Eliminare questo file dalla galleria?")) {
                            handleDeleteGalleryItem(item.id);
                          }
                        }}
                        className="absolute top-1.5 right-1.5 p-2 rounded-full bg-black/70 text-white hover:bg-red-500 active:bg-red-600 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

            {/* ─── Rentals Tab ─── */}
            {activeTab === "rentals" && (
              <div>
                {/* Header + config */}
                <div className="flex flex-col gap-3 mb-4">
                  {/* Section name */}
                  <div className="flex items-center gap-2">
                    {editSectionName ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          autoFocus
                          value={rentalConfig.section_name}
                          onChange={e => setRentalConfig(p => ({ ...p, section_name: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/40"
                        />
                        <button onClick={() => { handleUpdateRentalConfig("section_name", rentalConfig.section_name); setEditSectionName(false); }} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium">Salva</button>
                        <button onClick={() => setEditSectionName(false)} className="px-3 py-2 rounded-xl bg-white/5 text-gray-400 text-xs">Annulla</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <h2 className="text-base sm:text-lg font-bold text-white">{rentalConfig.section_name}</h2>
                        <button onClick={() => setEditSectionName(true)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all"><PencilLine size={13} /></button>
                      </div>
                    )}
                  </div>
                  {/* Button name */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Nome tasto:</span>
                    {editButtonName ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          autoFocus
                          value={rentalConfig.button_name}
                          onChange={e => setRentalConfig(p => ({ ...p, button_name: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/40"
                        />
                        <button onClick={() => { handleUpdateRentalConfig("button_name", rentalConfig.button_name); setEditButtonName(false); }} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium">Salva</button>
                        <button onClick={() => setEditButtonName(false)} className="px-3 py-2 rounded-xl bg-white/5 text-gray-400 text-xs">Annulla</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white font-medium bg-white/5 px-2 py-1 rounded-lg">{rentalConfig.button_name}</span>
                        <button onClick={() => setEditButtonName(true)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all"><PencilLine size={13} /></button>
                      </div>
                    )}
                  </div>
                  {/* Add button */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{rentalConfig.items.length}/50 attrezzature</span>
                    <button
                      onClick={() => { setEditingRental(null); setRentalForm({ name: "", description: "", price: "", duration: "", photos: [], contact_phone: "", contact_email: "", available: true }); setShowRentalForm(true); }}
                      disabled={rentalConfig.items.length >= 50}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-40"
                    >
                      <Plus size={14} /> Aggiungi
                    </button>
                  </div>
                </div>

                {/* Rental form */}
                {showRentalForm && (
                  <div className="mb-4 p-4 rounded-xl bg-[#0a0a12] border border-blue-500/20 space-y-3">
                    <h3 className="text-sm font-bold text-white">{editingRental ? "✏️ Modifica" : "➕ Nuovo"} Attrezzatura</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Nome *</label>
                        <input value={rentalForm.name || ""} onChange={e => setRentalForm(p => ({ ...p, name: e.target.value }))} placeholder="es. Casse JBL" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/40" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Prezzo</label>
                        <input value={rentalForm.price || ""} onChange={e => setRentalForm(p => ({ ...p, price: e.target.value }))} placeholder="es. €50/giorno" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/40" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Durata / Disponibilità</label>
                        <input value={rentalForm.duration || ""} onChange={e => setRentalForm(p => ({ ...p, duration: e.target.value }))} placeholder="es. Minimo 1 giorno" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/40" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Telefono / WhatsApp</label>
                        <input value={rentalForm.contact_phone || ""} onChange={e => setRentalForm(p => ({ ...p, contact_phone: e.target.value }))} placeholder="+39 123 456 7890" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/40" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Email / Gmail</label>
                        <input value={rentalForm.contact_email || ""} onChange={e => setRentalForm(p => ({ ...p, contact_email: e.target.value }))} placeholder="email@gmail.com" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/40" />
                      </div>
                      <div className="flex items-center gap-2 pt-4">
                        <button onClick={() => setRentalForm(p => ({ ...p, available: !p.available }))} className={`w-10 h-6 rounded-full transition-all flex-shrink-0 ${rentalForm.available ? "bg-green-500" : "bg-white/10"}`}>
                          <div className={`w-5 h-5 bg-white rounded-full transition-all mx-0.5 ${rentalForm.available ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                        <span className="text-xs text-gray-400">{rentalForm.available ? "Disponibile" : "Non disponibile"}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Descrizione</label>
                      <textarea value={rentalForm.description || ""} onChange={e => setRentalForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Descrivi l'attrezzatura..." className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/40 resize-none" />
                    </div>
                    {/* Photos */}
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block">Foto</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(rentalForm.photos || []).map((url, i) => (
                          <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button onClick={() => setRentalForm(p => ({ ...p, photos: (p.photos || []).filter((_, j) => j !== i) }))} className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 rounded-full text-white"><X size={10} /></button>
                          </div>
                        ))}
                        <label className="w-16 h-16 rounded-lg border border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-blue-500/40 transition-all">
                          <Plus size={18} className="text-gray-500" />
                          <input type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && handleRentalPhotoUpload(e.target.files)} />
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleSaveRental} disabled={rentalSaving || !rentalForm.name} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all active:scale-95">
                        {rentalSaving ? "Salvataggio..." : editingRental ? "Aggiorna" : "Aggiungi"}
                      </button>
                      <button onClick={() => { setShowRentalForm(false); setEditingRental(null); }} className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all active:scale-95">Annulla</button>
                    </div>
                  </div>
                )}

                {/* Items list */}
                {rentalConfig.items.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <Package size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nessuna attrezzatura</p>
                    <p className="text-xs text-gray-600 mt-1">Aggiungi la prima dal bottone sopra</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Active items */}
                    <div className="space-y-2">
                      {rentalConfig.items.filter(i => !i.archived).map(item => (
                        <div key={item.id} className={`p-3 sm:p-4 rounded-xl bg-[#0a0a12] border transition-all ${item.available ? "border-blue-500/10" : "border-gray-500/10"}`}>
                          <div className="flex items-start gap-3">
                            {item.photos[0] && <img src={item.photos[0]} alt="" className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-semibold text-sm text-white truncate">{item.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.available ? "bg-green-500/15 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>{item.available ? "Disponibile" : "N/D"}</span>
                              </div>
                              {item.price && <p className="text-xs text-blue-400 font-medium">{item.price}</p>}
                              {item.duration && <p className="text-[10px] text-gray-500">{item.duration}</p>}
                              <div className="flex gap-3 mt-1 flex-wrap">
                                {item.contact_phone && <span className="text-[10px] text-gray-400 flex items-center gap-1"><Phone size={9} />{item.contact_phone}</span>}
                                {item.contact_email && <span className="text-[10px] text-gray-400 flex items-center gap-1"><Mail size={9} />{item.contact_email}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 flex-shrink-0">
                              <button onClick={() => { setEditingRental(item); setRentalForm({ ...item }); setShowRentalForm(true); }} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all active:scale-95" title="Modifica"><Edit3 size={13} /></button>
                              <button onClick={() => handleArchiveRental(item)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all active:scale-95" title="Archivia"><Archive size={13} /></button>
                              <button onClick={() => handleDeleteRental(item.id)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-95" title="Elimina"><Trash2 size={13} /></button>
                            </div>
                          </div>
                          {item.photos.length > 1 && (
                            <div className="flex gap-1.5 mt-2 overflow-x-auto">
                              {item.photos.slice(1).map((url, i) => <img key={i} src={url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />)}
                            </div>
                          )}
                        </div>
                      ))}
                      {rentalConfig.items.filter(i => !i.archived).length === 0 && (
                        <p className="text-xs text-gray-600 text-center py-4">Nessuna attrezzatura attiva</p>
                      )}
                    </div>

                    {/* Archived items */}
                    {rentalConfig.items.filter(i => i.archived).length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Archive size={13} className="text-gray-500" />
                          <span className="text-xs text-gray-500 font-medium">Archiviate ({rentalConfig.items.filter(i => i.archived).length})</span>
                        </div>
                        <div className="space-y-2">
                          {rentalConfig.items.filter(i => i.archived).map(item => (
                            <div key={item.id} className="p-3 rounded-xl bg-[#0a0a12] border border-gray-500/10 opacity-60">
                              <div className="flex items-center gap-3">
                                {item.photos[0] && <img src={item.photos[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 grayscale" />}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-400 truncate">{item.name}</p>
                                  {item.price && <p className="text-[10px] text-gray-600">{item.price}</p>}
                                </div>
                                <div className="flex gap-1.5 flex-shrink-0">
                                  <button onClick={() => handleArchiveRental(item)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-all text-[11px]" title="Ripristina">
                                    <ArchiveRestore size={12} />
                                    <span className="hidden sm:inline">Ripristina</span>
                                  </button>
                                  <button onClick={() => handleDeleteRental(item.id)} className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Elimina definitivamente">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─── Tessere (Cards) Tab ─── */}
            {activeTab === "cards" && <CardsPanel autoOpenScannerTrigger={cardScanTrigger} />}

            {/* ─── Settings Tab ─── */}
            {activeTab === "settings" && (
              <div>
                <h2 className="text-base sm:text-lg font-bold mb-4">
                  ⚙️ Impostazioni Admin
                </h2>
                <div className="max-w-md space-y-4">

                  {/* Color Picker */}
                  <div className="p-4 sm:p-6 rounded-xl bg-[#0a0a12] border border-blue-500/10 glow-border space-y-4">
                    <p className="text-sm font-medium text-white">🎨 Colore Tema Sito</p>
                    <p className="text-xs text-gray-500">Il colore scelto sarà applicato a tutti gli utenti che visitano il sito.</p>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { color: "#3b82f6", label: "Blu" },
                        { color: "#8b5cf6", label: "Viola" },
                        { color: "#ec4899", label: "Rosa" },
                        { color: "#ef4444", label: "Rosso" },
                        { color: "#f59e0b", label: "Oro" },
                        { color: "#10b981", label: "Verde" },
                        { color: "#06b6d4", label: "Azzurro" },
                        { color: "#f97316", label: "Arancio" },
                      ].map(({ color, label }) => (
                        <button
                          key={color}
                          title={label}
                          onClick={() => handleSaveColor(color)}
                          disabled={colorSaving}
                          className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                          style={{ background: accentColor === color ? `${color}20` : "transparent", border: `2px solid ${accentColor === color ? color : "transparent"}` }}
                        >
                          <div className="w-8 h-8 rounded-full" style={{ background: color }} />
                          <span className="text-[10px] text-gray-400">{label}</span>
                        </button>
                      ))}
                    </div>
                    {colorSaving && <p className="text-xs text-blue-400 text-center">Salvataggio...</p>}
                  </div>

                  <div className="p-4 sm:p-6 rounded-xl bg-[#0a0a12] border border-blue-500/10 glow-border space-y-4">
                    <p className="text-sm text-gray-400">Cambia le credenziali di accesso al pannello admin.</p>
                  <div>
                      <label className="text-sm text-gray-400 mb-1 block">Password Attuale *</label>
                      <div className="relative">
                        <input
                          type={showCredCurrentPass ? "text" : "password"}
                          value={credCurrentPass}
                          onChange={(e) => setCredCurrentPass(e.target.value)}
                          className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                          placeholder="Inserisci la password attuale"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCredCurrentPass(!showCredCurrentPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {showCredCurrentPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Nuovo Username *</label>
                    <input
                      type="text"
                      value={credNewUser}
                      onChange={(e) => setCredNewUser(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                      placeholder="Nuovo username"
                    />
                  </div>
                  <div>
                      <label className="text-sm text-gray-400 mb-1 block">Nuova Password *</label>
                      <div className="relative">
                        <input
                          type={showCredNewPass ? "text" : "password"}
                          value={credNewPass}
                          onChange={(e) => setCredNewPass(e.target.value)}
                          className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base"
                          placeholder="Nuova password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCredNewPass(!showCredNewPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {showCredNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={handleCredentialsUpdate}
                      disabled={credSaving}
                      className="w-full py-3.5 sm:py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:from-blue-500 hover:to-blue-400 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 glow-blue-sm text-base active:scale-[0.98]"
                    >
                      <Lock size={18} />
                      {credSaving ? "Salvataggio..." : "Aggiorna Credenziali"}
                    </button>
                </div>
                <p className="text-xs text-gray-600">
                  Dopo aver cambiato le credenziali, dovrai usare le nuove al prossimo accesso.
                </p>
          </div>
        </div>
      )}
        </div>

      {/* ─── Scan chooser: pick which kind of QR to scan ─── */}
      {showScanChooser && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0a0a12] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Cosa vuoi scansionare?</h2>
              <button onClick={() => setShowScanChooser(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
                <X size={18} />
              </button>
            </div>
            <button
              onClick={() => { setShowScanChooser(false); setShowScanner(true); startScanner(); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-green-500/40 hover:bg-green-500/5 transition-all text-left"
            >
              <div className="w-11 h-11 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                <Ticket size={20} className="text-green-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Entrata con Prenotazione</p>
                <p className="text-gray-500 text-xs">Biglietto di un evento — uso singolo</p>
              </div>
            </button>
            <button
              onClick={() => { setShowScanChooser(false); setActiveTab("cards"); setCardScanTrigger((t) => t + 1); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all text-left"
            >
              <div className="w-11 h-11 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <CreditCard size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Tessera Cliente</p>
                <p className="text-gray-500 text-xs">Tessera personale — riutilizzabile ad ogni evento</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ─── QR Scanner Modal ─── */}
      {showScanner && (
          <div className="fixed inset-0 z-[200] flex flex-col bg-black">
            <div className="flex items-center justify-between px-4 py-3 bg-black/90 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
              <Camera size={18} className="text-green-400" />
              <span className="text-white font-semibold text-sm">Scansiona QR</span>
            </div>
            <button onClick={closeScanner} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95">
              <X size={18} />
            </button>
          </div>
          <div className="relative flex-1 overflow-hidden bg-black flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
            <canvas ref={canvasRef} className="hidden" />
            {!scanSuccess && !scanError && !scanLoading && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-64 sm:w-72 sm:h-72">
                  <div className="absolute top-0 left-0 w-10 h-10 border-green-400" style={{ borderTopWidth: 3, borderLeftWidth: 3, borderTopStyle: "solid", borderLeftStyle: "solid", borderRadius: "8px 0 0 0" }} />
                  <div className="absolute top-0 right-0 w-10 h-10 border-green-400" style={{ borderTopWidth: 3, borderRightWidth: 3, borderTopStyle: "solid", borderRightStyle: "solid", borderRadius: "0 8px 0 0" }} />
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-green-400" style={{ borderBottomWidth: 3, borderLeftWidth: 3, borderBottomStyle: "solid", borderLeftStyle: "solid", borderRadius: "0 0 0 8px" }} />
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-green-400" style={{ borderBottomWidth: 3, borderRightWidth: 3, borderBottomStyle: "solid", borderRightStyle: "solid", borderRadius: "0 0 8px 0" }} />
                </div>
                <p className="absolute bottom-24 text-green-300 text-sm font-medium bg-black/50 px-4 py-2 rounded-full">Inquadra il codice QR</p>
              </div>
            )}
            {scanLoading && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="w-14 h-14 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {/* Scan info card — awaiting confirm */}
            {scanResult && !scanSuccess && !scanLoading && (
              <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-6">
                <div className="bg-[#0a0a12] border border-blue-500/40 rounded-2xl p-6 w-full max-w-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Users size={24} className="text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white truncate">{scanResult.name}</h3>
                      <p className="text-xs text-gray-400 truncate">{scanResult.email}</p>
                    </div>
                  </div>
                  {/* User type badge */}
                  {scanResult.userType && (
                    <div className="mb-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                        scanResult.userType === "ERASMUS" ? "bg-green-500/15 text-green-400 border border-green-500/30" :
                        scanResult.userType === "UNIVERSITARIO" ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" :
                        "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                      }`}>{scanResult.userType}</span>
                    </div>
                  )}
                  <div className="bg-white/5 rounded-xl p-3 mb-5 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={14} className="text-blue-400 flex-shrink-0" />
                      <span className="text-white font-medium truncate">{scanResult.event}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Ticket size={12} className="flex-shrink-0" />
                      <span className="font-mono">{scanResult.code}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setScanResult(null); lastScannedRef.current = null; startScanner(); }}
                      className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 font-semibold hover:bg-white/10 transition-all active:scale-95 text-sm"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleConfirmEntry}
                      disabled={scanConfirming}
                      className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-500 transition-all active:scale-95 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {scanConfirming
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <CheckCircle size={16} />
                      }
                      {"Conferma Entrata"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Success screen after confirming */}
            {scanSuccess && scanResult && (
              <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-6">
                <div className="bg-[#0a0a12] border border-green-500/40 rounded-2xl p-6 w-full max-w-sm text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={36} className="text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-green-400">
                    ✅ Accesso Consentito
                  </h3>
                  <p className="text-white font-bold text-lg mb-0.5">{scanResult.name}</p>
                  <p className="text-gray-400 text-sm mb-1">{scanResult.email}</p>
                  {scanResult.userType && (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-1 ${
                      scanResult.userType === "ERASMUS" ? "bg-green-500/15 text-green-400" :
                      scanResult.userType === "UNIVERSITARIO" ? "bg-blue-500/15 text-blue-400" :
                      "bg-purple-500/15 text-purple-400"
                    }`}>{scanResult.userType}</span>
                  )}
                  <p className="text-blue-400 text-sm font-medium mt-1">{scanResult.event}</p>
                  <p className="text-gray-600 text-xs font-mono mb-6">{scanResult.code}</p>
                  <div className="flex gap-3">
                    <button onClick={() => { setScanSuccess(false); setScanResult(null); setScanError(null); lastScannedRef.current = null; startScanner(); }} className="flex-1 py-3 rounded-xl bg-green-500/20 text-green-400 font-semibold hover:bg-green-500/30 transition-all active:scale-95 text-sm">Scansiona ancora</button>
                    <button onClick={closeScanner} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300 font-semibold hover:bg-white/10 transition-all active:scale-95 text-sm">Chiudi</button>
                  </div>
                </div>
              </div>
            )}
            {scanError && !scanLoading && (
              <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-6">
                <div className="bg-[#0a0a12] border border-red-500/40 rounded-2xl p-6 w-full max-w-sm text-center">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <XCircle size={36} className="text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-red-400 mb-2">
                    {scanError === "Già utilizzato" ? "Già Utilizzato" : scanError === "Prenotazione cancellata" ? "Ticket Cancellato" : "Non Valido"}
                  </h3>
                  <p className="text-gray-400 text-sm mb-6">{scanError}</p>
                  <div className="flex gap-3">
                    <button onClick={() => { setScanError(null); lastScannedRef.current = null; startScanner(); }} className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-400 font-semibold hover:bg-red-500/20 transition-all active:scale-95">Riprova</button>
                    <button onClick={closeScanner} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300 font-semibold hover:bg-white/10 transition-all active:scale-95">Chiudi</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    {/* ─── Statistics Modal ─── */}
    {statsEvent && (() => {
      const evRes = reservations.filter(r => r.events?.title === statsEvent.title);
      const total = evRes.length;
      const active = evRes.filter(r => r.status === "active").length;
      const entered = evRes.filter(r => r.status === "used").length;
      const cancelled = evRes.filter(r => r.status === "cancelled").length;
      const totalGuests = evRes.reduce((s, r) => s + (r.guest_count || 1), 0);
      const enteredGuests = evRes.filter(r => r.status === "used").reduce((s, r) => s + (r.guest_count || 1), 0);
      const pct = total > 0 ? Math.round((entered / total) * 100) : 0;

      const statCards: { label: string; value: number; color: string; borderColor: string; list?: typeof evRes }[] = [
        { label: "Prenotazioni totali", value: total, color: "text-white", borderColor: "border-white/8", list: evRes },
        { label: "Persone totali", value: totalGuests, color: "text-blue-400", borderColor: "border-blue-500/20", list: evRes },
        { label: "Entrati", value: entered, color: "text-green-400", borderColor: "border-green-500/20", list: evRes.filter(r => r.status === "used") },
        { label: "Persone entrate", value: enteredGuests, color: "text-green-400", borderColor: "border-green-500/20", list: evRes.filter(r => r.status === "used") },
        { label: "In attesa", value: active, color: "text-yellow-400", borderColor: "border-yellow-500/20", list: evRes.filter(r => r.status === "active") },
        { label: "Cancellate", value: cancelled, color: "text-red-400", borderColor: "border-red-500/20", list: evRes.filter(r => r.status === "cancelled") },
      ];

      return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) { setStatsEvent(null); setStatsDrilldown(null); } }}>
          <div className="w-full sm:max-w-md bg-[#0d0d1a] sm:rounded-2xl rounded-t-2xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                {statsDrilldown ? (
                  <button onClick={() => setStatsDrilldown(null)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all mr-1"><ChevronLeft size={15} /></button>
                ) : (
                  <BarChart2 size={16} className="text-purple-400" />
                )}
                <h3 className="font-bold text-white text-base">{statsDrilldown ? statsDrilldown.label : "Statistiche"}</h3>
              </div>
              <button onClick={() => { setStatsEvent(null); setStatsDrilldown(null); }} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all"><X size={15} /></button>
            </div>

            {statsDrilldown ? (
              /* ── Detail list ── */
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {statsDrilldown.list.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-sm">Nessuna prenotazione</p>
                ) : statsDrilldown.list.map((r) => (
                  <div key={r.id} className={`p-3 rounded-xl border ${r.status === "used" ? "bg-green-950/20 border-green-500/25" : r.status === "cancelled" ? "bg-white/3 border-white/8 opacity-60" : "bg-[#0a0a12] border-blue-500/15"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{r.user_name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{r.user_email}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] text-gray-500 font-mono">{r.code}</span>
                          <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                            <Users size={9} className="inline" /> {r.guest_count} {r.guest_count === 1 ? "persona" : "persone"}
                          </span>
                        </div>
                      </div>
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${r.status === "used" ? "bg-green-500/15 text-green-400" : r.status === "cancelled" ? "bg-gray-500/10 text-gray-400" : "bg-blue-500/10 text-blue-400"}`}>
                        {r.status === "used" ? "Entrato" : r.status === "cancelled" ? "Cancellata" : "Attiva"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Stats overview ── */
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">{statsEvent.title}</p>
                  {statsEvent.event_date_iso && <p className="text-xs text-gray-500">{new Date(statsEvent.event_date_iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</p>}
                </div>
                <div className="p-3 rounded-xl bg-[#0a0a12] border border-white/8">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400">Entrati / Prenotazioni</p>
                    <p className="text-xs font-bold text-white">{entered} / {total} ({pct}%)</p>
                  </div>
                  <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {statCards.map(({ label, value, color, borderColor, list }) => (
                    <button
                      key={label}
                      onClick={() => list && list.length > 0 && setStatsDrilldown({ label, list })}
                      className={`p-3 rounded-xl bg-[#0a0a12] border ${borderColor} text-left transition-all active:scale-95 ${list && list.length > 0 ? "hover:brightness-125 cursor-pointer" : "cursor-default"}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`text-lg font-bold ${color}`}>{value}</p>
                        {list && list.length > 0 && <ChevronRight size={12} className="text-gray-600" />}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    })()}
    </div>
    );
  }
