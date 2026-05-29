import { Link } from "@tanstack/react-router";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { LenteWordmark } from "./LenteWordmark";

type Props = {
 variant?: "default"| "minimal"| "marketing";
 right?: React.ReactNode;
};

/**
 * BrandHeader — J P Saraiva brand chrome.
 * Lente product wordmark + "por J P Saraiva" eyebrow.
 *
 * Variants:
 * - default   → product chrome (Ver exemplo, Admin, custom right slot)
 * - minimal   → wordmark only (for auth / focus flows)
 * - marketing → landing-style chrome (uppercase nav + filled CTA)
 */
export function BrandHeader({ variant = "default", right }: Props) {
 const { isAdmin } = useIsAdmin();

 return (
 <header className="border-b border-border bg-background">
 <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
 <div className="inline-flex items-baseline gap-3">
 <Link to="/"aria-label="Lente — início"className="inline-flex items-center text-[color:var(--lente-teal-deep)] hover:opacity-80 transition-opacity">
 <LenteWordmark className="h-7 w-auto" />
 </Link>
 {variant !== "minimal"&& (
 <a href="https://pereirasaraiva.com"target="_blank"rel="noopener noreferrer"className="jps-eyebrow hidden sm:inline hover:opacity-70 transition-opacity">por J P Saraiva</a>
 )}
 </div>

 {variant === "marketing"? (
 <div className="flex items-center gap-6 sm:gap-8">
 <a href="#metodo"className="hidden sm:inline text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground hover:opacity-70 transition-opacity">
 Metodologia
 </a>
 <Link to="/login"className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground hover:opacity-70 transition-opacity">
 Entrar
 </Link>
 <Link
 to="/signup"
 className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground hover:bg-[color:var(--lente-teal-deep)] transition-colors"
 >
 Criar conta <span aria-hidden>→</span>
 </Link>
 {right}
 </div>
 ) : (
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
 )}
 </div>
 </header>
 );
}
