/**
 * BrandFooter — small JPS signature footer.
 */
export function BrandFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-col items-start gap-2 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex flex-col gap-1">
            <p className="jps-eyebrow">Participe</p>
            <p className="text-sm text-foreground">
              Quer participar como respondente?
            </p>
          </div>
          <a
            href="https://pereirasaraiva.com/respondentes"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Cadastre-se aqui →
          </a>
        </div>
        <div className="flex flex-col items-start justify-between gap-3 pt-6 sm:flex-row sm:items-center">
          <p className="jps-eyebrow">Lente · J P Saraiva</p>
          <p className="text-xs text-muted-foreground">
            Pesquisa qualitativa em vídeo · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
