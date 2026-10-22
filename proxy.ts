import { NextRequest, NextResponse } from "next/server";
import { isPrivatePage } from "@/lib/private-pages";
import { SESSION_COOKIE, DOCUMENT_ENTRY_COOKIE, parseSessionValue, documentEntryValue, clearDocumentEntry, clearSessionCookie } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!isPrivatePage(pathname) && pathname !== "/login") return NextResponse.next();
  // App Router navigation and silent refreshes are not new browser documents.
  const documentRequest = request.method === "GET" && (request.headers.get("sec-fetch-dest") === "document" || (request.headers.get("rsc") !== "1" && request.headers.get("accept")?.includes("text/html")));
  if (!documentRequest) return NextResponse.next();

  const value = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await parseSessionValue(value);
  if (pathname !== "/login" && session && value && request.cookies.get(DOCUMENT_ENTRY_COOKIE)?.value === await documentEntryValue(value)) {
    const response = NextResponse.next();
    clearDocumentEntry(response);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  if (pathname === "/login") {
    // Remove stale credentials from this render as well as from the browser.
    const headers = new Headers(request.headers);
    request.cookies.delete(SESSION_COOKIE);
    request.cookies.delete(DOCUMENT_ENTRY_COOKIE);
    headers.set("cookie", request.cookies.toString());
    const loginResponse = NextResponse.next({ request: { headers } });
    clearSessionCookie(loginResponse);
    loginResponse.headers.set("Cache-Control", "private, no-store");
    return loginResponse;
  }
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  const origin = host ? `${protocol}://${host}` : request.nextUrl.origin;
  const response = NextResponse.redirect(new URL(value ? "/login?expired=1" : "/login", origin));
  clearSessionCookie(response);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!api|_next|.*\\.[^/]+$).*)"] };
