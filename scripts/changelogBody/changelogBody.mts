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
  Exit,
  HashMap,
  HashSet,
  Layer,
  Logger,
  Match,
  Option,
  pipe,
  Redacted,
  Schema
} from 'effect';
import { isNotUndefined, isUndefined } from 'effect/Predicate';

const repo = 'forcedotcom/salesforcedx-vscode';
const keptTypes = ['feat', 'fix', 'perf'] as const;
const sectionNames = ['Added', 'Fixed', 'Changed', 'Under the Hood'] as const;
const tools: ToolName[] = [];

const Fact = Schema.Struct({
  sha: Schema.String,
  pr: Schema.Number,
  type: Schema.Literal(...keptTypes),
  subject: Schema.String,
  title: Schema.String,
  body: Schema.optional(Schema.String),
  labels: Schema.Array(Schema.String),
  packages: Schema.Array(Schema.String),
  paths: Schema.Array(Schema.String),
  issues: Schema.Array(Schema.Number),
  discussions: Schema.Array(Schema.Number)
});
type Fact = typeof Fact.Type;

const Entry = Schema.Struct({
  pr: Schema.Number,
  sentence: Schema.String,
  package: Schema.optional(Schema.String)
});
type Entry = typeof Entry.Type;

const PullRequest = Schema.Struct({
  title: Schema.String,
  body: Schema.NullOr(Schema.String),
  labels: Schema.Array(Schema.Struct({ name: Schema.String }))
});

class IdenticalChangelogRefs extends Schema.TaggedError<IdenticalChangelogRefs>()('IdenticalChangelogRefs', {
  from: Schema.String,
  to: Schema.String,
  sha: Schema.String,
  message: Schema.String
}) {}

class CursorRunFailed extends Schema.TaggedError<CursorRunFailed>()('CursorRunFailed', {
  status: Schema.String,
  message: Schema.String
}) {}

class MissingChangelogFact extends Schema.TaggedError<MissingChangelogFact>()('MissingChangelogFact', {
  pr: Schema.Number,
  message: Schema.String
}) {}

const messageOf = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const runCommand = Effect.fn('changelogBody.runCommand')(function* (
  cwd: string,
  command: string,
  args: readonly string[]
) {
  return yield* pipe(Command.make(command, ...args), Command.workingDirectory(cwd), Command.string);
});

const git = Effect.fn('changelogBody.git')(function* (cwd: string, args: readonly string[]) {
  return yield* runCommand(cwd, 'git', args);
});

const revParse = Effect.fn('changelogBody.revParse')(function* (cwd: string, ref: string) {
  return yield* git(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]).pipe(Effect.map(stdout => stdout.trim()));
});

const segments = (path: Path.Path, file: string): readonly string[] => {
  const parent = path.dirname(file);
  const name = path.basename(file);
  return parent === file || parent === '.' || parent === path.sep
    ? name === '' || name === '.' || name === path.sep
      ? []
      : [name]
    : [...segments(path, parent), name];
};

const isIgnoredPath = (path: Path.Path, file: string) => {
  const parts = segments(path, file);
  return parts.includes('images') || parts.includes('test');
};

const packageName = (path: Path.Path, file: string) => {
  const parts = segments(path, file);
  return parts[0] === 'packages'
    ? Option.fromNullable(parts[1]).pipe(
        Option.filter(name => name.startsWith('salesforce') || name.startsWith('docs'))
      )
    : Option.none();
};

const packageSet = (path: Path.Path, files: readonly string[]) => {
  const names = Arr.fromIterable(
    HashSet.fromIterable(Arr.getSomes(files.map(file => packageName(path, file))))
  ).toSorted();
  const collapsed = names.includes('salesforcedx-vscode-core')
    ? names.filter(name => name === 'salesforcedx-vscode-core' || name === 'docs')
    : names;
  const features = collapsed.filter(name => name !== 'salesforcedx-vscode-services' && name !== 'docs');
  return collapsed.includes('salesforcedx-vscode-services') && features.length === 1
    ? collapsed.filter(name => name !== 'salesforcedx-vscode-services')
    : collapsed;
};

const parseSubject = (subject: string) =>
  Option.gen(function* () {
    const typed = /^([a-zA-Z]+)(?:\([^)]*\))?!?:\s*([\s\S]*)$/.exec(subject);
    const typeName = yield* Option.fromNullable(typed?.[1]);
    const rest = yield* Option.fromNullable(typed?.[2]);
    const pr = yield* Option.fromNullable(/\(#(\d+)\)\s*$/.exec(rest)?.[1]);
    const type = yield* Arr.findFirst(keptTypes, candidate => candidate === typeName.toLowerCase());
    return {
      type,
      pr: Number(pr),
      message: rest
        .replace(/\(#\d+\)\s*$/, '')
        .replaceAll(/\[W-\d+\]\s*/g, '')
        .trim()
    };
  });

const numbersIn = (text: string, kind: 'issues' | 'discussions') =>
  Arr.getSomes(
    [...text.matchAll(new RegExp(`github\\.com/${repo}/${kind}/(\\d+)`, 'g'))].map(match =>
      Option.fromNullable(match[1]).pipe(Option.map(Number))
    )
  );

const referenceSection = (body: string) =>
  Option.fromNullable(/### What issues does this PR fix or reference\?\s*([\s\S]*?)(?=\n### |$)/.exec(body)?.[1]);

const survivingPaths = (path: Path.Path, nameOnly: string) =>
  nameOnly
    .split('\n')
    .filter(Schema.is(Schema.NonEmptyString))
    .filter(file => !isIgnoredPath(path, file))
    .toSorted();

const loadKeptCommit = Effect.fn('changelogBody.loadKeptCommit')(function* (
  cwd: string,
  sha: string,
  parsed: { readonly type: (typeof keptTypes)[number]; readonly pr: number; readonly message: string }
) {
  const path = yield* Path.Path;
  const [paths, pull] = yield* Effect.all(
    [
      git(cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', sha]).pipe(
        Effect.map(nameOnly => survivingPaths(path, nameOnly))
      ),
      runCommand(cwd, 'gh', ['pr', 'view', String(parsed.pr), '--repo', repo, '--json', 'title,body,labels']).pipe(
        Effect.flatMap(json => Schema.decodeUnknown(Schema.parseJson(PullRequest))(json))
      )
    ],
    { concurrency: 'unbounded' }
  );
  const references = Option.fromNullable(pull.body).pipe(Option.flatMap(referenceSection));
  return yield* Schema.decodeUnknown(Fact)({
    sha,
    pr: parsed.pr,
    type: parsed.type,
    subject: parsed.message,
    title: pull.title,
    body: Option.getOrUndefined(Option.fromNullable(pull.body)),
    labels: pull.labels.map(label => label.name),
    packages: packageSet(path, paths),
    paths,
    issues: Option.match(references, { onNone: () => [], onSome: section => numbersIn(section, 'issues') }),
    discussions: Option.match(references, {
      onNone: () => [],
      onSome: section => numbersIn(section, 'discussions')
    })
  });
});

const loadCommit = Effect.fn('changelogBody.loadCommit')(function* (cwd: string, sha: string) {
  return yield* git(cwd, ['show', '-s', '--format=%s', sha]).pipe(
    Effect.map(line => parseSubject(line.trim())),
    Effect.flatMap(parsed =>
      Option.match(parsed, {
        onNone: () => Effect.succeed(Option.none<Fact>()),
        onSome: commit => loadKeptCommit(cwd, sha, commit).pipe(Effect.map(Option.some))
      })
    )
  );
});

const sectionsSchema = (facts: readonly Fact[]) =>
  Schema.Struct({
    Added: Schema.Array(Entry),
    Fixed: Schema.Array(Entry),
    Changed: Schema.Array(Entry),
    'Under the Hood': Schema.Array(Entry)
  }).pipe(
    Schema.filter(sections => {
      const actual = sectionNames
        .flatMap(name => sections[name].map(entry => entry.pr))
        .toSorted((left, right) => left - right);
      const expected = facts.map(fact => fact.pr).toSorted((left, right) => left - right);
      const byPr = HashMap.fromIterable(facts.map(fact => [fact.pr, fact] as const));
      const visible = [sections.Added, sections.Fixed, sections.Changed].flat();
      const badPackage = visible.find(entry =>
        Option.match(HashMap.get(byPr, entry.pr), {
          onNone: () => true,
          onSome: fact => isUndefined(entry.package) || !fact.packages.includes(entry.package)
        })
      );
      const badHood = sections['Under the Hood'].find(
        entry => !isUndefined(entry.package) || Option.isNone(HashMap.get(byPr, entry.pr))
      );
      const emptyPackage = HashSet.fromIterable(facts.filter(fact => fact.packages.length === 0).map(fact => fact.pr));
      const misplaced = visible.find(entry => HashSet.has(emptyPackage, entry.pr));
      return expected.length === actual.length && expected.every((pr, index) => pr === actual[index])
        ? !isUndefined(badPackage)
          ? `package for PR ${badPackage.pr} is not in that fact's package set`
          : !isUndefined(badHood)
            ? `Under the Hood PR ${badHood.pr} must omit package`
            : !isUndefined(misplaced)
              ? `PR ${misplaced.pr} has no package and must be Under the Hood`
              : true
        : 'PR set does not match the changelog facts';
    })
  );

const linkList = (fact: Fact) =>
  [
    `[PR #${fact.pr}](https://github.com/${repo}/pull/${fact.pr})`,
    ...fact.issues.map(issue => `[ISSUE #${issue}](https://github.com/${repo}/issues/${issue})`),
    ...fact.discussions.map(
      discussion => `[DISCUSSION #${discussion}](https://github.com/${repo}/discussions/${discussion})`
    )
  ].join(', ');

const factFor = Effect.fn('changelogBody.factFor')(function* (byPr: HashMap.HashMap<number, Fact>, pr: number) {
  return yield* Option.match(HashMap.get(byPr, pr), {
    onNone: () => Effect.fail(new MissingChangelogFact({ pr, message: `PR ${pr} missing from facts after decode` })),
    onSome: Effect.succeed
  });
});

const packageBlocks = Effect.fn('changelogBody.packageBlocks')(function* (
  entries: readonly Entry[],
  byPr: HashMap.HashMap<number, Fact>
) {
  return yield* Effect.forEach(
    Object.entries(
      Arr.groupBy(
        entries.flatMap(entry => (isUndefined(entry.package) ? [] : [{ ...entry, package: entry.package }])),
        entry => entry.package
      )
    ).toSorted(([left], [right]) => left.localeCompare(right)),
    ([name, group]) =>
      Effect.forEach(
        group.toSorted((left, right) => left.pr - right.pr),
        entry => factFor(byPr, entry.pr).pipe(Effect.map(fact => `- ${entry.sentence} (${linkList(fact)})`)),
        { concurrency: 'unbounded' }
      ).pipe(Effect.map(lines => [`#### ${name}`, ...lines].join('\n\n'))),
    { concurrency: 'unbounded' }
  ).pipe(Effect.map(blocks => blocks.join('\n\n')));
});

const toMarkdown = Effect.fn('changelogBody.toMarkdown')(function* (
  sections: Schema.Schema.Type<ReturnType<typeof sectionsSchema>>,
  facts: readonly Fact[]
) {
  const byPr = HashMap.fromIterable(facts.map(fact => [fact.pr, fact] as const));
  const [visible, hoodLinks] = yield* Effect.all(
    [
      Effect.forEach(
        ['Added', 'Fixed', 'Changed'] as const,
        name =>
          sections[name].length === 0
            ? Effect.succeed(Option.none<string>())
            : packageBlocks(sections[name], byPr).pipe(Effect.map(body => Option.some(`## ${name}\n\n${body}`))),
        { concurrency: 'unbounded' }
      ),
      Effect.forEach(sections['Under the Hood'], entry => factFor(byPr, entry.pr).pipe(Effect.map(linkList)), {
        concurrency: 'unbounded'
      })
    ],
    { concurrency: 'unbounded' }
  );
  return [
    ...Arr.getSomes(visible),
    hoodLinks.length === 0
      ? undefined
      : `## Under the Hood\n\n- We made some under the hood changes. (${hoodLinks.join(', ')})`
  ]
    .filter(isNotUndefined)
    .join('\n\n');
});

const finishedText = (run: {
  readonly status: string;
  readonly result?: string;
  readonly error?: { readonly message: string };
}) =>
  Match.value(run).pipe(
    Match.when({ status: 'finished' }, finished =>
      Option.match(Option.fromNullable(finished.result), {
        onNone: () =>
          Effect.fail(new CursorRunFailed({ status: finished.status, message: 'Cursor run finished without text' })),
        onSome: Effect.succeed
      })
    ),
    Match.orElse(other =>
      Effect.fail(
        new CursorRunFailed({
          status: other.status,
          message: other.error?.message ?? `Cursor run ${other.status}`
        })
      )
    )
  );

const program = Effect.gen(function* () {
  const [from, to] = yield* Schema.decodeUnknown(
    Schema.Tuple(Schema.String.pipe(Schema.nonEmptyString()), Schema.String.pipe(Schema.nonEmptyString()))
  )(process.argv.slice(2));
  const cwd = yield* git(process.cwd(), ['rev-parse', '--show-toplevel']).pipe(Effect.map(root => root.trim()));
  const [fromSha, toSha] = yield* Effect.all([revParse(cwd, from), revParse(cwd, to)], {
    concurrency: 'unbounded'
  });
  if (fromSha === toSha) {
    return yield* new IdenticalChangelogRefs({
      from,
      to,
      sha: fromSha,
      message: `${from} and ${to} resolve to ${fromSha}`
    });
  }
  const facts = yield* git(cwd, ['log', '--reverse', `${fromSha}..${toSha}`, '--format=%H']).pipe(
    Effect.map(log => log.split('\n').filter(Schema.is(Schema.NonEmptyString))),
    Effect.flatMap(shas => Effect.forEach(shas, sha => loadCommit(cwd, sha), { concurrency: 'unbounded' })),
    Effect.map(Arr.getSomes)
  );
  if (facts.length === 0) return '';
  const [skill, apiKey, workspace] = yield* Effect.all(
    [
      Effect.all([Path.Path, FileSystem.FileSystem], { concurrency: 'unbounded' }).pipe(
        Effect.flatMap(([path, fs]) =>
          fs.readFileString(path.join(cwd, '.cursor', 'skills', 'changelog-judgment', 'SKILL.md'))
        )
      ),
      Config.redacted('CURSOR_API_KEY'),
      Effect.flatMap(FileSystem.FileSystem, fs => fs.makeTempDirectory({ prefix: 'changelog-body-' }))
    ],
    { concurrency: 'unbounded' }
  );
  const text = yield* Effect.tryPromise({
    try: () =>
      Agent.prompt(`${skill}\n\nChangelog facts:\n${JSON.stringify(facts)}`, {
        apiKey: Redacted.value(apiKey),
        model: { id: 'auto' },
        tools,
        local: { cwd: workspace }
      }),
    catch: error =>
      new CursorRunFailed({
        status: 'startup',
        message: messageOf(error, 'Cursor SDK failed to start')
      })
  }).pipe(Effect.flatMap(finishedText));
  return yield* Schema.decodeUnknown(Schema.parseJson(sectionsSchema(facts)))(text).pipe(
    Effect.flatMap(sections => toMarkdown(sections, facts))
  );
}).pipe(Effect.withSpan('changelogBody.program'));

const stderrLogger = Logger.make(({ message }) => {
  process.stderr.write(`${typeof message === 'string' ? message : JSON.stringify(message)}\n`);
});

await program.pipe(
  Effect.tap(body =>
    Effect.sync(() => {
      process.stdout.write(body.length === 0 ? body : `${body}\n`);
    })
  ),
  Effect.tapError(error => Effect.logError('changelog body failed', { error })),
  Effect.exit,
  Effect.tap(exit =>
    Effect.sync(() => {
      if (Exit.isFailure(exit)) process.exitCode = 1;
    })
  ),
  Effect.provide(Layer.mergeAll(NodeContext.layer, Logger.replace(Logger.defaultLogger, stderrLogger))),
  Effect.runPromise
);
