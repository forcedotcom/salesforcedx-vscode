/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { showExtensionLicense } from '../../../src/vscode/showExtensionLicense';
import { FsService } from '../../../src/vscode/fsService';

const makeExtension = (id: string, licenseUrl?: string): vscode.Extension<unknown> => ({
  id,
  extensionUri: URI.file(`/extensions/${id}`),
  extensionPath: `/extensions/${id}`,
  isActive: false,
  packageJSON: { displayName: id, licenseUrl },
  extensionKind: 1,
  exports: undefined,
  activate: async () => undefined
});

const runLicenseCommand = () => Effect.runPromise(showExtensionLicense().pipe(Effect.provide(FsService.Default)));

describe('showExtensionLicense', () => {
  let installedExtensions: vscode.Extension<unknown>[];

  beforeEach(() => {
    installedExtensions = [];
    Object.defineProperty(vscode.extensions, 'all', { configurable: true, get: () => installedExtensions });
    jest.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([]);
  });

  it('notifies when only excluded publishers are installed', async () => {
    installedExtensions = [
      makeExtension('salesforce.first'),
      makeExtension('Salesforce.second'),
      makeExtension('vscode.git'),
      makeExtension('TypeScriptTeam.jsts-chat-features')
    ];

    await runLicenseCommand();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No third-party extensions are available.');
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
    expect(vscode.workspace.fs.readDirectory).not.toHaveBeenCalled();
  });

  it('opens the sole third-party extension without a picker', async () => {
    installedExtensions = [
      makeExtension('salesforce.services'),
      makeExtension('Acme.widget', 'https://example.com/widget-license')
    ];

    await runLicenseCommand();

    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      URI.parse('https://example.com/widget-license')
    );
  });

  it('offers only third-party extensions and opens the selected packaged license', async () => {
    const acme = makeExtension('Acme.widget');
    const zed = makeExtension('Zed.tool');
    installedExtensions = [
      zed,
      makeExtension('salesforce.services'),
      makeExtension('Vscode.git'),
      makeExtension('TypeScriptTeam.jsts-chat-features'),
      acme
    ];
    const selected = { label: 'Acme.widget', description: acme.id, extension: acme };
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(selected);
    jest.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([['LICENSE.md', vscode.FileType.File]]);
    const licenseUri = URI.file('/extensions/Acme.widget/LICENSE.md');
    jest.mocked(vscode.workspace.openTextDocument).mockResolvedValue({ uri: licenseUri } as vscode.TextDocument);
    jest.mocked(vscode.window.showTextDocument).mockResolvedValue({} as vscode.TextEditor);

    await runLicenseCommand();

    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      [
        { label: 'Acme.widget', description: acme.id, extension: acme },
        { label: 'Zed.tool', description: zed.id, extension: zed }
      ],
      { placeHolder: 'Select an extension to view its license', matchOnDescription: true }
    );
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(licenseUri);
    expect(vscode.window.showTextDocument).toHaveBeenCalledWith(licenseUri, { preview: false });
  });
});
