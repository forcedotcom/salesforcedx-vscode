/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Agent, type ToolName } from '@cursor/sdk';
import * as Command from '@effect/platform/Command';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import * as NodeContext from '@effect/platform-node/NodeContext';
import {
  Array as Arr,
  Config,
  Effect,
  Either,
  Exit,
  HashSet,
  Layer,
  Logger,
  Option,
  pipe,
  Redacted,
  Schema,
  Stream
} from 'effect';
import { isNull, isUndefined } from 'effect/Predicate';
import { pathToFileURL } from 'node:url';

const skillPath = '.cursor/skills/manual-test-plan-judgment/SKILL.md';
const startMarker = '<!-- manual-test-plan -->';
const endMarker = '<!-- /manual-test-plan -->';
const servicesDir = 'salesforcedx-vscode-services';
const servicesIndex = `packages/${servicesDir}/src/index.ts`;
const servicesLayersPath = `packages/${servicesDir}/src/servicesLayers.ts`;
const tools: ToolName[] = [];
const excludedWorkflows = ['e2e.yml', 'playwrightE2EFullSuite.yml', 'rerunPushE2E.yml'] as const;
const languageServers = [
  { dir: 'salesforcedx-aura-language-server', name: '@salesforce/salesforcedx-aura-language-server' },
  { dir: 'salesforcedx-lwc-language-server', name: '@salesforce/salesforcedx-lwc-language-server' },
  { dir: 'salesforcedx-visualforce-language-server', name: '@salesforce/salesforcedx-visualforce-language-server' }
] as const;
const skippedDirs = new Set(['node_modules', 'dist', 'coverage']);

const WatchVideo = Schema.Struct({
  kind: Schema.Literal('watch-video'),
  spec: Schema.NonEmptyString,
  workflow: Schema.NonEmptyString,
  job: Schema.NonEmptyString
});
const ManualItem = Schema.Struct({
  kind: Schema.Literal('manual'),
  step: Schema.NonEmptyString
});
const Item = Schema.Union(WatchVideo, ManualItem);
type Item = typeof Item.Type;
const Nothing = Schema.Struct({ kind: Schema.Literal('nothing') });
const Checklist = Schema.Struct({
  kind: Schema.Literal('checklist'),
  items: Schema.NonEmptyArray(Item)
});
const Judgment = Schema.Union(Nothing, Checklist);
type Judgment = typeof Judgment.Type;

const TextFile = Schema.Struct({
  path: Schema.String,
  text: Schema.String
});
const WorkflowFact = Schema.Struct({
  name: Schema.String,
  jobs: Schema.Array(Schema.String)
});
const PackageFact = Schema.Struct({
  package: Schema.String,
  name: Schema.String,
  diff: Schema.String,
  playwright: Schema.Array(TextFile),
  unitTests: Schema.Array(TextFile),
  workflows: Schema.Array(WorkflowFact)
});
const DependentFact = Schema.Struct({
  package: Schema.String,
  workflow: Schema.optional(Schema.String),
  jobs: Schema.Array(Schema.String),
  specs: Schema.Array(Schema.String),
  excerpt: Schema.optional(Schema.String)
});
type DependentFact = typeof DependentFact.Type;
const Facts = Schema.Struct({
  packages: Schema.Array(PackageFact),
  dependents: Schema.Array(DependentFact)
});
export type Facts = typeof Facts.Type;

const PrBody = Schema.Struct({ body: Schema.NullOr(Schema.String) });
const PackageMeta = Schema.Struct({
  name: Schema.optional(Schema.String),
  dependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  devDependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  optionalDependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
});
type PackageMeta = typeof PackageMeta.Type;

export class CursorRunFailed extends Schema.TaggedError<CursorRunFailed>()('CursorRunFailed', {
  status: Schema.String,
  message: Schema.String
}) {}

class CommandFailed extends Schema.TaggedError<CommandFailed>()('CommandFailed', {
  command: Schema.String,
  code: Schema.Number,
  message: Schema.String
}) {}

class InvalidBaseRef extends Schema.TaggedError<InvalidBaseRef>()('InvalidBaseRef', {
  ref: Schema.String,
  message: Schema.String
}) {}

type Outcome = { readonly edited: boolean };
type WorkflowJob = {
  readonly key: string;
  readonly runs: readonly string[];
  readonly matrix: Readonly<Record<string, readonly string[]>>;
  readonly uploadPaths: readonly string[];
};
export type ParsedWorkflow = { readonly name: string; readonly jobs: readonly WorkflowJob[] };
type ServiceChange =
  | { readonly kind: 'shared' }
  | { readonly kind: 'services'; readonly names: readonly string[] }
  | { readonly kind: 'none' };
type SrcFile = { readonly path: string; readonly text: string };

const messageOf = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const uniqueSorted = (values: readonly string[]) => Arr.fromIterable(HashSet.fromIterable(values)).toSorted();

const baseRefOk = (ref: string) => /^[A-Za-z0-9._/-]+$/.test(ref) && !ref.split('/').includes('..');

export const isLeafE2EWorkflow = (filename: string) =>
  filename.endsWith('E2E.yml') && !excludedWorkflows.some(name => name === filename);

const indentOf = (line: string) => /^ */.exec(line)?.[0].length ?? 0;

const strip = (value: string) => value.trim().replace(/^['"]|['"]$/g, '');

const bracketValues = (raw: string) => {
  const open = raw.indexOf('[');
  const close = raw.indexOf(']');
  return open < 0 || close < open
    ? [strip(raw)].filter(value => value.length > 0)
    : raw
        .slice(open + 1, close)
        .split(',')
        .map(strip)
        .filter(value => value.length > 0);
};

const addValues = (
  record: Readonly<Record<string, readonly string[]>>,
  key: string,
  values: readonly string[]
) => ({
  ...record,
  [key]: [...(record[key] ?? []), ...values]
});

const matrixLines = (lines: readonly string[]) => {
  const start = lines.findIndex(line => /^\s+matrix:\s*$/.test(line));
  const header = lines[start];
  if (start < 0 || header === undefined) return [];
  const indent = indentOf(header);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(line => line.trim() !== '' && indentOf(line) <= indent);
  return end < 0 ? rest : rest.slice(0, end);
};

const parseMatrix = (lines: readonly string[]) =>
  matrixLines(lines).reduce<{
    readonly record: Readonly<Record<string, readonly string[]>>;
    readonly listKey: string | undefined;
  }>(
    (acc, line) => {
      const inline = /^(\s+)([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      const key = inline?.[2];
      const raw = inline?.[3]?.trim();
      if (key !== undefined && raw !== undefined) {
        return raw === '' || raw === '|' || raw === '|-' || raw === '>' || raw === '{'
          ? { record: acc.record, listKey: key }
          : { record: addValues(acc.record, key, bracketValues(raw)), listKey: undefined };
      }
      const item = /^\s+-\s+(.+)$/.exec(line);
      const body = item?.[1];
      if (body === undefined || acc.listKey === undefined) return acc;
      const pair = /^([A-Za-z0-9_-]+):\s*(.+)$/.exec(body);
      return pair?.[1] !== undefined && pair[2] !== undefined
        ? { record: addValues(acc.record, pair[1], [strip(pair[2])]), listKey: acc.listKey }
        : { record: addValues(acc.record, acc.listKey, [strip(body)]), listKey: acc.listKey };
    },
    { record: {}, listKey: undefined }
  ).record;

type RunState = {
  readonly runs: readonly string[];
  readonly block: { readonly indent: number; readonly lines: readonly string[] } | undefined;
};

const acceptRunLine = (state: RunState, line: string): RunState => {
  const started = /^(\s+)(?:- )?run:\s*(.*)$/.exec(line);
  const indent = started?.[1];
  const body = started?.[2];
  if (state.block !== undefined) {
    return line.trim() === '' || indentOf(line) > state.block.indent
      ? { runs: state.runs, block: { indent: state.block.indent, lines: [...state.block.lines, line] } }
      : acceptRunLine({ runs: [...state.runs, state.block.lines.join('\n')], block: undefined }, line);
  }
  if (indent === undefined || body === undefined) return state;
  const marker = body.trim();
  return marker === '|' || marker === '|-' || marker === '>' || marker === '>-' || marker === ''
    ? { runs: state.runs, block: { indent: indent.length, lines: [] } }
    : { runs: [...state.runs, body], block: undefined };
};

const runScripts = (lines: readonly string[]) => {
  const acc = lines.reduce<RunState>(acceptRunLine, { runs: [], block: undefined });
  return acc.block === undefined ? acc.runs : [...acc.runs, acc.block.lines.join('\n')];
};

type UploadState = {
  readonly paths: readonly string[];
  readonly upload: boolean;
  readonly blockIndent: number | undefined;
};

const yamlBlock = (marker: string) => marker === '|' || marker === '|-' || marker === '>' || marker === '>-';

const acceptUploadLine = (state: UploadState, line: string): UploadState =>
  state.blockIndent !== undefined && (line.trim() === '' || indentOf(line) > state.blockIndent)
    ? {
        paths: line.trim() === '' ? state.paths : [...state.paths, strip(line)],
        upload: state.upload,
        blockIndent: state.blockIndent
      }
    : acceptUploadKey(state.blockIndent === undefined ? state : { ...state, blockIndent: undefined }, line);

const acceptUploadKey = (state: UploadState, line: string): UploadState => {
  const upload = (/^\s+- /.test(line) ? false : state.upload) || line.includes('actions/upload-artifact');
  const match = /^(\s+)path:\s*(.*)$/.exec(line);
  const indent = match?.[1];
  const raw = match?.[2];
  const marker = raw?.trim();
  return indent === undefined || marker === undefined
    ? { paths: state.paths, upload, blockIndent: undefined }
    : yamlBlock(marker)
      ? { paths: state.paths, upload, blockIndent: upload ? indent.length : undefined }
      : {
          paths: upload && strip(marker).length > 0 ? [...state.paths, strip(marker)] : state.paths,
          upload,
          blockIndent: undefined
        };
};

const uploadPaths = (lines: readonly string[]) =>
  lines.reduce<UploadState>(acceptUploadLine, { paths: [], upload: false, blockIndent: undefined }).paths;

const jobBlocks = (text: string) =>
  text.split('\n').reduce<{
    readonly inJobs: boolean;
    readonly jobs: readonly { readonly key: string; readonly lines: readonly string[] }[];
  }>((acc, line) => {
    if (!acc.inJobs) return line === 'jobs:' ? { inJobs: true, jobs: acc.jobs } : acc;
    if (/^\S/.test(line)) return { inJobs: false, jobs: acc.jobs };
    const key = /^  ([A-Za-z0-9_-]+):\s*(?:#.*)?$/.exec(line)?.[1];
    if (key !== undefined) return { inJobs: true, jobs: [...acc.jobs, { key, lines: [] }] };
    const last = acc.jobs.at(-1);
    return last === undefined
      ? acc
      : {
          inJobs: true,
          jobs: [...acc.jobs.slice(0, -1), { key: last.key, lines: [...last.lines, line] }]
        };
  }, { inJobs: false, jobs: [] }).jobs;

export const parseWorkflowText = (text: string): Option.Option<ParsedWorkflow> => {
  const raw = text
    .split('\n')
    .find(line => line.startsWith('name:'))
    ?.slice('name:'.length)
    .trim()
    .replace(/^['"]|['"]$/g, '');
  return raw === undefined || raw.length === 0
    ? Option.none()
    : Option.some({
        name: raw,
        jobs: jobBlocks(text).map(job => ({
          key: job.key,
          runs: runScripts(job.lines),
          matrix: parseMatrix(job.lines),
          uploadPaths: uploadPaths(job.lines)
        }))
      });
};

const matrixToken = /^\$\{\{\s*matrix\.([A-Za-z0-9_-]+)\s*\}\}$/;

export const jobReferencesPackage = (job: WorkflowJob, dir: string, npmName: string) =>
  job.uploadPaths.some(uploadPath => uploadPath === `packages/${dir}` || uploadPath.startsWith(`packages/${dir}/`)) ||
  job.runs.some(run =>
    [...run.matchAll(/-w\s+(\$\{\{.*?\}\}|\S+)/g)].some(match => {
      const token = match[1]?.replace(/^['"]|['"]$/g, '');
      const ref = token === undefined ? null : matrixToken.exec(token);
      const key = ref?.[1];
      return token === undefined
        ? false
        : ref === null
          ? token === dir || token === npmName
          : key !== undefined && (job.matrix[key] ?? []).some(value => value === dir || value === npmName);
    })
  );

export const workflowReferencesPackage = (workflow: ParsedWorkflow, dir: string, npmName: string) =>
  workflow.jobs.some(job => jobReferencesPackage(job, dir, npmName));

const workflowRecords = (workflows: readonly ParsedWorkflow[], dir: string, npmName: string) =>
  workflows
    .filter(workflow => workflowReferencesPackage(workflow, dir, npmName))
    .map(workflow => ({ name: workflow.name, jobs: workflow.jobs.map(job => job.key) }));

const specPathsOf = (facts: Facts) => [
  ...facts.packages.flatMap(pkg => pkg.playwright.map(spec => spec.path)),
  ...facts.dependents.flatMap(dependent => dependent.specs)
];

const workflowsOf = (facts: Facts) => [
  ...facts.packages.flatMap(pkg => pkg.workflows),
  ...facts.dependents.flatMap(dependent =>
    dependent.workflow === undefined ? [] : [{ name: dependent.workflow, jobs: dependent.jobs }]
  )
];

const watchVideoBinds = (item: Item, facts: Facts) => {
  if (item.kind !== 'watch-video') return true;
  const workflow = workflowsOf(facts).find(candidate => candidate.name === item.workflow);
  return specPathsOf(facts).includes(item.spec) && workflow !== undefined && workflow.jobs.includes(item.job);
};

export const bindJudgment = (judgment: Judgment, facts: Facts) =>
  judgment.kind === 'nothing'
    ? judgment
    : pipe(
        judgment.items.filter(item => watchVideoBinds(item, facts)),
        items => (items.length === 0 ? undefined : { kind: 'checklist' as const, items })
      );

const itemLine = (item: Item) =>
  item.kind === 'watch-video'
    ? `- [ ] Watch video: \`${item.spec}\` in \`${item.workflow}\` (\`${item.job}\`)`
    : `- [ ] ${item.step}`;

export const renderManualTestPlan = (bound: NonNullable<ReturnType<typeof bindJudgment>>) => {
  const body = bound.kind === 'nothing' ? 'Nothing worth manually testing.' : bound.items.map(itemLine).join('\n');
  return `${startMarker}\n## Manual test plan\n\n${body}\n${endMarker}`;
};

export const spliceManualTestPlan = (body: string, block: string) => {
  const start = body.indexOf(startMarker);
  const end = body.indexOf(endMarker);
  return start >= 0 && end > start
    ? `${body.slice(0, start)}${block}${body.slice(end + endMarker.length)}`
    : body.length === 0
      ? `${block}\n`
      : `${body}${body.endsWith('\n') ? '\n' : '\n\n'}${block}\n`;
};

const dirnamePosix = (file: string) => file.split('/').slice(0, -1).join('/');

const normalizePosix = (parts: readonly string[]) =>
  parts.reduce<readonly string[]>(
    (stack, part) => (part === '' || part === '.' ? stack : part === '..' ? stack.slice(0, -1) : [...stack, part]),
    []
  );

const importCandidates = (from: string, spec: string) => {
  const base = normalizePosix([...dirnamePosix(from).split('/'), ...spec.split('/')]).join('/');
  return /\.(ts|tsx|mts)$/.test(spec) ? [base] : [`${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}/index.ts`];
};

const servicesObject = (source: string) => {
  const at = source.lastIndexOf('services: {');
  if (at < 0) return '';
  const block = source.slice(at);
  const end = block.search(/\n {6}\}/);
  return end < 0 ? block : block.slice(0, end);
};

const apiProperties = (source: string) =>
  [...servicesObject(source).matchAll(/^\s+([A-Za-z0-9_]+)(?:\s*:\s*(?:typeof\s+)?([A-Za-z0-9_]+))?\s*,?\s*(?:\/\/.*)?$/gm)].flatMap(
    match => {
      const key = match[1];
      return key === undefined ? [] : [{ key, local: match[2] ?? key }];
    }
  );

const localImportSpecs = (source: string) =>
  Object.fromEntries(
    [...source.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"](\.[^'"]+)['"]/g)].flatMap(match => {
      const inner = match[1];
      const spec = match[2];
      if (inner === undefined || spec === undefined) return [];
      return inner.split(',').flatMap(part => {
        const parsed = /^(?:type\s+)?([A-Za-z0-9_]+)(?:\s+as\s+([A-Za-z0-9_]+))?$/.exec(part.trim());
        const imported = parsed?.[1];
        return imported === undefined ? [] : [[parsed?.[2] ?? imported, spec] as const];
      });
    })
  );

const keysByFile = (indexSource: string) => {
  const specs = localImportSpecs(indexSource);
  return apiProperties(indexSource).reduce<Readonly<Record<string, readonly string[]>>>((acc, property) => {
    const spec = specs[property.local];
    return spec === undefined
      ? acc
      : importCandidates(servicesIndex, spec).reduce(
          (keys, candidate) => ({ ...keys, [candidate]: [...(keys[candidate] ?? []), property.key] }),
          acc
        );
  }, {});
};

const importersOf = (srcFiles: readonly SrcFile[]) =>
  srcFiles.reduce<Readonly<Record<string, readonly string[]>>>((acc, file) => {
    const specs = [...file.text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].flatMap(match =>
      match[1] === undefined ? [] : [match[1]]
    );
    return specs
      .flatMap(spec => importCandidates(file.path, spec))
      .reduce(
        (map, candidate) => ({ ...map, [candidate]: [...(map[candidate] ?? []), file.path] }),
        acc
      );
  }, {});

const namesForFile = (
  file: string,
  keys: Readonly<Record<string, readonly string[]>>,
  importers: Readonly<Record<string, readonly string[]>>,
  seen: ReadonlySet<string>
): readonly string[] => {
  if (seen.has(file)) return [];
  const direct = keys[file] ?? [];
  if (direct.length > 0) return direct;
  const next = new Set(seen).add(file);
  return uniqueSorted((importers[file] ?? []).flatMap(importer => namesForFile(importer, keys, importers, next)));
};

const changedBody = (line: string) =>
  (line.startsWith('+') && !line.startsWith('+++')) || (line.startsWith('-') && !line.startsWith('---'))
    ? line.slice(1)
    : undefined;

const sharedWiring =
  /prebuiltServicesLayer|buildAllServicesLayer|\bglobalLayers\b|\binternalLayers\b|const requirements|const builtContext|buildWithScope\(requirements|provideMerge\(globalLayers\)/;

const diffTouchesSharedLayer = (section: string) =>
  section.split(/^@@/m).some(hunk => {
    const lines = hunk.split('\n');
    const edited = lines.some(line => {
      const body = changedBody(line);
      return body !== undefined && body.trim().length > 0;
    });
    return edited && lines.some(line => sharedWiring.test(line.replace(/^[+\- ]/, '')));
  });

const diffEditsSharedLayerFile = (section: string) =>
  section.split('\n').some(line => {
    const trimmed = changedBody(line)?.trim();
    return (
      trimmed !== undefined &&
      trimmed.length > 0 &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('*') &&
      !trimmed.startsWith('/*')
    );
  });

const fileSection = (diff: string, file: string) =>
  diff.split(/^diff --git /m).find(part => part.startsWith(`a/${file} `)) ?? '';

const keysOnChangedLines = (diff: string, keys: readonly string[]) =>
  uniqueSorted(
    diff.split('\n').flatMap(line => {
      if ((!line.startsWith('+') && !line.startsWith('-')) || line.startsWith('+++') || line.startsWith('---'))
        return [];
      const name = /^\s*([A-Za-z0-9_]+)\s*(?:,|:)/.exec(line.slice(1))?.[1];
      return name !== undefined && keys.includes(name) ? [name] : [];
    })
  );

export const serviceChange = (
  indexSource: string,
  srcFiles: readonly SrcFile[],
  changed: readonly string[],
  servicesDiff: string
): ServiceChange => {
  const indexDiff = fileSection(servicesDiff, servicesIndex);
  const layersDiff = fileSection(servicesDiff, servicesLayersPath);
  if (
    (changed.includes(servicesIndex) && diffTouchesSharedLayer(indexDiff)) ||
    (changed.includes(servicesLayersPath) && diffEditsSharedLayerFile(layersDiff))
  )
    return { kind: 'shared' };
  const keys = keysByFile(indexSource);
  const importers = importersOf(srcFiles);
  const fromFiles = changed
    .filter(file => file.startsWith(`packages/${servicesDir}/src/`) && file !== servicesIndex)
    .flatMap(file => namesForFile(file, keys, importers, new Set()));
  const fromIndex = changed.includes(servicesIndex)
    ? keysOnChangedLines(indexDiff, apiProperties(indexSource).map(property => property.key))
    : [];
  const names = uniqueSorted([...fromFiles, ...fromIndex]);
  return names.length === 0 ? { kind: 'none' } : { kind: 'services', names };
};

const mergesSharedLayer = (source: string) =>
  /\bbuildAllServicesLayer\s*\(/.test(source) || /\bprebuiltServicesLayer\b/.test(source);

const callsService = (source: string, service: string) =>
  source.split('\n').some(line => {
    const needle = `.services.${service}`;
    const at = line.indexOf(needle);
    const after = at < 0 ? undefined : line[at + needle.length];
    return at >= 0 && !line.includes('Layer.succeed') && (after === undefined || !/[A-Za-z0-9_]/.test(after));
  });

const packageDirOf = (file: string) => {
  const parts = file.split('/');
  return parts[0] === 'packages' ? parts[1] : undefined;
};

const jestMirror = (file: string, dir: string) => {
  const prefix = `packages/${dir}/src/`;
  return file.startsWith(prefix) && file.endsWith('.ts')
    ? `packages/${dir}/test/jest/${file.slice(prefix.length, -'.ts'.length)}.test.ts`
    : undefined;
};

const excerptLine = (line: string) =>
  !/^\s*import\b/.test(line) &&
  (/\bexpect\b/.test(line) || /\.(?:to[A-Z]|not)\b/.test(line) || /\btest\s*\(/.test(line));

const excerptOf = (texts: readonly string[]) => {
  const joined = texts
    .map(text => text.split('\n').filter(excerptLine).join('\n'))
    .filter(block => block.length > 0)
    .join('\n---\n');
  return joined.length === 0 ? undefined : joined;
};

const dependsOn = (meta: PackageMeta, name: string) =>
  [meta.dependencies, meta.devDependencies, meta.optionalDependencies].some(
    deps => deps !== undefined && Object.hasOwn(deps, name)
  );

const runCommand = Effect.fn('manualTestPlan.runCommand')(function* (
  cwd: string,
  command: string,
  args: readonly string[]
) {
  const [text, code] = yield* pipe(
    Command.make(command, ...args),
    Command.workingDirectory(cwd),
    Command.start,
    Effect.flatMap(proc =>
      Effect.all(
        [Stream.mkString(Stream.decodeText(proc.stdout)), Stream.runDrain(Stream.decodeText(proc.stderr)), proc.exitCode],
        { concurrency: 'unbounded' }
      )
    ),
    Effect.map(([stdout, , exitCode]) => [stdout, exitCode] as const),
    Effect.scoped
  );
  return code === 0
    ? text
    : yield* new CommandFailed({ command, code: Number(code), message: `${command} exited ${String(code)}` });
});

const git = Effect.fn('manualTestPlan.git')(function* (cwd: string, args: readonly string[]) {
  return yield* runCommand(cwd, 'git', args);
});

const filesUnder = Effect.fn('manualTestPlan.filesUnder')(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const present = yield* fs.exists(dir);
  if (!present) return [] as readonly string[];
  const names = yield* fs.readDirectory(dir);
  const groups = yield* Effect.forEach(
    names.filter(name => !skippedDirs.has(name)),
    name => {
      const full = path.join(dir, name);
      return fs.stat(full).pipe(
        Effect.flatMap(info => (info.type === 'Directory' ? filesUnder(full) : Effect.succeed([full])))
      );
    },
    { concurrency: 'unbounded' }
  );
  return groups.flat();
});

const repoPath = (root: string, file: string) =>
  Path.Path.pipe(Effect.map(path => path.relative(root, file).split(path.sep).join('/')));

const readOptional = (file: string) =>
  FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.readFileString(file).pipe(Effect.option)));

const readMeta = (file: string) =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap(fs => fs.readFileString(file)),
    Effect.flatMap(json => Schema.decodeUnknown(Schema.parseJson(PackageMeta))(json)),
    Effect.option
  );

const workspaceDirs = Effect.fn('manualTestPlan.workspaceDirs')(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packages = path.join(root, 'packages');
  const present = yield* fs.exists(packages);
  if (!present) return [] as readonly string[];
  const names = yield* fs.readDirectory(packages);
  const dirs = yield* Effect.forEach(
    names,
    name =>
      fs.exists(path.join(packages, name, 'package.json')).pipe(
        Effect.map(ok => (ok ? Option.some(name) : Option.none()))
      ),
    { concurrency: 'unbounded' }
  );
  return Arr.getSomes(dirs).toSorted();
});

const loadWorkflows = Effect.fn('manualTestPlan.loadWorkflows')(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = path.join(root, '.github', 'workflows');
  const present = yield* fs.exists(dir);
  if (!present) return [] as readonly ParsedWorkflow[];
  const names = (yield* fs.readDirectory(dir)).filter(isLeafE2EWorkflow).toSorted();
  const parsed = yield* Effect.forEach(
    names,
    name => fs.readFileString(path.join(dir, name)).pipe(Effect.map(parseWorkflowText)),
    { concurrency: 'unbounded' }
  );
  return Arr.getSomes(parsed);
});

const textFiles = (root: string, paths: readonly string[]) =>
  Path.Path.pipe(
    Effect.flatMap(path =>
      Effect.forEach(
        paths,
        file =>
          readOptional(path.join(root, ...file.split('/'))).pipe(
            Effect.map(text => Option.map(text, value => ({ path: file, text: value })))
          ),
        { concurrency: 'unbounded' }
      )
    ),
    Effect.map(Arr.getSomes)
  );

const specDirs = ['playwright', 'browser'] as const;

const specPaths = (root: string, dir: string) =>
  Path.Path.pipe(
    Effect.flatMap(path =>
      Effect.forEach(
        specDirs,
        folder =>
          filesUnder(path.join(root, 'packages', dir, 'test', folder)).pipe(
            Effect.flatMap(files =>
              Effect.forEach(
                files.filter(file => file.endsWith('.spec.ts')),
                file => repoPath(root, file),
                { concurrency: 'unbounded' }
              )
            )
          ),
        { concurrency: 'unbounded' }
      ).pipe(Effect.map(groups => groups.flat().toSorted()))
    )
  );

const packageFact = Effect.fn('manualTestPlan.packageFact')(function* (
  root: string,
  base: string,
  dir: string,
  changed: readonly string[],
  workflows: readonly ParsedWorkflow[]
) {
  const path = yield* Path.Path;
  const meta = yield* readMeta(path.join(root, 'packages', dir, 'package.json'));
  const npmName = Option.flatMap(meta, value => Option.fromNullable(value.name));
  if (Option.isNone(npmName)) return Option.none();
  const [diff, specs, tests] = yield* Effect.all(
    [
      git(root, ['diff', `origin/${base}...HEAD`, '--', `packages/${dir}`]),
      specPaths(root, dir).pipe(
        Effect.flatMap(paths =>
          Effect.forEach(
            paths,
            file =>
              FileSystem.FileSystem.pipe(
                Effect.flatMap(fs => fs.readFileString(path.join(root, ...file.split('/')))),
                Effect.map(text => ({ path: file, text }))
              ),
            { concurrency: 'unbounded' }
          )
        )
      ),
      textFiles(
        root,
        uniqueSorted([
          ...changed.filter(file => file.startsWith(`packages/${dir}/test/jest/`) && file.endsWith('.test.ts')),
          ...Arr.getSomes(changed.map(file => Option.fromNullable(jestMirror(file, dir))))
        ])
      )
    ],
    { concurrency: 'unbounded' }
  );
  return Option.some({
    package: dir,
    name: npmName.value,
    diff,
    playwright: specs,
    unitTests: tests,
    workflows: workflowRecords(workflows, dir, npmName.value)
  });
});

const srcTexts = (root: string, dir: string) =>
  Path.Path.pipe(
    Effect.flatMap(path =>
      filesUnder(path.join(root, 'packages', dir, 'src')).pipe(
        Effect.flatMap(files =>
          Effect.forEach(
            files.filter(file => file.endsWith('.ts')),
            file =>
              Effect.all([repoPath(root, file), FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.readFileString(file)))], {
                concurrency: 'unbounded'
              }).pipe(Effect.map(([relative, text]) => ({ path: relative, text }))),
            { concurrency: 'unbounded' }
          )
        )
      )
    )
  );

const packageMatches = (texts: readonly SrcFile[], change: ServiceChange) =>
  change.kind === 'shared'
    ? texts.some(file => mergesSharedLayer(file.text))
    : change.kind === 'services'
      ? texts.some(file => change.names.some(name => callsService(file.text, name)))
      : false;

const dependentRecords = (
  dir: string,
  workflows: readonly ParsedWorkflow[],
  npmName: string,
  specs: readonly string[],
  excerpt: string | undefined
): readonly DependentFact[] => {
  const matched = workflowRecords(workflows, dir, npmName);
  const base = { package: dir, jobs: [] as readonly string[], specs, ...(excerpt === undefined ? {} : { excerpt }) };
  return matched.length === 0
    ? [base]
    : matched.map(workflow => ({
        package: dir,
        workflow: workflow.name,
        jobs: workflow.jobs,
        specs,
        ...(excerpt === undefined ? {} : { excerpt })
      }));
};

export const dependentsFor = Effect.fn('manualTestPlan.dependentsFor')(function* (
  root: string,
  changedFiles: readonly string[],
  servicesDiff: string,
  workflows: readonly ParsedWorkflow[]
) {
  const path = yield* Path.Path;
  const servicesSrc = changedFiles.filter(file => file.startsWith(`packages/${servicesDir}/src/`));
  const srcFiles = servicesSrc.length === 0 ? [] : yield* srcTexts(root, servicesDir);
  const indexSource = srcFiles.find(file => file.path === servicesIndex)?.text;
  const change =
    indexSource === undefined ? ({ kind: 'none' } as const) : serviceChange(indexSource, srcFiles, servicesSrc, servicesDiff);
  const dirs = yield* workspaceDirs(root);
  const serviceDirs =
    change.kind === 'none'
      ? []
      : yield* Effect.forEach(
          dirs.filter(dir => dir !== servicesDir),
          dir =>
            srcTexts(root, dir).pipe(Effect.map(texts => (packageMatches(texts, change) ? Option.some(dir) : Option.none()))),
          { concurrency: 4 }
        ).pipe(Effect.map(Arr.getSomes));
  const languageDirs = languageServers.flatMap(server =>
    changedFiles.some(file => file.startsWith(`packages/${server.dir}/`))
      ? dirs.filter(dir => dir !== server.dir)
      : []
  );
  const languageMatches = yield* Effect.forEach(
    uniqueSorted(languageDirs),
    dir =>
      readMeta(path.join(root, 'packages', dir, 'package.json')).pipe(
        Effect.map(meta =>
          Option.isSome(meta) &&
          languageServers.some(
            server =>
              changedFiles.some(file => file.startsWith(`packages/${server.dir}/`)) && dependsOn(meta.value, server.name)
          )
            ? Option.some(dir)
            : Option.none()
        )
      ),
    { concurrency: 'unbounded' }
  );
  const selected = uniqueSorted([...serviceDirs, ...Arr.getSomes(languageMatches)]);
  const records = yield* Effect.forEach(
    selected,
    dir =>
      readMeta(path.join(root, 'packages', dir, 'package.json')).pipe(
        Effect.flatMap(meta => {
          const npmName = Option.flatMap(meta, value => Option.fromNullable(value.name));
          return Option.isNone(npmName)
            ? Effect.succeed([] as readonly DependentFact[])
            : specPaths(root, dir).pipe(
                Effect.flatMap(specs =>
                  Effect.forEach(
                    specs,
                    file =>
                      FileSystem.FileSystem.pipe(
                        Effect.flatMap(fs => fs.readFileString(path.join(root, ...file.split('/'))))
                      ),
                    { concurrency: 'unbounded' }
                  ).pipe(
                    Effect.map(texts =>
                      dependentRecords(dir, workflows, npmName.value, specs, excerptOf(texts))
                    )
                  )
                )
              );
        })
      ),
    { concurrency: 4 }
  );
  return records
    .flat()
    .toSorted((left, right) =>
      left.package === right.package ? (left.workflow ?? '').localeCompare(right.workflow ?? '') : left.package.localeCompare(right.package)
    )
    .filter(
      (record, index, all) =>
        all.findIndex(other => other.package === record.package && other.workflow === record.workflow) === index
    );
});

const factsFor = Effect.fn('manualTestPlan.factsFor')(function* (
  root: string,
  base: string,
  changedFiles: readonly string[]
) {
  const workflows = yield* loadWorkflows(root);
  const dirs = uniqueSorted(Arr.getSomes(changedFiles.map(file => Option.fromNullable(packageDirOf(file)))));
  const packages = yield* Effect.forEach(
    dirs,
    dir => packageFact(root, base, dir, changedFiles, workflows),
    { concurrency: 2 }
  ).pipe(Effect.map(Arr.getSomes));
  const servicesDiff = changedFiles.some(file => file.startsWith(`packages/${servicesDir}/`))
    ? yield* git(root, ['diff', `origin/${base}...HEAD`, '--', `packages/${servicesDir}`])
    : '';
  const dependents = yield* dependentsFor(root, changedFiles, servicesDiff, workflows);
  return { packages, dependents };
});

const finishedText = (run: {
  readonly status: string;
  readonly result?: string;
  readonly error?: { readonly message: string };
}) =>
  run.status === 'finished'
    ? Option.match(Option.fromNullable(run.result), {
        onNone: () =>
          Effect.fail(new CursorRunFailed({ status: run.status, message: 'Cursor run finished without text' })),
        onSome: Effect.succeed
      })
    : Effect.fail(new CursorRunFailed({ status: run.status, message: run.error?.message ?? `Cursor run ${run.status}` }));

const cursorPrompt = Effect.fn('manualTestPlan.cursorPrompt')(function* (skill: string, factsJson: string) {
  return yield* Effect.all(
    [
      Config.redacted('CURSOR_API_KEY'),
      FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.makeTempDirectory({ prefix: 'manual-test-plan-' })))
    ],
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.flatMap(([apiKey, workspace]) =>
      Effect.tryPromise({
        try: () =>
          Agent.prompt(`${skill}\n\nManual test plan facts:\n${factsJson}`, {
            apiKey: Redacted.value(apiKey),
            model: { id: 'auto' },
            tools,
            local: { cwd: workspace }
          }),
        catch: error =>
          new CursorRunFailed({ status: 'startup', message: messageOf(error, 'Cursor SDK failed to start') })
      }).pipe(Effect.flatMap(finishedText))
    )
  );
});

const ghArgs = (repo: Option.Option<string>, args: readonly string[]) =>
  Option.match(repo, { onNone: () => args, onSome: name => [...args, '--repo', name] as const });

const readPrBody = Effect.fn('manualTestPlan.readPrBody')(function* (cwd: string, pr: number) {
  const repo = yield* Config.option(Config.string('GITHUB_REPOSITORY'));
  return yield* runCommand(cwd, 'gh', ghArgs(repo, ['pr', 'view', String(pr), '--json', 'body'])).pipe(
    Effect.flatMap(json => Schema.decodeUnknown(Schema.parseJson(PrBody))(json)),
    Effect.map(parsed => (isNull(parsed.body) ? '' : parsed.body))
  );
});

const writePrBody = Effect.fn('manualTestPlan.writePrBody')(function* (cwd: string, pr: number, body: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repo = yield* Config.option(Config.string('GITHUB_REPOSITORY'));
  const dir = yield* fs.makeTempDirectory({ prefix: 'manual-test-plan-body-' });
  const file = path.join(dir, 'body.md');
  yield* fs.writeFileString(file, body);
  yield* runCommand(cwd, 'gh', ghArgs(repo, ['pr', 'edit', String(pr), '--body-file', file]));
});

const skip = (reason: string, message: string) =>
  Effect.logWarning('manual test plan skipped', { reason, message }).pipe(Effect.as({ edited: false } satisfies Outcome));

export type ManualTestPlanDeps = {
  readonly cwd?: string;
  readonly prompt?: (skill: string, factsJson: string) => Effect.Effect<string, CursorRunFailed>;
  readonly readBody?: (pr: number) => Effect.Effect<string>;
  readonly writeBody?: (pr: number, body: string) => Effect.Effect<void>;
};

export const manualTestPlanProgram = (deps?: ManualTestPlanDeps) =>
  Effect.gen(function* () {
    const pr = yield* Config.string('PR_NUMBER').pipe(
      Effect.flatMap(value => Schema.decodeUnknown(Schema.NumberFromString)(value))
    );
    const base = yield* Config.string('BASE_REF');
    if (!baseRefOk(base)) {
      return yield* new InvalidBaseRef({ ref: base, message: `refused base ref ${base}` });
    }
    const cwd =
      deps?.cwd ?? (yield* git(process.cwd(), ['rev-parse', '--show-toplevel']).pipe(Effect.map(root => root.trim())));
    yield* Effect.annotateCurrentSpan('pr', String(pr));
    yield* git(cwd, ['fetch', 'origin', base]);
    const skill = yield* git(cwd, ['show', `origin/${base}:${skillPath}`]).pipe(Effect.option);
    if (Option.isNone(skill)) return yield* skip('missing-skill', `origin/${base}:${skillPath} is missing`);
    const changedFiles = yield* git(cwd, ['diff', '--name-only', `origin/${base}...HEAD`]).pipe(
      Effect.map(text => text.split('\n').map(line => line.trim()).filter(line => line.length > 0))
    );
    const facts = yield* factsFor(cwd, base, changedFiles);
    const prompt = deps?.prompt ?? cursorPrompt;
    const prompted = yield* prompt(skill.value, JSON.stringify(facts)).pipe(Effect.either);
    if (Either.isLeft(prompted)) return yield* skip('cursor', prompted.left.message);
    const decoded = yield* Schema.decodeUnknown(Schema.parseJson(Judgment))(prompted.right).pipe(Effect.either);
    if (Either.isLeft(decoded)) return yield* skip('schema', 'judgment JSON failed schema');
    const bound = bindJudgment(decoded.right, facts);
    if (isUndefined(bound)) return yield* skip('schema', 'checklist did not bind to facts');
    const block = renderManualTestPlan(bound);
    const readBody = deps?.readBody ?? ((number: number) => readPrBody(cwd, number));
    const current = yield* readBody(pr);
    const next = spliceManualTestPlan(current, block);
    if (next === current) return { edited: false } satisfies Outcome;
    const writeBody = deps?.writeBody ?? ((number: number, body: string) => writePrBody(cwd, number, body));
    yield* writeBody(pr, next);
    yield* Effect.logInfo('manual test plan updated', { pr });
    return { edited: true } satisfies Outcome;
  }).pipe(Effect.withSpan('manualTestPlan.program'));

const stderrLogger = Logger.make(({ message }) => {
  process.stderr.write(`${typeof message === 'string' ? message : JSON.stringify(message)}\n`);
});

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  await manualTestPlanProgram().pipe(
    Effect.tapError(error => Effect.logError('manual test plan failed', { error })),
    Effect.exit,
    Effect.tap(exit =>
      Effect.sync(() => {
        if (Exit.isFailure(exit)) process.exitCode = 1;
      })
    ),
    Effect.provide(Layer.mergeAll(NodeContext.layer, Logger.replace(Logger.defaultLogger, stderrLogger))),
    Effect.runPromise
  );
}
