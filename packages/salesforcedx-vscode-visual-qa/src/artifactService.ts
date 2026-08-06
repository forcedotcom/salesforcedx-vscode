/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type {
  VisualQaActionRecord,
  VisualQaFinding,
  VisualQaManifest,
  VisualQaRendererConsoleEntry,
  VisualQaSummary
} from './schemas';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import { redactValue } from '@salesforce/playwright-vscode-ext';
import * as Effect from 'effect/Effect';
import { causeMessage, VisualQaArtifactError } from './errors';

type ArtifactWrite = { filePath: string; contents: string; append: boolean };
const json = (value: unknown, pretty = false) =>
  `${JSON.stringify(redactValue(value), undefined, pretty ? 2 : undefined)}\n`;
type ArtifactWriter = {
  artifactDir: string;
  screenshotsDir: string;
  writeManifest: (manifest: VisualQaManifest) => Effect.Effect<void, VisualQaArtifactError>;
  appendAction: (action: VisualQaActionRecord) => Effect.Effect<void, VisualQaArtifactError>;
  appendRendererConsole: (entry: VisualQaRendererConsoleEntry) => Effect.Effect<void, VisualQaArtifactError>;
  appendFinding: (finding: VisualQaFinding) => Effect.Effect<void, VisualQaArtifactError>;
  finish: (summary: VisualQaSummary) => Effect.Effect<void, VisualQaArtifactError>;
  flush: Effect.Effect<void, VisualQaArtifactError>;
};

const markdownValue = (value: string) => value.replaceAll('\n', ' ');
const findingsMarkdown = (findings: readonly VisualQaFinding[]) =>
  findings.length === 0
    ? '# Findings\n\nNo findings recorded.\n'
    : `# Findings\n\n${findings.map((finding, index) => `## ${index + 1}. ${markdownValue(finding.title)}\n\n- Severity: ${finding.severity}\n- Area: ${markdownValue(finding.area)}\n- Confidence: ${finding.confidence}\n- Expected: ${markdownValue(finding.expected)}\n- Actual: ${markdownValue(finding.actual)}\n- Steps:\n${finding.steps.map((step, stepIndex) => `  ${stepIndex + 1}. ${markdownValue(step)}`).join('\n')}\n${finding.evidence === undefined ? '' : `- Evidence: ${finding.evidence.map(markdownValue).join(', ')}\n`}`).join('\n')}\n`;
const summaryMarkdown = (summary: VisualQaSummary) =>
  `# Visual QA Summary\n\n- Objective: ${markdownValue(summary.objective)}\n- Run ID: ${summary.runId}\n- Status: ${summary.status}\n- Explored: ${summary.exploredCount}\n- Actions: ${summary.actionCount}\n- Observations: ${summary.observationCount}\n- Findings: ${summary.findingCount}\n- Limitations: ${summary.limitations.length === 0 ? 'None' : summary.limitations.map(markdownValue).join('; ')}\n`;

export class ArtifactService extends Effect.Service<ArtifactService>()('VisualQa/ArtifactService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const create = Effect.fn('ArtifactService.create')(function* (artifactRoot: string, runId: string) {
      const artifactDir = path.join(artifactRoot, runId);
      const screenshotsDir = path.join(artifactDir, 'screenshots');
      yield* fs
        .makeDirectory(screenshotsDir, { recursive: true })
        .pipe(
          Effect.mapError(
            cause =>
              new VisualQaArtifactError({ message: 'Failed to create artifact directory', cause: causeMessage(cause) })
          )
        );
      const semaphore = yield* Effect.makeSemaphore(1);
      const findings: VisualQaFinding[] = [];
      const write = Effect.fn('ArtifactService.write')((item: ArtifactWrite) =>
        semaphore.withPermits(1)(
          fs
            .writeFileString(item.filePath, item.contents, item.append ? { flag: 'a' } : undefined)
            .pipe(
              Effect.mapError(
                cause =>
                  new VisualQaArtifactError({ message: `Failed to write ${item.filePath}`, cause: causeMessage(cause) })
              )
            )
        )
      );
      return {
        artifactDir,
        screenshotsDir,
        writeManifest: (manifest: VisualQaManifest) =>
          write({ filePath: path.join(artifactDir, 'manifest.json'), contents: json(manifest, true), append: false }),
        appendAction: (action: VisualQaActionRecord) =>
          write({ filePath: path.join(artifactDir, 'actions.jsonl'), contents: json(action), append: true }),
        appendRendererConsole: (entry: VisualQaRendererConsoleEntry) =>
          write({ filePath: path.join(artifactDir, 'renderer-console.jsonl'), contents: json(entry), append: true }),
        appendFinding: (finding: VisualQaFinding) =>
          semaphore.withPermits(1)(
            fs.writeFileString(path.join(artifactDir, 'findings.jsonl'), json(finding), { flag: 'a' }).pipe(
              Effect.tap(() => Effect.sync(() => findings.push(finding))),
              Effect.mapError(
                cause => new VisualQaArtifactError({ message: 'Failed to write finding', cause: causeMessage(cause) })
              )
            )
          ),
        finish: (summary: VisualQaSummary) =>
          semaphore.withPermits(1)(
            Effect.all(
              [
                fs.writeFileString(path.join(artifactDir, 'findings.json'), json(findings, true)),
                fs.writeFileString(path.join(artifactDir, 'findings.md'), findingsMarkdown(findings)),
                fs.writeFileString(path.join(artifactDir, 'summary.json'), json(summary, true)),
                fs.writeFileString(path.join(artifactDir, 'summary.md'), summaryMarkdown(summary))
              ],
              { concurrency: 1, discard: true }
            ).pipe(
              Effect.mapError(
                cause =>
                  new VisualQaArtifactError({ message: 'Failed to write final artifacts', cause: causeMessage(cause) })
              )
            )
          ),
        flush: semaphore.withPermits(1)(Effect.void)
      } satisfies ArtifactWriter;
    });
    return { create };
  })
}) {}
