"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, a non-zero staleTime avoids refetching on the client
        // immediately after the server already fetched.
        staleTime: 60 * 1000,
      },
    },
  })
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState keeps the client stable across re-renders without sharing it
  // between users on the server.
  const [queryClient] = useState(makeQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
