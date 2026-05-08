import type { ReactNode } from "react";

import type { DataTableEmptyState } from "../types";

export function DataTableEmpty({ empty }: { empty: DataTableEmptyState | string }) {
  const state = typeof empty === "string" ? { title: empty } : empty;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-8 text-center">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{state.title}</p>
        {state.description ? (
          <div className="text-sm leading-6 text-muted-foreground">{state.description}</div>
        ) : null}
      </div>
      {state.action ? (
        <div className="flex flex-wrap justify-center gap-2">{state.action}</div>
      ) : null}
    </div>
  );
}

export function DataTableEmptyText({ children }: { children: ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}</span>;
}
