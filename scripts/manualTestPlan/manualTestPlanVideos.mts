/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FileSystem from '@effect/platform/FileSystem';
import * as NodeContext from '@effect/platform-node/NodeContext';
import { allGitHubChecksSuccessful, GitHub, WorkflowRunJob } from '@salesforce/effect-octokit';
import { Config, Effect, Option, Redacted, Schema } from 'effect';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { parse } from 'yaml';
import { CommandFailed } from './schema.mts';
import {
  appendVideoSection,
  readVideoManifest,
  removeVideoSection,
  videoSection,
  videosEnd,
  videosStart
} from './videoManifest.mts';
import { Artifact, jobArtifact, latestTargetRun, targetLanes, Workflow, WorkflowRun } from './videoTargets.mts';

const updaterPath = '.github/workflows/manual-test-plan-videos.yml';
const exec = promisify(execFile);
const command = Effect.fn('manualTestPlanVideos.command')(function* (file: string, args: readonly string[]) {
  const token = yield* Config.redacted('IDEE_GH_TOKEN');
  const result = yield* Effect.tryPromise({
    try: () =>
      exec(file, args, { env: { ...process.env, GH_TOKEN: Redacted.value(token) }, maxBuffer: 16 * 1024 * 1024 }),
    catch: error => new CommandFailed({ command: file, code: 1, message: String(error) })
  });
  if (result.stderr.trim().length > 0) yield* Effect.logWarning(result.stderr);
  return result.stdout;
});

const Pull = Schema.Struct({
  number: Schema.Number,
  state: Schema.String,
  body: Schema.NullOr(Schema.String),
  head: Schema.Struct({ sha: Schema.String }),
  base: Schema.Struct({ repo: Schema.Struct({ full_name: Schema.String }) })
});
const Event = Schema.Struct({
  action: Schema.optional(Schema.String),
  pull_request: Schema.optional(Schema.Struct({ number: Schema.Number })),
  check_suite: Schema.optional(Schema.Struct({ head_sha: Schema.String })),
  workflow_run: Schema.optional(Schema.Struct({ head_sha: Schema.String })),
  inputs: Schema.optional(Schema.Struct({ pull_number: Schema.String }))
});
export const VideoUpdate = Schema.Struct({ pr: Schema.Number, sha: Schema.String, clear: Schema.Boolean });

const readPull = Effect.fn('manualTestPlanVideos.readPull')(function* (repository: string, pr: number) {
  return yield* GitHub.request(`GET /repos/${repository}/pulls/${pr}`).pipe(Effect.flatMap(Schema.decodeUnknown(Pull)));
});

/** Push workflows often have no pull_requests array. Resolve associations through the commit API. */
export const resolveVideoPulls = Effect.fn('manualTestPlanVideos.resolvePulls')(function* (event: typeof Event.Type) {
  const repository = yield* Config.string('GITHUB_REPOSITORY');
  const [owner, repo] = repository.split('/');
  const completed = event.check_suite ?? event.workflow_run;
  const pr = event.pull_request?.number ?? Number(event.inputs?.pull_number);
  const candidates =
    completed === undefined
      ? Number.isSafeInteger(pr) && pr > 0
        ? [pr]
        : []
      : (yield* GitHub.pullsForCommit(owner, repo, completed.head_sha)).map(pull => pull.number);
  return yield* Effect.forEach(
    [...new Set(candidates)],
    Effect.fn('manualTestPlanVideos.resolvePull')(function* (number) {
      const pull = yield* readPull(repository, number);
      return pull.state === 'open' &&
        pull.base.repo.full_name === repository &&
        (completed === undefined || pull.head.sha === completed.head_sha)
        ? [{ pr: number, sha: pull.head.sha, clear: event.action === 'synchronize' }]
        : [];
    })
  ).pipe(Effect.map(rows => rows.flat()));
});

const Video = Schema.Struct({
  path: Schema.String,
  title: Schema.String,
  project: Schema.String,
  retry: Schema.Number
});
const collect = Effect.fn('manualTestPlanVideos.collect')(function* (input: {
  readonly repository: string;
  readonly pairs: readonly { readonly report: number; readonly results: number }[];
  readonly spec: string;
  readonly sha: string;
  readonly dir: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.forEach(
    [...new Set(input.pairs.flatMap(pair => [pair.report, pair.results]))],
    Effect.fn('manualTestPlanVideos.download')(function* (id) {
      // Artifact-controlled paths never reach the filesystem.
      const token = yield* Config.redacted('IDEE_GH_TOKEN');
      const bytes = yield* Effect.tryPromise({
        try: () =>
          exec('gh', ['api', `repos/${input.repository}/actions/artifacts/${id}/zip`], {
            env: { ...process.env, GH_TOKEN: Redacted.value(token) },
            encoding: 'buffer',
            maxBuffer: 1024 * 1024 * 1024
          }),
        catch: error => new CommandFailed({ command: 'gh api', code: 1, message: String(error) })
      });
      yield* fs.writeFile(`${input.dir}/${id}.zip`, bytes.stdout);
    })
  );
  yield* fs.writeFileString(
    `${input.dir}/pairs.json`,
    JSON.stringify(
      input.pairs.map(pair => ({
        report: `${input.dir}/${pair.report}.zip`,
        results: `${input.dir}/${pair.results}.zip`
      }))
    )
  );
  return yield* command('python3', [
    'scripts/manualTestPlan/playwrightVideos.py',
    `${input.dir}/pairs.json`,
    input.spec,
    input.sha,
    input.dir
  ]).pipe(Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(Schema.Array(Video)))));
});

const publish = Effect.fn('manualTestPlanVideos.publish')(function* (input: {
  readonly repository: string;
  readonly pr: number;
  readonly body: string;
  readonly paths: readonly string[];
  readonly dir: string;
}) {
  const help = yield* command('gh', ['pr', 'edit', '--help']);
  if (!help.includes('--attach'))
    return yield* new CommandFailed({
      command: 'gh pr edit',
      code: 1,
      message: 'Runner GitHub CLI does not support --attach'
    });
  yield* FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.writeFileString(`${input.dir}/body.md`, input.body)));
  return yield* command('gh', [
    'pr',
    'edit',
    String(input.pr),
    '--repo',
    input.repository,
    '--body-file',
    `${input.dir}/body.md`,
    ...[...new Set(input.paths)].flatMap(path => ['--attach', path])
  ]).pipe(Effect.asVoid);
});

const markdownText = (text: string) => text.replaceAll(/[\\`*_{}[\]<>!#]/g, '\\$&').replaceAll(/[\r\n]/g, ' ');
const warning = (message: string) => Effect.logWarning('manual test plan videos', { message });

export const updateManualTestPlanVideos = Effect.fn('manualTestPlanVideos.update')(function* (
  input: typeof VideoUpdate.Type,
  deps?: { readonly collect?: typeof collect; readonly publish?: typeof publish }
) {
  const repository = yield* Config.string('GITHUB_REPOSITORY');
  const [owner, repo] = repository.split('/');
  const pull = yield* readPull(repository, input.pr);
  if (pull.state !== 'open' || pull.head.sha !== input.sha) return;
  const body = pull.body ?? '';
  if (input.clear) {
    const previousSection = videoSection(body);
    if (previousSection === undefined || previousSection.includes(`"sha":"${input.sha}"`)) return;
    // Reread immediately before writing, just as for publication.
    const current = yield* readPull(repository, input.pr);
    if (current.state === 'open' && current.head.sha === input.sha) {
      yield* GitHub.updatePullBody(owner, repo, input.pr, removeVideoSection(current.body ?? ''));
    }
    return;
  }
  const green = Effect.fn('manualTestPlanVideos.green')(function* () {
    return yield* GitHub.headChecks(owner, repo, input.sha).pipe(
      Effect.map(checks => allGitHubChecksSuccessful(checks.filter(check => check.key !== `workflow:${updaterPath}`)))
    );
  });
  if (!(yield* green())) return;
  const manifest = readVideoManifest(body);
  const targets = manifest.pipe(
    Option.filter(candidate => candidate.sha === input.sha),
    Option.match({
      onNone: () => [],
      onSome: candidate => [...new Map(candidate.targets.map(target => [JSON.stringify(target), target])).values()]
    })
  );
  if (targets.length === 0) return;
  const github = yield* GitHub;
  const runs = yield* github
    .paginate<unknown>(`GET /repos/${repository}/actions/runs`, { head_sha: input.sha })
    .pipe(Effect.flatMap(Schema.decodeUnknown(Schema.Array(WorkflowRun))));
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'manual-test-plan-videos-' });
  const rows = yield* Effect.forEach(
    targets,
    Effect.fn('manualTestPlanVideos.target')(function* (target) {
      const run = latestTargetRun(runs, input.sha, target.workflow);
      if (
        run?.status !== 'completed' ||
        run.conclusion !== 'success' ||
        !/^\.github\/workflows\/[\w-]+\.ya?ml$/.test(run.path)
      ) {
        yield* warning(`No successful current-SHA run: ${target.workflow}`);
        return [];
      }
      const workflow = yield* fs.readFileString(run.path).pipe(
        Effect.flatMap(text => Effect.try((): unknown => parse(text))),
        Effect.flatMap(Schema.decodeUnknown(Workflow))
      );
      const lanes = targetLanes(workflow, target);
      if (lanes.length === 0) yield* warning(`No artifact targets: ${target.workflow} / ${target.job}`);
      const jobs = yield* github
        .paginate<unknown>(`GET /repos/${repository}/actions/runs/${run.id}/jobs`, { filter: 'all' })
        .pipe(Effect.flatMap(Schema.decodeUnknown(Schema.Array(WorkflowRunJob))));
      const artifacts = yield* github
        .paginate<unknown>(`GET /repos/${repository}/actions/runs/${run.id}/artifacts`)
        .pipe(Effect.flatMap(Schema.decodeUnknown(Schema.Array(Artifact))));
      return yield* Effect.forEach(
        lanes,
        Effect.fn('manualTestPlanVideos.lane')(function* (lane) {
          const attempts = jobs
            .filter(candidate => candidate.name === lane.name)
            .toSorted((a, b) => (a.started_at ?? '').localeCompare(b.started_at ?? '') || a.id - b.id);
          const job = attempts.at(-1);
          if (job?.conclusion !== 'success') return [];
          const pairs = attempts.flatMap(attempt => {
            const report = jobArtifact(artifacts, lane.report, input.sha, attempt);
            const results = jobArtifact(artifacts, lane.results, input.sha, attempt);
            return report === undefined || results === undefined ? [] : [{ report: report.id, results: results.id }];
          });
          if (pairs.length !== attempts.length) {
            yield* warning(`Missing artifacts: ${target.workflow} / ${lane.name}`);
          }
          if (
            pairs.length === 0 ||
            jobArtifact(artifacts, lane.report, input.sha, job) === undefined ||
            jobArtifact(artifacts, lane.results, input.sha, job) === undefined
          ) {
            return [];
          }
          const videos = yield* (deps?.collect ?? collect)({
            repository,
            pairs,
            spec: target.spec,
            sha: input.sha,
            dir
          }).pipe(
            Effect.catchTags({
              CommandFailed: error => warning(error.message).pipe(Effect.as([]))
            })
          );
          if (videos.length === 0) yield* warning(`Missing successful video: ${target.spec} / ${lane.name}`);
          return videos.map(video => ({
            ...video,
            spec: target.spec,
            workflow: target.workflow,
            lane: lane.name,
            run: run.id,
            attempt: run.run_attempt,
            job: job.id,
            artifacts: pairs
          }));
        })
      ).pipe(Effect.map(result => result.flat()));
    })
  ).pipe(Effect.map(result => result.flat()));
  if (rows.length === 0) return;
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ sha: input.sha, targets, rows: rows.map(({ path: _path, ...row }) => row) }))
    .digest('hex');
  const state = `<!-- manual-test-plan-videos-state ${JSON.stringify({ sha: input.sha, fingerprint })} -->`;
  if (!(yield* green())) return;
  const latest = yield* readPull(repository, input.pr);
  const latestBody = latest.body ?? '';
  // A plan regeneration or human edit during downloads must not be overwritten.
  if (
    latest.state !== 'open' ||
    latest.head.sha !== input.sha ||
    JSON.stringify(readVideoManifest(latestBody)) !== JSON.stringify(manifest)
  )
    return;
  const existing = videoSection(latestBody);
  if (existing?.includes(state) && !existing.includes('![](')) return;
  const section = `${videosStart}\n${state}\n\n## Playwright videos\n\n${rows
    .map(
      row =>
        `**${markdownText(row.spec)}** — ${markdownText(row.workflow)} / ${markdownText(row.lane)} / ${markdownText(row.project)} / ${markdownText(row.title)} (attempt ${row.retry + 1}; [run ${row.run}](https://github.com/${repository}/actions/runs/${row.run}))\n\n![](${row.path})`
    )
    .join('\n\n')}\n${videosEnd}`;
  yield* (deps?.publish ?? publish)({
    repository,
    pr: input.pr,
    body: appendVideoSection(latestBody, section),
    paths: rows.map(row => row.path),
    dir
  });
});

const main = Effect.fn('manualTestPlanVideos.main')(function* () {
  if (process.argv[2] === 'resolve') {
    const fs = yield* FileSystem.FileSystem;
    const eventPath = yield* Config.string('GITHUB_EVENT_PATH');
    const event = yield* fs
      .readFileString(eventPath)
      .pipe(Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(Event))));
    const pulls = yield* resolveVideoPulls(event);
    const output = yield* Config.string('GITHUB_OUTPUT');
    yield* fs.writeFileString(output, `pulls=${JSON.stringify(pulls)}\n`, { flag: 'a' });
    return;
  }
  const input = yield* Config.all({
    pr: Config.integer('VIDEO_PR'),
    sha: Config.string('VIDEO_SHA'),
    clear: Config.boolean('VIDEO_CLEAR')
  });
  yield* updateManualTestPlanVideos(input).pipe(Effect.scoped);
});

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().pipe(Effect.provide([GitHub.Default, NodeContext.layer]), Effect.runPromise);
}
