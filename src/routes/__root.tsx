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
import { Toaster } from "@/components/ui/sonner";
import { BrandFooter } from "@/components/brand/BrandFooter";
import { syncHubspotSelf } from "@/lib/hubspot.functions";


function NotFoundComponent() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const match = pathname.match(/^\/r_?\/([^/]+)/);
  const slug = match?.[1];
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">Página não encontrada.</p>
        {slug ? (
          <Link
            to="/r/$slug"
            params={{ slug }}
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Voltar à entrevista
          </Link>
        ) : (
          <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Voltar
          </Link>
        )}
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lente: Pesquisa qualitativa em vídeo com IA" },
      { name: "description", content: "Conduza entrevistas em vídeo com follow-ups adaptativos, transcrição automática e síntese de insights." },
      { property: "og:title", content: "Lente: Pesquisa qualitativa em vídeo com IA" },
      { name: "twitter:title", content: "Lente: Pesquisa qualitativa em vídeo com IA" },
      { property: "og:description", content: "Conduza entrevistas em vídeo com follow-ups adaptativos, transcrição automática e síntese de insights." },
      { name: "twitter:description", content: "Conduza entrevistas em vídeo com follow-ups adaptativos, transcrição automática e síntese de insights." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/821c4956-afdc-4651-b3a0-6801ad9b5d37/id-preview-3a98dd85--19daec10-d6e6-48b0-85d3-7e3715904e7f.lovable.app-1779670696225.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/821c4956-afdc-4651-b3a0-6801ad9b5d37/id-preview-3a98dd85--19daec10-d6e6-48b0-85d3-7e3715904e7f.lovable.app-1779670696225.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      { src: "https://www.googletagmanager.com/gtag/js?id=G-QDHKZ82GE0", async: true },
      {
        children: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-QDHKZ82GE0');`,
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

      if (event === "SIGNED_IN" && session?.user) {
        const userId = session.user.id;
        const key = `lente:hubspot-synced:${userId}`;
        if (typeof window !== "undefined" && !window.localStorage.getItem(key)) {
          const path = window.location.pathname;
          const m = path.match(/^\/r_?\/([^/]+)/);
          const role: "researcher" | "respondent" = m ? "respondent" : "researcher";
          const study_slug = m?.[1];
          syncHubspotSelf({ data: { role, ...(study_slug ? { study_slug } : {}) } })
            .then(() => window.localStorage.setItem(key, "1"))
            .catch((e) => console.warn("hubspot sync failed", e));
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

function Header() {
  const { isAuthenticated, loading } = useAuth();
  return (
    <header className="border-b border-border bg-background sticky top-0 z-40">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-8">
        <div className="inline-flex items-baseline gap-3">
          <Link
            to="/"
            className="font-display text-2xl leading-none text-primary hover:opacity-85 transition-opacity"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 0' }}
          >
            Lente
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
        <nav className="flex items-center gap-8">
          {loading ? null : isAuthenticated ? (
            <>
              <Link to="/dashboard" className="jps-navlink">Dashboard</Link>
              <Link to="/my-privacy" className="jps-navlink">Minha privacidade</Link>
              <button
                onClick={async () => { await supabase.auth.signOut(); }}
                className="jps-navlink"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="jps-navlink">Entrar</Link>
              <Link to="/signup" className="jps-cta">
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
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1"><Outlet /></main>
        <BrandFooter />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
