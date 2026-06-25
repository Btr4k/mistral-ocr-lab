import type { Metadata } from "next";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ocr.a8d.ai";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Mistral OCR 4 Live Lab | A8D.AI",
  description: "Interactive document OCR and layout analysis using Mistral OCR 4.",
  alternates: {
    canonical: "https://ocr.a8d.ai",
    languages: {
      en: "https://ocr.a8d.ai?lang=en",
      ar: "https://ocr.a8d.ai?lang=ar"
    }
  },
  openGraph: {
    title: "Mistral OCR 4 Live Lab | A8D.AI",
    description: "Interactive document OCR and layout analysis using Mistral OCR 4.",
    url: "https://ocr.a8d.ai",
    siteName: "A8D.AI",
    locale: "en_US",
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
