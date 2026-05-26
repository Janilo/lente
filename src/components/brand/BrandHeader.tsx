import { Link } from "@tanstack/react-router";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type Props = {
  variant?: "default" | "minimal";
  right?: React.ReactNode;
};

/**
 * BrandHeader — J P Saraiva brand chrome.
 * Product wordmark "Lente" in Fraunces, with a "by J P Saraiva" eyebrow.
 */
export function BrandHeader({ variant = "default", right }: Props) {
  const { isAdmin } = useIsAdmin();
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="group inline-flex items-baseline gap-3">
          <span
            className="font-display text-3xl leading-none text-foreground"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 0' }}
          >
            Lente
          </span>
          {variant === "default" && (
            <span className="jps-eyebrow hidden sm:inline">por J P Saraiva</span>
          )}
        </Link>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              to="/admin/analytics"
              className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              Admin
            </Link>
          )}
          {right}
        </div>
      </div>
    </header>
  );
}
