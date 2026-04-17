import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['fr', 'en']
const defaultLocale = 'fr'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const token = request.cookies.get('agricollect_token')?.value

  // 1. Vérifier si le pathname a déjà un locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  // 2. Rediriger vers le locale par défaut si absent
  if (!pathnameHasLocale) {
    // Si c'est un asset, on ignore (mais le matcher s'en occupe déjà en théorie)
    if (pathname.includes('.')) return NextResponse.next()
    
    return NextResponse.redirect(
      new URL(`/${defaultLocale}${pathname}`, request.url)
    )
  }

  // 3. Logique d'authentification (basée sur le chemin après le locale)
  const currentLocale = pathname.split('/')[1]
  const pathWithoutLocale = pathname.replace(`/${currentLocale}`, '') || '/'

  const isDashboard = pathWithoutLocale.startsWith('/dashboard')
  const isLogin = pathWithoutLocale === '/login'

  if (isDashboard && !token) {
    return NextResponse.redirect(new URL(`/${currentLocale}/login`, request.url))
  }

  if (isLogin && token) {
    return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    '/((?!_next|api|favicon.ico).*)',
  ],
}
