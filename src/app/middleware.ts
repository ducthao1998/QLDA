import { updateSession } from '@/lib/supabase/middleware'
import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Update the session first
  const response = await updateSession(request)
  
  // Get the pathname from the URL
  const pathname = request.nextUrl.pathname
  
  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/auth', '/api/auth']
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route) || pathname === '/'
  )
  
  // Skip authentication check for public routes
  if (isPublicRoute) {
    return response
  }
  
  // Create Supabase client
  const supabase = createClient()
  
  // Check if user is authenticated
  const { data: { user } } = await (await supabase).auth.getUser()
  
  // If no user is found, redirect to login page
  if (!user) {
    const redirectUrl = new URL('/login', request.url)
    // Optionally add the original URL as a query parameter for redirecting back after login
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}