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
    <html lang="en" suppressHydrationWarning className={`${courierPrime.variable}`} style={{ height: '100%' }}>
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
          
          /* Fix for canvas root mounting */
          canvas {
            display: block;
            outline: none;
          }
          
          html, body {
            height: 100%;
            overflow: visible;
          }
          
          /* Make scrollable content for ScrollytellingScene */
          body {
            height: auto;
            min-height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
          }
          
          /* Fix for ScrollControls to prevent duplicate roots */
          .r3f-scroll-container {
            position: fixed !important;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            z-index: 1;
          }
          
          /* Ensure content can be scrolled even when a scene is active */
          .r3f-scroll-container > * {
            pointer-events: auto !important;
          }
          
          /* Critical fix for React createRoot error with r3f */
          #__next {
            isolation: isolate;
          }
          
          /* Animation for arrow bounce */
          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
              transform: translateY(0);
            }
            40% {
              transform: translateY(-20px);
            }
            60% {
              transform: translateY(-10px);
            }
          }
        `}} />
      </head>
      <body className={`bg-black ${inter.className}`} style={{ height: 'auto', margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
