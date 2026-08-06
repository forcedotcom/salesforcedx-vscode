/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as NodePath from '@effect/platform-node/NodePath';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { ArtifactService } from '../src/artifactService';

jest.mock('@salesforce/playwright-vscode-ext', () => ({ redactValue: (value: unknown) => value }));

const PlatformLayer = Layer.merge(NodeFileSystem.layer, NodePath.layer);
const TestLayer = Layer.merge(ArtifactService.Default.pipe(Layer.provide(PlatformLayer)), PlatformLayer);

describe('ArtifactService', () => {
  test('writes JSONL plus typed finding and summary deliverables', async () => {
    const files = await Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: 'visual-qa-artifacts-' });
        const artifacts = yield* ArtifactService.create(root, 'run-1');
        const finding = {
          title: 'Misleading URL feedback',
          severity: 'high' as const,
          area: 'Project creation',
          steps: ['Open command', 'Enter an invalid URL'] as const,
          expected: 'Explain that the URL is invalid',
          actual: 'Reports an unrelated connection failure',
          confidence: 'high' as const,
          evidence: ['screenshots/0001.png']
        };
        yield* artifacts.appendFinding(finding);
        yield* artifacts.finish({
          objective: 'Validate URL feedback',
          runId: 'run-1',
          exploredCount: 5,
          actionCount: 3,
          observationCount: 2,
          findingCount: 1,
          status: 'completed-with-limitations',
          limitations: ['External windows are not covered.']
        });
        return yield* Effect.all(
          ['findings.jsonl', 'findings.json', 'findings.md', 'summary.json', 'summary.md'].map(fileName =>
            fs
              .readFileString(`${artifacts.artifactDir}/${fileName}`)
              .pipe(Effect.map(contents => [fileName, contents] as const))
          )
        );
      }).pipe(Effect.scoped, Effect.provide(TestLayer))
    );

    const output = Object.fromEntries(files);
    expect(JSON.parse(output['findings.jsonl'])).toEqual(expect.objectContaining({ title: 'Misleading URL feedback' }));
    expect(JSON.parse(output['findings.json'])).toHaveLength(1);
    expect(output['findings.md']).toContain('## 1. Misleading URL feedback');
    expect(JSON.parse(output['summary.json'])).toEqual(
      expect.objectContaining({ objective: 'Validate URL feedback', actionCount: 3 })
    );
    expect(output['summary.md']).toContain('- Findings: 1');
  });
});
