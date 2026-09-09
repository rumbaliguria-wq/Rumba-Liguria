import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rumba Liguria Events",
  description: "Eventi e feste a Liguria - Rumba Liguria Events",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    return (
      <html lang="it" suppressHydrationWarning>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        </head>
        <body className={`${inter.variable} antialiased font-sans`}>
        {/* Dark stays the default with no class on <html> (matches the site's
            night-club identity with zero flash-of-light on load); picking
            "light" adds a .light class that the CSS overrides above key on. */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} value={{ dark: "dark", light: "light" }}>
          {children}
          <Toaster theme="dark" position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
