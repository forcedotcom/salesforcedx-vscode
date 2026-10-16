/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { EditorService } from 'salesforcedx-vscode-services/src/vscode/editorService';
import { CHECKPOINT } from '../../../src/debuggerConstants';

vi.mock('../../../src/apexExtension', () => ({
  salesforceApexExtension: { isActive: true, activate: vi.fn() },
  retrieveLineBreakpointInfo: () => Effect.void
}));

import { sfToggleCheckpointCommand } from '../../../src/breakpoints/checkpointService';

describe('sfToggleCheckpointCommand', () => {
  it('uses EditorService URI and cursor line to add a checkpoint breakpoint', async () => {
    const documentUri = URI.file('/project/classes/Example.cls');
    const addBreakpoints = vi.fn();
    const removeBreakpoints = vi.fn();
    const debug = { breakpoints: [], addBreakpoints, removeBreakpoints };
    class MockSourceBreakpoint {
      constructor(
        public location: vscode.Location,
        public enabled: boolean,
        public condition?: string,
        public hitCondition?: string
      ) {}
    }
    Object.defineProperty(vscode, 'debug', { configurable: true, value: debug });
    Object.defineProperty(vscode, 'SourceBreakpoint', { configurable: true, value: MockSourceBreakpoint });

    const servicesApi = { services: { EditorService } } as unknown as SalesforceVSCodeServicesApi;
    const editorService = {
      getActiveEditorContext: () =>
        Effect.succeed({
          text: '',
          documentUri,
          selectionStart: { line: 7, character: 12 },
          selectionRange: { startLine: 7, startCharacter: 12 }
        })
    } as unknown as EditorService;
    const layer = Layer.mergeAll(
      Layer.succeed(ExtensionProviderService, { getServicesApi: Effect.succeed(servicesApi) }),
      Layer.succeed(EditorService, editorService)
    );

    await Effect.runPromise(sfToggleCheckpointCommand().pipe(Effect.provide(layer)));

    expect(removeBreakpoints).not.toHaveBeenCalled();
    expect(addBreakpoints).toHaveBeenCalledTimes(1);
    const [breakpoint] = addBreakpoints.mock.calls[0][0] as [InstanceType<typeof MockSourceBreakpoint>];
    expect(breakpoint).toBeInstanceOf(MockSourceBreakpoint);
    expect(breakpoint.location.uri).toBe(documentUri);
    expect(breakpoint.location.range.start.line).toBe(7);
    expect(breakpoint.condition).toBe(CHECKPOINT);
  });
});
