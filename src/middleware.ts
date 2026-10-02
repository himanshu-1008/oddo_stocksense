import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "stocksense_session";

const PUBLIC_PAGES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-otp",
  "/reset-password",
];

const PUBLIC_API_ROUTES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/auth/verify-otp",
  "/api/auth/reset-password",
  "/api/auth/logout",
  "/api/health",
];

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    "stocksense-default-hackathon-jwt-secret-key-32chars";
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore Next.js internals, static files, and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") // static files like favicon.ico, images
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let isAuthenticated = false;

  if (token) {
    try {
      const secret = getJwtSecret();
      await jwtVerify(token, secret);
      isAuthenticated = true;
    } catch (error) {
      isAuthenticated = false;
    }
  }

  const isPublicPage = PUBLIC_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`)
  );
  const isPublicApi = PUBLIC_API_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isApiRoute = pathname.startsWith("/api");

  // Root redirect handled by page.tsx / dashboard
  if (pathname === "/") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 1. Unauthenticated users trying to access protected routes
  if (!isAuthenticated) {
    if (!isPublicPage && !isPublicApi) {
      if (isApiRoute) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required to access this resource.",
            },
          },
          { status: 401 }
        );
      }

      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/dashboard") {
        loginUrl.searchParams.set("callbackUrl", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Authenticated users trying to access login / signup / password-reset pages
  if (isAuthenticated && isPublicPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
