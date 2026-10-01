import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Turns any thrown value into a short, user-safe message.
 * Never leaks raw server/DB/provider errors to the UI.
 */
export function safeErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (typeof error === "string") {
    const lower = error.toLowerCase();
    if (lower.includes("invalid login")) return "Incorrect email or password.";
    if (lower.includes("already registered") || lower.includes("already been registered"))
      return "An account with that email already exists.";
    if (lower.includes("password should be")) return "Password is too weak. Use at least 8 characters.";
    if (lower.includes("email not confirmed")) return "Please confirm your email address first.";
    if (lower.includes("rate limit") || lower.includes("too many"))
      return "Too many attempts. Please wait a moment and try again.";
    if (lower.includes("fetch failed") || lower.includes("network"))
      return "Network problem. Check your connection and try again.";
    return error.slice(0, 180);
  }
  if (error && typeof error === "object" && "message" in error) {
    return safeErrorMessage(String((error as Error).message), fallback);
  }
  return fallback;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function initials(nameOrEmail: string): string {
  const source = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0] : nameOrEmail;
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * A v4 UUID, safe in any browser context.
 *
 * `crypto.randomUUID()` is only exposed in secure contexts, so fall back to
 * `getRandomValues` (available everywhere, including plain-http LAN previews).
 */
export function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) hex.push(bytes[i].toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

/** Secure, URL-safe random token (128 bits of entropy). */
export function secureToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Absolute origin of this deployment, used to build share / payment links.
 * Prefers the explicit NEXT_PUBLIC_APP_URL, then VERCEL_URL, then localhost.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const vercel = process.env.VERCEL_URL?.trim();
  const base = explicit || (vercel ? `https://${vercel}` : "") || "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  return wrapped;
}
