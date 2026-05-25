/**
 * BrandFooter — small JPS signature footer.
 */
export function BrandFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 px-6 py-8 sm:flex-row sm:items-center">
        <p className="jps-eyebrow">Lente · J P Saraiva</p>
        <p className="text-xs text-muted-foreground">
          Pesquisa qualitativa em vídeo · {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
