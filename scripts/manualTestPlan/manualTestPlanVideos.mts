/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FileSystem from '@effect/platform/FileSystem';
import * as NodeContext from '@effect/platform-node/NodeContext';
import {
  allGitHubChecksSuccessful,
  GitHub,
  readCompletedChecksEvent,
  readSynchronizeEvent,
  readWorkflowDispatchEvent
} from '@salesforce/effect-octokit';
import { Config, Effect, Option, Redacted, Schema } from 'effect';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { parse } from 'yaml';
import { collectLane } from './playwrightVideos.mts';
import { CommandFailed } from './schema.mts';
import {
  appendVideoSection,
  readVideoManifest,
  removeVideoSection,
  videoSection,
  videosEnd,
  videosStart
} from './videoManifest.mts';
import { jobArtifact, latestTargetRun, targetLanes, Workflow } from './videoTargets.mts';

const updaterPath = '.github/workflows/manual-test-plan-videos.yml';
const exec = promisify(execFile);
export const downloadArtifact = Effect.fn('manualTestPlanVideos.downloadArtifact')(function* (
  repository: string,
  artifactId: number,
  path: string
) {
  const [owner, repo] = repository.split('/');
  const body: unknown = yield* GitHub.request(
    'GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}',
    {
      owner,
      repo,
      artifact_id: artifactId,
      archive_format: 'zip',
      request: { parseSuccessResponseBody: false }
    }
  ).pipe(
    Effect.catchTag('GitHubRequestError', error =>
      Effect.fail(
        new CommandFailed({ command: 'Octokit artifact download', code: error.status, message: error.message })
      )
    )
  );
  return yield* Effect.tryPromise({
    try: async signal => {
      if (!(body instanceof NodeReadableStream)) throw new Error('Octokit returned a non-stream artifact response');
      await pipeline(Readable.fromWeb(body), createWriteStream(path), { signal });
    },
    catch: error => new CommandFailed({ command: 'Octokit artifact download', code: 1, message: String(error) })
  });
});
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

const WorkflowDispatchInputs = Schema.Struct({ pull_number: Schema.String });
export const VideoUpdate = Schema.Struct({ pr: Schema.Number, sha: Schema.String, clear: Schema.Boolean });

type PullResolution =
  | { readonly kind: 'pull'; readonly pullNumber: number; readonly clear: boolean }
  | { readonly kind: 'commit'; readonly sha: string }
  | { readonly kind: 'none' };

export const readPullResolution = Effect.fn('manualTestPlanVideos.readPullResolution')(function* (
  eventName: string,
  eventPath: string
) {
  if (eventName === 'workflow_dispatch') {
    const dispatch = yield* readWorkflowDispatchEvent(eventPath, WorkflowDispatchInputs);
    const pullNumber = Number(dispatch.inputs.pull_number);
    if (!Number.isSafeInteger(pullNumber) || pullNumber <= 0) return { kind: 'none' } satisfies PullResolution;
    return { kind: 'pull', pullNumber, clear: false } satisfies PullResolution;
  }
  if (eventName === 'pull_request_target') {
    const synchronize = yield* readSynchronizeEvent(eventPath);
    return {
      kind: 'pull',
      pullNumber: synchronize.pull_request.number,
      clear: synchronize.action === 'synchronize'
    } satisfies PullResolution;
  }
  const completedChecks = yield* readCompletedChecksEvent(eventPath);
  const completed = completedChecks.check_suite ?? completedChecks.workflow_run;
  return completed === undefined
    ? ({ kind: 'none' } satisfies PullResolution)
    : ({ kind: 'commit', sha: completed.head_sha } satisfies PullResolution);
});

/** Push workflows often have no pull_requests array. Resolve associations through the commit API. */
export const resolveVideoPulls = Effect.fn('manualTestPlanVideos.resolvePulls')(function* (event: PullResolution) {
  const repository = yield* Config.string('GITHUB_REPOSITORY');
  const [owner, repo] = repository.split('/');
  const candidates =
    event.kind === 'pull'
      ? [event.pullNumber]
      : event.kind === 'commit'
        ? (yield* GitHub.pullsForCommit(owner, repo, event.sha)).map(pull => pull.number)
        : [];
  const sha = event.kind === 'commit' ? event.sha : undefined;
  return yield* Effect.forEach(
    [...new Set(candidates)],
    Effect.fn('manualTestPlanVideos.resolvePull')(function* (number) {
      const pull = yield* GitHub.pullRequest(owner, repo, number);
      return pull?.state === 'OPEN' &&
        pull.baseRepository?.nameWithOwner === repository &&
        (sha === undefined || pull.headRefOid === sha)
        ? [{ pr: number, sha: pull.headRefOid, clear: event.kind === 'pull' && event.clear }]
        : [];
    })
  ).pipe(Effect.map(rows => rows.flat()));
});

const collect = Effect.fn('manualTestPlanVideos.collect')(function* (input: {
  readonly repository: string;
  readonly pairs: readonly { readonly report: number; readonly results: number }[];
  readonly spec: string;
  readonly sha: string;
  readonly dir: string;
}) {
  yield* Effect.forEach(
    [...new Set(input.pairs.flatMap(pair => [pair.report, pair.results]))],
    Effect.fn('manualTestPlanVideos.download')(function* (id) {
      // Artifact-controlled paths never reach the filesystem.
      yield* downloadArtifact(input.repository, id, `${input.dir}/${id}.zip`);
    })
  );
  return yield* collectLane(
    input.pairs.map(pair => ({
      report: `${input.dir}/${pair.report}.zip`,
      results: `${input.dir}/${pair.results}.zip`
    })),
    input.spec,
    input.sha,
    input.dir
  );
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
  const pull = yield* GitHub.pullRequest(owner, repo, input.pr);
  if (pull?.state !== 'OPEN' || pull.headRefOid !== input.sha) return;
  const body = pull.body ?? '';
  if (input.clear) {
    const previousSection = videoSection(body);
    if (previousSection === undefined || previousSection.includes(`"sha":"${input.sha}"`)) return;
    // Reread immediately before writing, just as for publication.
    const current = yield* GitHub.pullRequest(owner, repo, input.pr);
    if (current?.state === 'OPEN' && current.headRefOid === input.sha) {
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
  const runs = yield* GitHub.workflowRuns(repository, input.sha);
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
      const jobs = yield* GitHub.workflowRunJobs(repository, String(run.id), 'all');
      const artifacts = yield* GitHub.workflowRunArtifacts(repository, String(run.id));
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
              CommandFailed: error => warning(error.message).pipe(Effect.as([])),
              VideoArchiveError: error => warning(error.message).pipe(Effect.as([]))
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
  const latest = yield* GitHub.pullRequest(owner, repo, input.pr);
  if (latest?.state !== 'OPEN' || latest.headRefOid !== input.sha) return;
  const latestBody = latest.body ?? '';
  // A plan regeneration or human edit during downloads must not be overwritten.
  if (JSON.stringify(readVideoManifest(latestBody)) !== JSON.stringify(manifest)) return;
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
    const eventName = yield* Config.string('GITHUB_EVENT_NAME');
    const eventPath = yield* Config.string('GITHUB_EVENT_PATH');
    const pulls = yield* readPullResolution(eventName, eventPath).pipe(Effect.flatMap(resolveVideoPulls));
    const output = yield* Config.string('GITHUB_OUTPUT');
    yield* fs.writeFileString(output, `pulls=${JSON.stringify(pulls)}\n`, { flag: 'a' });
    return;
  }
  yield* Config.all({
    pr: Config.integer('VIDEO_PR'),
    sha: Config.string('VIDEO_SHA'),
    clear: Config.boolean('VIDEO_CLEAR')
  }).pipe(
    Effect.flatMap(input => updateManualTestPlanVideos(input)),
    Effect.scoped
  );
});

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().pipe(Effect.provide([GitHub.Default, NodeContext.layer]), Effect.runPromise);
}
