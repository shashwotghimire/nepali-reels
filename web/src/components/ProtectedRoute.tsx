import { useSession } from "@/lib/auth-client";
import { Navigate, Outlet } from "react-router-dom";

function ProtectedRoute() {
  const { data, isPending } = useSession();

  if (isPending) return null;
  if (!data) return <Navigate to="/" replace />;

  return <Outlet />;
}

export default ProtectedRoute;
