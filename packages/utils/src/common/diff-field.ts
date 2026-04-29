import diff, { type Difference } from "microdiff";

export type FieldDiff<T extends object> = Partial<T>;

export function diffFields<T extends object>(previous: T, next: Partial<T>): FieldDiff<T> {
  const result: FieldDiff<T> = {};

  for (const change of diff(previous, next) as Difference[]) {
    const [key, ...restPath] = change.path;
    if (restPath.length > 0 || typeof key !== "string") continue;

    if (change.type === "REMOVE") {
      result[key as keyof T] = undefined;
      continue;
    }

    result[key as keyof T] = change.value as T[keyof T];
  }

  return result;
}
