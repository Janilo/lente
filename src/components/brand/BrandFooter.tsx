/**
 * BrandFooter — JPS signature footer, pereirasaraiva.com style.
 */
export function BrandFooter() {
  return (
    <footer className="mt-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-start justify-between gap-3 border-t border-border/70 py-6 sm:flex-row sm:items-center">
          <p className="text-sm font-light text-muted-foreground">
            Quer participar como respondente de pesquisas?
          </p>
          <a
            href="https://pereirasaraiva.com/respondentes"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium uppercase tracking-[0.18em] text-foreground transition-opacity hover:opacity-70"
          >
            Cadastre-se aqui&nbsp;→
          </a>
        </div>
        <div className="flex flex-col items-start justify-between gap-2 border-t border-border/70 py-6 sm:flex-row sm:items-center">
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            J P Saraiva
          </p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
