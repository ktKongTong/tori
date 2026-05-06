import { createRequestClient } from "@repo/request";
import { z } from "zod";

const routeInventoryItemSchema = z.object({
  group: z.string(),
  path: z.string(),
  status: z.enum(["ready", "planned"]),
  note: z.string(),
});

const readinessItemSchema = z.object({
  system: z.string(),
  status: z.enum(["ready", "planned", "in-progress"]),
  note: z.string(),
});

export const dashboardOverviewSchema = z.object({
  generatedAt: z.string(),
  routeInventory: z.array(routeInventoryItemSchema),
  readiness: z.array(readinessItemSchema),
});

const dashboardRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

export const getOverview = () =>
  dashboardRequest.get("/api/dashboard/demo/overview", { schema: dashboardOverviewSchema });
