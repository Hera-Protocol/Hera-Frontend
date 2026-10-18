import { SiteFooter, SiteNav } from "@/components/marketing/site-chrome";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dot-grid min-h-screen">
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
