import { Link } from "@tanstack/react-router";
import { LenteWordmark } from "./LenteWordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border h-[var(--header-height)] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-8">
        <div className="inline-flex items-center gap-3 h-8">
          <Link
            to="/"
            aria-label="Lente — início"
            className="inline-flex items-center text-[color:var(--lente-teal-deep)] hover:opacity-80 transition-opacity"
          >
            <LenteWordmark className="h-[22px] w-auto" />
          </Link>
          <a
            href="https://pereirasaraiva.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline text-[13px] font-normal text-[#5F5B55] tracking-normal normal-case hover:opacity-70 transition-opacity"
          >
            por J P Saraiva
          </a>
        </div>
        <nav className="flex items-center gap-6 sm:gap-8">
          <a
            href="/#metodo"
            className="hidden sm:inline text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70 hover:text-foreground transition-colors"
          >
            Metodologia
          </a>
          <Link
            to="/login"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70 hover:text-foreground transition-colors"
          >
            Entrar
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] hover:opacity-90 transition-opacity"
          >
            Criar conta <span aria-hidden>→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
