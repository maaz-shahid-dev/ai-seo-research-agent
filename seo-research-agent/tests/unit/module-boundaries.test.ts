import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Server code may render client components, but any other value imported
 * from a "use client" module arrives as a client reference, not the value
 * (e.g. an array without .includes). Only PascalCase components may cross.
 */
const SRC = join(process.cwd(), "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

const isClient = (path: string) => /^\s*["']use client["']/.test(readFileSync(path, "utf8"));

function resolve(specifier: string) {
  const base = join(SRC, specifier.slice(2));
  return [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find((candidate) => existsSync(candidate)) ?? null;
}

describe("server and client module boundaries", () => {
  it("server files import only components from client modules", () => {
    const problems: string[] = [];
    const serverFiles = [...files(join(SRC, "app")), ...files(join(SRC, "server"))].filter((path) => !isClient(path));
    for (const file of serverFiles) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/^import\s+(?!type\b)\{([^}]+)\}\s+from\s+"(@\/[^"]+)";/gm)) {
        const target = resolve(match[2]!);
        if (!target || !isClient(target)) continue;
        const names = match[1]!.split(",").map((name) => name.trim()).filter((name) => name && !name.startsWith("type "));
        for (const name of names) {
          if (!/^[A-Z][a-z]/.test(name)) problems.push(`${file.slice(SRC.length + 1)} imports ${name} from ${match[2]}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
