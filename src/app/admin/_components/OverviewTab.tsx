"use client";

import Image from "next/image";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Calendar, Ticket, Users, Star, CreditCard, Image as ImageIcon,
  TrendingUp, PieChart as PieChartIcon, BarChart2, Plus, Camera, Images,
  CheckCircle, XCircle,
} from "lucide-react";
import type { Event, Reservation, User } from "../types";
import { weekOverWeekTrend, dailyCounts } from "../lib/stats";

interface OverviewTabProps {
  events: Event[];
  reservations: Reservation[];
  users: User[];
  galleryCount: number;
  vipCodesCount: number | null;
  clientCardsCount: number | null;
  accentColor: string;
  isLightTheme: boolean;
  onNewEvent: () => void;
  onOpenScanner: () => void;
  onGoToTab: (tab: "reservations" | "gallery") => void;
}

export default function OverviewTab({
  events,
  reservations,
  users,
  galleryCount,
  vipCodesCount,
  clientCardsCount,
  accentColor,
  isLightTheme,
  onNewEvent,
  onOpenScanner,
  onGoToTab,
}: OverviewTabProps) {
  // Estilos planos para recharts (no acepta clases de Tailwind).
  const chartAxisColor = isLightTheme ? "#6b7280" : "#9ca3af";
  const chartGridColor = isLightTheme ? "rgba(15,15,22,0.08)" : "rgba(255,255,255,0.06)";
  const chartTooltipStyle = {
    background: isLightTheme ? "#ffffff" : "#0a0a12",
    border: `1px solid ${isLightTheme ? "rgba(15,15,22,0.1)" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 8,
    fontSize: 12,
  };
  const chartTooltipLabelColor = isLightTheme ? "#0f0f16" : "#fff";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";

  // Solo prenotazioni reali de clientes — los códigos VIP y los links RRPP
  // comparten tabla pero no son una "prenotazione" que un cliente haya hecho.
  const realReservations = reservations.filter(
    (r) => r.user_email !== "__vip__" && !r.user_email?.startsWith("__link__")
  );
  const activeEvents = events.filter((e) => !e.archived);
  const upcomingEvents = [...activeEvents]
    .filter((e) => !e.event_date_iso || e.event_date_iso >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.event_date_iso || "9999").localeCompare(b.event_date_iso || "9999"))
    .slice(0, 5);
  const reservationsByEvent = (() => {
    const counts = new Map<string, { title: string; count: number }>();
    realReservations.forEach((r) => {
      const title = r.events?.title || "—";
      const key = r.event_id || title;
      counts.set(key, { title, count: (counts.get(key)?.count || 0) + 1 });
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  })();
  const recentActivity = [...realReservations]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 6);
  const reservationsTrend = weekOverWeekTrend(realReservations);
  const usersTrend = weekOverWeekTrend(users);
  const reservationsDaily = dailyCounts(realReservations, 7);
  const statusBreakdown = (() => {
    const counts = { active: 0, used: 0, cancelled: 0 };
    realReservations.forEach((r) => {
      if (r.status === "used") counts.used++;
      else if (r.status === "cancelled") counts.cancelled++;
      else counts.active++;
    });
    return [
      { name: "Attive", value: counts.active, color: "#3b82f6" },
      { name: "Entrati", value: counts.used, color: "#22c55e" },
      { name: "Annullate", value: counts.cancelled, color: "#ef4444" },
    ].filter((s) => s.value > 0);
  })();

  return (
    <div className="admin-dashboard space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="admin-eyebrow">Panoramica</p>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{greeting}, Admin</h2>
        </div>
        <div className="admin-status-pill"><span className="admin-status-dot" /> Sistema operativo</div>
      </div>

      <div className="admin-quick-toolbar" aria-label="Azioni rapide">
        <button type="button" onClick={onNewEvent} className="admin-icon-action" aria-label="Crea un nuovo evento" title="Nuovo evento"><Plus size={18} /></button>
        <button type="button" onClick={onOpenScanner} className="admin-icon-action" aria-label="Apri controllo accessi QR" title="Controllo accessi"><Camera size={18} /></button>
        <button type="button" onClick={() => onGoToTab("reservations")} className="admin-icon-action" aria-label="Gestisci prenotazioni" title="Prenotazioni"><Ticket size={18} /></button>
        <button type="button" onClick={() => onGoToTab("gallery")} className="admin-icon-action" aria-label="Aggiungi foto o video" title="Aggiungi contenuti"><Images size={18} /></button>
      </div>

      {/* Stats — neutral cards, real week-over-week trend where the data supports it */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { icon: Calendar, label: "Eventi attivi", value: activeEvents.length, trend: null as number | null },
          { icon: Ticket, label: "Prenotazioni", value: realReservations.length, trend: reservationsTrend.diff },
          { icon: Users, label: "Utenti registrati", value: users.length, trend: usersTrend.diff },
          { icon: Star, label: "Codici VIP", value: vipCodesCount, trend: null },
          { icon: CreditCard, label: "Tessere clienti", value: clientCardsCount, trend: null },
          { icon: ImageIcon, label: "Galleria", value: galleryCount, trend: null },
        ].map((s) => (
          <div key={s.label} className="admin-kpi-card relative p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-1">
              <div className="admin-kpi-icon w-8 h-8 flex items-center justify-center flex-shrink-0">
                <s.icon size={16} strokeWidth={2} />
              </div>
              {s.trend !== null && s.trend !== 0 && (
                <span
                  title="vs settimana scorsa"
                  className={`text-[10px] font-semibold ${s.trend > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {s.trend > 0 ? "+" : ""}{s.trend}
                </span>
              )}
            </div>
            <p className="text-2xl sm:text-[1.65rem] leading-none font-bold tracking-tight text-foreground mt-3.5">{s.value ?? "—"}</p>
            <p className="mt-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground truncate">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Trend: reservations over the last 7 days — full width */}
      <div className="admin-panel p-4 sm:p-5">
        <h3 className="admin-panel-title !mb-1">
          <TrendingUp size={14} /> Prenotazioni ultimi 7 giorni
        </h3>
        <p className="text-xs text-muted-foreground mb-5">{reservationsTrend.thisWeek} questa settimana <span className="mx-1.5 text-border">·</span> {reservationsTrend.lastWeek} la settimana scorsa</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={reservationsDaily} margin={{ top: 4, right: 8, left: -26, bottom: 0 }}>
            <defs>
              <linearGradient id="resTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 4" stroke={chartGridColor} vertical={false} />
            <XAxis dataKey="day" tick={{ fill: chartAxisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: chartAxisColor, fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} width={24} />
            <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: chartTooltipLabelColor }} />
            <Area type="monotone" dataKey="count" name="Prenotazioni" stroke={accentColor} strokeWidth={2.5} fill="url(#resTrendFill)" activeDot={{ r: 5, strokeWidth: 3, fill: "var(--card)" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Donut + bar chart, same row, matched height */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Donut: reservation status breakdown */}
        <div className="admin-panel p-4 sm:p-5 flex flex-col">
          <h3 className="admin-panel-title">
            <PieChartIcon size={14} /> Stato prenotazioni
          </h3>
          {statusBreakdown.length === 0 ? (
            <p className="flex-1 flex items-center justify-center text-center text-muted-foreground text-sm">Nessuna prenotazione ancora</p>
          ) : (
            <div className="flex-1 flex flex-col justify-center">
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={4}>
                    {statusBreakdown.map((s) => <Cell key={s.name} fill={s.color} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-3">
                {statusBreakdown.map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {s.name} ({s.value})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chart: reservations per event */}
        <div className="admin-panel p-4 sm:p-5 flex flex-col">
          <h3 className="admin-panel-title">
            <BarChart2 size={14} /> Prenotazioni per evento
          </h3>
          {reservationsByEvent.length === 0 ? (
            <p className="flex-1 flex items-center justify-center text-center text-muted-foreground text-sm">Nessuna prenotazione ancora</p>
          ) : (
            <div className="flex-1 flex flex-col justify-center">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={reservationsByEvent} margin={{ top: 4, right: 8, left: -26, bottom: 4 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 4" stroke={chartGridColor} vertical={false} />
                  <XAxis dataKey="title" tick={{ fill: chartAxisColor, fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chartAxisColor, fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} width={24} />
                  <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: chartTooltipLabelColor }} />
                  <Bar dataKey="count" name="Prenotazioni" fill={accentColor} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming events + recent activity, same row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="admin-panel p-4 sm:p-5">
          <h3 className="admin-panel-title">
            <Calendar size={14} /> Prossimi eventi
          </h3>
          {upcomingEvents.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">Nessun evento in programma</p>
          ) : (
            <div className="-mt-1">
              {upcomingEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-2.5 py-2 border-b border-border last:border-0">
                  {e.flyer_url ? (
                    <Image src={e.flyer_url} alt="" width={36} height={36} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Calendar size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground truncate">{e.title}</p>
                    <p className="text-[10px] text-muted-foreground">{e.event_date || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity, with a semantic icon badge per status */}
        <div className="admin-panel p-4 sm:p-5">
          <h3 className="admin-panel-title">
            <Ticket size={14} /> Attività recente
          </h3>
          {recentActivity.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">Nessuna attività ancora</p>
          ) : (
            <div className="-mt-1">
              {recentActivity.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5 text-xs border-b border-border last:border-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: r.status === "used" ? "rgba(34,197,94,0.15)" : r.status === "cancelled" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)" }}
                >
                  {r.status === "used" ? <CheckCircle size={13} className="text-green-500 dark:text-green-400" /> : r.status === "cancelled" ? <XCircle size={13} className="text-red-500 dark:text-red-400" /> : <Ticket size={13} className="text-blue-500 dark:text-blue-400" />}
                </div>
                <span className="text-foreground truncate flex-1">{r.user_name || "—"}</span>
                <span className="text-muted-foreground truncate flex-1 text-right hidden sm:block">{r.events?.title || "—"}</span>
                <span
                  className={`flex-shrink-0 px-2 py-0.5 rounded-full font-medium ${
                    r.status === "used" ? "bg-green-500/15 text-green-500 dark:text-green-400" : r.status === "cancelled" ? "bg-red-500/15 text-red-500 dark:text-red-400" : "bg-blue-500/15 text-blue-500 dark:text-blue-400"
                  }`}
                >
                  {r.status === "used" ? "Entrato" : r.status === "cancelled" ? "Annullato" : "Attiva"}
                </span>
              </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
