/**
 * LenteWordmark — Lente product wordmark per DS § Brand.
 * Lens glyph + "lente" lowercase in Inter Tight 700.
 * Uses currentColor so callers control the tone (teal-deep on light, white on dark).
 * Default height matches DS: 28px in chrome, 56px in hero specimens.
 */
type Props = {
  className?: string;
  title?: string;
};

export function LenteWordmark({ className = "h-7 w-auto", title = "Lente"}: Props) {
  return (
    <svg
      viewBox="0 0 180 44"
      role="img"
      aria-label={title}
      className={className}
      fill="currentColor"
    >
      <circle cx="22" cy="22" r="16" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="22" cy="22" r="10" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="22" cy="22" r="4.5"/>
      <text
        x="50"
        y="29.5"
        fontFamily="Inter Tight, Inter, system-ui, sans-serif"
        fontWeight={700}
        fontSize={24}
        letterSpacing="-0.02em"
      >lente</text>
    </svg>
  );
}
