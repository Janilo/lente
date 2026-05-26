import { useAuth } from "./useAuth";

export const ADMIN_EMAIL = "janilo@pereirasaraiva.com";

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const isAdmin = (user?.email ?? "").toLowerCase() === ADMIN_EMAIL;
  return { isAdmin, loading };
}
