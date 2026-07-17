import UserReelsTable from "@/components/pipeline/UserReelsTable";
import CreateReelButton from "@/components/pipeline/CreateReelButton";

function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to Nepali Reels.</p>
        </div>
        <CreateReelButton />
      </div>
      <UserReelsTable />
    </div>
  );
}

export default Dashboard;
