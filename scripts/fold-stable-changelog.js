#!/usr/bin/env node

/**
 * Folds every pre-release section of the root CHANGELOG.md that a stable release contains into one
 * `# <version> - <date>` section.
 *
 * promote-to-prerelease.yml prepends one section per promoted pre-release, headed with that
 * pre-release's version. A stable release can contain several (e.g. two promotions between stable
 * builds, or a stable built from a patched pre-release), so relabeling only the source nightly's
 * header drops the others' entries.
 *
 * Walking from the top, each `# X.Y.Z` section is classified with git:
 *   - a `vX.Y.Z-nightly.develop.*` tag is an ancestor of --ref: fold it into the stable section
 *   - nightly tags exist but none is an ancestor (a newer pre-release): keep it in place
 *   - no nightly tag (a stable section): stop; everything from here down is shipped history
 *
 * Usage:
 *   node scripts/fold-stable-changelog.js --changelog <file> --ref <git-ref> --version <X.Y.Z> --date <"Month D, YYYY">
 *     [--overlay <file>]           replace the same-version section with this file's top section before folding
 *                                  (picks up polish applied to packages/salesforcedx-vscode/CHANGELOG.md)
 *     [--section-out <file>]       write only the stable section (the stable VSIX's package CHANGELOG.md). Left
 *                                  unchanged if it already starts with `# <version>` (prepared by hand on a
 *                                  startFromRef branch) or if there is nothing to fold
 *     [--write]                    rewrite --changelog with the stable section in place of the folded ones
 *     [--fallback-section <file>]  with --write, insert this file's top section when nothing was folded and it is
 *                                  headed `# <version>` (stable hotfixes whose notes only exist on their branch)
 *
 * Idempotent: if `# <version>` is already in --changelog, --write is a no-op and --section-out uses that section.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');

const HEADER = /^# (\d+\.\d+\.\d+)(?:\s.*)?$/;
const GENERIC_UNDER_THE_HOOD = /^- We made some under the hood changes\. \((.*)\)$/;
const CATEGORY_ORDER = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
const UNDER_THE_HOOD = 'Under the Hood';

const fail = message => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

const parseArgs = argv => {
  const opts = { write: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--write') {
      opts.write = true;
    } else if (arg.startsWith('--') && i + 1 < argv.length) {
      opts[arg.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = argv[++i];
    } else {
      fail(`Unexpected argument: ${arg}`);
    }
  }
  for (const required of ['changelog', 'ref', 'version', 'date']) {
    if (!opts[required]) fail(`--${required} is required`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(opts.version)) fail(`--version must be X.Y.Z, got ${opts.version}`);
  if (!opts.write && !opts.sectionOut) fail('Pass --write and/or --section-out');
  return opts;
};

/** Splits changelog text into leading lines and `# X.Y.Z` sections; joining all lines round-trips. */
const splitSections = text => {
  const lead = [];
  const sections = [];
  for (const line of text.split('\n')) {
    const match = HEADER.exec(line);
    if (match) sections.push({ version: match[1], lines: [line] });
    else if (sections.length > 0) sections.at(-1).lines.push(line);
    else lead.push(line);
  }
  return { lead, sections };
};

const withTrailingBlank = lines => (lines.at(-1) === '' ? lines : [...lines, '']);

const topSection = file => splitSections(fs.readFileSync(file, 'utf8')).sections[0];

const isAncestor = (tag, ref) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', tag, ref], { stdio: 'pipe' });
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    return fail(`git merge-base --is-ancestor ${tag} ${ref} failed: ${String(error.stderr).trim()}`);
  }
};

const classify = ref => version => {
  const tags = execFileSync('git', ['tag', '--list', `v${version}-nightly.develop.*`], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  if (tags.length === 0) return 'stop';
  return tags.some(tag => isAncestor(tag, ref)) ? 'fold' : 'keep';
};

/** category -> package ('' when none) -> entries, each entry being a bullet's lines. */
const parseEntries = section => {
  const categories = new Map();
  let category;
  let pkg = '';
  let entry;
  for (const line of section.lines.slice(1)) {
    if (line.startsWith('## ')) {
      category = line.slice(3).trim();
      pkg = '';
      entry = undefined;
    } else if (line.startsWith('#### ')) {
      pkg = line.slice(5).trim();
      entry = undefined;
    } else if (line.trim() === '') {
      entry = undefined;
    } else if (category === undefined) {
      // Free text such as "No customer-facing changes." carries no entries.
    } else if (entry && !line.startsWith('- ')) {
      entry.push(line);
    } else {
      entry = [line];
      if (!categories.has(category)) categories.set(category, new Map());
      const packages = categories.get(category);
      if (!packages.has(pkg)) packages.set(pkg, []);
      packages.get(pkg).push(entry);
    }
  }
  return categories;
};

const prNumber = link => Number(/#(\d+)\]/.exec(link)?.[1] ?? Number.MAX_SAFE_INTEGER);

/** Collapses generic "under the hood changes" bullets into one, keeping links unique and ascending. */
const mergeGenericBullets = entries => {
  const links = entries
    .map(entry => entry.length === 1 && GENERIC_UNDER_THE_HOOD.exec(entry[0]))
    .filter(Boolean)
    .flatMap(match => match[1].split(/, (?=\[)/));
  if (links.length === 0) return entries;
  const merged = [
    `- We made some under the hood changes. (${[...new Set(links)].sort((a, b) => prNumber(a) - prNumber(b)).join(', ')})`
  ];
  const firstGeneric = entries.findIndex(entry => entry.length === 1 && GENERIC_UNDER_THE_HOOD.test(entry[0]));
  const rest = entries.filter(entry => !(entry.length === 1 && GENERIC_UNDER_THE_HOOD.test(entry[0])));
  return [...rest.slice(0, firstGeneric), merged, ...rest.slice(firstGeneric)];
};

const categoryRank = category => {
  if (category === UNDER_THE_HOOD) return CATEGORY_ORDER.length + 1;
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
};

const renderStableSection = (version, date, sections) => {
  const merged = new Map();
  for (const section of sections) {
    for (const [category, packages] of parseEntries(section)) {
      if (!merged.has(category)) merged.set(category, new Map());
      for (const [pkg, entries] of packages) {
        merged.get(category).set(pkg, [...(merged.get(category).get(pkg) ?? []), ...entries]);
      }
    }
  }

  const lines = [`# ${version} - ${date}`, ''];
  if (merged.size === 0) lines.push('No customer-facing changes.', '');
  // Stable sort keeps first-seen order among categories outside CATEGORY_ORDER.
  for (const category of [...merged.keys()].sort((a, b) => categoryRank(a) - categoryRank(b))) {
    lines.push(`## ${category}`, '');
    const packages = merged.get(category);
    for (const pkg of [...packages.keys()].sort((a, b) => a.localeCompare(b))) {
      if (pkg) lines.push(`#### ${pkg}`, '');
      const entries = category === UNDER_THE_HOOD ? mergeGenericBullets(packages.get(pkg)) : packages.get(pkg);
      for (const entry of entries) lines.push(...entry, '');
    }
  }
  return lines;
};

const main = () => {
  const opts = parseArgs(process.argv.slice(2));
  const { lead, sections } = splitSections(fs.readFileSync(opts.changelog, 'utf8'));

  if (opts.overlay) {
    const overlay = topSection(opts.overlay);
    const target = overlay && sections.find(section => section.version === overlay.version);
    if (target) {
      target.lines = withTrailingBlank(overlay.lines);
      console.log(`Overlaid # ${overlay.version} from ${opts.overlay}`);
    }
  }

  const existing = sections.find(section => section.version === opts.version);
  const classifyVersion = classify(opts.ref);
  const folded = [];
  let stopAt = sections.length;
  if (!existing) {
    for (let i = 0; i < sections.length; i++) {
      const kind = classifyVersion(sections[i].version);
      if (kind === 'stop') {
        stopAt = i;
        break;
      }
      if (kind === 'fold') folded.push(sections[i]);
    }
  }

  const stableSection = existing
    ? existing.lines
    : folded.length > 0
      ? renderStableSection(opts.version, opts.date, folded)
      : undefined;
  if (existing) console.log(`# ${opts.version} already in ${opts.changelog}`);
  else if (folded.length > 0)
    console.log(`Folded ${folded.map(section => `# ${section.version}`).join(', ')} into # ${opts.version}`);
  else console.log(`No pre-release sections in ${opts.changelog} are contained in ${opts.ref}`);

  if (opts.sectionOut) {
    const current = fs.existsSync(opts.sectionOut) ? topSection(opts.sectionOut) : undefined;
    if (current?.version === opts.version) {
      console.log(`${opts.sectionOut} already starts with # ${opts.version}; leaving it unchanged`);
    } else if (stableSection) {
      fs.writeFileSync(opts.sectionOut, withTrailingBlank(stableSection).join('\n'), 'utf8');
      console.log(`Wrote # ${opts.version} to ${opts.sectionOut}`);
    } else {
      console.log(`Nothing to fold; leaving ${opts.sectionOut} unchanged`);
    }
  }

  if (opts.write && !existing) {
    let updated;
    if (folded.length > 0) {
      const insertAt = sections.indexOf(folded[0]);
      updated = sections.filter(section => !folded.includes(section));
      updated.splice(insertAt, 0, { version: opts.version, lines: stableSection });
    } else {
      const fallback = opts.fallbackSection ? topSection(opts.fallbackSection) : undefined;
      if (fallback?.version === opts.version) {
        updated = [...sections];
        updated.splice(stopAt, 0, { version: opts.version, lines: withTrailingBlank(fallback.lines) });
        console.log(`Inserted # ${opts.version} from ${opts.fallbackSection}`);
      }
    }
    if (updated) {
      fs.writeFileSync(opts.changelog, [...lead, ...updated.flatMap(section => section.lines)].join('\n'), 'utf8');
      console.log(`Updated ${opts.changelog}`);
    }
  }
};

if (require.main === module) {
  main();
}
