#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
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
 *   node scripts/foldStableChangelog.mts --changelog <file> --ref <git-ref> --version <X.Y.Z>
 *     [--date <"Month D, YYYY">]   stable section date. Defaults to the newest folded section's date, which
 *                                  promote-to-prerelease.yml sets to the expected stable ship date, so the build
 *                                  (stable VSIX) and publish (develop history) runs agree whatever day each runs
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

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const HEADER = /^# (\d+\.\d+\.\d+)(?:\s.*)?$/;
const HEADER_DATE = /^# \d+\.\d+\.\d+ - (.+)$/;
const GENERIC_UNDER_THE_HOOD = /^- We made some under the hood changes\. \((.*)\)$/;
const CATEGORY_ORDER = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
const UNDER_THE_HOOD = 'Under the Hood';

const fail: (message: string) => never = message => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

const parseArgs = (argv: string[]) => {
  const opts: { write: boolean } & Record<string, string | boolean | undefined> = { write: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--write') {
      opts.write = true;
    } else if (arg.startsWith('--') && i + 1 < argv.length) {
      opts[arg.slice(2).replaceAll(/-(\w)/g, (_, c: string) => c.toUpperCase())] = argv[++i];
    } else {
      fail(`Unexpected argument: ${arg}`);
    }
  }
  const { changelog, ref, version, date, sectionOut, overlay, fallbackSection } = opts;
  if (typeof changelog !== 'string' || !changelog) fail('--changelog is required');
  if (typeof ref !== 'string' || !ref) fail('--ref is required');
  if (typeof version !== 'string' || !version) fail('--version is required');
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`--version must be X.Y.Z, got ${version}`);
  if (!opts.write && !opts.sectionOut) fail('Pass --write and/or --section-out');
  return {
    changelog,
    ref,
    version,
    write: opts.write,
    date: typeof date === 'string' ? date : undefined,
    sectionOut: typeof sectionOut === 'string' ? sectionOut : undefined,
    overlay: typeof overlay === 'string' ? overlay : undefined,
    fallbackSection: typeof fallbackSection === 'string' ? fallbackSection : undefined
  };
};

type Section = { version: string; lines: string[] };
type Entries = Map<string, Map<string, string[][]>>;

/** Splits changelog text into leading lines and `# X.Y.Z` sections; joining all lines round-trips. */
const splitSections = (text: string) => {
  const lead: string[] = [];
  const sections: Section[] = [];
  for (const line of text.split('\n')) {
    const match = HEADER.exec(line);
    const lastSection = sections.at(-1);
    if (match) sections.push({ version: match[1], lines: [line] });
    else if (lastSection) lastSection.lines.push(line);
    else lead.push(line);
  }
  return { lead, sections };
};

const withTrailingBlank = (lines: string[]) => (lines.at(-1) === '' ? lines : [...lines, '']);

const topSection = (file: string) => splitSections(fs.readFileSync(file, 'utf8')).sections[0];

const isAncestor = (tag: string, ref: string) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', tag, ref], { stdio: 'pipe' });
    return true;
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 1) return false;
    return fail(
      `git merge-base --is-ancestor ${tag} ${ref} failed: ${String(error instanceof Error && 'stderr' in error ? error.stderr : error).trim()}`
    );
  }
};

const classify = (ref: string) => (version: string) => {
  const tags = execFileSync('git', ['tag', '--list', `v${version}-nightly.develop.*`], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  if (tags.length === 0) return 'stop';
  return tags.some(tag => isAncestor(tag, ref)) ? 'fold' : 'keep';
};

/** category -> package ('' when none) -> entries, each entry being a bullet's lines. */
const parseEntries = (section: Section) => {
  const categories: Entries = new Map();
  let category: string | undefined;
  let pkg = '';
  let entry: string[] | undefined;
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
      const packages = categories.get(category) ?? new Map<string, string[][]>();
      categories.set(category, packages);
      const entries = packages.get(pkg) ?? [];
      packages.set(pkg, entries);
      entries.push(entry);
    }
  }
  return categories;
};

const prNumber = (link: string) => Number(/#(\d+)\]/.exec(link)?.[1] ?? Number.MAX_SAFE_INTEGER);

/** Collapses generic "under the hood changes" bullets into one, keeping links unique and ascending. */
const mergeGenericBullets = (entries: string[][]) => {
  const links = entries.flatMap(entry =>
    entry.length === 1 ? (GENERIC_UNDER_THE_HOOD.exec(entry[0])?.[1].split(/, (?=\[)/) ?? []) : []
  );
  if (links.length === 0) return entries;
  const merged = [
    `- We made some under the hood changes. (${[...new Set(links)].toSorted((a, b) => prNumber(a) - prNumber(b)).join(', ')})`
  ];
  const firstGeneric = entries.findIndex(entry => entry.length === 1 && GENERIC_UNDER_THE_HOOD.test(entry[0]));
  const rest = entries.filter(entry => !(entry.length === 1 && GENERIC_UNDER_THE_HOOD.test(entry[0])));
  return [...rest.slice(0, firstGeneric), merged, ...rest.slice(firstGeneric)];
};

const categoryRank = (category: string) => {
  if (category === UNDER_THE_HOOD) return CATEGORY_ORDER.length + 1;
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
};

const renderStableSection = (version: string, date: string, sections: Section[]) => {
  const merged: Entries = new Map();
  for (const section of sections) {
    for (const [category, packages] of parseEntries(section)) {
      const mergedPackages = merged.get(category) ?? new Map<string, string[][]>();
      merged.set(category, mergedPackages);
      for (const [pkg, entries] of packages) {
        mergedPackages.set(pkg, [...(mergedPackages.get(pkg) ?? []), ...entries]);
      }
    }
  }

  const lines = [`# ${version} - ${date}`, ''];
  if (merged.size === 0) lines.push('No customer-facing changes.', '');
  // Stable sort keeps first-seen order among categories outside CATEGORY_ORDER.
  for (const [category, packages] of [...merged.entries()].toSorted(([a], [b]) => categoryRank(a) - categoryRank(b))) {
    lines.push(`## ${category}`, '');
    for (const [pkg, packageEntries] of [...packages.entries()].toSorted(([a], [b]) => a.localeCompare(b))) {
      if (pkg) lines.push(`#### ${pkg}`, '');
      const entries = category === UNDER_THE_HOOD ? mergeGenericBullets(packageEntries) : packageEntries;
      for (const entry of entries) lines.push(...entry, '');
    }
  }
  return lines;
};

const todayUtc = () =>
  new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** --date, else the newest folded section's date, else today (a header without a date). */
const stableDate = (opts: ReturnType<typeof parseArgs>, folded: Section[]) => {
  if (opts.date) return opts.date;
  const fromSection = HEADER_DATE.exec(folded[0].lines[0])?.[1].trim();
  if (fromSection) return fromSection;
  console.log(`# ${folded[0].version} has no date; using today's`);
  return todayUtc();
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
  const folded: Section[] = [];
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
      ? renderStableSection(opts.version, stableDate(opts, folded), folded)
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
    if (folded.length > 0 && stableSection) {
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

if (import.meta.main) {
  main();
}
