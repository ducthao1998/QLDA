import { NextResponse, type NextRequest } from 'next/server'

export const middleware = async (request: NextRequest) => {
  // Log to server console
  process.stdout.write(`\nDashboard middleware is running for path: ${request.nextUrl.pathname}\n`)
  
  // Always redirect to login for testing
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export default middleware

export const config = {
  matcher: ['/dashboard/:path*']
} 