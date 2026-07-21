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

export default function UserReelsTable() {
  const navigate = useNavigate();
  const { data, isPending, error } = useGetReelsOfUser();
  const { mutate: deletePipeline, isPending: isDeleting } = useDeletePipeline();

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
            <TableHead>Model</TableHead>
            <TableHead>Created</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.reels.map((reel) => (
            <TableRow key={reel.id}>
              <TableCell className="font-medium">{reel.topic}</TableCell>
              <TableCell>
                <Badge variant={PIPELINE_STATUS_VARIANT[reel.pipelineStatus]}>
                  {reel.pipelineStatus.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {reel.claudeModel.split("claude-")[1]?.split("-v")[0] ?? reel.claudeModel}
              </TableCell>
              <TableCell className="text-muted-foreground">
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
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete pipeline?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &ldquo;{reel.topic}&rdquo; and all its generated content. This action cannot be undone.
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
      <p className="text-xs text-muted-foreground text-right">
        {data.totalItems} reel{data.totalItems !== 1 ? "s" : ""} &middot; page{" "}
        {data.currentPage} of {data.totalPages}
      </p>
    </div>
  );
}
