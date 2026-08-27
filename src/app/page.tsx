"use client";

import { useState, useEffect, useCallback } from "react";
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
  ChevronUp,
} from "lucide-react";
import Image from "next/image";
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
  ticket_types?: { name: string; color: string }[];
  created_at: string;
  reservation_total: number;
  reservation_used: number;
  tickets_sold?: number;
  sold_out?: boolean;
}

const WHATSAPP_BOOKING = "393501863148";

const LANGS: {code: Lang;label: string;flag: string;}[] = [
{ code: "it", label: "Italiano", flag: "IT" },
{ code: "es", label: "Español", flag: "ES" },
{ code: "en", label: "English", flag: "EN" }];


export default function Home() {
  const [lang, setLang] = useState<Lang>("it");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authUserType, setAuthUserType] = useState<string>("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [reservation, setReservation] = useState<{eventId: string;count: number;ticketType?: string;} | null>(null);
  const [qrData, setQrData] = useState<{codes: string[];eventTitle: string;guestCount: number;ticketTypes?: {name: string; color: string}[];} | null>(null);
  const [reserving, setReserving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [snowflakes, setSnowflakes] = useState<{left: number;duration: number;delay: number;opacity: number;size: number;char: string;}[]>([]);
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [cancelledReservations, setCancelledReservations] = useState<{code: string;eventTitle: string;}[]>([]);
  const [expandedMaps, setExpandedMaps] = useState<Set<string>>(new Set());
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [userReservations, setUserReservations] = useState<(any)[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [rentalConfig, setRentalConfig] = useState<RentalConfig>({ items: [], section_name: "Noleggio Attrezzatura", button_name: "Noleggio", enabled: true });
  const [expandedRental, setExpandedRental] = useState<string | null>(null);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [rentalModalItem, setRentalModalItem] = useState<RentalItem | null>(null);
  const [rentalPhotoIndex, setRentalPhotoIndex] = useState(0);
  // Set when arriving via a personalized RRPP link (?ref=...&eid=...) — locks
  // the page to that single event instead of showing the whole event list.
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);


  useEffect(() => {
    setSnowflakes(
      Array.from({ length: 30 }, (_, i) => ({
        left: Math.random() * 100,
        duration: 6 + Math.random() * 10,
        delay: Math.random() * 8,
        opacity: 0.3 + Math.random() * 0.5,
        size: 6 + Math.random() * 12,
        char: i % 3 === 0 ? '❄' : '•'
      }))
    );
  }, []);

  useEffect(() => {
    fetch("/api/admin/color").then((r) => r.json()).then((d) => {
      if (d.accent_color) setAccentColor(d.accent_color);
    }).catch(() => {});
    // Track custom link referral from URL
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      const eid = params.get("eid");
      if (ref && eid) {
        sessionStorage.setItem("rumba_ref", ref);
        sessionStorage.setItem("rumba_ref_eid", eid);
        setLinkedEventId(eid);
      }
    } catch {}
  }, []);

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
      toast.error("Errore nel caricamento delle prenotazioni");
    } finally {
      setLoadingReservations(false);
    }
  }, []);

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

  const handleAuth = async () => {
    if (authMode === "register") {
      if (!authFirstName.trim() || !authLastName.trim()) {
        toast.error("Inserisci nome e cognome");
        return;
      }
      if (!authPhone.trim()) {
        toast.error("Il numero di telefono è obbligatorio");
        return;
      }
      // Validate phone: international prefix required (+39 auto-added for Italian mobiles)
      let digitsOnly = authPhone.replace(/[\s\-().]/g, "");
      if (digitsOnly.startsWith("00")) digitsOnly = "+" + digitsOnly.slice(2);
      if (/^3\d{8,9}$/.test(digitsOnly)) digitsOnly = "+39" + digitsOnly;
      const validPhone = /^\+[1-9]\d{7,14}$/.test(digitsOnly);
      if (!validPhone) {
        toast.error("Inserisci un numero valido con prefisso internazionale (es. +39 347 000 0000)");
        return;
      }
      if (!authUserType) {
        toast.error("Seleziona: ERASMUS, UNIVERSITARIO o ALTRO");
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
        toast.error(data.error || "Error");
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
      if (!res.ok) throw new Error();
      const data = await res.json(); // Array of tickets
      const codes = data.map((t: {code: string}) => t.code);
        setQrData({ codes, eventTitle: event.title, guestCount: reservation.count, ticketTypes: event.ticket_types });
        setReservation(null);
        fetchUserReservations(userEmail);
        toast.success(t(lang, "reservation.confirmed"));
    } catch {
      toast.error("Errore nella prenotazione");
    } finally {
      setReserving(false);
    }
  };

  const saveQrImage = async () => {
    const containers = document.querySelectorAll(".qr-code-container");
    if (!containers.length) return;
    
    toast.info("Salvataggio biglietti...");
    
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
    toast.success("Tutti i biglietti sono stati salvati!");
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
  const a40 = `${a}66`; // 40% opacity

  // Arriving via a personalized RRPP link locks the page to that one event —
  // it's no longer in the list once its event has been archived (ended), so
  // this naturally comes up empty for an expired link.
  const visibleEvents = linkedEventId ? events.filter((e) => e.id === linkedEventId) : events;
  const linkExpired = !!linkedEventId && events.length > 0 && visibleEvents.length === 0;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
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
        className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 animate-fade-in"
        style={{ borderBottom: `1px solid ${a20}` }}>

        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Image
              src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/659b52a5-69ae-4783-b222-bf54f8c81855/logo-1771260580239.png?width=8000&height=8000&resize=contain"
              alt="Rumba Liguria"
              width={40}
              height={40}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain flex-shrink-0" />

              <h1 className="text-base sm:text-xl font-bold tracking-tight">
                <span className="text-white">Rumba</span>{" "}
                <span className="glow-text" style={{ color: a }}>Liguria</span>{" "}
                <span className="text-gray-400 text-xs sm:text-sm font-normal hidden xs:inline">Events</span>
              </h1>
            </div>

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

            {/* Social links - hidden on very small screens */}
            <div className="hidden sm:flex items-center gap-1">
              <a
                href="https://www.instagram.com/rumba_liguria?igsh=ZmwzYWZ6NDl5NmQ1"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full hover:bg-white/5 transition-all duration-300 text-gray-400 hover:text-pink-400">

                <Instagram size={18} />
              </a>
              <a
                href="https://t.me/+l7vvNcE_ZQQyZTQ0"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full hover:bg-white/5 transition-all duration-300 text-gray-400 hover:text-blue-400">

                <Send size={18} />
              </a>
              <a
                href="https://wa.me/393501863148"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full hover:bg-white/5 transition-all duration-300 text-gray-400 hover:text-green-400">

                  <MessageCircle size={18} />
                </a>
                <a
                href="/admin"
                className="p-2 rounded-full hover:bg-white/5 transition-all duration-300 text-gray-400 hover:text-yellow-400"
                title="Admin Panel">

                  <Shield size={18} />
                </a>
              </div>

              <div className="w-px h-5 sm:h-6 bg-white/10" />

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

      {/* Mobile social links bar */}
      <div className="sm:hidden flex items-center justify-center gap-6 py-2 border-b border-white/5 bg-black/50">
        <a
          href="https://www.instagram.com/rumba_liguria?igsh=ZmwzYWZ6NDl5NmQ1"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-gray-400 hover:text-pink-400 transition-all">

          <Instagram size={20} />
        </a>
        <a
          href="https://t.me/+l7vvNcE_ZQQyZTQ0"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-gray-400 hover:text-blue-400 transition-all">

          <Send size={20} />
        </a>
        <a
          href="https://wa.me/393501863148"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-gray-400 hover:text-green-400 transition-all">

          <MessageCircle size={20} />
          </a>
          <a
          href="/admin"
          className="p-2 text-gray-400 hover:text-yellow-400 transition-all">

            <Shield size={20} />
          </a>
        </div>

          {/* Hero */}
        <section className="relative py-12 sm:py-20 text-center animate-fade-in-up">
          <div className="max-w-3xl mx-auto px-4">
              <div className="w-28 h-28 sm:w-40 sm:h-40 mx-auto mb-6 sm:mb-8" style={{ animation: "breathe 3s ease-in-out infinite" }}>
                    <Image
              src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/659b52a5-69ae-4783-b222-bf54f8c81855/logo-1771260580239.png?width=8000&height=8000&resize=contain"
              alt="Rumba Liguria Events"
              width={160}
              height={160}
              priority
              className="w-full h-full object-contain" style={{ filter: `drop-shadow(0 0 18px ${a}60)` }} />

            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 animate-fade-in-up animate-delay-100">
              <span className="text-white">{t(lang, "hero.title")}</span>{" "}
              <span className="glow-text" style={{ color: a }}>{t(lang, "hero.subtitle")}</span>
            </h2>
            <p className="text-gray-400 text-base sm:text-lg animate-fade-in-up animate-delay-200">
              {t(lang, "hero.description")}
            </p>
          </div>
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

      {/* Events */}
        <section className="max-w-4xl mx-auto px-3 sm:px-4 pb-16 sm:pb-20 relative z-10">
        {linkExpired ?
        <div className="text-center py-16 sm:py-20 animate-fade-in">
              <Calendar size={40} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">Questo evento non è più disponibile</p>
              <p className="text-gray-600 text-xs sm:text-sm mt-2">Il link che hai usato è scaduto perché l&apos;evento è terminato.</p>
            </div> :
        visibleEvents.length === 0 ?
        <div className="text-center py-16 sm:py-20 animate-fade-in">
              <Calendar size={40} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">{t(lang, "events.empty")}</p>
              <p className="text-gray-600 text-xs sm:text-sm mt-2">{t(lang, "events.emptyDesc")}</p>
            </div> :

        <div className="space-y-6 sm:space-y-8">
                {visibleEvents.map((event) =>
          <div
            key={event.id}
            className="rounded-xl sm:rounded-2xl bg-[#0a0a12] glow-border transition-all duration-500 animate-fade-in-up"
            style={{ border: `1px solid ${a20}` }}>

                    {/* Flyer */}
                    {event.flyer_url &&
            <div className={`w-full p-3 sm:p-4 pb-0 ${event.flyer_ratio === "9:16" ? "flex justify-center" : ""}`}>
                        <div
                className="rounded-xl overflow-hidden flyer-glow"
                style={{ width: event.flyer_ratio === "9:16" ? "min(100%, 360px)" : "100%" }}>
                          <img
                  src={event.flyer_url}
                  alt={event.title}
                  className="w-full h-auto block"
                  loading="lazy" />
                        </div>
                      </div>
            }

                    {/* Date / Time / Age strip — right below flyer */}
                    {(event.event_date || event.event_time || event.min_age) &&
            <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 pt-3">
                        {event.event_date &&
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-xs border border-white/10">
                            <Calendar size={12} style={{ color: accentColor }} />
                            {event.event_date}
                          </span>
              }
                        {(event.event_time || event.event_time_end) &&
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-xs border border-white/10">
                            <Clock size={12} style={{ color: accentColor }} />
                            {event.event_time}{event.event_time_end ? ` – ${event.event_time_end}` : ""}
                          </span>
              }
                        {event.min_age &&
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-xs border border-white/10">
                            <span style={{ color: accentColor }} className="text-[11px] font-bold">+{event.min_age}</span>
                          </span>
              }
                      </div>
            }

                    {/* Event info */}
                    <div className="p-4 sm:p-6">
                      {/* Title + POPOLARE */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight">{event.title}</h3>
                        {event.is_popular &&
                <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 mt-1" style={{ background: "#f59e0b20", color: "#f59e0b", borderColor: "#f59e0b30" }}>
                            <Star size={9} fill="#f59e0b" /> POPOLARE
                          </span>
                }
                      </div>
                      {/* Organizer */}
                      <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
                        <span>🎤</span> Organizzato da <span style={{ color: accentColor }} className="font-medium ml-1">{event.organizer || "Rumba Liguria"}</span>
                      </p>
                      {/* Price + Share */}
                      <div className="flex items-center gap-2 mb-4">
                        <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: event.price === "free" || event.price === "Free" || event.price === "Gratis" ? "rgba(34,197,94,0.15)" : `${accentColor}20`,
                    color: event.price === "free" || event.price === "Free" || event.price === "Gratis" ? "#4ade80" : accentColor,
                    border: "1px solid",
                    borderColor: event.price === "free" || event.price === "Free" || event.price === "Gratis" ? "rgba(34,197,94,0.3)" : `${accentColor}40`
                  }}>

                          {event.price === "free" || event.price === "Free" ? t(lang, "events.free") : event.price}
                        </span>
                        <button
                  onClick={() => {
                    const url = window.location.href;
                    if (navigator.share) {
                      navigator.share({ title: event.title, url }).catch(() => {
                        navigator.clipboard.writeText(url).then(() => toast.success("Link copiato!"));
                      });
                    } else {
                      navigator.clipboard.writeText(url).then(() => toast.success("Link copiato!"));
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all active:scale-95"
                  style={{ background: `${accentColor}15`, color: accentColor, borderColor: `${accentColor}40` }}>

                          <Share2 size={12} />
                          Condividi
                        </button>
                      </div>

                        {event.details &&
              <div className="mb-4">
                            {(() => {
                              const isExpanded = expandedEvents.has(event.id);
                              const LIMIT = 120;
                              const needsTruncation = event.details.length > LIMIT;
                              const displayed = isExpanded || !needsTruncation
                                ? event.details
                                : event.details.slice(0, LIMIT).trimEnd() + "…";
                              return (
                                <>
                                  <p className="text-gray-400 leading-relaxed text-sm sm:text-base whitespace-pre-line">
                                    {displayed}
                                  </p>
                                  {needsTruncation && (
                                    <button
                                      onClick={() => setExpandedEvents((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(event.id)) next.delete(event.id);
                                        else next.add(event.id);
                                        return next;
                                      })}
                                      className="text-xs font-semibold mt-1"
                                      style={{ color: accentColor }}>
                                      {isExpanded ? "Vedi meno ▲" : "Vedi di più ▼"}
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>}

                      {/* Dress code badge */}
                      {event.dress_code &&
              <div className="flex flex-wrap gap-2 mb-4">
                          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-xs border border-white/10">
                            <span>👗</span> {event.dress_code}
                          </span>
                        </div>
              }

                        {/* Reservation button */}
                        {(() => {
                          const now = Date.now();
                          const saleClose = event.event_date_iso ? getSaleCloseUTC(event.event_date_iso) : null;
                          const saleClosed = saleClose ? now >= saleClose : false;
                          const saleNotOpen = event.sale_start ? now < new Date(event.sale_start).getTime() : false;
                          const bookingClosed = saleClosed || saleNotOpen;
                          if (bookingClosed) {
                            return (
                              <button
                                disabled
                                className="w-full py-3 rounded-xl text-gray-500 font-semibold flex items-center justify-center gap-2 cursor-not-allowed text-sm sm:text-base"
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                                <X size={18} />
                                Prenotazioni chiuse
                              </button>
                            );
                          }
                          if (event.sold_out) {
                            return (
                              <div className="space-y-2">
                                <div
                                  className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm sm:text-base tracking-widest"
                                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}>
                                  <X size={18} />
                                  SOLD OUT
                                </div>
                                <a
                                  href={`https://wa.me/${WHATSAPP_BOOKING}?text=${encodeURIComponent(`Ciao! L'evento "${event.title}" è SOLD OUT. C'è ancora qualche posto disponibile?`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-300 text-sm sm:text-base"
                                  style={{ background: "linear-gradient(90deg, #16a34a, #22c55e)", boxShadow: "0 0 20px rgba(34,197,94,0.25)" }}>
                                  <MessageCircle size={18} />
                                  Scrivici su WhatsApp
                                </a>
                              </div>
                            );
                          }
                          return (
                            <button
                              onClick={() => handleReservation(event)}
                              className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-300 text-sm sm:text-base"
                              style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`, boxShadow: `0 0 20px ${accentColor}30` }}>
                              <Users size={18} />
                              {t(lang, "events.bookNow")}
                            </button>
                          );
                        })()}

                      {/* Reservation panel */}
                      {reservation && reservation.eventId === event.id &&
              <div className="overflow-hidden animate-fade-in">
                          <div className="mt-4 p-4 rounded-xl" style={{ background: `${a}0d`, border: `1px solid ${a30}` }}>
                            <p className="text-sm text-gray-300 mb-3">{t(lang, "events.howMany")}</p>
                            {/* Ticket Type Selector */}
                            {event.ticket_types && event.ticket_types.length > 0 && (
                              <div className="mb-3">
                                <label className="text-xs text-gray-400 mb-1.5 block">Tipo di biglietto</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {event.ticket_types.map((tt) => (
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
                    const spotsLeft = event.max_tickets != null ? event.max_tickets - (event.tickets_sold ?? event.reservation_total) : 999;
                      const maxAllowed = Math.max(1, event.max_per_person ? Math.min(spotsLeft, event.max_per_person) : spotsLeft);
                      return (
                        <div className="flex items-center gap-3 mb-4 justify-center">
                                  <button
                          onClick={() => setReservation((prev) => prev ? { ...prev, count: Math.max(1, prev.count - 1) } : null)}
                          className="w-11 h-11 sm:w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg hover:bg-white/10 transition-all active:bg-white/15">

                                    -
                                  </button>
                                  <span className="text-2xl font-bold w-16 text-center" style={{ color: a }}>
                                    {reservation.count}
                                  </span>
                                  <button
                          onClick={() => setReservation((prev) => prev ? { ...prev, count: Math.min(maxAllowed, prev.count + 1) } : null)}
                          disabled={reservation.count >= maxAllowed}
                          className="w-11 h-11 sm:w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg hover:bg-white/10 transition-all active:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed">

                                    +
                                  </button>
                                </div>);

                  })()}
                            <div className="flex gap-2">
                              <button
                      onClick={() => setReservation(null)}
                      className="flex-1 py-2.5 sm:py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-all text-sm active:bg-white/15">

                                {t(lang, "events.cancel")}
                              </button>
                              <button
                      onClick={() => confirmReservation(event)}
                      disabled={reserving}
                      className="flex-1 py-2.5 sm:py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-all text-sm flex items-center justify-center gap-2 active:bg-green-400 disabled:opacity-50">

                                {reserving ?
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> :

                      <CheckCircle size={16} />
                      }
                                {t(lang, "reservation.confirm")}
                              </button>
                            </div>
                          </div>
                        </div>
              }

                        {/* Google Maps embed — accordion */}
                        {event.maps_url &&
                <div className="mt-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${a20}` }}>
                            {/* Header / toggle */}
                            <button
                    className="w-full flex items-center gap-2 px-3 py-3 bg-white/[0.03] active:bg-white/[0.06] transition-all"
                    onClick={() => setExpandedMaps((prev) => {
                      const next = new Set(prev);
                      if (next.has(event.id)) next.delete(event.id);
                      else next.add(event.id);
                      return next;
                    })}>

                              <MapPin size={14} style={{ color: accentColor }} />
                              <span className="text-xs text-gray-300 font-medium flex-1 text-left">Come arrivare</span>
                              <a
                      href={event.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-0.5 rounded-full mr-2"
                      style={{ color: accentColor, background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}
                      onClick={(e) => e.stopPropagation()}>
                                Apri →
                              </a>
                              <span className="text-gray-500 text-xs transition-transform duration-300" style={{ display: "inline-block", transform: expandedMaps.has(event.id) ? "rotate(180deg)" : "rotate(0deg)" }}>
                                ▼
                              </span>
                            </button>
                            {/* Map iframe — shown/hidden */}
                            <div style={{ height: expandedMaps.has(event.id) ? 240 : 0, overflow: "hidden", transition: "height 0.35s ease" }}>
                              <iframe
                      src={getMapsEmbedUrl(event.maps_url)}
                      width="100%"
                      height="240"
                      style={{ border: 0, display: "block" }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade" />
                            </div>
                          </div>
                }

                      {/* How to get there - transport */}
                      <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <p className="text-xs text-gray-500 mb-2.5 font-medium uppercase tracking-wide">Come puoi venire</p>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                  { icon: Train, label: "Treno", color: "#3b82f6", travelmode: "transit" },
                  { icon: Car, label: "Auto", color: "#10b981", travelmode: "driving" },
                  { icon: Bike, label: "Bici", color: "#f59e0b", travelmode: "bicycling" },
                  { icon: PersonStanding, label: "A piedi", color: "#ec4899", travelmode: "walking" }].
                  map(({ icon: Icon, label, color, travelmode }) => {
                    const dest = event.maps_url ?
                    (() => {
                      const coordMatch = event.maps_url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                      const qMatch = event.maps_url.match(/[?&]q=([^&]+)/);
                      const placeMatch = event.maps_url.match(/\/maps\/place\/([^/@?]+)/);
                      if (coordMatch) return `${coordMatch[1]},${coordMatch[2]}`;
                      if (qMatch) return decodeURIComponent(qMatch[1]);
                      if (placeMatch) return decodeURIComponent(placeMatch[1]);
                      return event.maps_url;
                    })() :
                    null;
                    const href = dest ?
                    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=${travelmode}` :
                    null;
                    const Wrapper = href ? "a" : "div";
                    return (
                      <Wrapper
                        key={label}
                        {...href ? { href, target: "_blank", rel: "noopener noreferrer" } : {}}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg bg-white/5 border border-white/5 transition-all duration-200${href ? " cursor-pointer hover:bg-white/10 active:scale-95" : ""}`}>

                                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${color}20` }}>
                                  <Icon size={16} style={{ color }} />
                                </div>
                                <span className="text-[10px] text-gray-400">{label}</span>
                              </Wrapper>);
                  })}
                        </div>
                      </div>
                    </div>
                  </div>
          )}
          </div>
        }
        </section>

      {/* ─── Noleggio Attrezzatura Section (compact) ─── */}
      {rentalConfig.enabled && rentalConfig.items.filter(i => !i.archived).length > 0 && (
        <section className="max-w-5xl mx-auto px-3 sm:px-4 pb-16 sm:pb-20 relative z-10">
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
                  <p className="text-xs text-gray-500">{activeItems.filter(i => i.available).length} equipaggiamenti disponibili</p>
                </div>
              </div>
              <button
                onClick={() => setShowRentalModal(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: `${a}18`, color: a, border: `1px solid ${a}30` }}
              >
                <ChevronDown size={15} />
                Ver más
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
                      ? <img src={item.photos[0]} alt={item.name} className="w-full h-full object-cover" />
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
                  <p className="text-[10px] text-gray-500">altri</p>
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
                  <span className="text-sm">Indietro</span>
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
                        <img src={rentalModalItem.photos[rentalPhotoIndex]} alt={rentalModalItem.name} className="w-full h-full object-cover" />
                        {!rentalModalItem.available && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-sm text-gray-300 font-medium bg-black/50 px-4 py-1.5 rounded-full">Non disponibile</span>
                          </div>
                        )}
                        {rentalModalItem.available && (
                          <div className="absolute top-2 right-2">
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Disponibile</span>
                          </div>
                        )}
                      </div>
                      {rentalModalItem.photos.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                          {rentalModalItem.photos.map((url, i) => (
                            <button key={i} onClick={() => setRentalPhotoIndex(i)}
                              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${rentalPhotoIndex === i ? "border-blue-400" : "border-white/10 opacity-60 hover:opacity-100"}`}>
                              <img src={url} alt="" className="w-full h-full object-cover" />
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
                      <a href={`https://wa.me/${rentalModalItem.contact_phone.replace(/[^0-9+]/g, "")}?text=${encodeURIComponent(`Ciao! Sono interessato/a al noleggio di: ${rentalModalItem.name}`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                        style={{ background: `${a}18`, color: a, border: `1px solid ${a}30` }}>
                        <Phone size={16} /> Contatta su WhatsApp
                      </a>
                    )}
                    {rentalModalItem.contact_email && (
                      <a href={`mailto:${rentalModalItem.contact_email}?subject=${encodeURIComponent(`Richiesta noleggio: ${rentalModalItem.name}`)}`}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-all active:scale-95">
                        <Mail size={16} /> Invia Email
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
                          ? <img src={item.photos[0]} alt={item.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-white/5 flex items-center justify-center"><Package size={24} className="text-gray-600" /></div>
                        }
                        {item.available
                          ? <div className="absolute top-1.5 right-1.5"><span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">✓</span></div>
                          : <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-[10px] text-gray-400 bg-black/60 px-2 py-0.5 rounded-full">Non disp.</span></div>
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
      <section className="max-w-5xl mx-auto px-3 sm:px-4 pb-16 sm:pb-20 relative z-10">
        {/* Anniversary banner */}
        <div className="text-center mb-10 sm:mb-14 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold uppercase tracking-widest mb-4">
            <span>⭐</span> Eventi by Rumba Liguria <span>⭐</span>
          </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3">
              <span className="glow-text" style={{ color: a }}>Eventi by Rumba Liguria</span>
            </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Con noi troverai la migliore musica e le serate più calde in Liguria. Grazie a tutti voi que avete ballato, cantato e vissuto con noi ogni momento. Ti aspettiamo!
          </p>
        </div>

        {/* Photo/Video grid — dynamic from DB */}
        {gallery.length === 0 ? (
          <div className="text-center py-10 text-gray-600 text-sm">Nessun contenuto in galleria</div>
        ) : (
          <div className="columns-2 sm:columns-3 gap-2 sm:gap-3 space-y-2 sm:space-y-3">
            {gallery.map((item, i) => (
              <div
                key={item.id}
                className="break-inside-avoid rounded-xl overflow-hidden border border-white/5 hover:border-blue-500/30 transition-all duration-300 cursor-pointer group relative"
                onClick={() => item.type === "image" ? setLightboxImg(item.url) : undefined}
              >
                {item.type === "video" ? (
                  <>
                    <video
                      src={item.url}
                      className="w-full h-auto object-cover"
                      playsInline
                      muted
                      loop
                      autoPlay
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="white"><polygon points="4,2 14,8 4,14"/></svg>
                      </div>
                    </div>
                  </>
                ) : (
                  <img
                    src={item.url}
                    alt={`Rumba Liguria evento ${i + 1}`}
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                )}
              </div>
            ))}
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
              <h3 className="text-lg font-bold text-white text-center mb-2">Prenotazione Cancellata</h3>
              <p className="text-sm text-gray-400 text-center mb-4">
                {cancelledReservations.length === 1 ?
            <>La tua prenotazione per <span className="text-white font-medium">{cancelledReservations[0].eventTitle}</span> è stata cancellata dall&apos;organizzatore.</> :
            <>Alcune tue prenotaciones sono state cancellate dall&apos;organizzatore.</>
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

                Ho capito
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
          <img
          src={lightboxImg}
          alt="Foto evento"
          className="max-w-full max-h-[90vh] rounded-xl object-contain animate-fade-in-up"
          onClick={(e) => e.stopPropagation()} />

        </div>
      }

      {/* Footer */}
      <footer className="bg-black/50 backdrop-blur-sm" style={{ borderTop: `1px solid ${a20}` }}>
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: `linear-gradient(135deg, ${a}, ${a}bb)` }}>
                  R
                </div>
              <span className="text-sm text-gray-400">Rumba Liguria Events</span>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="https://www.instagram.com/rumba_liguria?igsh=ZmwzYWZ6NDl5NmQ1"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-pink-400 transition-all">

                <Instagram size={18} />
              </a>
              <a
                href="https://t.me/+l7vvNcE_ZQQyZTQ0"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-blue-400 transition-all">

                <Send size={18} />
              </a>
              <a
                href="https://wa.me/393501863148"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-green-400 transition-all">

                <MessageCircle size={18} />
              </a>
            </div>

              <p className="text-xs text-gray-600">
                {t(lang, "footer.createdBy")}{" "}
                <a
                href="https://wa.me/393478275119"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 transition-all">

                  Tokkyo&apos;s
                </a>
              </p>

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
                              <img
                                src={res.events.flyer_url}
                                alt={res.events.title}
                                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <h5 className="text-sm font-bold text-white truncate">{res.events?.title || "Evento"}</h5>
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
        onClick={() => {setShowAuth(false);setShowPassword(false);}}>

          <div
          className="w-full sm:max-w-md bg-[#0a0a12] border-t sm:border rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 glow-border animate-fade-in-up"
          style={{ borderColor: a30 }}
          onClick={(e) => e.stopPropagation()}>

            <div className="sm:hidden w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <div className="flex items-center justify-between mb-5 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-white">
                {authMode === "login" ? t(lang, "auth.login") : t(lang, "auth.register")}
              </h3>
              <button
              onClick={() => {setShowAuth(false);setShowPassword(false);}}
              className="p-2 rounded-full hover:bg-white/5 text-gray-400">

                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t(lang, "auth.email")}</label>
                <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="email@gmail.com"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base" />

              </div>
              {authMode === "register" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Nome</label>
                      <input
                        type="text"
                        value={authFirstName}
                        onChange={(e) => setAuthFirstName(e.target.value)}
                        placeholder="Mario"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Cognome</label>
                      <input
                        type="text"
                        value={authLastName}
                        onChange={(e) => setAuthLastName(e.target.value)}
                        placeholder="Rossi"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base" />
                    </div>
                  </div>
                  {/* User type selector */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Sei <span className="text-red-400">*</span></label>
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
                    <input
                      type="tel"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="+39 347 000 0000"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base" />
                    <p className="text-[10px] text-gray-600 mt-1">Includi il prefisso internazionale (es. +39)</p>
                  </div>
                </div>
              ) : null}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t(lang, "auth.password")}</label>
                <div className="relative">
                  <input
                  type={showPassword ? "text" : "password"}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="********"
                  onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/40 transition-all text-base" />

                  <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1">

                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
                <button
              onClick={handleAuth}
              disabled={authLoading}
              className="w-full py-3.5 sm:py-3 rounded-xl text-white font-semibold active:scale-[0.98] transition-all duration-300 disabled:opacity-50 glow-blue-sm text-base"
              style={{ background: `linear-gradient(90deg, ${a}, ${a}cc)` }}>

                  {authLoading ?
              t(lang, "auth.loading") :
              authMode === "login" ?
              t(lang, "auth.login") :
              t(lang, "auth.register")}
                </button>
                <p className="text-center text-sm text-gray-500 pb-2 sm:pb-0">
                  {authMode === "login" ? t(lang, "auth.noAccount") : t(lang, "auth.hasAccount")}{" "}
                  <button
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className="hover:opacity-80 transition-all"
                style={{ color: a }}>

                    {authMode === "login" ? t(lang, "auth.register") : t(lang, "auth.login")}
                  </button>
                </p>
            </div>
          </div>
        </div>
      }

      {/* Close language menu on outside click */}
      {showLangMenu &&
      <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
      }
      
    </div>);

}
