import { supabase } from "@/integrations/supabase/client";
import wordmarkInk from "@/assets/brand/wordmark-ink.svg";

const RESPONDENTS_HREF = "https://pereirasaraiva.com/respondentes";
const CTA_ID = "footer_respondents_signup";

/**
 * BrandFooter — JPS signature footer, pereirasaraiva.com style.
 * Same layout and typography on mobile and desktop.
 */
export function BrandFooter() {
 const handleCtaClick = () => {
 void supabase.from("cta_click_events").insert({
 cta_id: CTA_ID,
 href: RESPONDENTS_HREF,
 referrer: typeof document !== "undefined"? document.referrer || null : null,
 user_agent: typeof navigator !== "undefined"? navigator.userAgent.slice(0, 500) : null,
 });
 };

 return (
 <footer className="mt-24">
 <div className="mx-auto max-w-6xl px-4 sm:px-6">
 <div className="flex flex-row flex-nowrap items-center justify-between gap-3 border-t border-border/70 py-6">
 <p className="min-w-0 flex-1 truncate text-[11px] font-light text-muted-foreground sm:text-sm">
 Quer participar como respondente de pesquisas?
 </p>
 <a
 href={RESPONDENTS_HREF}
 target="_blank"
 rel="noopener noreferrer"
 onClick={handleCtaClick}
 className="shrink-0 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.18em] text-foreground transition-opacity hover:opacity-70 sm:text-xs"
 >
 Cadastre-se aqui&nbsp;→
 </a>
 </div>
 <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-1 border-t border-border/70 py-5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
 <span className="font-semibold">Outros produtos</span>
 <a href="https://prisma.pereirasaraiva.com"target="_blank"rel="noopener noreferrer"className="hover:opacity-70 transition-opacity">Prisma</a>
 <a href="https://cascata.pereirasaraiva.com"target="_blank"rel="noopener noreferrer"className="hover:opacity-70 transition-opacity">Cascata</a>
 </div>
 <div className="flex flex-row flex-nowrap items-center justify-between gap-3 border-t border-border/70 py-6">
 <a href="https://pereirasaraiva.com"target="_blank"rel="noopener noreferrer"aria-label="J P Saraiva"className="shrink-0 hover:opacity-70 transition-opacity">
 <img src={wordmarkInk} alt="J P Saraiva" className="h-4 w-auto" />
 </a>
 <p className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
 © {new Date().getFullYear()}
 </p>
 </div>
 </div>
 </footer>
 );
}
