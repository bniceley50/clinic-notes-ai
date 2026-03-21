import { NextResponse } from "next/server";

const NO_STORE_CACHE_CONTROL = "no-store";

export function withNoStoreHeaders(init: ResponseInit = {}): ResponseInit {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", NO_STORE_CACHE_CONTROL);
  return {
    ...init,
    headers,
  };
}

export function jsonNoStore<T>(
  body: T,
  init: ResponseInit = {},
): NextResponse<T> {
  return NextResponse.json(body, withNoStoreHeaders(init));
}
