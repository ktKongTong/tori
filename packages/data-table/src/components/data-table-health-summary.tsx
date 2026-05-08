import { DataTableStatus } from "./data-table-status";
import type { DataTableStatusTone } from "../types";

export function DataTableHealthSummary({
  status,
  tone = "neutral",
  reason,
  impact,
}: {
  status: string;
  tone?: DataTableStatusTone;
  reason?: string | null;
  impact?: string | null;
}) {
  return (
    <div className="space-y-2">
      <DataTableStatus text={status} tone={tone} />
      {reason || impact ? (
        <div className="max-w-sm space-y-1 text-xs leading-5 text-muted-foreground">
          {reason ? <p>{reason}</p> : null}
          {impact ? <p>{impact}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
