import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/connections/StatusBadge";
import ConstraintIcon from "@/components/connections/ConstraintIcon";
import type { Platform } from "@/components/connections/types";

export default function PlatformCard({ platform }: { platform: Platform }) {
  const isConnected = platform.status === "connected";

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${platform.iconBg}`}>
          {platform.icon}
        </div>
        <StatusBadge status={platform.status} />
      </div>

      <div>
        <h3 className="font-semibold text-base">{platform.name}</h3>
        <p className="text-sm text-muted-foreground">{platform.handle ?? "Not Linked"}</p>
      </div>

      <div className="flex flex-col gap-2 text-xs">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Publish Constraints</p>
        <div className="flex items-start gap-1.5 text-muted-foreground">
          <ConstraintIcon type={platform.constraintIcon} />
          <span>{platform.constraints}</span>
        </div>

        {platform.lastSync && (
          <div className="mt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Last Sync</p>
            <p className="text-muted-foreground">{platform.lastSync}</p>
          </div>
        )}

        {platform.actionRequired && (
          <div className="mt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Action Required</p>
            <p className="text-muted-foreground">{platform.actionRequired}</p>
          </div>
        )}

        {platform.availableTiers && (
          <div className="mt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Available Tiers</p>
            <p className="text-muted-foreground">{platform.availableTiers}</p>
          </div>
        )}
      </div>

      <div className="mt-auto pt-2">
        {isConnected ? (
          <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
            DISCONNECT
          </Button>
        ) : (
          <Button className="w-full">CONNECT</Button>
        )}
      </div>
    </div>
  );
}
