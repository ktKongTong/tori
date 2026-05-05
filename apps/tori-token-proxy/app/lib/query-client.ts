import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: 0,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
