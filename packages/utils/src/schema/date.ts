import { z } from "zod";

export const dateToIsoDatetime = z.codec(z.iso.datetime(), z.date(), {
  encode: (date) => date.toISOString(),
  decode: (isoString) => new Date(isoString),
});

export const isoDatetimeToDate = z.codec(z.date(), z.iso.datetime(), {
  decode: (date) => date.toISOString(),
  encode: (isoString) => new Date(isoString),
});
