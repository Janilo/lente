import { Link } from "@tanstack/react-router";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import wordmarkInk from "@/assets/brand/wordmark-ink.svg";

type Props = {
 variant?: "default"| "minimal";
 right?: React.ReactNode;
};

/**
 * BrandHeader — J P Saraiva brand chrome.
 * Product wordmark "Lente"in Fraunces, with a "by J P Saraiva"eyebrow.
 */
export function BrandHeader({ variant = "default", right }: Props) {
 const { isAdmin } = useIsAdmin();
 return (
 <header className="border-b border-border bg-background">
 <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
 <div className="inline-flex items-baseline gap-3">
 <Link to="/"className="font-display text-2xl leading-none text-primary"style={{ fontVariationSettings: '"opsz"144, "SOFT"0, "WONK"0' }}>Lente</Link>
 {variant === "default"&& (
 <a href="https://pereirasaraiva.com"target="_blank"rel="noopener noreferrer"className="hidden sm:inline-flex items-baseline gap-1.5 hover:opacity-70 transition-opacity">
 <span className="jps-eyebrow">por</span>
 <img src={wordmarkInk} alt="J P Saraiva" className="h-3 w-auto translate-y-[1px]" />
 </a>
 )}
 </div>
 <div className="flex items-center gap-8">
 <Link to="/exemplo"className="jps-navlink">
 Ver exemplo
 </Link>
 {isAdmin && (
 <Link to="/admin/analytics"className="jps-navlink">
 Admin
 </Link>
 )}
 {right}
 </div>
 </div>
 </header>
 );
}
