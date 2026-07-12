import TikTokConnectionCard from "@/components/connections/TikTokConnectionCard";

export default function Connections() {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Connections</h1>
        <p className="text-muted-foreground text-sm">Link your social media accounts to manage publishing pipelines.</p>
      </div>
      <div className="flex flex-wrap gap-4">
        <TikTokConnectionCard />
      </div>
    </div>
  );
}
