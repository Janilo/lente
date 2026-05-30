import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
 Outlet,
 Link,
 createRootRouteWithContext,
 useRouter,
 HeadContent,
 Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Toaster } from "@/components/ui/sonner";
import { BrandFooter } from "@/components/brand/BrandFooter";
import { LenteWordmark } from "@/components/brand/LenteWordmark";
import { syncHubspotSelf } from "@/lib/hubspot.functions";


function NotFoundComponent() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const match = pathname.match(/^\/r_?\/([^/]+)/);
  const slug = match?.[1];
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md">
        <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">404</p>
        <h1 className="font-display text-[44px] font-light italic leading-tight text-foreground">
          Página não encontrada.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
          O link pode estar desatualizado ou a página foi movida.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {slug ? (
            <Link
              to="/r/$slug"
              params={{ slug }}
              className="inline-flex items-center bg-primary px-6 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-primary-foreground transition-opacity hover:opacity-85"
            >
              Voltar à entrevista
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center bg-primary px-6 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-primary-foreground transition-opacity hover:opacity-85"
            >
              Entrar
            </Link>
          )}
          <a
            href="https://pereirasaraiva.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center border border-border px-6 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-foreground transition-opacity hover:opacity-85"
          >
            J P Saraiva
          </a>
          <Link
            to="/"
            className="inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
 console.error(error);
 const router = useRouter();
 return (
 <div className="flex min-h-dvh items-center justify-center bg-background px-4">
 <div className="max-w-md text-center">
 <h1 className="text-xl font-semibold">Algo deu errado</h1>
 <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
 <button
 onClick={() => { router.invalidate(); reset(); }}
 className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
 >
 Tentar novamente
 </button>
 </div>
 </div>
 );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
 head: () => ({
 meta: [
 { charSet: "utf-8"},
 { name: "viewport", content: "width=device-width, initial-scale=1"},
 { title: "Lente: Pesquisa qualitativa em vídeo com IA"},
 { name: "description", content: "Pesquisa qualitativa em vídeo com IA. Entrevistas com follow-ups adaptativos, transcrição automática e síntese de insights com recortes."},
 { property: "og:title", content: "Lente: Pesquisa qualitativa em vídeo com IA"},
 { name: "twitter:title", content: "Lente: Pesquisa qualitativa em vídeo com IA"},
 { property: "og:description", content: "Pesquisa qualitativa em vídeo com IA. Entrevistas com follow-ups adaptativos, transcrição automática e síntese de insights com recortes."},
 { name: "twitter:description", content: "Pesquisa qualitativa em vídeo com IA. Entrevistas com follow-ups adaptativos, transcrição automática e síntese de insights com recortes."},
 { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/821c4956-afdc-4651-b3a0-6801ad9b5d37/id-preview-3a98dd85--19daec10-d6e6-48b0-85d3-7e3715904e7f.lovable.app-1779670696225.png"},
 { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/821c4956-afdc-4651-b3a0-6801ad9b5d37/id-preview-3a98dd85--19daec10-d6e6-48b0-85d3-7e3715904e7f.lovable.app-1779670696225.png"},
 { name: "twitter:card", content: "summary_large_image"},
 { property: "og:type", content: "website"},
 { property: "og:url", content: "https://lente.pereirasaraiva.com/" },
 { property: "og:locale", content: "pt_BR" },
 { name: "google-site-verification", content: "kbiLQWHuF0-ziT6y9mGuE2Cj7PqUFiphcc9AbbG12bE"},
 ],
 links: [
 { rel: "icon", type: "image/svg+xml", href: "/favicon.svg"},
 { rel: "stylesheet", href: appCss },
 { rel: "canonical", href: "https://lente.pereirasaraiva.com/" },
 { rel: "preload", href: "/fonts/Fraunces-VariableFont_SOFT_WONK_opsz_wght.ttf", as: "font", type: "font/ttf", crossOrigin: "anonymous" },
 { rel: "preload", href: "/fonts/InterTight-VariableFont_wght.ttf", as: "font", type: "font/ttf", crossOrigin: "anonymous" },
 ],
 scripts: [
 { src: "https://www.googletagmanager.com/gtag/js?id=G-QDHKZ82GE0", async: true },
 {
 children: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-QDHKZ82GE0');`,
 },
 {
 type: "application/ld+json",
 children: JSON.stringify({
 "@context": "https://schema.org",
 "@graph": [
 {
 "@type": "Organization",
 name: "Lente",
 url: "https://lente.pereirasaraiva.com",
 logo: "https://lente.pereirasaraiva.com/favicon.svg",
 },
 {
 "@type": "WebSite",
 name: "Lente",
 url: "https://lente.pereirasaraiva.com",
 },
 {
 "@type": "SoftwareApplication",
 name: "Lente",
 applicationCategory: "BusinessApplication",
 operatingSystem: "Web",
 description: "Pesquisa qualitativa em vídeo com IA: entrevistas com follow-ups adaptativos, transcrição automática e síntese de insights.",
 offers: { "@type": "Offer", price: "0", priceCurrency: "BRL"},
 },
 ],
 }),
 },
 ],
 }),
 shellComponent: RootShell,
 component: RootComponent,
 notFoundComponent: NotFoundComponent,
 errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
 return (
 <html lang="pt-BR">
 <head><HeadContent /></head>
 <body>{children}<Scripts /></body>
 </html>
 );
}

function AuthInvalidator() {
 const router = useRouter();
 const queryClient = useQueryClient();
 useEffect(() => {
 const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
 router.invalidate();
 queryClient.invalidateQueries();

 if (event === "SIGNED_IN"&& session?.user) {
 const userId = session.user.id;
 const key = `lente:hubspot-synced:${userId}`;
 if (typeof window !== "undefined"&& !window.localStorage.getItem(key)) {
 window.localStorage.setItem(key, "1");
 const path = window.location.pathname;
 const m = path.match(/^\/r_?\/([^/]+)/);
 const role: "researcher"| "respondent"= m ? "respondent": "researcher";
 const study_slug = m?.[1];
 syncHubspotSelf({ data: { role, ...(study_slug ? { study_slug } : {}) } })
 .catch((e) => {
 console.warn("hubspot sync failed", e);
 window.localStorage.removeItem(key);
 });
 }
 }
 });
 return () => subscription.unsubscribe();
 }, [router, queryClient]);
 return null;
}

function Header() {
 const { isAuthenticated, loading } = useAuth();
 const { isAdmin } = useIsAdmin();
 return (
 <header className="border-b border-border bg-background sticky top-0 z-40 h-[var(--header-height)]">
 <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-8">
 <div className="inline-flex items-center gap-3">
 <Link
 to="/"
 aria-label="Lente — início"
 className="inline-flex items-center text-[color:var(--lente-teal-deep)] hover:opacity-80 transition-opacity"
 >
 <LenteWordmark className="h-7 w-auto" />
 </Link>
 <a
 href="https://pereirasaraiva.com"
 target="_blank"
 rel="noopener noreferrer"
 className="jps-eyebrow hidden sm:inline hover:opacity-70 transition-opacity"
 >
 por J P Saraiva
 </a>
 </div>
 <nav className="flex items-center gap-6 sm:gap-8">
 {loading ? null : isAuthenticated ? (
 <>
 <Link to="/dashboard"className="jps-navlink">Dashboard</Link>
 <Link to="/my-privacy"className="jps-navlink">Minha privacidade</Link>
 {isAdmin && <Link to="/admin/analytics" className="jps-navlink">Admin</Link>}
 <button
 onClick={async () => { await supabase.auth.signOut(); }}
 className="jps-navlink"
 >
 Sair
 </button>
 </>
 ) : (
 <>
 <a href="/#metodo"className="jps-navlink hidden sm:inline">Metodologia</a>
 <Link to="/login"className="jps-navlink">Entrar</Link>
 <Link to="/signup"className="jps-cta">
 Criar conta <span aria-hidden>→</span>
 </Link>
 </>
 )}
 </nav>
 </div>
 </header>
 );
}

function RootComponent() {
 const { queryClient } = Route.useRouteContext();
 return (
 <QueryClientProvider client={queryClient}>
 <AuthInvalidator />
 <div className="min-h-dvh flex flex-col">
 <Header />
 <main className="flex-1"><Outlet /></main>
 <BrandFooter />
 </div>
 <Toaster />
 </QueryClientProvider>
 );
}
