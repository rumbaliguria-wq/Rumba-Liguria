import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/adminSession";

// ─── ¿Esta petición necesita sesión de administrador? ───
// Se decide por ruta + método. Todo lo que no aparezca aquí sigue siendo
// público (la web del cliente lee eventos, galería, etc. sin sesión).
function requiresAdmin(path: string, method: string): boolean {
  const m = method.toUpperCase();
  const mutation = m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";

  // /api/admin/* — todo protegido salvo el propio login/2FA, el chequeo de
  // sesión, el logout y el GET de color (lo usa la pantalla de login).
  if (path.startsWith("/api/admin/")) {
    if (path.startsWith("/api/admin/login")) return false;
    if (path.startsWith("/api/admin/2fa")) return false;
    if (path.startsWith("/api/admin/session")) return false;
    if (path.startsWith("/api/admin/logout")) return false;
    if (path.startsWith("/api/admin/color") && m === "GET") return false;
    return true;
  }

  // Listados y gestión que sólo tienen sentido en el panel
  if (path === "/api/users" && m === "GET") return true;
  if (/^\/api\/users\/[^/]+$/.test(path) && m === "DELETE") return true;

  if (path === "/api/reservations" && m === "GET") return true;
  if (path.startsWith("/api/reservations/vip")) return true;

  if (path === "/api/cards" && (m === "GET" || m === "POST")) return true;
  if (path === "/api/cards/stats") return true;
  if (path === "/api/cards/scan") return true;
  if (path === "/api/cards/upload") return true;
  if (/^\/api\/cards\/[^/]+$/.test(path) && (m === "PUT" || m === "DELETE")) return true;

  if (path === "/api/custom-links" && (m === "POST" || m === "DELETE")) return true;

  // Gestión de colaboradores externos (bares/locales que validan tessere) —
  // OJO: /api/colaborador (sin "s") es la ruta PÚBLICA del propio bar, que
  // se protege solo con su nombre+PIN, no con la sesión de admin.
  if (path === "/api/partners") return true;

  if (path === "/api/events" && mutation) return true;
  if (/^\/api\/events\/[^/]+$/.test(path) && mutation) return true;
  if (path === "/api/events/reorder") return true;
  if (path === "/api/events/upload") return true;
  if (/^\/api\/events\/[^/]+\/notify$/.test(path)) return true;

  if (path.startsWith("/api/gallery") && (mutation || path === "/api/gallery/upload")) return true;
  if (path.startsWith("/api/hero-photos") && mutation) return true;
  if (path.startsWith("/api/rentals") && mutation) return true;

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!requiresAdmin(pathname, req.method)) return NextResponse.next();

  const ok = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (ok) return NextResponse.next();

  return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
}

export const config = {
  matcher: ["/api/:path*"],
};
