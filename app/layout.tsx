import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: {
    default: "Invoice Generator",
    template: "%s · Invoice Generator",
  },
  description:
    "Create, customise and share professional invoices in seconds. Live preview, PDF export and secure payment links.",
  applicationName: "Invoice Generator",
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-ink-50 font-sans text-ink-900">
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-[100] rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
