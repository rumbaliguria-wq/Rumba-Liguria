"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Instagram,
  Send,
  Calendar,
  Users,
  Clock,
  LogIn,
  LogOut,
  X,
  Globe,
  Shield,
  CheckCircle,
  MessageCircle,
  Eye,
  EyeOff,
  Download,
  Star,
  MapPin,
  Train,
  Car,
  Bike,
  PersonStanding,
  Ticket,
  Share2,
  XCircle,
  QrCode,
  User,
  Package,
  Phone,
  Mail,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Info,
  LockKeyhole,
  ArrowLeft,
  Sparkles,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import { QRCodeSVG } from "qrcode.react";
import { type Lang, t } from "@/lib/translations";
import { getSaleCloseUTC } from "@/lib/eventExpiry";

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
}

interface RentalConfig {
  items: RentalItem[];
  section_name: string;
  button_name: string;
  enabled: boolean;
}

interface Event {
  id: string;
  title: string;
  details: string;
  price: string;
  flyer_url: string;
  flyer_ratio: string;
  maps_url?: string;
  venue_name?: string;
  is_popular?: boolean;
  organizer?: string;
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
  ticket_types?: { name: string; color: string; price?: number }[];
  created_at: string;
  reservation_total: number;
  reservation_used: number;
  tickets_sold?: number;
  sold_out?: boolean;
}

const WHATSAPP_BOOKING = "393501863148";
const IT_MONTH_ABBR = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];

// Small day/month badge (e.g. "24 / MAG") for the event card overlay —
// returns null when event_date_iso isn't a parseable "YYYY-MM-DD", so the
// badge simply doesn't render rather than showing garbage.
function eventDateBadge(iso?: string): { day: string; month: string } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const monthIdx = parseInt(m[2], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return null;
  return { day: m[3], month: IT_MONTH_ABBR[monthIdx] };
}

const LANGS: {code: Lang;label: string;flag: string;}[] = [
{ code: "it", label: "Italiano", flag: "IT" },
{ code: "es", label: "Español", flag: "ES" },
{ code: "en", label: "English", flag: "EN" }];


export default function Home() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("it");
  const [showLangMenu, setShowLangMenu] = useState(false);
  // Si este navegador ya tiene una sesión de admin válida, mostramos un
  // acceso directo al panel en el header — sin pasar de nuevo por el login.
  const [hasAdminSession, setHasAdminSession] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authUserType, setAuthUserType] = useState<string>("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  // Flujo 2FA del panel, resuelto dentro de este mismo modal cuando el
  // usuario mete credenciales de administrador.
  const [adminStep, setAdminStep] = useState<"none" | "channel" | "code">("none");
  const [adminChannels, setAdminChannels] = useState<string[]>([]);
  const [adminMasked, setAdminMasked] = useState<{ email: string | null; phone: string | null }>({ email: null, phone: null });
  const [adminChallengeId, setAdminChallengeId] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [adminSending, setAdminSending] = useState(false);
  const [reservation, setReservation] = useState<{eventId: string;count: number;ticketType?: string;} | null>(null);
  const [qrData, setQrData] = useState<{codes: string[];eventTitle: string;guestCount: number;ticketTypes?: {name: string; color: string}[];} | null>(null);
  const [reserving, setReserving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  // Ticks once a second so the "Evento in Evidenza" countdown stays live.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Hero slideshow. The set
  // of photos is managed from the admin panel ("Foto Hero"), not hardcoded.
  const [heroPhotos, setHeroPhotos] = useState<string[]>([]);
  const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);
  const heroTouchStart = useRef<number | null>(null);
  const moveHeroPhoto = useCallback((direction: 1 | -1) => {
    if (heroPhotos.length < 2) return;
    setHeroPhotoIndex((index) => (index + direction + heroPhotos.length) % heroPhotos.length);
  }, [heroPhotos.length]);
  useEffect(() => {
    if (heroPhotos.length < 2) return;
    const id = setInterval(() => moveHeroPhoto(1), 6500);
    return () => clearInterval(id);
  }, [heroPhotos.length, moveHeroPhoto]);
  // Which event's full-detail popup is open (compact grid cards just show a
  // preview + "Vedi Evento"; the popup carries description, reservation,
  // map, everything).
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [snowflakes, setSnowflakes] = useState<{left: number;duration: number;delay: number;opacity: number;size: number;char: string;}[]>([]);
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [cancelledReservations, setCancelledReservations] = useState<{code: string;eventTitle: string;}[]>([]);
  const [expandedMaps, setExpandedMaps] = useState<Set<string>>(new Set());
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryTouchStart = useRef<number | null>(null);
  const moveGallery = useCallback((direction: 1 | -1) => {
    if (gallery.length < 2) return;
    setGalleryIndex((index) => (index + direction + gallery.length) % gallery.length);
  }, [gallery.length]);
  useEffect(() => {
    if (gallery.length < 2) return;
    const id = setInterval(() => moveGallery(1), 3000);
    return () => clearInterval(id);
  }, [gallery.length, moveGallery]);
  useEffect(() => {
    setGalleryIndex((index) => Math.min(index, Math.max(gallery.length - 1, 0)));
  }, [gallery.length]);
  const [showProfile, setShowProfile] = useState(false);
  const [userReservations, setUserReservations] = useState<(any)[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [rentalConfig, setRentalConfig] = useState<RentalConfig>({ items: [], section_name: "Noleggio Attrezzatura", button_name: "Noleggio", enabled: true });
  const [expandedRental, setExpandedRental] = useState<string | null>(null);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [rentalModalItem, setRentalModalItem] = useState<RentalItem | null>(null);
  const [rentalPhotoIndex, setRentalPhotoIndex] = useState(0);
  // Set when arriving via a personalized RRPP link (?ref=name) — locks the
  // page to whichever event that name is currently assigned to, instead of
  // showing the whole event list. Resolved dynamically (not baked into the
  // URL) so the admin can re-point the same link at a new event later.
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);
  const [refPending, setRefPending] = useState(false);
  const [refExpired, setRefExpired] = useState(false);


  useEffect(() => {
    // Copos de nieve solo en invierno (dic–feb). El resto del año, unos
    // pocos puntos de ambiente para que el hero no quede plano.
    const month = new Date().getMonth();
    const isWinter = month === 11 || month === 0 || month === 1;
    setSnowflakes(
      Array.from({ length: isWinter ? 30 : 12 }, (_, i) => ({
        left: Math.random() * 100,
        duration: 6 + Math.random() * 10,
        delay: Math.random() * 8,
        opacity: 0.3 + Math.random() * 0.5,
        size: 6 + Math.random() * 12,
        char: isWinter && i % 3 === 0 ? '❄' : '•'
      }))
    );
  }, []);

  useEffect(() => {
    // Evita el parpadeo del color de marca: primero el valor cacheado de la
    // última visita, luego el fresco del servidor.
    try {
      const cached = localStorage.getItem("rumba_accent");
      if (cached) setAccentColor(cached);
    } catch {}
    fetch("/api/admin/color").then((r) => r.json()).then((d) => {
      if (d.accent_color) {
        setAccentColor(d.accent_color);
        try { localStorage.setItem("rumba_accent", d.accent_color); } catch {}
      }
    }).catch(() => {});
    fetch("/api/admin/session").then((r) => r.json()).then((d) => {
      if (d.authenticated) {
        setHasAdminSession(true);
        router.prefetch("/admin");
        // El admin también puede usar el sitio "de cliente" (reservar, ver
        // sus QR) con el email que ya tiene configurado para el 2FA — sin
        // pisar una sesión de cliente real si ya había una guardada.
        if (d.email && !localStorage.getItem("rumba_user")) {
          setUserEmail(d.email);
        }
      }
    }).catch(() => {});
    // Track custom link referral from URL and resolve which event it
    // currently points to (the admin can reassign a link name to a new
    // event, so this can't just be read from the URL).
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("payment") === "cancelled") {
        // Efecto de montaje: `lang` aún no cargó desde localStorage en este
        // punto, así que se lee directo para no mostrar el toast siempre en it.
        const savedLang = (localStorage.getItem("rumba_lang") as Lang) || "it";
        toast.info(t(savedLang, "payment.cancelled"));
        window.history.replaceState({}, "", window.location.pathname);
      }
      const ref = params.get("ref");
      if (ref) {
        sessionStorage.setItem("rumba_ref", ref);
        setRefPending(true);
        fetch(`/api/custom-links?name=${encodeURIComponent(ref)}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.active && d.event_id) {
              sessionStorage.setItem("rumba_ref_eid", d.event_id);
              setLinkedEventId(d.event_id);
            } else {
              setRefExpired(true);
            }
          })
          .catch(() => setRefExpired(true))
          .finally(() => setRefPending(false));
      }
    } catch {}
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem("rumba_lang");
    if (saved && (saved === "it" || saved === "es" || saved === "en")) {
      setLang(saved as Lang);
    }
  }, []);

  const changeLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem("rumba_lang", l);
    setShowLangMenu(false);
  };

  const checkCancelledReservations = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/reservations/by-email?email=${encodeURIComponent(email)}`);
      if (!res.ok) return;
      const data = await res.json();
      
      const acknowledged = JSON.parse(localStorage.getItem("rumba_ack_cancelled") || "[]");
      
      const cancelled = (data as {code: string;status: string;events?: {title: string;};}[]).
      filter((r) => r.status === "cancelled" && !acknowledged.includes(r.code)).
      map((r) => ({ code: r.code, eventTitle: r.events?.title || "Evento" }));
      if (cancelled.length > 0) setCancelledReservations(cancelled);
    } catch {/* ignore */}
  }, []);

  const fetchUserReservations = useCallback(async (email: string) => {
    setLoadingReservations(true);
    try {
      const res = await fetch(`/api/reservations/by-email?email=${encodeURIComponent(email)}`);
      if (!res.ok) return;
      const data = await res.json();
      setUserReservations(data);
    } catch {
      toast.error(t(lang, "profile.loadError"));
    } finally {
      setLoadingReservations(false);
    }
  }, [lang]);

  const fetchEvents = useCallback(async () => {
    const res = await fetch("/api/events");
    const data = await res.json();
    if (Array.isArray(data)) {
      const parseDate = (d: string | undefined) => {
        if (!d) return null;
        const months: Record<string, number> = {
          gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
          luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11
        };
        const match = d.toLowerCase().match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
        if (!match) return null;
        const m = months[match[2]];
        if (m === undefined) return null;
        return new Date(parseInt(match[3]), m, parseInt(match[1]));
      };
      const sorted = [...data].sort((a: Event, b: Event) => {
        const da = parseDate(a.event_date);
        const db = parseDate(b.event_date);
        if (da && db) return da.getTime() - db.getTime();
        if (da) return -1;
        if (db) return 1;
        return 0;
      });
      setEvents(sorted);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetch("/api/gallery").then(r => r.json()).then(d => { if (Array.isArray(d)) setGallery(d); }).catch(() => {});
    fetch("/api/hero-photos").then(r => r.json()).then(d => { if (Array.isArray(d)) setHeroPhotos(d.map((p: { url: string }) => p.url)); }).catch(() => {});
    fetch("/api/rentals").then(r => r.json()).then(d => { if (d && !d.error) setRentalConfig(d); }).catch(() => {});
    const saved = localStorage.getItem("rumba_user");
    if (saved) {
      // Verify user still exists in DB (deleted accounts should be logged out)
      fetch("/api/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: saved }),
      }).then(r => r.json()).then(d => {
        if (d.exists) {
          setUserEmail(saved);
          checkCancelledReservations(saved);
        } else {
          localStorage.removeItem("rumba_user");
        }
      }).catch(() => {
        // Network error — keep user logged in (don't logout on flaky connection)
        setUserEmail(saved);
        checkCancelledReservations(saved);
      });
    }
  }, [fetchEvents, checkCancelledReservations]);

  const resetAdminFlow = () => {
    setAdminStep("none");
    setAdminChannels([]);
    setAdminChallengeId("");
    setAdminCode("");
  };

  const requestAdminCode = async (channel: string) => {
    setAdminSending(true);
    router.prefetch("/admin"); // el chunk del panel se descarga mientras llega el código
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authEmail, password: authPassword, channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.challengeId) {
        setAdminChallengeId(data.challengeId);
        setAdminCode("");
        setAdminStep("code");
        toast.success(channel === "email" ? "Codice inviato via email" : "Codice inviato su WhatsApp");
      } else {
        toast.error(data.error || "Impossibile inviare il codice");
      }
    } catch {
      toast.error(t(lang, "auth.connectionError"));
    } finally {
      setAdminSending(false);
    }
  };

  const verifyAdminCode = async () => {
    setAdminSending(true);
    try {
      const res = await fetch("/api/admin/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: adminChallengeId, code: adminCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        router.push("/admin");
      } else {
        toast.error(data.error || t(lang, "auth2fa.wrongCode"));
        if (res.status === 429 || res.status === 400) {
          setAdminStep(adminChannels.length > 1 ? "channel" : "none");
        }
      }
    } catch {
      toast.error(t(lang, "auth.connectionError"));
    } finally {
      setAdminSending(false);
    }
  };

  const handleAuth = async () => {
    if (authMode === "forgot") {
      if (!authEmail.trim()) {
        toast.error(t(lang, "auth.emailRequired"));
        return;
      }
      setAuthLoading(true);
      try {
        const res = await fetch("/api/auth/password-reset/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || t(lang, "auth.connectionError"));
          return;
        }
        toast.success(t(lang, "auth.resetSent"));
      } catch {
        toast.error(t(lang, "auth.connectionError"));
      } finally {
        setAuthLoading(false);
      }
      return;
    }
    if (authMode === "register") {
      if (!authFirstName.trim() || !authLastName.trim()) {
        toast.error(t(lang, "auth.nameRequired"));
        return;
      }
      if (!authPhone.trim()) {
        toast.error(t(lang, "auth.phoneRequired"));
        return;
      }
      // Validate phone: international prefix required (+39 auto-added for Italian mobiles)
      let digitsOnly = authPhone.replace(/[\s\-().]/g, "");
      if (digitsOnly.startsWith("00")) digitsOnly = "+" + digitsOnly.slice(2);
      if (/^3\d{8,9}$/.test(digitsOnly)) digitsOnly = "+39" + digitsOnly;
      const validPhone = /^\+[1-9]\d{7,14}$/.test(digitsOnly);
      if (!validPhone) {
        toast.error(t(lang, "auth.invalidPhone"));
        return;
      }
      if (!authUserType) {
        toast.error(t(lang, "auth.selectUserType"));
        return;
      }
    }
    setAuthLoading(true);
    try {
      const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword, ...(authMode === "register" ? { phone: authPhone, first_name: authFirstName, last_name: authLastName, user_type: authUserType } : {}) })
      });
      const data = await res.json();
      if (!res.ok) {
        // The shared access form also accepts the admin credentials. Only try
        // this after the customer login fails, so normal accounts keep their
        // exact current flow.
        if (authMode === "login") {
          const adminRes = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: authEmail, password: authPassword }),
          });
          const adminData = await adminRes.json().catch(() => ({}));
          if (adminRes.ok && adminData.success) {
            // Panel sin 2FA: la cookie ya está puesta, entramos directo.
            router.push("/admin");
            return;
          }
          if (adminRes.ok && adminData.twoFactor) {
            // Resolvemos el 2FA aquí mismo, sin mandar a /admin ni reescribir nada.
            router.prefetch("/admin");
            const channels: string[] = adminData.channels || [];
            setAdminChannels(channels);
            setAdminMasked({ email: adminData.maskedEmail ?? null, phone: adminData.maskedPhone ?? null });
            if (channels.length === 1) {
              await requestAdminCode(channels[0]);
            } else {
              setAdminStep("channel");
            }
            return;
          }
        }
        toast.error(data.error || t(lang, "auth.genericError"));
        return;
      }
      const email = authMode === "register" ? authEmail.toLowerCase() : data.email;
      setUserEmail(email);
      localStorage.setItem("rumba_user", email);
      setShowAuth(false);
      setAuthEmail("");
      setAuthPhone("");
      setAuthFirstName("");
      setAuthLastName("");
      setAuthUserType("");
      setAuthPassword("");
      checkCancelledReservations(email);
      toast.success(
        authMode === "register" ? t(lang, "auth.registerSuccess") : t(lang, "auth.loginSuccess")
      );
    } catch {
      toast.error(t(lang, "auth.connectionError"));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUserEmail(null);
    setUserReservations([]);
    setShowProfile(false);
    localStorage.removeItem("rumba_user");
    toast.success(t(lang, "auth.logoutSuccess"));
  };

  const handleReservation = (event: Event) => {
    if (!userEmail) {
      setShowAuth(true);
      return;
    }
    setReservation({ eventId: event.id, count: 1 });
  };

  const confirmReservation = async (event: Event) => {
    if (!reservation || !userEmail) return;
    setReserving(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: event.id,
          user_email: userEmail,
          guest_count: reservation.count,
          ticket_type: reservation.ticketType,
          referral: sessionStorage.getItem("rumba_ref") || undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t(lang, "reservation.error"));

      const codes = data.map((t: {code: string}) => t.code);
      setQrData({ codes, eventTitle: event.title, guestCount: reservation.count, ticketTypes: event.ticket_types });
      setReservation(null);
      fetchUserReservations(userEmail);
      toast.success(t(lang, "reservation.confirmed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(lang, "reservation.error"));
    } finally {
      setReserving(false);
    }
  };

  const saveQrImage = async () => {
    const containers = document.querySelectorAll(".qr-code-container");
    if (!containers.length) return;
    
    toast.info(t(lang, "reservation.savingTickets"));
    
    for (let i = 0; i < containers.length; i++) {
      const svg = containers[i].querySelector("svg") as SVGElement;
      if (!svg) continue;
      
      const canvas = document.createElement("canvas");
      const size = 600;
      const padding = 40;
      canvas.width = size + padding * 2;
      canvas.height = size + padding * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const svgData = new XMLSerializer().serializeToString(svg);
      
      await new Promise<void>((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          ctx.drawImage(img, padding, padding, size, size);
          const link = document.createElement("a");
          link.download = `biglietto-${i + 1}-${qrData?.codes[i] || "qr"}.png`;
          link.href = canvas.toDataURL("image/png");
          link.click();
          // Small delay between downloads
          setTimeout(resolve, 500);
        };
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
      });
    }
    toast.success(t(lang, "reservation.allTicketsSaved"));
  };

  // Returns true if the reservation has expired (next day after event at 05:00 Rome time)
  const isReservationExpired = (eventDateIso: string | undefined | null): boolean => {
    if (!eventDateIso) return false;
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
  };

  const locale = t(lang, "locale");

  const getMapsEmbedUrl = (url: string): string => {
    if (!url) return "";
    // Already an embed URL - use as-is
    if (url.includes("/embed") || url.includes("output=embed")) return url;
    try {
      const u = new URL(url);
      // google.com/maps/place/PlaceName/@lat,lng... — extract place name + coords
      const placeMatch = url.match(/\/maps\/place\/([^/@?]+)/);
      const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) {
        const lat = coordMatch[1],lng = coordMatch[2];
        const place = placeMatch ? decodeURIComponent(placeMatch[1]).replace(/\+/g, " ") : `${lat},${lng}`;
        return `https://maps.google.com/maps?q=${encodeURIComponent(place)}&ll=${lat},${lng}&z=15&output=embed&hl=it`;
      }
      // maps?q=... format
      const q = u.searchParams.get("q");
      if (q) return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed&hl=it`;
      // short link or unknown - pass it as search
    } catch {/* fall through */}
    // Treat the whole input as a place name / address
    return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed&hl=it`;
  };

  const a = accentColor;
  const a10 = `${a}1a`; // 10% opacity
  const a20 = `${a}33`; // 20% opacity
  const a30 = `${a}4d`; // 30% opacity

  // Arriving via a personalized RRPP link locks the page to that one event.
  // /api/custom-links already refuses to resolve an archived/reassigned-away
  // event, and this filter is a second safety net in case it slipped through.
  const visibleEvents = linkedEventId ? events.filter((e) => e.id === linkedEventId) : events;
  const linkExpired = refExpired || (!!linkedEventId && events.length > 0 && visibleEvents.length === 0);

  // "Evento in Evidenza": the popular one if there is an upcoming one, else
  // just the next event on the list. Past events (booking already closed)
  // never get featured.
  const upcomingEvents = visibleEvents.filter((e) => {
    const close = e.event_date_iso ? getSaleCloseUTC(e.event_date_iso) : null;
    return close ? nowTick < close : true;
  });
  const featuredEvent = upcomingEvents.find((e) => e.is_popular) || upcomingEvents[0] || null;
  const featuredCountdown = (() => {
    if (!featuredEvent?.event_date_iso) return null;
    const target = new Date(`${featuredEvent.event_date_iso}T${featuredEvent.event_time || "23:00"}:00`).getTime();
    const diff = target - nowTick;
    if (!Number.isFinite(diff) || diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { days, hours, minutes, seconds };
  })();

  return (
    <div className="theme-page min-h-screen bg-black text-white relative overflow-hidden">
        <style>{`
          :root { --accent: ${a}; }
          * { --accent: ${a}; }
          .glow-text { text-shadow: 0 0 20px ${a}80 !important; }
          .glow-border { border-color: ${a20} !important; box-shadow: 0 0 30px ${a}10 !important; }
          .glow-blue-sm { box-shadow: 0 0 15px ${a}40 !important; }
          .flyer-glow { box-shadow: 0 0 30px ${a}20 !important; }
            @keyframes breathe {
              0%, 100% { transform: scale(1); filter: drop-shadow(0 0 12px ${a}50); }
              50% { transform: scale(1.07); filter: drop-shadow(0 0 28px ${a}90); }
            }
        `}</style>
      {/* Background glow */}
          <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[300px] sm:h-[400px] rounded-full blur-3xl sm:blur-[120px]" style={{ background: `${a}0d` }} />
          </div>

      {/* Header */}
        <header
        className="theme-header sticky top-0 z-50 backdrop-blur-xl bg-black/80 animate-fade-in"
        style={{ borderBottom: `1px solid ${a20}` }}>

        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
            <a href="/" aria-label="Ir al inicio de Rumba Liguria" className="flex items-center gap-2 sm:gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
              <Image
              src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/659b52a5-69ae-4783-b222-bf54f8c81855/logo-1771260580239.png?width=8000&height=8000&resize=contain"
              alt="Rumba Liguria"
              width={40}
              height={40}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain flex-shrink-0" />

              <h1 className="text-base sm:text-2xl font-bold tracking-tight whitespace-nowrap">
                <span className="text-white">Rumba</span>{" "}
                <span className="glow-text" style={{ color: a }}>Liguria</span>{" "}
                <span className="text-gray-400 text-xs sm:text-base font-normal">Events</span>
              </h1>
            </a>

            {/* Nav links — desktop only */}
            <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold tracking-wide uppercase text-gray-300">
              {[
                { href: "#eventi", label: t(lang, "nav.events") },
                ...(rentalConfig.enabled && rentalConfig.items.some(i => !i.archived)
                  ? [{ href: "#noleggio", label: rentalConfig.button_name || t(lang, "nav.rentals") }]
                  : []),
                { href: "#gallery", label: t(lang, "nav.gallery") },
                { href: "#contatti", label: t(lang, "nav.info") },
              ].map((item) => (
                <a key={item.href} href={item.href} className="hover:text-white transition-colors">
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-3">
                {/* Language switcher */}
              <div className="relative">
                <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-full bg-white/5 hover:bg-white/10 transition-all text-xs sm:text-sm text-gray-300"
                style={{ border: `1px solid ${a20}` }}>

                  <Globe size={14} style={{ color: a }} />
                  <span className="font-medium">{LANGS.find((l) => l.code === lang)?.flag}</span>
                </button>
                  {showLangMenu &&
              <div
                className="absolute right-0 top-full mt-1 bg-[#0a0a12] rounded-xl overflow-hidden shadow-xl shadow-black/50 min-w-[140px] z-50 animate-scale-in"
                style={{ border: `1px solid ${a20}` }}>

                        {LANGS.map((l) =>
                <button
                  key={l.code}
                  onClick={() => changeLang(l.code)}
                  className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 transition-all ${
                  lang === l.code ?
                  "text-white" :
                  "text-gray-400 hover:bg-white/5 hover:text-white"}`
                  }
                  style={lang === l.code ? { background: `${a}1a`, color: a } : {}}>

                            <span className="font-bold text-xs w-5">{l.flag}</span>
                            <span>{l.label}</span>
                          </button>
                )}
                      </div>
              }
              </div>

              <ThemeToggle className="!w-8 !h-8 sm:!w-9 sm:!h-9" />

              {hasAdminSession && (
                <button
                  onClick={() => router.push("/admin")}
                  title="Pannello Admin"
                  aria-label="Pannello Admin"
                  className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 hover:bg-white/10 transition-all text-gray-300 hover:text-white"
                  style={{ border: `1px solid ${a20}` }}
                >
                  <Shield size={15} />
                </button>
              )}

            {userEmail ?
            <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => {
                    setShowProfile(true);
                    fetchUserReservations(userEmail);
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full hover:opacity-80 transition-all text-xs sm:text-sm"
                  style={{ background: `${a}20`, border: `1px solid ${a30}`, color: a }}>
                  <QrCode size={14} />
                  <span className="font-medium hidden xs:inline">{t(lang, "header.profile")}</span>
                </button>
                <button
                onClick={handleLogout}
                className="p-1.5 sm:p-2 rounded-full hover:bg-white/5 transition-all text-gray-400 hover:text-red-400">
                  <LogOut size={16} />
                </button>
              </div> :

            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full hover:opacity-80 transition-all duration-300 text-xs sm:text-sm"
              style={{ background: `${a}20`, border: `1px solid ${a30}`, color: a }}>

                <LogIn size={14} />
                <span>{t(lang, "header.login")}</span>
              </button>
            }
          </div>
        </div>
      </header>

          {/* Hero */}
        <section
          className="theme-hero relative min-h-[88dvh] sm:min-h-[92dvh] flex items-center overflow-hidden animate-fade-in-up"
          onTouchStart={(event) => { heroTouchStart.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            const start = heroTouchStart.current;
            const end = event.changedTouches[0]?.clientX;
            heroTouchStart.current = null;
            if (start === null || end === undefined || Math.abs(end - start) < 45) return;
            moveHeroPhoto(end < start ? 1 : -1);
          }}
        >
          {/* Real crowd photos, rotating automatically with club-light
              glow and a dark vignette on top so the text stays legible. */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden bg-black">
            {heroPhotos.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover transition-opacity duration-1000 ease-in-out"
                style={{ opacity: i === heroPhotoIndex ? 1 : 0 }}
              />
            ))}
            <div className="absolute -top-24 -left-16 w-[280px] sm:w-[480px] h-[280px] sm:h-[480px] rounded-full blur-[90px] sm:blur-[140px] mix-blend-screen" style={{ background: "rgba(139,92,246,0.35)" }} />
            <div className="absolute top-0 -right-16 w-[320px] sm:w-[560px] h-[320px] sm:h-[560px] rounded-full blur-[90px] sm:blur-[140px] mix-blend-screen" style={{ background: "rgba(236,72,153,0.3)" }} />
            <div className="absolute bottom-0 left-1/3 w-[320px] sm:w-[520px] h-[200px] sm:h-[320px] rounded-full blur-[90px] sm:blur-[130px] mix-blend-screen" style={{ background: `${a}33` }} />
            {/* Vignette so text stays legible over the photo */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0.82) 100%)" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, transparent 80%)" }} />
          </div>

          {heroPhotos.length > 1 && (
            <div className="absolute z-20 bottom-5 sm:bottom-7 right-4 sm:right-8 flex items-center gap-2">
              {heroPhotos.map((_, index) => <button key={index} type="button" onClick={() => setHeroPhotoIndex(index)} aria-label={`Mostrar foto ${index + 1}`} className="h-2 rounded-full transition-all" style={{ width: index === heroPhotoIndex ? 24 : 8, background: index === heroPhotoIndex ? a : "rgba(255,255,255,0.55)" }} />)}
            </div>
          )}

          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 w-full">
            <div className="max-w-2xl">
              <p className="flex items-center gap-3 text-xs sm:text-sm font-semibold tracking-[0.3em] mb-4 sm:mb-5 animate-fade-in-up" style={{ color: a }}>
                <span className="w-8 h-px" style={{ background: a }} />
                {t(lang, "hero.tagline").toUpperCase()}
              </p>
              <h2 className="text-3xl sm:text-7xl md:text-8xl font-extrabold leading-[0.95] tracking-tight mb-5 sm:mb-6 animate-fade-in-up animate-delay-100 whitespace-nowrap sm:whitespace-normal">
                <span className="sm:block text-white">RUMBA</span>{" "}
                <span className="sm:block text-gradient-night">LIGURIA</span>
              </h2>
              <p className="text-gray-300 text-base sm:text-lg mb-8 sm:mb-10 max-w-md leading-relaxed animate-fade-in-up animate-delay-200">
                {t(lang, "hero.description")}
              </p>

              <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3 animate-fade-in-up animate-delay-300">
                <a
                  href="#eventi"
                  className="btn-shine flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm sm:text-base text-white transition-all active:scale-[0.97]"
                  style={{ background: "linear-gradient(90deg, var(--neon-violet), var(--neon-magenta) 55%, var(--neon-blue))", boxShadow: `0 0 28px ${a}55` }}
                >
                  <Calendar size={17} />
                  {t(lang, "hero.cta.events")}
                </a>
                <a
                  href={`https://wa.me/${WHATSAPP_BOOKING}?text=${encodeURIComponent(t(lang, "hero.bookingMessage"))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm sm:text-base text-white hover:bg-white/10 transition-all active:scale-[0.97]"
                  style={{ border: `1px solid ${a}` }}
                >
                  <Star size={16} style={{ color: a }} />
                  {t(lang, "hero.cta.table")}
                </a>
              </div>
            </div>
          </div>

          {/* Scroll cue */}
          <a href="#eventi" aria-hidden="true" className="hidden sm:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors animate-fade-in animate-delay-300">
            <span className="text-[10px] tracking-[0.2em] uppercase">Scroll</span>
            <ChevronDown size={16} className="animate-bounce" />
          </a>
        </section>

      {/* Snowflakes */}
        {snowflakes.length > 0 &&
      <div className="snowflakes-container" aria-hidden="true">
            {snowflakes.map((s, i) =>
        <div
          key={i}
          className="snowflake"
          style={{
            left: `${s.left}%`,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
            opacity: s.opacity,
            fontSize: `${s.size}px`
          }}>

                {s.char}
              </div>
        )}
          </div>
      }

      {/* "Eventi" ancla acá — así "Vedi Eventi"/el menú siempre arrancan
          mostrando el evento de hoy (destacado), no la grilla de abajo que
          lo excluye a propósito para no repetirlo. */}
      <div id="eventi" className="scroll-mt-20">
      {/* ─── Evento in Evidenza ─── */}
      {featuredEvent && (
        <section className="max-w-6xl mx-auto px-3 sm:px-4 pt-6 sm:pt-10 pb-16 sm:pb-20 relative z-10 animate-fade-in-up">
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden glass-panel" style={{ border: `1px solid ${a30}` }}>
            <div className="grid lg:grid-cols-[300px_1fr_320px]">
              {/* Flyer */}
              {featuredEvent.flyer_url && (
                <div className="relative h-56 lg:h-auto">
                  <Image src={featuredEvent.flyer_url} alt={featuredEvent.title} fill sizes="(max-width:1024px) 100vw, 300px" className="object-cover" />
                  <div className="absolute inset-0 lg:bg-gradient-to-r lg:from-transparent lg:to-[#0a0a12] bg-gradient-to-t from-[#0a0a12] to-transparent" />
                </div>
              )}

              {/* Info */}
              <div className="p-5 sm:p-6 lg:p-7 flex flex-col justify-center lg:border-l lg:border-white/[0.06]">
                <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.2em] uppercase mb-3" style={{ color: a }}>
                  <Star size={11} fill={a} /> Evento in Evidenza
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">{featuredEvent.title}</h3>
                {featuredEvent.organizer && (
                  <p className="text-sm sm:text-base font-bold uppercase tracking-wide mb-4" style={{ color: a }}>{featuredEvent.organizer}</p>
                )}

                <div className="flex flex-col gap-2 text-sm text-gray-300 mb-4">
                  {featuredEvent.event_date && (
                    <span className="flex items-center gap-2"><Calendar size={14} style={{ color: a }} className="flex-shrink-0" /> {featuredEvent.event_date}</span>
                  )}
                  {(featuredEvent.event_time || featuredEvent.event_time_end) && (
                    <span className="flex items-center gap-2"><Clock size={14} style={{ color: a }} className="flex-shrink-0" /> {featuredEvent.event_time}{featuredEvent.event_time_end ? ` – ${featuredEvent.event_time_end}` : ""}</span>
                  )}
                  <span className="flex items-center gap-2"><MapPin size={14} style={{ color: a }} className="flex-shrink-0" /> {featuredEvent.venue_name || "Rumba Liguria"} {featuredEvent.organizer && featuredEvent.organizer !== "Rumba Liguria" ? `– ${featuredEvent.organizer}` : ""}</span>
                </div>

                {featuredEvent.dress_code && (
                  <span className="inline-flex items-center gap-1.5 w-fit px-3 py-1 rounded-full text-xs font-medium text-gray-300" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
                    👗 {featuredEvent.dress_code}
                  </span>
                )}
              </div>

              {/* Countdown + CTAs */}
              <div className="p-5 sm:p-6 lg:p-7 flex flex-col justify-center gap-4 border-t lg:border-t-0 lg:border-l border-white/[0.06]">
                {featuredCountdown && (
                  <div className="grid grid-cols-4 gap-2.5">
                    {[
                      { v: featuredCountdown.days, l: "Giorni" },
                      { v: featuredCountdown.hours, l: "Ore" },
                      { v: featuredCountdown.minutes, l: "Minuti" },
                      { v: featuredCountdown.seconds, l: "Secondi" },
                    ].map((c) => (
                      <div key={c.l} className="text-center py-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="text-lg sm:text-xl font-extrabold" style={{ color: a }}>{String(c.v).padStart(2, "0")}</div>
                        <div className="text-[8px] uppercase tracking-tight text-gray-500 whitespace-nowrap">{c.l}</div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    setDetailEventId(featuredEvent.id);
                    handleReservation(featuredEvent);
                  }}
                  className="btn-shine flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-white transition-all active:scale-[0.97] w-full"
                  style={{ background: a, boxShadow: `0 0 20px ${a}40` }}
                >
                  <Crown size={15} /> {t(lang, "events.bookNow")}
                </button>
                <button
                  onClick={() => setDetailEventId(featuredEvent.id)}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-white border border-white/25 hover:bg-white/5 transition-all active:scale-[0.97] w-full"
                >
                  <Info size={15} /> {t(lang, "eventDetail.infoButton")}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Events */}
        <section className="max-w-6xl mx-auto px-3 sm:px-4 pb-16 sm:pb-20 relative z-10">
        {refPending ?
        <div className="flex justify-center py-16 sm:py-20 animate-fade-in">
              <div className="w-8 h-8 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
            </div> :
        linkExpired ?
        <div className="text-center py-16 sm:py-20 animate-fade-in">
              <Calendar size={40} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">{t(lang, "events.linkExpiredTitle")}</p>
              <p className="text-gray-600 text-xs sm:text-sm mt-2">{t(lang, "events.linkExpiredDesc")}</p>
            </div> :
        visibleEvents.length === 0 ?
        <div className="text-center py-16 sm:py-20 animate-fade-in">
              <Calendar size={40} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">{t(lang, "events.empty")}</p>
              <p className="text-gray-600 text-xs sm:text-sm mt-2">{t(lang, "events.emptyDesc")}</p>
            </div> :

        // The featured event already gets its own spotlight below ("Evento in
        // Evidenza") — skip it here so it doesn't show up twice on the page.
        (() => {
          const gridEvents = visibleEvents.filter((e) => e.id !== featuredEvent?.id);
          if (gridEvents.length === 0) {
            return (
              <p className="text-center text-gray-600 text-sm py-4">{t(lang, "events.moreComingSoon")}</p>
            );
          }
          return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6 items-start">
                {gridEvents.map((event) => {
          const badge = eventDateBadge(event.event_date_iso);
          const nowTs = Date.now();
          const saleCloseTs = event.event_date_iso ? getSaleCloseUTC(event.event_date_iso) : null;
          const isPast = saleCloseTs ? nowTs >= saleCloseTs : false;
          const isUpcoming = event.sale_start ? nowTs < new Date(event.sale_start).getTime() : false;
          const spotsLeft = event.max_tickets == null ? null : Math.max(0, event.max_tickets - (event.tickets_sold ?? event.reservation_total));
          return (
          <div
            key={event.id}
            className="rounded-xl sm:rounded-2xl bg-[#0a0a12] glow-border transition-all duration-500 animate-fade-in-up overflow-hidden"
            style={{ border: `1px solid ${a20}` }}>

                    {/* Flyer — cropped to a consistent card height (uncropped version
                        shows in the detail popup) with date/status badges overlaid */}
                    {event.flyer_url &&
            <div className="relative w-full aspect-[4/5] overflow-hidden">
                        <Image
                  src={event.flyer_url}
                  alt={event.title}
                  fill
                  sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 400px"
                  className="object-cover" />
                        {badge && (
                          <div className="absolute top-3 left-3 flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 leading-none">
                            <span className="text-base font-extrabold text-white">{badge.day}</span>
                            <span className="text-[9px] font-bold tracking-wide" style={{ color: a }}>{badge.month}</span>
                          </div>
                        )}
                        {event.sold_out ? (
                          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide text-white bg-red-500/90 backdrop-blur-sm">
                            SOLD OUT
                          </span>
                        ) : isUpcoming ? (
                          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide text-white bg-black/70 backdrop-blur-sm border border-white/15">
                            PROSSIMAMENTE
                          </span>
                        ) : isPast ? (
                          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide text-gray-300 bg-black/70 backdrop-blur-sm border border-white/15">
                            TERMINATO
                          </span>
                        ) : spotsLeft !== null && spotsLeft <= 15 ? (
                          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide text-amber-200 bg-black/70 backdrop-blur-sm border border-amber-300/25">
                            SOLO {spotsLeft} POSTI
                          </span>
                        ) : null}
                      </div>
            }

                    {/* Event info — compact preview only; full details open in the popup */}
                    <div className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-0.5">
                        <h3 className="text-base font-extrabold text-white leading-tight">{event.title}</h3>
                        {event.is_popular && <Star size={12} fill="#f59e0b" className="flex-shrink-0" style={{ color: "#f59e0b" }} />}
                      </div>
                      {event.organizer && (
                        <p className="text-xs font-semibold mb-0.5" style={{ color: accentColor }}>{event.organizer}</p>
                      )}
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-3">Rumba Liguria</p>

                      {/* Vedi Evento — opens the popup with full description, reservation, map */}
                      <button
                        onClick={() => setDetailEventId(event.id)}
                        className="w-full py-2.5 rounded-full font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] text-sm text-white hover:bg-white/5"
                        style={event.sold_out
                          ? { border: "1px solid rgba(255,255,255,0.25)" }
                          : { border: `1px solid ${accentColor}` }}
                      >
                        {event.sold_out ? "Sold Out" : t(lang, "eventDetail.viewEvent")}
                      </button>
                    </div>
                  </div>
          );
                })}
          </div>
          );
        })()}
        </section>
      </div>

      {/* ─── Event Detail Popup ─── */}
      {detailEventId && (() => {
        const detailEvent = visibleEvents.find((e) => e.id === detailEventId);
        if (!detailEvent) return null;
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
            onClick={() => setDetailEventId(null)}
          >
            <div
              className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-lg bg-[#0a0a12] sm:rounded-2xl overflow-y-auto glow-border animate-fade-in-up"
              style={{ border: `1px solid ${a30}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setDetailEventId(null)}
                className="fixed sm:absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-all"
              >
                <X size={18} />
              </button>

              {/* Flyer */}
              {detailEvent.flyer_url && (
                <div className={`w-full ${detailEvent.flyer_ratio === "9:16" ? "flex justify-center bg-black" : ""}`}>
                  <div style={{ width: detailEvent.flyer_ratio === "9:16" ? "min(100%, 420px)" : "100%" }}>
                    {(() => {
                      const [rw, rh] = detailEvent.flyer_ratio === "9:16" ? [900, 1600] : detailEvent.flyer_ratio === "1:1" ? [1000, 1000] : [1600, 900];
                      return <Image src={detailEvent.flyer_url} alt={detailEvent.title} width={rw} height={rh} sizes="(max-width:640px) 100vw, 560px" className="w-full h-auto block" />;
                    })()}
                  </div>
                </div>
              )}

              {/* Date / Time / Age strip */}
              {(detailEvent.event_date || detailEvent.event_time || detailEvent.min_age) && (
                <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 pt-4">
                  {detailEvent.event_date && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-xs border border-white/10">
                      <Calendar size={12} style={{ color: accentColor }} />
                      {detailEvent.event_date}
                    </span>
                  )}
                  {(detailEvent.event_time || detailEvent.event_time_end) && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-xs border border-white/10">
                      <Clock size={12} style={{ color: accentColor }} />
                      {detailEvent.event_time}{detailEvent.event_time_end ? ` – ${detailEvent.event_time_end}` : ""}
                    </span>
                  )}
                  {detailEvent.min_age && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-xs border border-white/10">
                      <span style={{ color: accentColor }} className="text-[11px] font-bold">+{detailEvent.min_age}</span>
                    </span>
                  )}
                </div>
              )}

              <div className="p-4 sm:p-6">
                {/* Title + POPOLARE */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight">{detailEvent.title}</h3>
                  {detailEvent.is_popular && (
                    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 mt-1" style={{ background: "#f59e0b20", color: "#f59e0b", borderColor: "#f59e0b30" }}>
                      <Star size={9} fill="#f59e0b" /> POPOLARE
                    </span>
                  )}
                </div>
                {/* Organizer */}
                <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
                  <span>🎤</span> {t(lang, "eventDetail.organizedBy")} <span style={{ color: accentColor }} className="font-medium ml-1">{detailEvent.organizer || "Rumba Liguria"}</span>
                </p>
                {/* Price + Share */}
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: detailEvent.price === "free" || detailEvent.price === "Free" || detailEvent.price === "Gratis" ? "rgba(34,197,94,0.15)" : `${accentColor}20`,
                      color: detailEvent.price === "free" || detailEvent.price === "Free" || detailEvent.price === "Gratis" ? "#4ade80" : accentColor,
                      border: "1px solid",
                      borderColor: detailEvent.price === "free" || detailEvent.price === "Free" || detailEvent.price === "Gratis" ? "rgba(34,197,94,0.3)" : `${accentColor}40`
                    }}
                  >
                    {detailEvent.price === "free" || detailEvent.price === "Free" ? t(lang, "events.free") : detailEvent.price}
                  </span>
                  <button
                    onClick={() => {
                      const url = window.location.href;
                      if (navigator.share) {
                        navigator.share({ title: detailEvent.title, url }).catch(() => {
                          navigator.clipboard.writeText(url).then(() => toast.success(t(lang, "eventDetail.linkCopied")));
                        });
                      } else {
                        navigator.clipboard.writeText(url).then(() => toast.success(t(lang, "eventDetail.linkCopied")));
                      }
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all active:scale-95"
                    style={{ background: `${accentColor}15`, color: accentColor, borderColor: `${accentColor}40` }}
                  >
                    <Share2 size={12} />
                    {t(lang, "eventDetail.share")}
                  </button>
                </div>

                {/* Full description — no truncation, there's room here */}
                {detailEvent.details && (
                  <p className="text-gray-400 leading-relaxed text-sm sm:text-base whitespace-pre-line mb-4">
                    {detailEvent.details}
                  </p>
                )}

                {detailEvent.dress_code && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-xs border border-white/10">
                      <span>👗</span> {detailEvent.dress_code}
                    </span>
                  </div>
                )}

                {/* Reservation button */}
                {(() => {
                  const now = Date.now();
                  const saleClose = detailEvent.event_date_iso ? getSaleCloseUTC(detailEvent.event_date_iso) : null;
                  const saleClosed = saleClose ? now >= saleClose : false;
                  const saleNotOpen = detailEvent.sale_start ? now < new Date(detailEvent.sale_start).getTime() : false;
                  const bookingClosed = saleClosed || saleNotOpen;
                  if (bookingClosed) {
                    return (
                      <button
                        disabled
                        className="w-full py-3 rounded-xl text-gray-500 font-semibold flex items-center justify-center gap-2 cursor-not-allowed text-sm sm:text-base"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        <X size={18} />
                        {t(lang, "eventDetail.bookingClosed")}
                      </button>
                    );
                  }
                  if (detailEvent.sold_out) {
                    return (
                      <div className="space-y-2">
                        <div
                          className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm sm:text-base tracking-widest"
                          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}
                        >
                          <X size={18} />
                          SOLD OUT
                        </div>
                        <a
                          href={`https://wa.me/${WHATSAPP_BOOKING}?text=${encodeURIComponent(t(lang, "eventDetail.soldOutWhatsappMessage", { title: detailEvent.title }))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-300 text-sm sm:text-base"
                          style={{ background: "linear-gradient(90deg, #16a34a, #22c55e)", boxShadow: "0 0 20px rgba(34,197,94,0.25)" }}
                        >
                          <MessageCircle size={18} />
                          {t(lang, "eventDetail.messageUsWhatsapp")}
                        </a>
                      </div>
                    );
                  }
                  return (
                    <button
                      onClick={() => handleReservation(detailEvent)}
                      className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-300 text-sm sm:text-base"
                      style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`, boxShadow: `0 0 20px ${accentColor}30` }}
                    >
                      <Users size={18} />
                      {t(lang, "events.bookNow")}
                    </button>
                  );
                })()}

                {/* Reservation panel */}
                {reservation && reservation.eventId === detailEvent.id && (
                  <div className="overflow-hidden animate-fade-in">
                    <div className="mt-4 p-4 rounded-xl" style={{ background: `${a}0d`, border: `1px solid ${a30}` }}>
                      <p className="text-sm text-gray-300 mb-3">{t(lang, "events.howMany")}</p>
                      {/* Ticket Type Selector */}
                      {detailEvent.ticket_types && detailEvent.ticket_types.length > 0 && (
                        <div className="mb-3">
                          <label className="text-xs text-gray-400 mb-1.5 block">{t(lang, "eventDetail.ticketType")}</label>
                          <div className="grid grid-cols-2 gap-2">
                            {detailEvent.ticket_types.map((tt) => (
                              <button
                                key={tt.name}
                                onClick={() => setReservation((prev) => prev ? { ...prev, ticketType: tt.name } : null)}
                                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                  reservation.ticketType === tt.name
                                    ? "text-white border-white/30"
                                    : "text-gray-400 border-white/10 hover:border-white/20"
                                }`}
                                style={reservation.ticketType === tt.name ? { background: `${tt.color}25`, borderColor: tt.color } : {}}
                              >
                                <span className="block">{tt.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {(() => {
                        const spotsLeft = detailEvent.max_tickets != null ? detailEvent.max_tickets - (detailEvent.tickets_sold ?? detailEvent.reservation_total) : 999;
                        const maxAllowed = Math.max(1, detailEvent.max_per_person ? Math.min(spotsLeft, detailEvent.max_per_person) : spotsLeft);
                        return (
                          <div className="flex items-center gap-3 mb-4 justify-center">
                            <button
                              onClick={() => setReservation((prev) => prev ? { ...prev, count: Math.max(1, prev.count - 1) } : null)}
                              className="w-11 h-11 sm:w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg hover:bg-white/10 transition-all active:bg-white/15"
                            >
                              -
                            </button>
                            <span className="text-2xl font-bold w-16 text-center" style={{ color: a }}>
                              {reservation.count}
                            </span>
                            <button
                              onClick={() => setReservation((prev) => prev ? { ...prev, count: Math.min(maxAllowed, prev.count + 1) } : null)}
                              disabled={reservation.count >= maxAllowed}
                              className="w-11 h-11 sm:w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg hover:bg-white/10 transition-all active:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        );
                      })()}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setReservation(null)}
                          className="flex-1 py-2.5 sm:py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-all text-sm active:bg-white/15"
                        >
                          {t(lang, "events.cancel")}
                        </button>
                        <button
                          onClick={() => confirmReservation(detailEvent)}
                          disabled={reserving}
                          className="flex-1 py-2.5 sm:py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-all text-sm flex items-center justify-center gap-2 active:bg-green-400 disabled:opacity-50"
                        >
                          {reserving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <CheckCircle size={16} />
                          )}
                          {(() => {
                            const selectedType = detailEvent.ticket_types?.find(tt => tt.name === reservation.ticketType);
                            if (selectedType?.price) {
                              return `Paga €${(selectedType.price * reservation.count).toFixed(2).replace(/\.00$/, "")}`;
                            }
                            return t(lang, "reservation.confirm");
                          })()}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Google Maps embed — accordion */}
                {detailEvent.maps_url && (
                  <div className="mt-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${a20}` }}>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-3 bg-white/[0.03] active:bg-white/[0.06] transition-all"
                      onClick={() => setExpandedMaps((prev) => {
                        const next = new Set(prev);
                        if (next.has(detailEvent.id)) next.delete(detailEvent.id);
                        else next.add(detailEvent.id);
                        return next;
                      })}
                    >
                      <MapPin size={14} style={{ color: accentColor }} />
                      <span className="text-xs text-gray-300 font-medium flex-1 text-left">{t(lang, "location.howToGetThere")}</span>
                      <a
                        href={detailEvent.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-0.5 rounded-full mr-2"
                        style={{ color: accentColor, background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t(lang, "location.openMaps")} →
                      </a>
                      <span className="text-gray-500 text-xs transition-transform duration-300" style={{ display: "inline-block", transform: expandedMaps.has(detailEvent.id) ? "rotate(180deg)" : "rotate(0deg)" }}>
                        ▼
                      </span>
                    </button>
                    <div style={{ height: expandedMaps.has(detailEvent.id) ? 240 : 0, overflow: "hidden", transition: "height 0.35s ease" }}>
                      <iframe
                        src={getMapsEmbedUrl(detailEvent.maps_url)}
                        width="100%"
                        height="240"
                        style={{ border: 0, display: "block" }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  </div>
                )}

                {/* How to get there - transport */}
                <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-xs text-gray-500 mb-2.5 font-medium uppercase tracking-wide">{t(lang, "location.howToComeHeading")}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: Train, label: t(lang, "location.train"), color: "#3b82f6", travelmode: "transit" },
                      { icon: Car, label: t(lang, "location.car"), color: "#10b981", travelmode: "driving" },
                      { icon: Bike, label: t(lang, "location.bike"), color: "#f59e0b", travelmode: "bicycling" },
                      { icon: PersonStanding, label: t(lang, "location.walking"), color: "#ec4899", travelmode: "walking" },
                    ].map(({ icon: Icon, label, color, travelmode }) => {
                      const dest = detailEvent.maps_url
                        ? (() => {
                            const url = detailEvent.maps_url!;
                            const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                            const qMatch = url.match(/[?&]q=([^&]+)/);
                            const placeMatch = url.match(/\/maps\/place\/([^/@?]+)/);
                            if (coordMatch) return `${coordMatch[1]},${coordMatch[2]}`;
                            if (qMatch) return decodeURIComponent(qMatch[1]);
                            if (placeMatch) return decodeURIComponent(placeMatch[1]);
                            return url;
                          })()
                        : null;
                      const href = dest
                        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=${travelmode}`
                        : null;
                      const Wrapper = href ? "a" : "div";
                      return (
                        <Wrapper
                          key={label}
                          {...(href ? { href, target: "_blank", rel: "noopener noreferrer" } : {})}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-lg bg-white/5 border border-white/5 transition-all duration-200${href ? " cursor-pointer hover:bg-white/10 active:scale-95" : ""}`}
                        >
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${color}20` }}>
                            <Icon size={16} style={{ color }} />
                          </div>
                          <span className="text-[10px] text-gray-400">{label}</span>
                        </Wrapper>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── L'Esperienza Rumba Liguria ─── */}
      <section className="max-w-6xl mx-auto px-3 sm:px-4 pb-16 sm:pb-20 relative z-10">
        <h2 className="section-title text-2xl sm:text-4xl text-white text-center mb-8 sm:mb-10 animate-fade-in-up">
          {t(lang, "experience.titlePrefix")} <span className="text-gradient-night">Rumba Liguria</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {[
            { icon: Star, label: t(lang, "experience.exclusiveEvents.title"), desc: t(lang, "experience.exclusiveEvents.desc") },
            { icon: Users, label: t(lang, "experience.vipTables.title"), desc: t(lang, "experience.vipTables.desc") },
            { icon: MessageCircle, label: t(lang, "experience.premiumCocktails.title"), desc: t(lang, "experience.premiumCocktails.desc") },
            { icon: QrCode, label: t(lang, "experience.uniqueAtmosphere.title"), desc: t(lang, "experience.uniqueAtmosphere.desc") },
            { icon: Shield, label: t(lang, "experience.security.title"), desc: t(lang, "experience.security.desc") },
          ].map((f) => (
            <div key={f.label} className="p-4 rounded-xl bg-[#0a0a12] border border-white/5 text-center hover:border-white/15 transition-all">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: `${a}18` }}>
                <f.icon size={18} style={{ color: a }} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">{f.label}</h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-snug">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Noleggio Attrezzatura Section (compact) ─── */}
      {rentalConfig.enabled && rentalConfig.items.filter(i => !i.archived).length > 0 && (
        <section id="noleggio" className="max-w-6xl mx-auto px-3 sm:px-4 pb-16 sm:pb-20 relative z-10 scroll-mt-20">
          {(() => {
            const activeItems = rentalConfig.items.filter(i => !i.archived);
            return (
          <div className="rounded-2xl border border-white/10 bg-[#0a0a12] overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${a}18` }}>
                  <Package size={20} style={{ color: a }} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">{rentalConfig.section_name}</h2>
                  <p className="text-xs text-gray-500">{t(lang, "rental.equipmentAvailable", { count: activeItems.filter(i => i.available).length })}</p>
                </div>
              </div>
              <button
                onClick={() => setShowRentalModal(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: `${a}18`, color: a, border: `1px solid ${a}30` }}
              >
                <ChevronDown size={15} />
                {rentalConfig.button_name || t(lang, "rental.viewMore")}
              </button>
            </div>
            {/* Preview strip */}
            <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-none">
              {activeItems.slice(0, 6).map(item => (
                <button
                  key={item.id}
                  onClick={() => { setRentalModalItem(item); setRentalPhotoIndex(0); setShowRentalModal(true); }}
                  className="flex-shrink-0 w-20 sm:w-24 group"
                >
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-white/10 group-hover:border-white/30 transition-all">
                    {item.photos[0]
                      ? <Image src={item.photos[0]} alt={item.name} fill sizes="96px" className="object-cover" />
                      : <div className="w-full h-full bg-white/5 flex items-center justify-center"><Package size={20} className="text-gray-600" /></div>
                    }
                    {!item.available && <div className="absolute inset-0 bg-black/60" />}
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-1 truncate w-20 sm:w-24">{item.name}</p>
                </button>
              ))}
              {activeItems.length > 6 && (
                <button onClick={() => setShowRentalModal(true)} className="flex-shrink-0 w-20 sm:w-24 flex flex-col items-center justify-center gap-1">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-white/10 bg-white/3 flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-400">+{activeItems.length - 6}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">{t(lang, "rental.others")}</p>
                </button>
              )}
            </div>
          </div>
            );
          })()}
        </section>
      )}

      {/* ─── Noleggio Modal ─── */}
      {showRentalModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) { setShowRentalModal(false); setRentalModalItem(null); }}}>
          <div className="w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88vh] bg-[#0d0d1a] sm:rounded-2xl rounded-t-2xl border border-white/10 flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
              {rentalModalItem ? (
                <button onClick={() => { setRentalModalItem(null); setRentalPhotoIndex(0); }} className="flex items-center gap-2 text-gray-400 hover:text-white transition-all">
                  <ChevronDown size={16} className="rotate-90" />
                  <span className="text-sm">{t(lang, "rental.back")}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Package size={16} style={{ color: a }} />
                  <h3 className="font-bold text-white text-base">{rentalConfig.section_name}</h3>
                </div>
              )}
              <button onClick={() => { setShowRentalModal(false); setRentalModalItem(null); }} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1">
              {rentalModalItem ? (
                /* ── Item detail view ── */
                <div className="p-4 space-y-4">
                  {/* Photo gallery */}
                  {rentalModalItem.photos.length > 0 && (
                    <div className="space-y-2">
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
                        <Image src={rentalModalItem.photos[rentalPhotoIndex]} alt={rentalModalItem.name} fill sizes="(max-width:640px) 100vw, 480px" className="object-cover" />
                        {!rentalModalItem.available && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-sm text-gray-300 font-medium bg-black/50 px-4 py-1.5 rounded-full">{t(lang, "rental.notAvailable")}</span>
                          </div>
                        )}
                        {rentalModalItem.available && (
                          <div className="absolute top-2 right-2">
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">{t(lang, "rental.available")}</span>
                          </div>
                        )}
                      </div>
                      {rentalModalItem.photos.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                          {rentalModalItem.photos.map((url, i) => (
                            <button key={i} onClick={() => setRentalPhotoIndex(i)}
                              className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${rentalPhotoIndex === i ? "border-blue-400" : "border-white/10 opacity-60 hover:opacity-100"}`}>
                              <Image src={url} alt="" fill sizes="56px" className="object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h2 className="text-lg font-bold text-white">{rentalModalItem.name}</h2>
                      {rentalModalItem.price && <span className="text-base font-bold flex-shrink-0" style={{ color: a }}>{rentalModalItem.price}</span>}
                    </div>
                    {rentalModalItem.duration && <p className="text-sm text-gray-500 mb-3">{rentalModalItem.duration}</p>}
                    {rentalModalItem.description && <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{rentalModalItem.description}</p>}
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    {rentalModalItem.contact_phone && (
                      <a href={`https://wa.me/${rentalModalItem.contact_phone.replace(/[^0-9+]/g, "")}?text=${encodeURIComponent(t(lang, "rental.whatsappMessage", { name: rentalModalItem.name }))}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                        style={{ background: `${a}18`, color: a, border: `1px solid ${a}30` }}>
                        <Phone size={16} /> {t(lang, "rental.contactWhatsapp")}
                      </a>
                    )}
                    {rentalModalItem.contact_email && (
                      <a href={`mailto:${rentalModalItem.contact_email}?subject=${encodeURIComponent(t(lang, "rental.emailSubject", { name: rentalModalItem.name }))}`}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-all active:scale-95">
                        <Mail size={16} /> {t(lang, "rental.sendEmail")}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Items list view ── */
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {rentalConfig.items.filter(i => !i.archived).map(item => (
                    <button key={item.id} onClick={() => { setRentalModalItem(item); setRentalPhotoIndex(0); }}
                      className={`text-left rounded-xl overflow-hidden border transition-all active:scale-[0.97] ${item.available ? "border-white/10 hover:border-white/25 bg-[#0a0a12]" : "border-white/5 bg-[#0a0a12] opacity-60"}`}>
                      <div className="relative w-full aspect-square">
                        {item.photos[0]
                          ? <Image src={item.photos[0]} alt={item.name} fill sizes="(max-width:640px) 50vw, 200px" className="object-cover" />
                          : <div className="w-full h-full bg-white/5 flex items-center justify-center"><Package size={24} className="text-gray-600" /></div>
                        }
                        {item.available
                          ? <div className="absolute top-1.5 right-1.5"><span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">✓</span></div>
                          : <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-[10px] text-gray-400 bg-black/60 px-2 py-0.5 rounded-full">{t(lang, "rental.notAvailableShort")}</span></div>
                        }
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                        {item.price && <p className="text-[10px] font-bold mt-0.5" style={{ color: a }}>{item.price}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1 Year Anniversary + Gallery */}
      <section id="gallery" className="max-w-6xl mx-auto px-3 sm:px-4 pb-16 sm:pb-20 relative z-10 scroll-mt-20">
        {/* Anniversary banner */}
        <div className="text-center mb-10 sm:mb-14 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold uppercase tracking-widest mb-4">
            <span>⭐</span> {t(lang, "gallery.eventsBy")} <span>⭐</span>
          </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3">
              <span className="glow-text" style={{ color: a }}>{t(lang, "gallery.eventsBy")}</span>
            </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            {t(lang, "gallery.description")}
          </p>
        </div>

        {/* Photo/Video grid — dynamic from DB. Capped to a preview count so the
            page doesn't keep growing taller forever as more photos get added
            in the admin panel; "Vedi tutte" expands the rest on demand. */}
        {gallery.length === 0 ? (
          <div className="text-center py-10 text-gray-600 text-sm">{t(lang, "gallery.empty")}</div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div
              className="relative aspect-[4/5] sm:aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl touch-pan-y"
              onTouchStart={(event) => { galleryTouchStart.current = event.touches[0].clientX; }}
              onTouchEnd={(event) => {
                const start = galleryTouchStart.current;
                galleryTouchStart.current = null;
                if (start === null) return;
                const distance = event.changedTouches[0].clientX - start;
                if (Math.abs(distance) > 45) moveGallery(distance < 0 ? 1 : -1);
              }}
            >
              {gallery.map((item, index) => (
                <div key={item.id} aria-hidden={index !== galleryIndex} className={`absolute inset-0 transition-all duration-700 ease-out ${index === galleryIndex ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-[1.02]"}`}>
                  {item.type === "video" ? (
                    <video src={item.url} className="w-full h-full object-cover" playsInline muted loop autoPlay={index === galleryIndex} preload="metadata" />
                  ) : (
                    <button type="button" className="relative w-full h-full cursor-zoom-in" onClick={() => setLightboxImg(item.url)} aria-label={`Apri foto ${index + 1} di ${gallery.length}`}>
                      <Image src={item.url} alt={`Rumba Liguria evento ${index + 1}`} fill priority={index === 0} sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
                    </button>
                  )}
                </div>
              ))}
              {gallery.length > 1 && <>
                <button type="button" onClick={() => moveGallery(-1)} aria-label="Foto precedente" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronLeft size={22} /></button>
                <button type="button" onClick={() => moveGallery(1)} aria-label="Foto successiva" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronRight size={22} /></button>
              </>}
              <div className="absolute bottom-4 left-1/2 flex max-w-[75%] -translate-x-1/2 gap-2 rounded-full bg-black/35 px-3 py-2 backdrop-blur-sm">
                {gallery.map((item, index) => <button key={item.id} type="button" onClick={() => setGalleryIndex(index)} aria-label={`Mostrar contenido ${index + 1}`} aria-current={index === galleryIndex} className={`h-2 rounded-full transition-all ${index === galleryIndex ? "w-6 bg-white" : "w-2 bg-white/55 hover:bg-white/80"}`} />)}
              </div>
              <div className="absolute right-4 top-4 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">{galleryIndex + 1} / {gallery.length}</div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span>{t(lang, "gallery.tapToView")}</span>
              <a href="https://www.instagram.com/rumba_liguria?igsh=ZmwzYWZ6NDl5NmQ1" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold transition-opacity hover:opacity-75" style={{ color: accentColor }}><Instagram size={13} /> {t(lang, "gallery.seeMoreInstagram")}</a>
            </div>
          </div>
        )}
      </section>

        {/* Cancelled reservation alert */}
        {cancelledReservations.length > 0 &&
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-sm bg-[#0a0a12] border border-red-500/30 rounded-2xl p-6 animate-fade-in-up">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 mx-auto mb-4">
                <XCircle size={28} className="text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white text-center mb-2">{t(lang, "cancelledAlert.title")}</h3>
              <p className="text-sm text-gray-400 text-center mb-4">
                {cancelledReservations.length === 1 ?
            <>{t(lang, "cancelledAlert.singleBefore")} <span className="text-white font-medium">{cancelledReservations[0].eventTitle}</span> {t(lang, "cancelledAlert.singleAfter")}</> :
            <>{t(lang, "cancelledAlert.multiple")}</>
            }
              </p>
              <div className="space-y-2 mb-5">
                {cancelledReservations.map((r) =>
            <div key={r.code} className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/5 border border-red-500/15">
                    <XCircle size={14} className="text-red-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-white font-medium truncate">{r.eventTitle}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{r.code}</p>
                    </div>
                  </div>
            )}
              </div>
                <button
              onClick={() => {
                const acknowledged = JSON.parse(localStorage.getItem("rumba_ack_cancelled") || "[]");
                const newAcknowledged = [...acknowledged, ...cancelledReservations.map(r => r.code)];
                localStorage.setItem("rumba_ack_cancelled", JSON.stringify(newAcknowledged));
                setCancelledReservations([]);
              }}
              className="w-full py-3 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all font-medium text-sm">

                {t(lang, "cancelledAlert.acknowledge")}
              </button>
            </div>
          </div>
      }

        {/* Lightbox */}
        {lightboxImg &&
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-fade-in"
        onClick={() => setLightboxImg(null)}>

          <button
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
          onClick={() => setLightboxImg(null)}>

            <X size={22} />
          </button>
          <Image
          src={lightboxImg}
          alt="Foto evento"
          width={0}
          height={0}
          sizes="100vw"
          className="w-auto h-auto max-w-full max-h-[90vh] rounded-xl object-contain animate-fade-in-up"
          onClick={(e) => e.stopPropagation()} />

        </div>
      }


      {/* Footer */}
      <footer className="relative z-10" style={{ borderTop: `1px solid ${a20}` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-6 mb-10">
            {/* Logo + tagline + socials */}
            <div className="col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Image
                  src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/659b52a5-69ae-4783-b222-bf54f8c81855/logo-1771260580239.png?width=8000&height=8000&resize=contain"
                  alt="Rumba Liguria"
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-contain flex-shrink-0"
                />
                <span className="text-base font-bold whitespace-nowrap">
                  <span className="text-white">Rumba</span> <span style={{ color: a }}>Liguria</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-4">{t(lang, "hero.tagline")}</p>
              <p className="text-xs font-bold tracking-[0.16em] mb-2" style={{ color: a }}>{t(lang, "footer.followUs")}</p>
              <div className="flex items-center gap-2">
                <a href="https://www.instagram.com/rumba_liguria?igsh=ZmwzYWZ6NDl5NmQ1" target="_blank" rel="noopener noreferrer" aria-label="Instagram de Rumba Liguria" className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-pink-400 hover:bg-pink-400/10 transition-all"><Instagram size={19} /></a>
                <a href="https://t.me/+l7vvNcE_ZQQyZTQ0" target="_blank" rel="noopener noreferrer" aria-label="Telegram de Rumba Liguria" className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 transition-all"><Send size={19} /></a>
                <a href="https://wa.me/393501863148" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp de Rumba Liguria" className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-green-400 hover:bg-green-400/10 transition-all"><MessageCircle size={19} /></a>
              </div>
            </div>

            {/* Navigazione */}
            <div>
              <h4 className="text-sm font-bold tracking-widest mb-3" style={{ color: a }}>{t(lang, "footer.navigation")}</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                {[
                  { href: "#eventi", label: t(lang, "nav.events") },
                  ...(rentalConfig.enabled && rentalConfig.items.some(i => !i.archived)
                    ? [{ href: "#noleggio", label: rentalConfig.button_name || t(lang, "nav.rentals") }]
                    : []),
                  { href: "#gallery", label: t(lang, "nav.gallery") },
                ].map((l) => (
                  <li key={l.href}><a href={l.href} className="hover:text-white transition-colors">{l.label}</a></li>
                ))}
              </ul>
            </div>

            {/* Contatti */}
            <div id="contatti" className="scroll-mt-20">
              <h4 className="text-sm font-bold tracking-widest mb-3" style={{ color: a }}>{t(lang, "footer.contact")}</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li className="flex items-start gap-2"><MessageCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: a }} />
                  <a href={`https://wa.me/${WHATSAPP_BOOKING}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">+39 350 186 3148</a>
                </li>
                <li className="flex items-start gap-2"><Instagram size={13} className="mt-0.5 flex-shrink-0" style={{ color: a }} />
                  <a href="https://www.instagram.com/rumba_liguria?igsh=ZmwzYWZ6NDl5NmQ1" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">@rumba_liguria</a>
                </li>
                <li className="flex items-start gap-2"><Send size={13} className="mt-0.5 flex-shrink-0" style={{ color: a }} />
                  <a href="https://t.me/+l7vvNcE_ZQQyZTQ0" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">{t(lang, "footer.telegramChannel")}</a>
                </li>
              </ul>
            </div>

            {/* Info / Admin */}
            <div>
              <h4 className="text-sm font-bold tracking-widest mb-3" style={{ color: a }}>{t(lang, "footer.info")}</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#eventi" className="hover:text-white transition-colors">{t(lang, "footer.howToBook")}</a></li>
                <li><a href={`https://wa.me/${WHATSAPP_BOOKING}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">{t(lang, "footer.support")}</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 text-xs text-gray-600" style={{ borderTop: `1px solid ${a10}` }}>
            <p>© {new Date().getFullYear()} Rumba Liguria Events. {t(lang, "footer.rights")}</p>
          </div>
        </div>
      </footer>

        {/* Profile / My Reservations Modal */}
        {showProfile &&
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
          onClick={() => setShowProfile(false)}>

            <div
            className="w-full h-full sm:h-auto sm:max-w-2xl bg-[#0a0a12] sm:rounded-2xl p-4 sm:p-6 text-center space-y-4 glow-border animate-fade-in-up flex flex-col overflow-hidden"
            style={{ border: `1px solid ${a30}` }}
            onClick={(e) => e.stopPropagation()}>

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <User size={20} style={{ color: a }} />
                  <h3 className="text-lg font-bold text-white">{t(lang, "profile.title")}</h3>
                </div>
                <button
                onClick={() => setShowProfile(false)}
                className="p-2 rounded-full hover:bg-white/5 text-gray-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                <div className="text-left space-y-4">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">{t(lang, "profile.myReservations")}</h4>
                  
                  {loadingReservations ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                      <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-gray-500">{t(lang, "auth.loading")}</p>
                    </div>
                  ) : userReservations.length === 0 ? (
                    <div className="py-12 text-center">
                      <Ticket size={40} className="mx-auto text-gray-700 mb-3" />
                      <p className="text-gray-500 text-sm">{t(lang, "profile.noReservations")}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {userReservations.map((res: any) => {
                        const expired = res.status === 'active' && isReservationExpired(res.events?.event_date_iso);
                        const displayStatus = expired ? 'expired' : res.status;
                        return (
                        <div
                          key={res.code}
                          className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-3 group hover:border-blue-500/20 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            {res.events?.flyer_url && (
                              <Image
                                src={res.events.flyer_url}
                                alt={res.events.title}
                                width={64}
                                height={64}
                                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <h5 className="text-sm font-bold text-white truncate">{res.events?.title || t(lang, "generic.event")}</h5>
                              <p className="text-[11px] text-gray-500 mt-0.5">{res.events?.event_date}</p>
                              <div className="mt-2 flex items-center gap-2">
                                <span
                                  className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full border ${
                                    displayStatus === 'active' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                    displayStatus === 'used' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                    displayStatus === 'expired' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                    'bg-red-500/10 border-red-500/20 text-red-400'
                                  }`}
                                >
                                  {t(lang, `profile.status.${displayStatus}`)}
                                </span>
                                <span className="text-[10px] font-mono text-gray-600">{res.code}</span>
                              </div>
                            </div>
                          </div>

                          {displayStatus === 'active' && (
                            <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-center">
                              <div className="bg-white rounded-lg p-2">
                                <QRCodeSVG
                                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/verify/${res.code}`}
                                  size={100}
                                  level="M"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 sticky bottom-0 bg-[#0a0a12]">
                <button
                  onClick={() => setShowProfile(false)}
                  className="w-full py-3 rounded-xl text-white font-semibold hover:opacity-80 transition-all text-sm"
                  style={{ background: `linear-gradient(90deg, ${a}, ${a}cc)` }}>
                  {t(lang, "profile.back")}
                </button>
              </div>
            </div>
          </div>
        }

        {/* QR Code Modal */}
        {qrData &&
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
        onClick={() => setQrData(null)}>

          <div
          className="w-full max-w-sm bg-[#0a0a12] rounded-2xl p-6 text-center space-y-4 glow-border animate-fade-in-up max-h-[90vh] overflow-y-auto"
          style={{ border: `1px solid ${a30}` }}
          onClick={(e) => e.stopPropagation()}>

            <CheckCircle size={40} className="text-green-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">{t(lang, "reservation.confirmed")}</h3>
            <p className="text-sm text-gray-400">{qrData.eventTitle}</p>
            <p className="text-sm text-gray-400">
              {qrData.guestCount} {qrData.guestCount === 1 ? t(lang, "reservation.person") : t(lang, "reservation.people")}
            </p>
            
            <div className="space-y-6 pt-2">
              {qrData.codes.map((code, index) => {
                const qrColor = qrData.ticketTypes?.[0]?.color || "#000000";
                return (
                <div key={code} className="space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Ticket {index + 1}{qrData.ticketTypes?.[0] ? ` — ${qrData.ticketTypes[0].name}` : ""}</p>
                  <div className="qr-code-container bg-white rounded-xl p-3 inline-block">
                    <QRCodeSVG
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/verify/${code}`}
                      size={160}
                      level="H"
                      fgColor={qrColor}
                    />
                  </div>
                  <p className="text-[10px] font-mono text-gray-500">{code}</p>
                </div>);
              })}
            </div>

            <p className="text-xs text-gray-500 pt-2">{t(lang, "reservation.showQr")}</p>
            <div className="flex gap-2 sticky bottom-0 bg-[#0a0a12] py-2">
              <button
                onClick={saveQrImage}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 transition-all text-sm flex items-center justify-center gap-2">
                <Download size={16} />
                {t(lang, "reservation.saveQr")}
              </button>
              <button
                onClick={() => setQrData(null)}
                className="flex-1 py-2.5 rounded-xl text-white font-semibold hover:opacity-80 transition-all text-sm"
                style={{ background: `linear-gradient(90deg, ${a}, ${a}cc)` }}>
                OK
              </button>
            </div>
          </div>
        </div>
      }

      {/* Auth Modal */}
      {showAuth &&
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
        onClick={() => {setShowAuth(false);setShowPassword(false);resetAdminFlow();}}>

          <div
          className="w-full sm:max-w-md overflow-hidden bg-[#090914] border-t sm:border rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 glow-border animate-fade-in-up"
          style={{ borderColor: a30 }}
          onClick={(e) => e.stopPropagation()}>

            <div className="sm:hidden w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <div className="relative flex items-start justify-center mb-5 sm:mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/5 ring-1 ring-white/10 shadow-lg" style={{ boxShadow: `0 0 24px ${a}55` }}>
                  <Image src="/icon-512.png" alt="Rumba Liguria" width={48} height={48} className="w-full h-full object-cover" priority />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] font-semibold" style={{ color: a }}>Rumba Liguria</p>
                  <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">
                    {adminStep !== "none" ? t(lang, "auth2fa.title") : authMode === "forgot" ? t(lang, "auth.resetTitle") : authMode === "login" ? t(lang, "auth.login") : t(lang, "auth.register")}
                  </h3>
                </div>
              </div>
              <button
              onClick={() => {setShowAuth(false);setShowPassword(false);}}
              className="absolute right-0 top-0 p-2 rounded-full hover:bg-white/5 text-gray-400">

                <X size={18} />
              </button>
            </div>
            {adminStep === "channel" ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400 text-center mb-1">{t(lang, "auth2fa.chooseChannel")}</p>
                {adminChannels.includes("email") && (
                  <button onClick={() => requestAdminCode("email")} disabled={adminSending} className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/25 transition-all text-left disabled:opacity-50">
                    <Mail size={20} style={{ color: a }} />
                    <div><p className="text-white font-semibold text-sm">Email</p><p className="text-gray-500 text-xs">{adminMasked.email}</p></div>
                  </button>
                )}
                {adminChannels.includes("whatsapp") && (
                  <button onClick={() => requestAdminCode("whatsapp")} disabled={adminSending} className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/25 transition-all text-left disabled:opacity-50">
                    <Phone size={20} className="text-green-400" />
                    <div><p className="text-white font-semibold text-sm">WhatsApp</p><p className="text-gray-500 text-xs">{adminMasked.phone}</p></div>
                  </button>
                )}
                <button onClick={resetAdminFlow} className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-300 pt-1"><ArrowLeft size={14} /> {t(lang, "auth2fa.goBack")}</button>
              </div>
            ) : adminStep === "code" ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400 text-center">{t(lang, "auth2fa.enterCode")}</p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && adminCode.length === 6 && verifyAdminCode()}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.5em] focus:outline-none transition-all"
                  placeholder="••••••"
                />
                <button onClick={verifyAdminCode} disabled={adminSending || adminCode.length !== 6} className="w-full py-3.5 rounded-xl text-white font-semibold active:scale-[0.98] transition-all duration-300 disabled:opacity-50" style={{ background: `linear-gradient(90deg, ${a}, ${a}cc)`, boxShadow: `0 10px 28px ${a}30` }}>
                  {adminSending ? t(lang, "auth.loading") : t(lang, "auth2fa.verifyButton")}
                </button>
                <button onClick={() => setAdminStep(adminChannels.length > 1 ? "channel" : "none")} className="w-full text-xs text-gray-500 hover:text-gray-300">{t(lang, "auth2fa.resendPrompt")}</button>
              </div>
            ) : authMode === "forgot" ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <Sparkles size={18} style={{ color: a }} className="mb-2" />
                  <p className="text-sm text-gray-300 leading-relaxed">{t(lang, "auth.resetDescription")}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1.5 block">{t(lang, "auth.email")}</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden="true" />
                    <input autoFocus type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="email@gmail.com" onKeyDown={(e) => e.key === "Enter" && handleAuth()} className="w-full py-3 pl-11 pr-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none transition-all text-base" />
                  </div>
                </div>
                <button onClick={handleAuth} disabled={authLoading} className="w-full py-3.5 rounded-xl text-white font-semibold active:scale-[0.98] transition-all duration-300 disabled:opacity-50" style={{ background: `linear-gradient(90deg, ${a}, ${a}cc)`, boxShadow: `0 10px 28px ${a}30` }}>
                  {authLoading ? t(lang, "auth.loading") : t(lang, "auth.sendReset")}
                </button>
                <button type="button" onClick={() => setAuthMode("login")} className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"><ArrowLeft size={15} /> {t(lang, "auth.backToLogin")}</button>
              </div>
            ) : <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{authMode === "login" ? t(lang, "auth.emailOrUsername") : t(lang, "auth.email")}</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden="true" />
                  <input
                  type={authMode === "login" ? "text" : "email"}
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="email@gmail.com"
                  className="w-full py-3 pl-11 pr-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base" />
                </div>

              </div>
              {authMode === "register" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">{t(lang, "auth.firstName")}</label>
                      <div className="relative">
                        <User size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden="true" />
                        <input
                          type="text"
                          value={authFirstName}
                          onChange={(e) => setAuthFirstName(e.target.value)}
                          placeholder="Mario"
                          className="w-full py-3 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">{t(lang, "auth.lastName")}</label>
                      <div className="relative">
                        <User size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden="true" />
                        <input
                          type="text"
                          value={authLastName}
                          onChange={(e) => setAuthLastName(e.target.value)}
                          placeholder="Rossi"
                          className="w-full py-3 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base" />
                      </div>
                    </div>
                  </div>
                  {/* User type selector */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">{t(lang, "auth.youAre")} <span className="text-red-400">*</span></label>
                    <div className="grid grid-cols-3 gap-2">
                      {["ERASMUS", "UNIVERSITARIO", "ALTRO"].map((tipo) => (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => setAuthUserType(tipo)}
                          className={`px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border ${
                            authUserType === tipo
                              ? "text-white border-blue-500/60"
                              : "text-gray-400 border-white/10 hover:border-white/20 bg-white/5"
                          }`}
                          style={authUserType === tipo ? { background: `${a}25`, borderColor: `${a}60`, color: a } : {}}
                        >
                          {tipo}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      {t(lang, "auth.phone")} <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden="true" />
                      <input
                        type="tel"
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value)}
                        placeholder="+39 347 000 0000"
                        required
                        className="w-full py-3 pl-11 pr-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base" />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">{t(lang, "auth.phoneHint")}</p>
                  </div>
                </div>
              ) : null}
              <div>
                <label className="text-sm text-gray-400 mb-1 flex items-center gap-1.5"><LockKeyhole size={13} />{t(lang, "auth.password")}</label>
                <div className="relative">
                  <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden="true" />
                  <input
                  type={showPassword ? "text" : "password"}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="********"
                  onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                  className="w-full py-3 pl-11 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base" />

                  <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1">

                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {authMode === "login" && (
                  <button type="button" onClick={() => { setAuthMode("forgot"); setShowPassword(false); }} className="mt-2 text-xs font-medium transition-opacity hover:opacity-75" style={{ color: a }}>
                    {t(lang, "auth.forgotPassword")}
                  </button>
                )}
              </div>
                <button
              onClick={handleAuth}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 sm:py-3 rounded-xl text-white font-semibold active:scale-[0.98] transition-all duration-300 disabled:opacity-50 glow-blue-sm text-base"
              style={{ background: `linear-gradient(90deg, ${a}, ${a}cc)` }}>

                  {authLoading ? t(lang, "auth.loading") : <>
                    {authMode === "login" ? <LogIn size={18} aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
                    {authMode === "login" ? t(lang, "auth.login") : t(lang, "auth.register")}
                  </>}
                </button>
                <p className="text-center text-sm text-gray-500 pb-2 sm:pb-0">
                  {authMode === "login" ? t(lang, "auth.noAccount") : t(lang, "auth.hasAccount")}{" "}
                  <button
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className="inline-flex items-center gap-1.5 hover:opacity-80 transition-all"
                style={{ color: a }}>

                    {authMode === "login" ? <UserPlus size={15} aria-hidden="true" /> : <LogIn size={15} aria-hidden="true" />}
                    {authMode === "login" ? t(lang, "auth.register") : t(lang, "auth.login")}
                  </button>
                </p>
            </div>}
          </div>
        </div>
      }

      {/* Close language menu on outside click */}
      {showLangMenu &&
      <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
      }
      
    </div>);

}
