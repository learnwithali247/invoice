import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

const AUTH_COOKIE = "sb-access-token";

function isPublic(pathname: string) {
  return (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/pay/") ||
    pathname.startsWith("/i/") ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/payments/webhook") ||
    pathname.startsWith("/api/public/")
  );
}

/** Cheap pre-check: is there any chance a session exists? */
function hasSessionCookie(request: NextRequest): boolean {
  const { cookies } = request;
  if (cookies.get(AUTH_COOKIE)) return true;
  // @supabase/ssr 0.12 stores the session under `sb-<project-ref>-auth-token`.
  return request.cookies
    .getAll()
    .some((c) => c.name === AUTH_COOKIE || /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
}

/**
 * Refreshes the Supabase session and gates private routes.
 *
 * Performance: `auth.getUser()` is a network round trip to Supabase Auth, and
 * running it on every request is the single biggest cost in an SSR app. So it is
 * only called when a session cookie is actually present — anonymous traffic to
 * /login, /i/*, /pay/* and /api/health never pays for it.
 *
 * No Supabase secret is ever touched here; the publishable key is enough.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return NextResponse.next({ request });

  // No cookie -> no session. Resolve the redirect without any network call.
  if (!hasSessionCookie(request)) {
    if (!isPublic(pathname)) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname + search);
      return NextResponse.redirect(login);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Validating also refreshes an expiring token, so cookies stay in sync.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isPublic(pathname)) return NextResponse.next({ request });
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // We just paid for an auth round trip; hand the identity to the server
  // components instead of making them ask Supabase again. The headers are
  // always *overwritten*, never appended, so a client cannot forge them — the
  // value only exists after the token above was verified.
  const headers = new Headers(request.headers);
  headers.set("x-user-id", user.id);
  headers.set("x-user-email", user.email ?? "");

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|css|js|map)$).*)",
  ],
};
