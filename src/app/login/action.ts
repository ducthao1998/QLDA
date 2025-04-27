// app/login/actions.ts
"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

// This runs on the server, has access to cookies, can set them for you
export async function login(formData: FormData) {
  const supabase = createClient()
  const email    = formData.get("email")    as string
  const password = formData.get("password") as string
  const { error } = await (await supabase).auth.signInWithPassword({ email, password })
  if (error) {
    return { error };
  }
  return {};
}
