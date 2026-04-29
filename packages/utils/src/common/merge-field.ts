import { createDefu, defu } from "defu";

export type DeepPartial<T> = T extends readonly (infer Item)[]
  ? DeepPartial<Item>[]
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> }
    : T;

export type MergeFieldsOptions = {
  arrayStrategy?: "replace" | "concat";
};

const replaceArrayDefu = createDefu((target, key, value) => {
  if (Array.isArray(target[key]) && Array.isArray(value)) {
    target[key] = value;
    return true;
  }
});

export function mergeFields<T extends object>(
  target: T,
  patch: DeepPartial<T>,
  options: MergeFieldsOptions = {},
): T {
  const merge = options.arrayStrategy === "concat" ? defu : replaceArrayDefu;
  return merge(patch as Record<PropertyKey, unknown>, target) as T;
}
