import { v7 as uuidv7 } from "uuid";

export function uniqueId(): string {
  return uuidv7();
}
