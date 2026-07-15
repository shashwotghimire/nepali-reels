import { useGetReelsOfUser } from "@/hooks/api/usePipeline";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  queued: "outline",
  script_generated: "secondary",
  script_finalised: "secondary",
  video_spec_generated: "default",
  sound_generated: "default",
  failed: "destructive",
};

export default function UserReelsTable() {
  const { data, isPending, error } = useGetReelsOfUser();

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-sm text-destructive">
        Failed to load reels. Please try again.
      </div>
    );
  }

  if (!data?.reels.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No reels yet. Create your first reel to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Topic</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.reels.map((reel) => (
            <TableRow key={reel.id}>
              <TableCell className="font-medium">{reel.topic}</TableCell>
              <TableCell>
                <Badge
                  variant={STATUS_VARIANT[reel.pipelineStatus] ?? "outline"}
                >
                  {reel.pipelineStatus.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(reel.createdAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground text-right">
        {data.totalItems} reel{data.totalItems !== 1 ? "s" : ""} &middot; page{" "}
        {data.currentPage} of {data.totalPages}
      </p>
    </div>
  );
}
