import { useSession } from "@/lib/auth-client";
import { Navigate, Outlet } from "react-router-dom";

function PublicRoute() {
  const { data, isPending } = useSession();

  if (isPending) return null;
  if (data) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

export default PublicRoute;
