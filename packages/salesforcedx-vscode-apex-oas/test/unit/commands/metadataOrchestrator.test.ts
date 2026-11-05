/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { EditorService } from 'salesforcedx-vscode-services/src/vscode/editorService';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { ProjectService } from 'salesforcedx-vscode-services/src/core/projectService';
import { URI } from 'vscode-uri';
import { analyzeMetadata } from '../../../src/commands/metadataOrchestrator';
import { ContextGatheringFailed } from '../../../src/errors';
import { ApexMetadataService } from '../../../src/services/apexMetadataService';

describe('analyzeMetadata', () => {
  it('rejects resources outside package directories before requesting Apex LS metadata', async () => {
    const analyze = vi.fn();
    const error = await Effect.runPromise(
      analyzeMetadata(URI.file('/outside/Example.cls')).pipe(
        Effect.provideService(ApexMetadataService, { analyze } as never),
        Effect.provideService(EditorService, { getActiveEditorUri: () => Effect.die('not expected') } as never),
        Effect.provideService(FsService, { readFile: () => Effect.die('not expected') } as never),
        Effect.provideService(ProjectService, {
          ensureInPackageDirectories: () => Effect.fail(new Error('outside package directory'))
        } as never),
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            services: {
              ProjectService: {
                ensureInPackageDirectories: () => Effect.fail(new Error('outside package directory'))
              }
            }
          } as never)
        } as never),
        Effect.flip
      )
    );

    expect(error).toBeInstanceOf(ContextGatheringFailed);
    expect(analyze).not.toHaveBeenCalled();
  });
});
