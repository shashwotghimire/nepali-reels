export type ConnectionStatus = "connected" | "review_pending" | "disconnected";

export interface Platform {
  id: string;
  name: string;
  handle: string | null;
  status: ConnectionStatus;
  icon: React.ReactNode;
  iconBg: string;
  constraints: string;
  constraintIcon: "check" | "warning" | "none";
  lastSync?: string;
  actionRequired?: string;
  availableTiers?: string;
}

export interface LogEntry {
  pipelineId: string;
  platform: string;
  event: string;
  timestamp: string;
  statusCode: string;
  statusColor: string;
}
