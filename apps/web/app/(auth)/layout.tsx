import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

/** Auth pages: no app shell, no marketing chrome. Each page lays itself out. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-paper text-ink">{children}</div>;
}
