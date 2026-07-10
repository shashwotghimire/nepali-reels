import { useSession } from "@/lib/auth-client";
import UserProfile from "@/components/UserProfile";

function Dashboard() {
  const { data, isPending, error } = useSession();
  if (isPending) return <p>Loading...</p>;
  if (error) return <p>{error.message}</p>;
  if (!data) return null;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-end p-4">
        <UserProfile />
      </header>
      <main className="p-4">
        Dashboard
      </main>
    </div>
  );
}

export default Dashboard;
