import type { ReactNode } from "react";

export type DataTableMetadataItem = {
  label: string;
  value: ReactNode;
};

export function DataTableMetadata({ items }: { items: DataTableMetadataItem[] }) {
  const visibleItems = items.filter((item) => item.value !== null && item.value !== undefined);

  if (!visibleItems.length)
    return <span className="text-sm text-muted-foreground">No details</span>;

  return (
    <dl className="grid gap-2 text-sm">
      {visibleItems.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {item.label}
          </dt>
          <dd className="mt-1 break-words text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
