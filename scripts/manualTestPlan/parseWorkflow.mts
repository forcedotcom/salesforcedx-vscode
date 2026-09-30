/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Option } from 'effect';

const excludedWorkflows = ['e2e.yml', 'playwrightE2EFullSuite.yml', 'rerunPushE2E.yml'] as const;

type WorkflowJob = {
  readonly key: string;
  readonly runs: readonly string[];
  readonly matrix: Readonly<Record<string, readonly string[]>>;
  readonly uploadPaths: readonly string[];
};
export type ParsedWorkflow = { readonly name: string; readonly jobs: readonly WorkflowJob[] };

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

const addValues = (record: Readonly<Record<string, readonly string[]>>, key: string, values: readonly string[]) => ({
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
  }>(
    (acc, line) => {
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
    },
    { inJobs: false, jobs: [] }
  ).jobs;

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

const workflowReferencesPackage = (workflow: ParsedWorkflow, dir: string, npmName: string) =>
  workflow.jobs.some(job => jobReferencesPackage(job, dir, npmName));

export const workflowRecords = (workflows: readonly ParsedWorkflow[], dir: string, npmName: string) =>
  workflows
    .filter(workflow => workflowReferencesPackage(workflow, dir, npmName))
    .map(workflow => ({ name: workflow.name, jobs: workflow.jobs.map(job => job.key) }));
