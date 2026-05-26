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
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
        <Link to="/" className="group inline-flex items-baseline gap-3">
          <span
            className="font-display text-2xl leading-none text-primary"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 0' }}
          >
            Lente
          </span>
          {variant === "default" && (
            <span className="jps-eyebrow hidden sm:inline">por J P Saraiva</span>
          )}
        </Link>
        <div className="flex items-center gap-8">
          {isAdmin && (
            <Link to="/admin/analytics" className="jps-navlink">
              Admin
            </Link>
          )}
          {right}
        </div>
      </div>
    </header>
  );
}
