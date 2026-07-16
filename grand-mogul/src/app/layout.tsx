import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SWRegister } from "@/components/SWRegister";

export const metadata: Metadata = {
  title: "Le Grand Mogul — Quiz de culture générale",
  description:
    "Quiz de culture générale française animé par LE GRAND MOGUL et ses cinq compagnons. Jouable hors-ligne, installable, solo ou entre amis.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Grand Mogul",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0b1e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const schemeInit = `try{if(localStorage.getItem("gm-scheme")==="light")document.documentElement.classList.add("light")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: schemeInit }} />
      </head>
      <body className="antialiased">
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
