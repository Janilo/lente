import { createFileRoute, redirect } from "@tanstack/react-router";

// Compatibilidade com links antigos /r/$slug — redireciona para /r_/$slug.
export const Route = createFileRoute("/r/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/r_/$slug", params: { slug: params.slug } });
  },
  component: () => null,
});
