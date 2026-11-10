/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { VideoTarget } from './videoManifest.mts';
import { Schema } from 'effect';

const Step = Schema.Struct({
  uses: Schema.optional(Schema.String),
  with: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
});
export const Workflow = Schema.Struct({
  name: Schema.String,
  jobs: Schema.Record({
    key: Schema.String,
    value: Schema.Struct({
      name: Schema.optional(Schema.String),
      strategy: Schema.optional(
        Schema.Struct({ matrix: Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) }) })
      ),
      steps: Schema.optional(Schema.Array(Step))
    })
  })
});

const expand = (template: string, matrix: Readonly<Record<string, string>>) =>
  template.replaceAll(/\$\{\{\s*matrix\.(\w+)\s*\}\}/g, (match, key: string) => matrix[key] ?? match);

/** Resolve artifact names from trusted workflow inputs, including every matrix combination. */
export const targetLanes = (workflow: typeof Workflow.Type, target: VideoTarget) => {
  const job = workflow.jobs[target.job];
  const steps = job?.steps ?? [];
  const action = steps.find(step => step.uses?.endsWith('/.github/actions/playwright-e2e'))?.with;
  const uploads = steps.filter(step => step.uses?.startsWith('actions/upload-artifact@')).map(step => step.with);
  const report =
    action?.['report-name'] ?? uploads.find(step => String(step?.path).endsWith('/playwright-report'))?.name;
  const results = action?.['results-name'] ?? uploads.find(step => String(step?.path).endsWith('/test-results'))?.name;
  const workspace = action?.workspace ?? uploads.find(step => String(step?.path).endsWith('/test-results'))?.path;
  if (typeof report !== 'string' || typeof results !== 'string' || typeof workspace !== 'string') return [];
  const matrices = Object.entries(job?.strategy?.matrix ?? {}).reduce<Readonly<Record<string, string>>[]>(
    (rows, [key, values]) => rows.flatMap(row => values.map(value => ({ ...row, [key]: value }))),
    [{}]
  );
  return matrices.flatMap(matrix => {
    const expandedWorkspace = expand(workspace, matrix).replace(/\/test-results$/, '');
    const values = Object.values(matrix);
    const name =
      job?.name === undefined
        ? `${target.job}${values.length === 0 ? '' : ` (${values.join(', ')})`}`
        : expand(job.name, matrix);
    return target.spec.startsWith(`${expandedWorkspace}/test/playwright/`) && !target.spec.split('/').includes('..')
      ? [{ name, report: expand(report, matrix), results: expand(results, matrix) }]
      : [];
  });
};

export const WorkflowRun = Schema.Struct({
  id: Schema.Number,
  name: Schema.NullOr(Schema.String),
  path: Schema.String,
  head_sha: Schema.String,
  status: Schema.NullOr(Schema.String),
  conclusion: Schema.NullOr(Schema.String),
  run_attempt: Schema.Number
});
export const Artifact = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  expired: Schema.Boolean,
  created_at: Schema.String,
  workflow_run: Schema.optional(Schema.Struct({ head_sha: Schema.String }))
});

export const latestTargetRun = (runs: readonly (typeof WorkflowRun.Type)[], sha: string, workflow: string) =>
  runs.filter(run => run.head_sha === sha && run.name === workflow).toSorted((a, b) => b.id - a.id)[0];

/** Reruns can leave identically named artifacts. Match each job attempt's upload window. */
export const jobArtifact = (
  artifacts: readonly (typeof Artifact.Type)[],
  name: string,
  sha: string,
  job: { readonly started_at?: string | null; readonly completed_at?: string | null }
) =>
  artifacts
    .filter(
      artifact =>
        artifact.name === name &&
        !artifact.expired &&
        artifact.workflow_run?.head_sha === sha &&
        job.started_at !== undefined &&
        job.started_at !== null &&
        job.completed_at !== undefined &&
        job.completed_at !== null &&
        Date.parse(artifact.created_at) >= Date.parse(job.started_at) &&
        Date.parse(artifact.created_at) <= Date.parse(job.completed_at)
    )
    .toSorted((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)[0];
