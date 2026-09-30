/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Command from '@effect/platform/Command';
import type { PlatformError } from '@effect/platform/Error';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import { Array as Arr, Effect, HashSet, Match, Option, pipe, Schema, Stream } from 'effect';
import { isLeafE2EWorkflow, parseWorkflowText, workflowRecords, type ParsedWorkflow } from './parseWorkflow.mts';
import { serviceChange, servicesDir, servicesIndex, type ServiceChange, type SrcFile } from './serviceChange.mts';
import { CommandFailed, PackageMeta, type DependentFact } from './schema.mts';

const languageServers = [
  { dir: 'salesforcedx-aura-language-server', name: '@salesforce/salesforcedx-aura-language-server' },
  { dir: 'salesforcedx-lwc-language-server', name: '@salesforce/salesforcedx-lwc-language-server' },
  { dir: 'salesforcedx-visualforce-language-server', name: '@salesforce/salesforcedx-visualforce-language-server' }
] as const;
const skippedDirs = new Set(['node_modules', 'dist', 'coverage']);

const uniqueSorted = (values: readonly string[]) => Arr.fromIterable(HashSet.fromIterable(values)).toSorted();

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

const dependsOn = (meta: typeof PackageMeta.Type, name: string) =>
  [meta.dependencies, meta.devDependencies, meta.optionalDependencies].some(
    deps => deps !== undefined && Object.hasOwn(deps, name)
  );

export const runCommand = Effect.fn('manualTestPlan.runCommand')(function* (
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
        [
          Stream.mkString(Stream.decodeText(proc.stdout)),
          Stream.runDrain(Stream.decodeText(proc.stderr)),
          proc.exitCode
        ],
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

export const git = Effect.fn('manualTestPlan.git')((cwd: string, args: readonly string[]) =>
  runCommand(cwd, 'git', args)
);

const filesUnder: (dir: string) => Effect.Effect<readonly string[], PlatformError, FileSystem.FileSystem | Path.Path> =
  Effect.fn('manualTestPlan.filesUnder')(function* (dir: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const present = yield* fs.exists(dir);
    if (!present) return [] as readonly string[];
    const names = yield* fs.readDirectory(dir);
    const groups = yield* Effect.forEach(
      names.filter(name => !skippedDirs.has(name)),
      name => {
        const full = path.join(dir, name);
        return fs
          .stat(full)
          .pipe(Effect.flatMap(info => (info.type === 'Directory' ? filesUnder(full) : Effect.succeed([full]))));
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
      fs
        .exists(path.join(packages, name, 'package.json'))
        .pipe(Effect.map(ok => (ok ? Option.some(name) : Option.none()))),
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
  const meta = yield* Path.Path.pipe(
    Effect.flatMap(path => readMeta(path.join(root, 'packages', dir, 'package.json')))
  );
  const npmName = Option.flatMap(meta, value => Option.fromNullable(value.name));
  if (Option.isNone(npmName)) return Option.none();
  const [diff, specs, tests] = yield* Effect.all(
    [
      git(root, ['diff', `origin/${base}...HEAD`, '--', `packages/${dir}`]),
      specPaths(root, dir).pipe(Effect.flatMap(paths => textFiles(root, paths))),
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
              Effect.all(
                [repoPath(root, file), FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.readFileString(file)))],
                {
                  concurrency: 'unbounded'
                }
              ).pipe(Effect.map(([relative, text]) => ({ path: relative, text }))),
            { concurrency: 'unbounded' }
          )
        )
      )
    )
  );

const packageMatches = (texts: readonly SrcFile[], change: ServiceChange) =>
  Match.value(change).pipe(
    Match.when({ kind: 'shared' }, () => texts.some(file => mergesSharedLayer(file.text))),
    Match.when({ kind: 'services' }, ({ names }) =>
      texts.some(file => names.some(name => callsService(file.text, name)))
    ),
    Match.when({ kind: 'none' }, () => false),
    Match.exhaustive
  );

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

const serviceCallerDirs = Effect.fn('manualTestPlan.serviceCallerDirs')(function* (
  root: string,
  changedFiles: readonly string[],
  servicesDiff: string,
  dirs: readonly string[]
) {
  const servicesSrc = changedFiles.filter(file => file.startsWith(`packages/${servicesDir}/src/`));
  const srcFiles = servicesSrc.length === 0 ? [] : yield* srcTexts(root, servicesDir);
  const indexSource = srcFiles.find(file => file.path === servicesIndex)?.text;
  const change =
    indexSource === undefined
      ? ({ kind: 'none' } as const)
      : serviceChange(indexSource, srcFiles, servicesSrc, servicesDiff);
  return change.kind === 'none'
    ? []
    : yield* Effect.forEach(
        dirs.filter(dir => dir !== servicesDir),
        dir =>
          srcTexts(root, dir).pipe(
            Effect.map(texts => (packageMatches(texts, change) ? Option.some(dir) : Option.none()))
          ),
        { concurrency: 4 }
      ).pipe(Effect.map(Arr.getSomes));
});

const languageServerCallerDirs = Effect.fn('manualTestPlan.languageServerCallerDirs')(
  (root: string, changedFiles: readonly string[], dirs: readonly string[]) =>
    Path.Path.pipe(
      Effect.flatMap(path =>
        Effect.forEach(
          uniqueSorted(
            languageServers.flatMap(server =>
              changedFiles.some(file => file.startsWith(`packages/${server.dir}/`))
                ? dirs.filter(dir => dir !== server.dir)
                : []
            )
          ),
          dir =>
            readMeta(path.join(root, 'packages', dir, 'package.json')).pipe(
              Effect.map(meta =>
                Option.isSome(meta) &&
                languageServers.some(
                  server =>
                    changedFiles.some(file => file.startsWith(`packages/${server.dir}/`)) &&
                    dependsOn(meta.value, server.name)
                )
                  ? Option.some(dir)
                  : Option.none()
              )
            ),
          { concurrency: 'unbounded' }
        )
      ),
      Effect.map(Arr.getSomes)
    )
);

export const dependentsFor = Effect.fn('manualTestPlan.dependentsFor')(function* (
  root: string,
  changedFiles: readonly string[],
  servicesDiff: string,
  workflows: readonly ParsedWorkflow[]
) {
  const dirs = yield* workspaceDirs(root);
  return yield* Effect.all(
    [serviceCallerDirs(root, changedFiles, servicesDiff, dirs), languageServerCallerDirs(root, changedFiles, dirs)],
    { concurrency: 2 }
  ).pipe(
    Effect.flatMap(([serviceDirs, languageDirs]) =>
      Path.Path.pipe(
        Effect.flatMap(path =>
          Effect.forEach(
            uniqueSorted([...serviceDirs, ...languageDirs]),
            dir =>
              readMeta(path.join(root, 'packages', dir, 'package.json')).pipe(
                Effect.flatMap(meta => {
                  const npmName = Option.flatMap(meta, value => Option.fromNullable(value.name));
                  return Option.isNone(npmName)
                    ? Effect.succeed([] as readonly DependentFact[])
                    : specPaths(root, dir).pipe(
                        Effect.flatMap(specs =>
                          textFiles(root, specs).pipe(
                            Effect.map(files =>
                              dependentRecords(
                                dir,
                                workflows,
                                npmName.value,
                                specs,
                                excerptOf(files.map(file => file.text))
                              )
                            )
                          )
                        )
                      );
                })
              ),
            { concurrency: 4 }
          )
        )
      )
    ),
    Effect.map(records =>
      records
        .flat()
        .toSorted((left, right) =>
          left.package === right.package
            ? (left.workflow ?? '').localeCompare(right.workflow ?? '')
            : left.package.localeCompare(right.package)
        )
        .filter(
          (record, index, all) =>
            all.findIndex(other => other.package === record.package && other.workflow === record.workflow) === index
        )
    )
  );
});

export const factsFor = Effect.fn('manualTestPlan.factsFor')(function* (
  root: string,
  base: string,
  changedFiles: readonly string[]
) {
  const workflows = yield* loadWorkflows(root);
  const dirs = uniqueSorted(Arr.getSomes(changedFiles.map(file => Option.fromNullable(packageDirOf(file)))));
  const packages = yield* Effect.forEach(dirs, dir => packageFact(root, base, dir, changedFiles, workflows), {
    concurrency: 2
  }).pipe(Effect.map(Arr.getSomes));
  const servicesDiff = changedFiles.some(file => file.startsWith(`packages/${servicesDir}/`))
    ? yield* git(root, ['diff', `origin/${base}...HEAD`, '--', `packages/${servicesDir}`])
    : '';
  const dependents = yield* dependentsFor(root, changedFiles, servicesDiff, workflows);
  return { packages, dependents };
});
