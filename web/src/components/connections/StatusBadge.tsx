import { Clock } from "lucide-react";
import type { ConnectionStatus } from "@/components/connections/types";

export default function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        CONNECTED
      </span>
    );
  }
  if (status === "review_pending") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">
        <Clock className="w-3 h-3" />
        REVIEW PENDING
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
      DISCONNECTED
    </span>
  );
}
