// app/Providers.tsx
"use client"

import { ReactNode, useState } from "react"
import { SessionContextProvider } from "@supabase/auth-helpers-react"
import { ThemeProvider } from "next-themes"
import { createClient } from "@/lib/supabase/client"

export function Providers({ children }: { children: ReactNode }) {
  // Tạo 1 client Supabase duy nhất
  const [supabaseClient] = useState(() => createClient())

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
