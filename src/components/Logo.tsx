interface LogoProps {
  showWordmark?: boolean;
  size?: number;
  className?: string;
  /** When true, mark renders white (for dark backgrounds). Defaults to true. */
  light?: boolean;
}

/**
 * Hera Protocol — geometric maze-H lettermark in a square frame.
 * Rendered as inline SVG so it scales crisply and adapts to theme.
 */
export function Logo({ showWordmark = true, size = 28, className = "", light = true }: LogoProps) {
  const stroke = light ? "currentColor" : "hsl(var(--primary-foreground))";
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Hera Protocol"
        className="text-foreground shrink-0"
      >
        {/* Outer square frame */}
        <rect x="4" y="4" width="56" height="56" stroke={stroke} strokeWidth="5" />
        {/* Left inner vertical */}
        <rect x="16" y="16" width="6" height="32" fill={stroke} />
        {/* Right inner vertical */}
        <rect x="42" y="16" width="6" height="32" fill={stroke} />
        {/* Crossbar of the H */}
        <rect x="16" y="29" width="32" height="6" fill={stroke} />
      </svg>
      {showWordmark && (
        <span className="font-sans text-[13px] font-bold tracking-[0.18em] text-foreground uppercase">
          Hera Protocol
        </span>
      )}
    </div>
  );
}
