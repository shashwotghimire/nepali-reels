import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import TikTokIcon from "./TikTokIcon";
import type { ConnectionStatus } from "@/types/ui/connections.types";
import { useGetTiktokConnectionDetails, useDisconnectTiktok } from "@/hooks/api/useTiktok";
import { connectTiktokService } from "@/services/tiktok.service";

const statusConfig: Record<
  ConnectionStatus,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  connected: { label: "Connected", variant: "default" },
  disconnected: { label: "Not connected", variant: "secondary" },
  expired: { label: "Token expired", variant: "destructive" },
};

export default function TikTokConnectionCard() {
  const { data, isPending } = useGetTiktokConnectionDetails();
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectTiktok();

  const status: ConnectionStatus = data?.connected ? "connected" : "disconnected";
  const { label, variant } = statusConfig[status];
  const profile = data?.profile;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-black text-white">
            <TikTokIcon />
          </div>
          <div>
            <CardTitle>TikTok</CardTitle>
            <CardDescription>
              {profile?.username ? `@${profile.username}` : "No account linked"}
            </CardDescription>
          </div>
        </div>
        <Badge variant={variant} className="w-fit">
          {label}
        </Badge>
      </CardHeader>
      <CardContent>
        {profile ? (
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={profile.avatar_url} alt={profile.display_name} />
              <AvatarFallback>{profile.display_name?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{profile.display_name}</p>
              <p className="text-xs text-muted-foreground">@{profile.username}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Connect your TikTok account to publish videos directly from your pipeline.
          </p>
        )}
      </CardContent>
      <CardFooter>
        {status === "connected" ? (
          <Button variant="destructive" size="sm" disabled={isDisconnecting} onClick={() => disconnect()}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" disabled={isPending} onClick={connectTiktokService}>
            Connect TikTok
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
