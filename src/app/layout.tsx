import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // For potential future use of toasts

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Page Highlighter',
  description: 'Chrome Extension for text highlighting',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="popup-html">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased popup-body text-sm`}>
        {children}
        <Toaster /> {/* For potential notifications */}
      </body>
    </html>
  );
}
