"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { useMe } from "@/lib/queries";
import { AppearanceSection, DangerSection, NotificationsSection, OrganizationSection, ProfileSection, SecuritySection } from "./sections";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "org", label: "Organization" },
  { id: "notifications", label: "Notifications" },
  { id: "appearance", label: "Appearance" },
  { id: "danger", label: "Danger zone" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/** Highlights the section nearest the top of the viewport. */
function useActiveSection(): [SectionId, (id: SectionId) => void] {
  const [active, setActive] = useState<SectionId>("profile");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = visible[0]?.target.id as SectionId | undefined;
        if (id) setActive(id);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return [active, setActive];
}

export default function SettingsPage() {
  const { data: me } = useMe();
  const [active, setActive] = useActiveSection();
  if (!me) return null;

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-[22px] md:flex-row md:items-start">
        <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-[15px] font-semibold md:sticky md:top-24 md:w-[200px] md:shrink-0 md:flex-col md:overflow-visible">
          {SECTIONS.map((s) => {
            const on = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setActive(s.id)}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex min-h-10 shrink-0 items-center rounded-[11px] whitespace-nowrap",
                  on ? "border-2 border-line bg-sun px-3 py-2 text-[#17130F] shadow-[3px_3px_0_var(--shadow-color)]" : "px-3.5 py-2.5 hover:bg-paper-2",
                  !on && s.id === "danger" && "text-risk-severe",
                )}
              >
                {s.label}
              </a>
            );
          })}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
          <ProfileSection me={me} />
          <SecuritySection me={me} />
          <OrganizationSection me={me} />
          <NotificationsSection me={me} />
          <AppearanceSection />
          <DangerSection me={me} />
        </div>
      </div>
    </>
  );
}
