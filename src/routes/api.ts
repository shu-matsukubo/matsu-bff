import type { Context } from "hono";
import { Hono } from "hono";
import { config } from "../config.js";
import {
  clearSessionCookie,
  requireSession,
  type SessionVariables,
} from "../middleware/session.js";
import { deleteSession } from "../services/sessionStore.js";
import { refreshSession } from "../services/sessionRefresh.js";
import type { Session } from "../types/session.js";

export const apiRoutes = new Hono<{ Variables: SessionVariables }>();

const proxyToBackend = async (
  c: Context,
  session: Session,
): Promise<Response> => {
  const url = new URL(c.req.url);
  const basePath = c.req.path.replace(/^\/api/, "") || "/";
  const pathAndQuery = `${basePath}${url.search}` || "/";

  const targetUrl = `${config.backendApiBaseUrl}${pathAndQuery}`;
  const headers: Record<string, string> = {
    accept: c.req.header("accept") ?? "application/json",
    authorization: `Bearer ${session.accessToken}`,
  };

  const hasBody = !["GET", "HEAD"].includes(c.req.method);
  let body: string | undefined;

  if (hasBody) {
    const text = await c.req.text();

    if (text) {
      headers["content-type"] = "application/json";
      body = text;
    }
  }

  return fetch(targetUrl, {
    method: c.req.method,
    headers,
    body,
  });
};

const forwardBackendResponse = async (
  _c: Context,
  backendResponse: Response,
) => {
  const contentType =
    backendResponse.headers.get("content-type") ??
    "application/json; charset=utf-8";
  const text = await backendResponse.text();

  return new Response(text, {
    status: backendResponse.status,
    headers: { "content-type": contentType },
  });
};

apiRoutes.all("/*", requireSession, async (c) => {
  const sessionId = c.get("sessionId");
  const session = c.get("session");

  let backendResponse = await proxyToBackend(c, session);

  if (backendResponse.status === 401) {
    try {
      const refreshed = await refreshSession(sessionId, session);
      backendResponse = await proxyToBackend(c, refreshed);
    } catch {
      await deleteSession(sessionId);
      clearSessionCookie(c);
      return c.json({ message: "Unauthenticated." }, 401);
    }
  }

  return forwardBackendResponse(c, backendResponse);
});
