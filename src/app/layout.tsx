import "./globals.css";
import type { Metadata, Viewport } from "next";
import PWA from "@/components/PWA";
import Splash from "@/components/Splash";

export const metadata: Metadata = {
  title: "ProSight Report Studio",
  description: "Inspection report generation for ProSight Property Inspections",
  applicationName: "ProSight Studio",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,                 // full screen when launched from the home screen
    title: "ProSight Studio",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },   // stops Safari turning report numbers into call links
};

/* viewport-fit=cover so the app reaches under the notch/rounded corners on a
   phone; maximumScale is left alone deliberately — pinch-zoom on a photograph
   is useful in the field and blocking it is an accessibility failure. */
export const viewport: Viewport = {
  themeColor: "#070d16",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500;6..72,600&family=Cormorant+Garamond:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&family=Libre+Baskerville:wght@400;700&family=Archivo:wght@600;700;800&family=Fraunces:wght@500;600;700&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet" />
        {/* Overscroll reveals the document, not the page — without this the
            rubber-band at the top and bottom flashes white on a dark screen. */}
        <style>{`
          html { background:#070d16; color-scheme:dark; }
          body { background:#070d16; margin:0; overscroll-behavior-y:none; }
          ::selection { background:rgba(69,176,238,.3); }
        `}</style>
      </head>
      <body>
        <Splash />
        {children}
        <PWA />
      </body>
    </html>
  );
}
