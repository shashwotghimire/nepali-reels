import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetReelsOfUser, useDeletePipeline } from "@/hooks/api/usePipeline";
import { Button } from "@/components/ui/button";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PIPELINE_STATUS_VARIANT } from "@/types/ui/pipeline.types";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function UserReelsTable() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isPending, isFetching, error } = useGetReelsOfUser({ page });
  const { mutate: deletePipeline, isPending: isDeleting } = useDeletePipeline();

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center text-sm text-destructive">
        Couldn't load your reels — try refreshing.
      </div>
    );
  }

  if (!data?.reels.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium">Nothing here yet.</p>
        <p className="text-sm text-muted-foreground mt-1">Hit <span className="font-medium text-foreground">New reel</span> to kick off your first pipeline.</p>
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
            <TableHead className="hidden md:table-cell">Model</TableHead>
            <TableHead className="hidden md:table-cell">Video</TableHead>
            <TableHead className="hidden sm:table-cell">Cost</TableHead>
            <TableHead className="hidden sm:table-cell">Created</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.reels.map((reel) => (
            <TableRow key={reel.id}>
              <TableCell className="font-medium max-w-[200px] truncate">{reel.topic}</TableCell>
              <TableCell>
                <Badge variant={PIPELINE_STATUS_VARIANT[reel.pipelineStatus]}>
                  {reel.pipelineStatus.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                {reel.claudeModel.split("claude-")[1]?.split("-v")[0] ?? reel.claudeModel}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                {reel.videoModel.split("/")[1] ?? reel.videoModel}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground text-xs tabular-nums">
                {reel.costUsd != null ? `$${reel.costUsd.toFixed(4)}` : "—"}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground text-xs tabular-nums">
                {new Date(reel.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/dashboard/pipeline/${reel.id}`)}
                  >
                    View
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this reel?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &ldquo;{reel.topic}&rdquo; and everything it generated will be gone for good.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deletePipeline(reel.id)}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {page} of {data.totalPages} &middot; {data.totalItems} reel{data.totalItems !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || isFetching}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.totalPages || isFetching}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
