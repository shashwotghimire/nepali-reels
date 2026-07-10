import PlatformCard from "@/components/connections/PlatformCard";
import { platforms } from "@/components/connections/data";

export default function PlatformGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {platforms.map((p) => (
        <PlatformCard key={p.id} platform={p} />
      ))}
    </div>
  );
}
