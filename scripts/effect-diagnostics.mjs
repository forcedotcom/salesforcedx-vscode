import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

// Effect LS diagnostics ratchet.
// Runs @effect/language-service `diagnostics` on one package directory (argv),
// then fails ONLY on findings whose rule name is listed in config/effect-diagnostics.json
// `enforcedRules` (any severity). Everything else is reported informationally.
// Decoupled from the CLI exit code (which counts errors) so per-rule gating is uniform.
// A CLI invocation that can't be parsed as JSON for any reason other than an empty-package
// NoFilesToCheckError fails the gate — a broken run must never silently drop enforced findings.
// Requires a compiled tree: cross-package imports resolve to `unknown` (TS2307) without
// `out/*.d.ts`, spawning phantom findings — the wireit `dependencies: ["compile"]` guarantees it.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'node_modules', '@effect', 'language-service', 'cli.js');
const configPath = path.join(repoRoot, 'config', 'effect-diagnostics.json');

const packageDirArg = process.argv[2];
if (packageDirArg === undefined) {
  console.error('usage: node scripts/effect-diagnostics.mjs <package-dir>');
  process.exit(1);
}

const pkgDir = path.resolve(process.cwd(), packageDirArg);
const name = path.basename(pkgDir);
const tsconfig = path.join(pkgDir, 'tsconfig.json');

const enforcedRules = JSON.parse(fs.readFileSync(configPath, 'utf8')).enforcedRules;
if (!Array.isArray(enforcedRules)) {
  console.error(
    `config/effect-diagnostics.json: "enforcedRules" must be an array of rule names (got ${JSON.stringify(enforcedRules)})`
  );
  process.exit(1);
}
const enforcedSet = new Set(enforcedRules);
// --lspconfig replaces the project's Effect plugin config; enable off-by-default rules
// here without pinning them in tsconfig.common.json (which also affects editor/tsc).
const lspConfig = JSON.stringify({
  diagnosticSeverity: Object.fromEntries(enforcedRules.map(name => [name, 'error']))
});

// Per-package CLI budget: bound a hung/runaway invocation instead of hanging the whole CI job.
const perPackageTimeoutMs = 5 * 60 * 1000;

// Run the CLI; parse JSON.
// - Valid JSON -> diagnostics.
// - NoFilesToCheckError (a package with no analyzable files) -> benign skip.
// - Anything else (crash, timeout, maxBuffer overflow, non-JSON output) -> hard failure
//   that fails the gate, so a broken invocation can never silently drop enforced findings.
const runPackage = () => {
  const result = spawnSync(
    'node',
    [cli, 'diagnostics', '--project', tsconfig, '--format', 'json', '--lspconfig', lspConfig],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: perPackageTimeoutMs
    }
  );
  const parsed = (() => {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return undefined;
    }
  })();
  if (parsed !== undefined) return { name, diagnostics: parsed.diagnostics ?? [] };
  const rawError = (result.stderr || result.stdout || '').trim();
  const benignSkip = result.error === undefined && rawError.includes('NoFilesToCheckError');
  return benignSkip
    ? { name, skipped: true, reason: rawError.split('\n')[0] || 'NoFilesToCheckError' }
    : {
        name,
        failed: true,
        detail: rawError || (result.error ? `${result.error.code ?? result.error.message}` : `exit ${result.status}`)
      };
};

const result = runPackage();
const skipped = result.skipped ? [result] : [];
const failed = result.failed ? [result] : [];
const violations =
  result.skipped || result.failed
    ? []
    : result.diagnostics.filter(
        d => enforcedSet.has(d.name) && !(d.name === 'extendsNativeError' && d.file.endsWith('.d.ts'))
      );

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

skipped.forEach(r => console.log(`skip ${r.name}: ${r.reason}`));

failed.forEach(r =>
  console.log(
    isGithubActions
      ? `::error::effect-diagnostics failed to run on ${r.name}: ${r.detail}`
      : `FAIL ${r.name}: ${r.detail}`
  )
);

violations.forEach(d =>
  console.log(
    isGithubActions
      ? `::error file=${d.file},line=${d.line},col=${d.column}::${d.name} ${d.message}`
      : `${d.file}:${d.line}:${d.column} ${d.name} — ${d.message}`
  )
);

console.log(
  `${enforcedRules.length} rules enforced${enforcedRules.length > 0 ? ` (${enforcedRules.join(', ')})` : ''}`
);
console.log(
  `1 package checked, ${skipped.length} skipped, ${failed.length} failed, ${violations.length} enforced violation(s)`
);

process.exit(violations.length > 0 || failed.length > 0 ? 1 : 0);
