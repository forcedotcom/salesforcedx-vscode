/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import * as vscode from 'vscode';
import { SymbolKind } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { ApexExtensionUnavailable } from '../../../src/errors';
import { ApexMetadataService, ensureApexLsAvailable } from '../../../src/services/apexMetadataService';

const analyze = () =>
  ApexMetadataService.analyze(URI.file('/project/Example.cls')).pipe(
    Effect.provide(ApexMetadataService.Default),
    Effect.provideService(ExtensionProviderService, {
      getServicesApi: Effect.die('The client export must resolve before source access')
    } as never),
    Effect.provideService(FsService, { readFile: () => Effect.die('Source access is not expected') } as never)
  );

const apexLsExports = (tokens: readonly unknown[] | undefined, symbols: readonly unknown[] | null) => ({
  client: {
    semanticTokens: vi.fn().mockResolvedValue(tokens),
    documentSymbol: vi.fn().mockResolvedValue(symbols)
  }
});

const ensureAvailable = () => ensureApexLsAvailable();

const runAnalysis = (exports: ReturnType<typeof apexLsExports>) =>
  ApexMetadataService.analyze(URI.file('/project/Example.cls')).pipe(
    Effect.provide(ApexMetadataService.Default),
    Effect.provideService(ExtensionProviderService, {
      getServicesApi: Effect.succeed({
        services: { FsService: { readFile: () => Effect.succeed('@CustomMarker global class Example {}') } }
      } as never)
    } as never),
    Effect.provideService(FsService, {
      readFile: () => Effect.succeed('@CustomMarker global class Example {}')
    } as never)
  );

describe('Apex LS metadata extension activation', () => {
  beforeEach(() => {
    vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as vscode.TextDocument);
  });

  it('fails when the Apex LS extension is unavailable', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);

    const error = await Effect.runPromise(analyze().pipe(Effect.flip));

    expect(error).toBeInstanceOf(ApexExtensionUnavailable);
    expect(error.message).toBe('Apex Language Server extension is not installed');
  });

  it('fails when the Apex LS extension activation rejects', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: false,
      activate: vi.fn().mockRejectedValue(new Error('activation failed'))
    } as unknown as vscode.Extension<unknown>);

    const error = await Effect.runPromise(analyze().pipe(Effect.flip));

    expect(error).toBeInstanceOf(ApexExtensionUnavailable);
    expect(error.message).toBe('Failed to activate Apex Language Server extension: Error: activation failed');
  });

  it('fails when Apex LS does not expose OAS-required standard-LSP methods', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports: { client: { semanticTokens: vi.fn() } }
    } as unknown as vscode.Extension<unknown>);

    const error = await Effect.runPromise(analyze().pipe(Effect.flip));

    expect(error._tag).toBe('ParseError');
  });

  it('accepts the Apex LS client shape required before OAS commands register', async () => {
    const exports = apexLsExports([], []);
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports
    } as unknown as vscode.Extension<unknown>);

    await expect(Effect.runPromise(ensureAvailable())).resolves.toBeUndefined();
    expect(exports.client.semanticTokens).not.toHaveBeenCalled();
    expect(exports.client.documentSymbol).not.toHaveBeenCalled();
  });

  it('uses guarded Apex LS standard-LSP methods to derive source analysis', async () => {
    const exports = apexLsExports(
      [
        { line: 0, character: 1, length: 12, tokenType: 'decorator', tokenModifiers: [] },
        { line: 0, character: 27, length: 7, tokenType: 'class', tokenModifiers: ['declaration'] }
      ],
      [
        {
          name: 'Example',
          detail: '',
          kind: SymbolKind.Class,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 40 } },
          selectionRange: { start: { line: 0, character: 27 }, end: { line: 0, character: 34 } }
        }
      ]
    );
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports
    } as unknown as vscode.Extension<unknown>);

    const result = await Effect.runPromise(runAnalysis(exports));

    expect(result.classContext.name).toBe('Example');
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(URI.file('/project/Example.cls'));
    expect(exports.client.semanticTokens).toHaveBeenCalledWith({
      textDocument: { uri: URI.file('/project/Example.cls').toString() }
    });
    expect(exports.client.documentSymbol).toHaveBeenCalledOnce();
  });

  it('rejects an unavailable semantic-token capability', async () => {
    const exports = apexLsExports(undefined, []);
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports
    } as unknown as vscode.Extension<unknown>);

    const error = await Effect.runPromise(runAnalysis(exports).pipe(Effect.flip));

    expect(error.message).toBe('Apex Language Server does not provide semantic tokens');
  });

  it('rejects flat document symbols because OAS needs declaration hierarchy', async () => {
    const exports = apexLsExports(
      [],
      [
        {
          name: 'Example',
          kind: SymbolKind.Class,
          location: {
            uri: URI.file('/project/Example.cls').toString(),
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
          }
        }
      ]
    );
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports
    } as unknown as vscode.Extension<unknown>);

    const error = await Effect.runPromise(runAnalysis(exports).pipe(Effect.flip));

    expect(error.message).toBe('Apex Language Server did not provide hierarchical document symbols');
  });
});
