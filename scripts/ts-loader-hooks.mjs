// Custom Node ESM resolve hook, registered by register-ts-loader.mjs and used only by
// `pnpm db:seed`. Node's native ESM resolver requires explicit file extensions and has
// no path-alias concept; this hook adds both, mirroring tsconfig.json's "@/*" -> "./*"
// mapping and letting relative imports omit their extension — so scripts/seed.ts (and
// anything under lib/** it imports) can be written in the exact same style as the rest
// of the codebase instead of a special "runnable by node" dialect.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const CANDIDATE_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".json"];

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Given a specifier resolved to a path with no (or the wrong) extension, find the real
 * file on disk: the exact path, then each candidate extension, then `<path>/index.<ext>`. */
function resolveOnDisk(basePath) {
  if (isFile(basePath)) return basePath;
  for (const ext of CANDIDATE_EXTENSIONS) {
    if (isFile(basePath + ext)) return basePath + ext;
  }
  const indexPath = path.join(basePath, "index");
  for (const ext of CANDIDATE_EXTENSIONS) {
    if (isFile(indexPath + ext)) return indexPath + ext;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const onDisk = resolveOnDisk(path.join(PROJECT_ROOT, specifier.slice(2)));
    if (onDisk) return nextResolve(pathToFileURL(onDisk).href, context);
  } else if (specifier.startsWith(".") && context.parentURL) {
    const basePath = fileURLToPath(new URL(specifier, context.parentURL));
    if (existsSync(basePath) || !path.extname(basePath)) {
      const onDisk = resolveOnDisk(basePath);
      if (onDisk) return nextResolve(pathToFileURL(onDisk).href, context);
    }
  }
  // Bare specifiers (node_modules packages like "mysql2"/"zod") and anything we didn't
  // resolve above fall through to Node's default resolution unchanged.
  return nextResolve(specifier, context);
}
