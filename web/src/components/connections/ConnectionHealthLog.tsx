import { logEntries } from "@/components/connections/data";

export default function ConnectionHealthLog() {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Connection Health Log
      </h2>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Pipeline ID</th>
              <th className="text-left px-4 py-3 font-medium">Platform</th>
              <th className="text-left px-4 py-3 font-medium">Event</th>
              <th className="text-left px-4 py-3 font-medium">Timestamp</th>
              <th className="text-left px-4 py-3 font-medium">Status Code</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logEntries.map((entry) => (
              <tr key={entry.pipelineId} className="bg-card hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.pipelineId}</td>
                <td className="px-4 py-3">{entry.platform}</td>
                <td className="px-4 py-3 text-muted-foreground">{entry.event}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.timestamp}</td>
                <td className={`px-4 py-3 font-mono text-xs font-semibold ${entry.statusColor}`}>{entry.statusCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
