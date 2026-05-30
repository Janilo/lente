import { useAuth } from "./useAuth";
import { ADMIN_EMAIL } from "@/lib/config";

export { ADMIN_EMAIL };

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const isAdmin = (user?.email ?? "").toLowerCase() === ADMIN_EMAIL;
  return { isAdmin, loading };
}
