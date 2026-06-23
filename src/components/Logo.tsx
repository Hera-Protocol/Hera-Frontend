import heraLogo from "@/assets/hera-logo.png";

interface LogoProps {
  showWordmark?: boolean;
  size?: number;
  className?: string;
}

export function Logo({ showWordmark = true, size = 28, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={heraLogo}
        alt="Hera Protocol"
        width={size}
        height={size}
        className="shrink-0 object-contain"
      />
      {showWordmark && (
        <span className="font-sans text-[13px] font-bold tracking-[0.18em] text-foreground uppercase">
          Hera Protocol
        </span>
      )}
    </div>
  );
}
