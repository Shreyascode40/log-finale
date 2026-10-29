import type { Metadata } from "next";
import { Arimo, Tinos } from "next/font/google";
import "./globals.css";

/**
 * Fonts are self-hosted by next/font so the on-screen sheet and the Puppeteer
 * PDF use identical faces.
 *  - Tinos  is metric-compatible with Times New Roman (body / tables / labels)
 *  - Arimo  is metric-compatible with Arial (bold centred section titles)
 * Both are loaded offline by next/font at build time.
 */
const serif = Tinos({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const sansTitle = Arimo({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-sans-title",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Digital BE Project Log Book — APCOE&R",
  description:
    "Digital Project Diary (Record No. ACA/D/003B, Revision 00, DoI 01/02/2025), Anantrao Pawar College of Engineering & Research.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sansTitle.variable}`}>{children}</body>
    </html>
  );
}
