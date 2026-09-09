"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

// Reused wherever a theme switch belongs — admin header for now, more spots
// as the rest of the site gets converted to the light/dark tokens.
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Avoid a hydration mismatch — render an inert placeholder the same size
    // as the real button until we know the resolved theme client-side.
    return <div className={`w-9 h-9 rounded-lg ${className}`} />;
  }

  const isLight = resolvedTheme === "light";
  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      title={isLight ? "Activar modo oscuro" : "Activar modo claro"}
      aria-label={isLight ? "Activar modo oscuro" : "Activar modo claro"}
      className={`w-9 h-9 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-95 ${className}`}
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
