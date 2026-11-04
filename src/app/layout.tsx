import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import ThemeProvider from "./components/theme-provider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

// Applies the theme to <html> before React hydrates so there is no flash of
// the wrong theme on first paint. Uses the saved preference if the user has
// picked one; otherwise follows the OS (prefers-color-scheme), defaulting to dark.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var m=(t==='light'||t==='dark')?t:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.classList.toggle('dark',m==='dark');document.documentElement.style.colorScheme=m;}catch(e){document.documentElement.classList.add('dark');}})();`;

export const metadata: Metadata = {
  title: "Smartloop.",
  description: "Enterprise SLM Platform - Document extraction using Gen AI",
  keywords: "Generative AI, SLM, documents, small language model, document extraction",
  // This is the signed-in console, not a public site, and pages of it had been
  // indexed. Crawling is deliberately left open rather than blocked in a
  // robots.txt: a page Google is not allowed to fetch is a page whose noindex
  // it never reads, so the URLs already in the index would simply persist.
  // Public content lives on smartloop.ai, which is what should rank.
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: "icon.png",
    apple: "apple.png"
  },
  twitter: {
    card: "summary_large_image",
    title: "Smartloop.",
    images: ["https://smartloop.ai/twitter-logo.png"],
    site: "https://smartloop.ai",
    creator: "@smartloop"
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={spaceGrotesk.variable} id="app">
        <ThemeProvider>
          <div className="wrapper" >
              {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
