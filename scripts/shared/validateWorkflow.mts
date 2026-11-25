/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { validateWorkflow as validateWorkflowSchema } from '@action-validator/core';
import { isRecord } from 'effect/Predicate';
import { parseDocument, stringify } from 'yaml';

// @action-validator/core@0.6.0 predates GitHub's queue: max concurrency option:
// https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
// Accept only the documented literal with cancellation explicitly disabled; let
// the bundled schema validate every remaining field, including group and job shape.
const compatibleConcurrency = (value: unknown) => {
  if (!isRecord(value) || value.queue !== 'max' || value['cancel-in-progress'] !== false) return value;
  const { queue: _queue, ...concurrency } = value;
  return concurrency;
};

const compatibleJob = (job: unknown) =>
  isRecord(job) && Object.hasOwn(job, 'concurrency')
    ? { ...job, concurrency: compatibleConcurrency(job.concurrency) }
    : job;

export const validateWorkflow = (source: string) => {
  const document = parseDocument(source);
  if (document.errors.length > 0) return validateWorkflowSchema(source);
  const workflow: unknown = document.toJS();
  if (!isRecord(workflow)) return validateWorkflowSchema(source);
  return validateWorkflowSchema(
    stringify({
      ...workflow,
      ...(Object.hasOwn(workflow, 'concurrency') ? { concurrency: compatibleConcurrency(workflow.concurrency) } : {}),
      ...(isRecord(workflow.jobs)
        ? { jobs: Object.fromEntries(Object.entries(workflow.jobs).map(([name, job]) => [name, compatibleJob(job)])) }
        : {})
    })
  );
};
