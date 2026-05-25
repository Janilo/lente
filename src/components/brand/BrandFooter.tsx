import { supabase } from "@/integrations/supabase/client";

const RESPONDENTS_HREF = "https://pereirasaraiva.com/respondentes";
const CTA_ID = "footer_respondents_signup";

/**
 * BrandFooter — JPS signature footer, pereirasaraiva.com style.
 */
export function BrandFooter() {
  const handleCtaClick = () => {
    // Fire-and-forget click tracking; never blocks navigation.
    void supabase.from("cta_click_events").insert({
      cta_id: CTA_ID,
      href: RESPONDENTS_HREF,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  };

  return (
    <footer className="mt-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-start justify-between gap-3 border-t border-border/70 py-6 sm:flex-row sm:items-center">
          <p className="text-sm font-light text-muted-foreground">
            Quer participar como respondente de pesquisas?
          </p>
          <a
            href={RESPONDENTS_HREF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCtaClick}
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
