import { adjectives, colors, uniqueNamesGenerator, type Config } from "unique-names-generator";

export type GenerateNameOptions = Partial<
  Pick<Config, "dictionaries" | "length" | "separator" | "style">
>;

export function generateName(options: GenerateNameOptions = {}): string {
  return uniqueNamesGenerator({
    dictionaries: options.dictionaries ?? [adjectives, colors],
    length: options.length ?? 2,
    separator: options.separator ?? "-",
    style: options.style,
  });
}
