import { NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Not allowed") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const parts = cookieHeader.split(/;\s*/);
    for (const part of parts) {
      if (part.startsWith("__session=")) {
        const token = decodeURIComponent(part.split("=")[1] || "");
        if (token) return token;
      }
    }
  }

  const fallback = req.headers.get("x-firebase-auth");
  if (fallback) {
    const token = fallback.trim();
    if (token) return token;
  }

  return null;
}

export async function requireUser(req: NextRequest): Promise<DecodedIdToken> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new UnauthorizedError();
  }

  try {
    const auth = await getAdminAuth();
    return await auth.verifyIdToken(token, true);
  } catch (error) {
    console.error("Failed to verify Firebase ID token", error);
    throw new UnauthorizedError();
  }
}

export async function optionalUser(req: NextRequest): Promise<DecodedIdToken | null> {
  try {
    return await requireUser(req);
  } catch (error) {
    if (error instanceof UnauthorizedError) return null;
    throw error;
  }
}
