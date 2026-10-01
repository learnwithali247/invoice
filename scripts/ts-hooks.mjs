/**
 * Loader hooks so `node --experimental-strip-types` can run the TypeScript
 * sources in `lib/` directly, resolving the extensionless relative imports and
 * the `@/` path alias that a bundler would normally handle.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CANDIDATES = ["", ".ts", ".tsx", "/index.ts"];

/** Project root, derived from this file's location. */
const ROOT = new URL("../", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    let base;

    if (specifier.startsWith("@/")) {
      // tsconfig paths: "@/*" -> "./*"
      base = new URL(`./${specifier.slice(2)}`, ROOT);
    } else if (specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/")) {
      if (!context.parentURL) throw error;
      base = new URL(specifier, context.parentURL);
    } else {
      throw error;
    }

    for (const suffix of CANDIDATES) {
      const candidate = new URL(base.href + suffix);
      if (!existsSync(fileURLToPath(candidate))) continue;
      return {
        url: candidate.href,
        shortCircuit: true,
        format: "module-typescript",
      };
    }
    throw error;
  }
}

