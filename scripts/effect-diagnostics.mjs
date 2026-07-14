import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

// Effect LS diagnostics ratchet.
// Runs @effect/language-service `diagnostics` on every Effect-adopting package,
// then fails ONLY on findings whose rule name is listed in config/effect-diagnostics.json
// `enforcedRules` (any severity). Everything else is reported informationally.
// Decoupled from the CLI exit code (which counts errors) so per-rule gating is uniform.
// Requires a compiled tree: cross-package imports resolve to `unknown` (TS2307) without
// `out/*.d.ts`, spawning phantom findings — the wireit `dependencies: ["compile"]` guarantees it.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'node_modules', '@effect', 'language-service', 'cli.js');
const configPath = path.join(repoRoot, 'config', 'effect-diagnostics.json');

const enforcedRules = JSON.parse(fs.readFileSync(configPath, 'utf8')).enforcedRules;
const enforcedSet = new Set(enforcedRules);

// Discover packages: an Effect dependency + a tsconfig + at least one src .ts file.
const packageJsonPaths = (await glob('packages/*/package.json', { cwd: repoRoot })).sort();

const hasEffectDep = pkg => {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Object.keys(deps).some(name => name === 'effect' || name.startsWith('@effect/'));
};

const discoveredPackages = packageJsonPaths.flatMap(relPkgJson => {
  const pkgDir = path.join(repoRoot, path.dirname(relPkgJson));
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, relPkgJson), 'utf8'));
  const tsconfig = path.join(pkgDir, 'tsconfig.json');
  const hasTsconfig = fs.existsSync(tsconfig);
  const hasSrcTs = fs.existsSync(path.join(pkgDir, 'src')) && glob.sync('src/**/*.ts', { cwd: pkgDir }).length > 0;
  return hasEffectDep(pkg) && hasTsconfig && hasSrcTs ? [{ name: path.basename(pkgDir), tsconfig }] : [];
});

// Run the CLI per package; parse JSON. On NoFilesToCheckError / nonzero-without-JSON, skip with a note.
const runPackage = ({ name, tsconfig }) => {
  const result = spawnSync('node', [cli, 'diagnostics', '--project', tsconfig, '--format', 'json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const parsed = (() => {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return undefined;
    }
  })();
  return parsed === undefined
    ? { name, skipped: true, reason: (result.stderr || result.stdout || `exit ${result.status}`).trim().split('\n')[0] }
    : { name, diagnostics: parsed.diagnostics ?? [] };
};

const results = discoveredPackages.map(runPackage);

const skipped = results.filter(r => r.skipped);
const violations = results
  .filter(r => !r.skipped)
  .flatMap(r => r.diagnostics.filter(d => enforcedSet.has(d.name)));

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

skipped.forEach(r => console.log(`skip ${r.name}: ${r.reason}`));

violations.forEach(d =>
  console.log(
    isGithubActions
      ? `::error file=${d.file},line=${d.line},col=${d.column}::${d.name} ${d.message}`
      : `${d.file}:${d.line}:${d.column} ${d.name} — ${d.message}`
  )
);

console.log(`${enforcedRules.length} rules enforced${enforcedRules.length > 0 ? ` (${enforcedRules.join(', ')})` : ''}`);
console.log(`${discoveredPackages.length} packages checked, ${skipped.length} skipped, ${violations.length} enforced violation(s)`);

process.exit(violations.length > 0 ? 1 : 0);
