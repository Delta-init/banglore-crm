import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { GoeyToaster } from "@/components/ui/goey-toaster";
import NextTopLoader from "nextjs-toploader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Delta",
  description: "Delta CRM",
  applicationName: "Delta",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Delta",
  },
  formatDetection: {
    telephone: false,
  },
  // Open Graph (looks good when shared)
  openGraph: {
    type: "website",
    siteName: "Delta",
    title: "Delta",
    description: "Delta CRM",
  },
};

// Separate viewport export (required by Next.js 14)
export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",        // respect iPhone notch / safe areas
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* iOS standalone splash / status bar */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Delta" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <NextTopLoader
            color="#3b82f6"
            shadow="0 0 10px #3b82f6, 0 0 5px #3b82f6"
            height={3}
            showSpinner={false}
            easing="ease"
            speed={200}
          />
          <QueryProvider>
            {children}
            <GoeyToaster  />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
