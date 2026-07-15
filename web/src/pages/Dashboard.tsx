import UserReelsTable from "@/components/pipeline/UserReelsTable";

function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Nepali Reels.</p>
      </div>
      <UserReelsTable />
    </div>
  );
}

export default Dashboard;
