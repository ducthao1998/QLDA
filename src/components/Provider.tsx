// app/Providers.tsx
"use client"

import { ReactNode, useState } from "react"
import { SessionContextProvider } from "@supabase/auth-helpers-react"
import { ThemeProvider } from "next-themes"
import { createBrowserClient } from "@supabase/ssr"

export function Providers({ children }: { children: ReactNode }) {
  // Tạo 1 client Supabase duy nhất
  const [supabaseClient] = useState(() => createBrowserClient( process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!))

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <SessionContextProvider supabaseClient={supabaseClient}>
        {children}
      </SessionContextProvider>
    </ThemeProvider>
  )
}
