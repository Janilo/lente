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

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Voltar
        </Link>
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
      { title: "Lente — Pesquisa qualitativa em vídeo com IA" },
      { name: "description", content: "Conduza entrevistas em vídeo com follow-ups adaptativos, transcrição automática e síntese de insights." },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

function Header() {
  const { isAuthenticated, loading } = useAuth();
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary" />
          <span className="font-display text-2xl">Lente</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {loading ? null : isAuthenticated ? (
            <>
              <Link to="/dashboard" className="rounded-md px-3 py-2 text-foreground hover:bg-accent">Dashboard</Link>
              <button
                onClick={async () => { await supabase.auth.signOut(); }}
                className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-md px-3 py-2 text-foreground hover:bg-accent">Entrar</Link>
              <Link to="/signup" className="rounded-md bg-primary px-3 py-2 text-primary-foreground hover:opacity-90">
                Criar conta
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
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
