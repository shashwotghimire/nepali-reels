import { CheckCircle, Clock, XCircle } from "lucide-react";

export default function ConstraintIcon({ type }: { type: "check" | "warning" | "none" }) {
  if (type === "check") return <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />;
  if (type === "warning") return <Clock className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />;
  return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />;
}
