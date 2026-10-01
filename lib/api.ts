import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ServiceError } from "@/lib/invoice/service";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(message: string, status = 400, code = "bad_request") {
  return NextResponse.json({ ok: false, error: { message, code } }, { status });
}

/** Uniform error handling — raw internals are logged, never returned. */
export function handleApiError(error: unknown, context: string) {
  if (error instanceof ZodError) {
    const first = error.errors[0];
    const field = first?.path?.join(".") ?? "";
    return jsonError(field ? `${field}: ${first?.message}` : (first?.message ?? "Invalid input"), 422, "validation");
  }
  if (error instanceof ServiceError) {
    return jsonError(error.message, error.status, error.code);
  }
  console.error(`[api] ${context} failed:`, error);
  return jsonError("Something went wrong on our side. Please try again.", 500, "server_error");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ServiceError("Malformed request body.", 400);
  }
}
