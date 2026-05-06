import { useEffect } from "react";
import { toast } from "sonner";

type ToastErrorOptions = {
  title?: string;
};

export function useToastError(error: unknown, options: ToastErrorOptions = {}) {
  useEffect(() => {
    if (!(error instanceof Error)) return;

    toast.error(options.title ?? "Request failed", {
      description: error.message,
    });
  }, [error, options.title]);
}
