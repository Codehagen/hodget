import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

/**
 * The attribution boundary — a point-in-time control, not a style rule.
 *
 * `OutcomeData` is the only port in the engine allowed to return facts from
 * after a decision cutoff. That is safe for exactly as long as no analyst can
 * reach it. Analysts are never *handed* one, but nothing stops a future analyst
 * from importing the module and constructing its own — at which point the
 * analyst can read its own future, every backtest silently inflates, and the
 * PIT guarantee `PitMarketData` centralizes becomes a convention again.
 *
 * This test is the enforcement. It cannot be a lint rule: the shared ESLint
 * base registers `eslint-plugin-only-warn`, which downgrades every error in
 * this package to a warning, and the engine's lint script passes no
 * `--max-warnings 0` — so an ESLint rule here is advisory decoration that
 * cannot fail CI. Tests do run unconditionally, so the boundary is real.
 *
 * It walks the **transitive** import graph rather than grepping each analyst
 * file for the word "attribution", because the package barrel (`src/index.ts`)
 * re-exports attribution: `import type { OutcomeData } from "../../index.js"`
 * is a one-line, type-checking, lint-clean route to the same capability and a
 * text match would never see it. A boundary that misses the easiest route is
 * worse than no boundary, because it reads as protection.
 *
 * Four things therefore fail: reaching `src/attribution/` through any chain of
 * relative imports, importing this package by name (`@workspace/engine`, which
 * resolves to the barrel), any import whose specifier is not a plain string
 * literal, and any runtime module load (`require` / `createRequire`) — the last
 * two because an analyst's imports must stay statically resolvable or this
 * check cannot see where they lead.
 *
 * The detector takes its root as a parameter so it can be pointed at a fixture
 * tree containing a deliberate violation. That is what the "bites" suite below
 * does: a boundary asserted only against a clean repo proves the repo is clean,
 * not that the boundary works.
 *
 * **If this test is failing**: the named analyst file must not reach
 * attribution. Whatever it needs, it needs from `MarketData` at its `asOf`, or
 * it does not need it. Do not "fix" this by relaxing the check.
 */

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url))

/**
 * Extensions a NodeNext TypeScript package can execute from. `.mts` and `.cts`
 * are ordinary, resolvable module files — collecting only `.ts` would leave a
 * one-character rename as a way past the whole check.
 */
const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts"]
const TEST_EXTENSIONS = SOURCE_EXTENSIONS.map((extension) => `.test${extension}`)

/** Specifier of `import x from "s"`, `import "s"`, `import("s")`, `export … from "s"`. */
const SPECIFIER = /(?:from|import)\s*\(?\s*(["'`])([^"'`]*)\1/g
/** Every `import(...)` call site, so its argument can be checked for being a plain literal. */
const DYNAMIC_IMPORT = /\bimport\s*\(([^)]*)\)/g
/**
 * Runtime module loading. `createRequire` is available to any ESM file in this
 * repo (an analyst already imports `node:fs`), and `createRequire(import.meta.url)("…")`
 * is a fully working route to attribution that carries no `import` keyword at
 * all. A static scan cannot follow it, so it is refused outright.
 */
const RUNTIME_REQUIRE = /\b(?:createRequire|require)\s*\(/g
/**
 * The only argument shape a static check can follow: one unbroken string
 * literal with no interpolation. Concatenation (`"../attri" + "bution/…"`) and
 * a template hole (`` `../${dir}/…` ``) both name a module this test cannot
 * resolve, so both are refused rather than waved through.
 */
const PLAIN_LITERAL = /^(["'`])(?!.*\$\{)[^"'`]*\1$/
/** This package's own name; importing it pulls in the barrel, hence attribution. */
const SELF_PACKAGE = /^@workspace\/engine(\/|$)/

/**
 * Blank out comments, leaving strings intact.
 *
 * Without this, `import type { OutcomeData } from /* borrowed *␘/ "../../index.js"`
 * slips straight past {@link SPECIFIER}: the regex wants the quote to follow
 * `from` after nothing but whitespace. A comment is legal TypeScript, changes
 * nothing about what the module resolves to, and would have made the boundary
 * decorative.
 *
 * The scanner tracks string and template literals so a `//` inside a URL is not
 * mistaken for a comment, and skips regex literals in the positions where one
 * can legally start. A regex in a position this heuristic does not recognise
 * (e.g. directly after `return`) is treated as division; the cost is a possible
 * missed comment inside that expression, never a false violation.
 */
function stripComments(source: string): string {
  const REGEX_MAY_START = /[(,=:[!&|?{};+\-*%~^<>]/
  let out = ""
  let index = 0
  let previous = ""

  while (index < source.length) {
    const char = source[index] ?? ""
    const next = source[index + 1] ?? ""

    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index++
      out += " "
      continue
    }
    if (char === "/" && next === "*") {
      index += 2
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        // Newlines inside the comment are dropped with it; only the regexes
        // above read this output, and none of them are line-anchored.
        index++
      }
      index += 2
      out += " "
      continue
    }
    if (char === '"' || char === "'" || char === "`") {
      out += char
      index++
      while (index < source.length) {
        const inner = source[index] ?? ""
        out += inner
        index++
        if (inner === "\\") {
          out += source[index] ?? ""
          index++
          continue
        }
        if (inner === char) break
      }
      previous = char
      continue
    }
    if (char === "/" && (previous === "" || REGEX_MAY_START.test(previous))) {
      out += char
      index++
      let inCharacterClass = false
      while (index < source.length) {
        const inner = source[index] ?? ""
        out += inner
        index++
        if (inner === "\\") {
          out += source[index] ?? ""
          index++
          continue
        }
        if (inner === "[") inCharacterClass = true
        else if (inner === "]") inCharacterClass = false
        else if (inner === "/" && !inCharacterClass) break
      }
      previous = "/"
      continue
    }

    out += char
    if (!/\s/.test(char)) previous = char
    index++
  }
  return out
}

/** Every non-test module file under `dir`, recursively. */
export function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...sourceFiles(path))
      continue
    }
    const isSource = SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))
    const isTest = TEST_EXTENSIONS.some((extension) => entry.name.endsWith(extension))
    if (isSource && !isTest) found.push(path)
  }
  return found.sort()
}

/** Map a NodeNext specifier (`./x.js`, `./x.mjs`, `./dir`) back to the file on disk. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  const base = resolve(dirname(fromFile), specifier)
  const stems = [base.replace(/\.[mc]?js$/, ""), base]
  const candidates: string[] = []
  for (const stem of stems) {
    for (const extension of SOURCE_EXTENSIONS) candidates.push(`${stem}${extension}`)
  }
  for (const stem of stems) {
    for (const extension of SOURCE_EXTENSIONS) candidates.push(join(stem, `index${extension}`))
  }
  return (
    candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
  )
}

/**
 * Walk out from the analyst sources under `srcDir` and report every chain that
 * reaches attribution — through the barrel, through this package's own name, or
 * directly. The chain is part of the message: a three-hop route is otherwise
 * very hard to see from a bare file name.
 *
 * `srcDir` is the package's `src`: analysts live at `srcDir/analysts`,
 * attribution at `srcDir/attribution`, the barrel at `srcDir/index.ts`.
 */
export function boundaryViolations(srcDir: string): string[] {
  const analystsDir = join(srcDir, "analysts")
  const attributionDir = join(srcDir, "attribution")
  const barrels = SOURCE_EXTENSIONS.map((extension) => join(srcDir, `index${extension}`))
  const label = (path: string): string => relative(srcDir, path)

  const violations: string[] = []
  const roots = sourceFiles(analystsDir)
  const chains = new Map<string, string[]>(roots.map((file) => [file, [label(file)]]))
  const queue = [...roots]
  const seen = new Set<string>(roots)

  while (queue.length > 0) {
    const file = queue.shift()
    if (!file) break
    const chain = chains.get(file) ?? [label(file)]
    const source = stripComments(readFileSync(file, "utf8"))

    for (const call of source.matchAll(DYNAMIC_IMPORT)) {
      const argument = (call[1] ?? "").trim()
      if (PLAIN_LITERAL.test(argument)) continue
      violations.push(
        `${chain.join(" → ")}: dynamic import with a computed specifier (${JSON.stringify(argument)}) — ` +
          `analyst imports must stay statically resolvable, or this boundary cannot see where they lead`,
      )
    }

    for (const call of source.matchAll(RUNTIME_REQUIRE)) {
      violations.push(
        `${chain.join(" → ")}: runtime module load (${(call[0] ?? "").trim()}) — ` +
          `analyst imports must stay statically resolvable, or this boundary cannot see where they lead`,
      )
    }

    for (const match of source.matchAll(SPECIFIER)) {
      const specifier = match[2]
      if (!specifier) continue

      if (SELF_PACKAGE.test(specifier)) {
        violations.push(
          `${[...chain, specifier].join(" → ")}: an analyst must not import its own package by name — ` +
            `the barrel re-exports attribution`,
        )
        continue
      }
      if (!specifier.startsWith(".")) continue

      const target = resolveSpecifier(file, specifier)
      if (!target) continue

      const next = [...chain, label(target)]
      if (target.startsWith(attributionDir) || barrels.includes(target)) {
        violations.push(
          `${next.join(" → ")}: analysts may never reach OutcomeData, the one port allowed to return ` +
            `data from after a decision cutoff. An analyst that can read its own future silently ` +
            `contaminates every backtest. This is a point-in-time control, not a style rule: take ` +
            `what you need from MarketData at asOf instead.`,
        )
        continue
      }
      if (seen.has(target)) continue
      seen.add(target)
      chains.set(target, next)
      queue.push(target)
    }
  }
  return violations
}

describe("attribution boundary", () => {
  it("scans the analyst sources (a boundary test that scans nothing protects nothing)", () => {
    expect(sourceFiles(join(SRC_DIR, "analysts")).length).toBeGreaterThan(0)
  })

  it("finds no analyst reaching the attribution module, directly or transitively", () => {
    expect(boundaryViolations(SRC_DIR)).toEqual([])
  })

  it("pins the shape of AnalystContext, which no import scan could police", () => {
    // An import graph cannot see a field. If a forward-looking price series, an
    // `OutcomeData`, or a "realized alpha so far" summary were ever inlined onto
    // the context object, every analyst would get look-ahead with no import to
    // find. The only defence is to state the shape and make widening it a
    // deliberate act that fails this test first.
    const types = stripComments(readFileSync(join(SRC_DIR, "types.ts"), "utf8"))
    const body = /export interface AnalystContext \{([^}]*)\}/.exec(types)?.[1]
    if (body === undefined) throw new Error("AnalystContext not found in types.ts")

    const fields = [...body.matchAll(/(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/g)].map(
      (match) => match[1],
    )
    expect(fields).toEqual(["securityId", "asOf", "data"])
    // `data` is the PIT-wrapped port and nothing else.
    expect(body).toMatch(/data:\s*MarketData\b/)
    expect(body).not.toMatch(/Outcome/)
  })
})

/**
 * The detector, pointed at fixture trees that deliberately violate the boundary.
 *
 * Asserting only that the real repo is clean proves the repo is clean; it says
 * nothing about whether the check can tell. Each case here is a route someone
 * could plausibly take — including three the detector used to miss.
 */
describe("attribution boundary — the detector bites", () => {
  const roots: string[] = []

  afterAll(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true })
  })

  /** A miniature `src` tree: barrel, attribution, data, analysts. */
  function tree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "attribution-boundary-"))
    roots.push(root)
    const all: Record<string, string> = {
      "index.ts": 'export * from "./attribution/index.js"\nexport * from "./analysts/index.js"\n',
      "attribution/index.ts": "export interface OutcomeData { readonly forward: number }\n",
      "data/market-data.ts": "export interface MarketData { readonly pit: true }\n",
      "analysts/index.ts": 'export * from "./quant/clean.js"\n',
      "analysts/quant/clean.ts":
        'import type { MarketData } from "../../data/market-data.js"\nexport type Clean = MarketData\n',
      ...files,
    }
    for (const [path, content] of Object.entries(all)) {
      const full = join(root, path)
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, content, "utf8")
    }
    return root
  }

  it("passes a tree whose analysts only reach the PIT market-data port", () => {
    // The control. Without it, a detector that flagged everything would look
    // like a working boundary.
    expect(boundaryViolations(tree({}))).toEqual([])
  })

  it("catches a direct relative import of attribution", () => {
    const violations = boundaryViolations(
      tree({ "analysts/quant/direct.ts": 'import "../../attribution/index.js"\n' }),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain("analysts/quant/direct.ts → attribution/index.ts")
    expect(violations[0]).toContain("point-in-time control, not a style rule")
  })

  it("catches a reach through the package barrel", () => {
    const violations = boundaryViolations(
      tree({
        "analysts/quant/barrel.ts":
          'import type { OutcomeData } from "../../index.js"\nexport type Sneak = OutcomeData\n',
      }),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain("analysts/quant/barrel.ts → index.ts")
  })

  it("catches a reach through the package's own name", () => {
    const violations = boundaryViolations(
      tree({
        "analysts/quant/named.ts": 'import type { OutcomeData } from "@workspace/engine"\n',
      }),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain("must not import its own package by name")
  })

  it("catches a transitive two-hop reach and names the whole chain", () => {
    const violations = boundaryViolations(
      tree({
        "analysts/quant/hop.ts": 'import type { Reached } from "../../helpers/reach.js"\nexport type H = Reached\n',
        "helpers/reach.ts":
          'import type { OutcomeData } from "../attribution/index.js"\nexport type Reached = OutcomeData\n',
      }),
    )
    expect(violations).toHaveLength(1)
    // The chain is the point: a bare file name would send a reader to `hop.ts`,
    // which contains no mention of attribution at all.
    expect(violations[0]).toContain(
      "analysts/quant/hop.ts → helpers/reach.ts → attribution/index.ts",
    )
  })

  it("catches a violation in a .mts or .cts file", () => {
    const violations = boundaryViolations(
      tree({
        "analysts/quant/modern.mts": 'import "../../attribution/index.js"\n',
        "analysts/quant/legacy.cts": 'import "../../attribution/index.js"\n',
      }),
    )
    expect(violations).toHaveLength(2)
    expect(violations.join("\n")).toContain("analysts/quant/legacy.cts")
    expect(violations.join("\n")).toContain("analysts/quant/modern.mts")
  })

  it("catches a specifier hidden behind a comment", () => {
    const violations = boundaryViolations(
      tree({
        "analysts/quant/commented.ts":
          'import type { OutcomeData } from /* just a helper */ "../../attribution/index.js"\nexport type C = OutcomeData\n',
      }),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain("attribution/index.ts")
  })

  it("catches a runtime require, including via createRequire", () => {
    const violations = boundaryViolations(
      tree({
        "analysts/quant/required.ts":
          'import { createRequire } from "node:module"\n' +
          "const load = createRequire(import.meta.url)\n" +
          'export const forward = load("../../attribution/index.js")\n',
      }),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain("runtime module load")
  })

  it("catches a dynamic import with a computed specifier", () => {
    const violations = boundaryViolations(
      tree({
        "analysts/quant/computed.ts":
          'const dir = "attribution"\nexport const load = () => import(`../../${dir}/index.js`)\n',
      }),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain("computed specifier")
  })

  it("does not flag a commented-out import, a URL, or a legitimate node builtin", () => {
    // The comment stripper must not turn ordinary code into violations: a `//`
    // inside a string is not a comment, and `node:fs` is already imported by a
    // real analyst.
    const violations = boundaryViolations(
      tree({
        "analysts/quant/ordinary.ts":
          'import { promises as fs } from "node:fs"\n' +
          '// import "../../attribution/index.js"\n' +
          'export const docs = "https://example.com//attribution/index.js"\n' +
          "export const use = fs\n",
      }),
    )
    expect(violations).toEqual([])
  })

  it("ignores test files, which may legitimately import attribution", () => {
    expect(
      boundaryViolations(
        tree({ "analysts/quant/clean.test.ts": 'import "../../attribution/index.js"\n' }),
      ),
    ).toEqual([])
  })
})
