import "./globals.css";
import { Metadata, Viewport } from "next";
import { Inter, Courier_Prime } from "next/font/google";

// Initialize fonts
const inter = Inter({ subsets: ["latin"] });
const courierPrime = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-courier-prime",
});

export const metadata: Metadata = {
  title: "Oddysseia - Onchain Community",
  description: "Building the largest onchain community, driving the consumer crypto revolution",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${courierPrime.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          /* Critical CSS to ensure overlay visibility */
          [data-overlay="true"] {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 9000 !important;
          }
          
          /* Hide Next.js watermark */
          [data-nextjs-dev-indicator], 
          [id^="__nextjs"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
          }
        `}} />
      </head>
      <body className={`bg-black overflow-hidden ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
