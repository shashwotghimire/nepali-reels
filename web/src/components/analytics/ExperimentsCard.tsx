import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Experiment } from "@/types/api/analytics-api.types";

interface Props {
  experiments: Experiment[];
}

export function ExperimentsCard({ experiments }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Experiments</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {experiments.map((e, i) => (
          <div key={i} className="py-3 space-y-1">
            <p className="text-sm font-medium">{e.hypothesis}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Variable:</span> {e.variable} —{" "}
              <span className="font-medium">How:</span> {e.how}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
