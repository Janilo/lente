import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !isAuthenticated) navigate({ to: "/login" });
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20 text-sm text-muted-foreground">Carregando…</div>
    );
  }
  if (!isAuthenticated) return null;
  return <Outlet />;
}
