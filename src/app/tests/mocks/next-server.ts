/**
 * Vitest mock for `next/server` used by the API route handler tests.
 *
 * Next.js is not installed in this repository, so the routes (which import
 * `next/server` lazily to build responses) run against this mock. It
 * implements the one piece of surface the routes need — `NextResponse.json`
 * — by returning a minimal, structural stand-in for a `Response`
 * (`{ status, json() }`), which is all the tests assert on.
 */
export const NextResponse = {
  json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    const payload = JSON.stringify(body);
    return {
      status: init?.status ?? 200,
      headers: init?.headers,
      json: async () => JSON.parse(payload) as unknown,
    };
  },
};

export default { NextResponse };
