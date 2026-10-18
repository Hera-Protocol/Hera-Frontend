import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, DM_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.heralayer.com"),
  title: { default: "Hera: compliance that never blinks", template: "%s · Hera" },
  description:
    "KYT, AML and the Travel Rule for Stellar and EVM. Hera screens wallets and scores every transaction with its own intelligence, natively handling muxed accounts, memos and SEPs.",
  icons: { icon: "/hera-mark.svg" },
  openGraph: { title: "Hera: compliance that never blinks", type: "website", images: ["/hera-mark.svg"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF5E8" },
    { media: "(prefers-color-scheme: dark)", color: "#15110D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bricolage.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
