import type { Metadata, Viewport } from "next";
import { Caprasimo, Figtree } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const caprasimo = Caprasimo({ subsets: ["latin"], weight: "400", variable: "--font-caprasimo" });
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: { default: "Red Km 0 · Huertas cerca de tu cocina", template: "%s · Red Km 0" },
  description: "Verdura agroecológica de huertas cercanas para restaurantes, verdulerías y hoteles: una entrega y una factura.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5ead8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${caprasimo.variable} ${figtree.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
