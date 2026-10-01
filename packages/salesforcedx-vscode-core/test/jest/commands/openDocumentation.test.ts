/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { EditorService, NoActiveEditorError } from 'salesforcedx-vscode-services/src/vscode/editorService';
import { openDocumentationCommand } from '../../../src/commands/openDocumentation';
import { nls } from '../../../src/messages';

describe('openDocumentationCommand', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [
      'Aura',
      '/force-app/main/default/aura/exampleAuraComponent/exampleAuraComponent.cmp',
      'aura',
      nls.localize('aura_doc_url')
    ],
    ['Apex class', '/force-app/main/default/classes/exampleApexClass.cls', 'apex', nls.localize('apex_doc_url')],
    ['Anonymous Apex', '/scripts/apex/exampleApex.apex', 'apex', nls.localize('apex_doc_url')],
    ['SOQL', '/scripts/soql/exampleSoql.soql', 'soql', nls.localize('soql_doc_url')],
    [
      'LWC',
      '/force-app/main/default/lwc/exampleLwcComponent/exampleLwcComponent.js',
      'lwc',
      nls.localize('lwc_doc_url')
    ],
    ['no active editor', undefined, 'default', nls.localize('default_doc_url')],
    ['default', '/force-app/main/default/staticresources/example-image.png', 'default', nls.localize('default_doc_url')]
  ])('opens %s documentation and emits its type', async (_label, fileName, type, expectedUrl) => {
    const openExternal = jest.fn().mockResolvedValue(true);
    (vscode.env as unknown as { openExternal: jest.Mock }).openExternal = openExternal;
    const annotateCurrentSpan = jest.spyOn(Effect, 'annotateCurrentSpan');
    const getActiveEditorUri = () =>
      fileName
        ? Effect.succeed(URI.file(fileName))
        : Effect.fail(new NoActiveEditorError({ message: 'No active text editor is currently open' }));
    const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed({ services: { EditorService } })
    } as never);
    const editorServiceLayer = Layer.succeed(EditorService, new EditorService({ getActiveEditorUri } as never));

    await Effect.runPromise(
      openDocumentationCommand().pipe(Effect.provide(Layer.mergeAll(extensionProviderLayer, editorServiceLayer)))
    );

    expect(annotateCurrentSpan).toHaveBeenCalledWith({ type });
    expect(openExternal).toHaveBeenCalledTimes(1);
    expect(openExternal.mock.calls[0][0].toString()).toBe(expectedUrl);
  });
});
