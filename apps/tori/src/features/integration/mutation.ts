import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  connectionCreatedDtoSchema,
  type CreateConnectionDto,
} from "@/api/modules/platform/connection/contract";
import { toast } from "sonner";
import { createRequestClient } from "@repo/request";

const connectionRequest = createRequestClient({
  credentials: "include",
  headers: { accept: "application/json" },
});

export const useCreateConnection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateConnectionDto) =>
      connectionRequest.post("/api/integration/connections", data, {
        schema: connectionCreatedDtoSchema,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration", "connections"] });
      toast.success("Connection created successfully");
      // onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to create connection", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
};
