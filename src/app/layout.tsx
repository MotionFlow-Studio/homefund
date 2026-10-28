import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OfflineProvider } from "@/components/offline-provider";
import splashScreens from "@/lib/splash-screens.json";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://homefund.motionflowstudio.com"),
  title: {
    default: "HomeFund",
    template: "%s · HomeFund",
  },
  description: "See what is left until payday and how much you can spend per day.",
  applicationName: "HomeFund",
  appleWebApp: {
    capable: true,
    title: "HomeFund",
    statusBarStyle: "default",
    // iOS shows these while the installed app starts; made by scripts/make-icons.mjs.
    startupImage: splashScreens.map(([width, height, ratio]) => ({
      url: `/splash/${width * ratio}x${height * ratio}.png`,
      media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
    })),
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <OfflineProvider />
      </body>
    </html>
  );
}
