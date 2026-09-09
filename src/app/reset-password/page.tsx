"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirmation) return setError("Las contraseñas no coinciden.");
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return setError("El enlace de recuperación no es válido.");

    setStatus("loading");
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "No se pudo actualizar la contraseña.");
      setStatus("success");
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    }
  }

  function setError(text: string) { setMessage(text); setStatus("error"); }

  return <main className="min-h-screen bg-[#05050b] text-white flex items-center justify-center p-4 relative overflow-hidden">
    <div className="absolute w-96 h-96 rounded-full bg-blue-600/20 blur-3xl -top-28 -left-20" />
    <div className="absolute w-80 h-80 rounded-full bg-fuchsia-600/15 blur-3xl -bottom-32 -right-20" />
    <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b15]/90 backdrop-blur-xl p-7 sm:p-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-7">
        <Image src="/icon-512.png" alt="Rumba Liguria" width={54} height={54} className="rounded-2xl ring-1 ring-white/10" priority />
        <div><p className="text-xs uppercase tracking-[.22em] text-blue-400 font-semibold">Rumba Liguria</p><h1 className="text-xl font-bold">Nueva contraseña</h1></div>
      </div>
      {status === "success" ? <div className="text-center py-5"><CheckCircle2 size={52} className="mx-auto mb-4 text-emerald-400" /><h2 className="text-xl font-bold">Contraseña actualizada</h2><p className="text-gray-400 mt-2 text-sm">Ya puedes iniciar sesión con tu nueva contraseña.</p><a href="/" className="inline-block mt-6 rounded-xl bg-blue-500 px-5 py-3 font-semibold">Ir al inicio</a></div> :
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">Elige una contraseña nueva de al menos 8 caracteres.</p>
        <div><label className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-300"><LockKeyhole size={14} />Nueva contraseña</label><div className="relative"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 outline-none focus:border-blue-500" autoFocus /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
        <div><label className="mb-1.5 block text-sm text-gray-300">Confirmar contraseña</label><input type={showPassword ? "text" : "password"} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-blue-500" /></div>
        {status === "error" && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{message}</p>}
        <button disabled={status === "loading"} className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-400 py-3.5 font-semibold disabled:opacity-50">{status === "loading" ? "Actualizando..." : "Guardar nueva contraseña"}</button>
      </form>}
    </section>
  </main>;
}
