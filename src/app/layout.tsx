import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ProSight Report Studio",
  description: "Inspection report generation for ProSight Property Inspections",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cormorant+Garamond:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&family=Libre+Baskerville:wght@400;700&family=Archivo:wght@600;700;800&family=Fraunces:wght@500;600;700&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
