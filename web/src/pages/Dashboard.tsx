import UserReelsTable from "@/components/pipeline/UserReelsTable";
import CreateReelButton from "@/components/pipeline/CreateReelButton";

function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your reels</h1>
        <CreateReelButton />
      </div>
      <UserReelsTable />
    </div>
  );
}

export default Dashboard;
