import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/exemplo")({
  beforeLoad: () => {
    throw redirect({ to: "/demo", statusCode: 301 });
  },
});
