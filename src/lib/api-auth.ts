import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ApiError(401, "Unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== "admin") {
    throw new ApiError(403, "Forbidden");
  }
  return session;
}

export function handleApiError(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error("API Error:", e);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
