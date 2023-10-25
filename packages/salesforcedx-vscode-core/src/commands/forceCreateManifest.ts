/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import { join, parse } from 'path';
import { format } from 'util';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import { workspaceUtils } from '../util';
import { FilePathGatherer, SfdxCommandlet, SfdxWorkspaceChecker } from './util';

const CREATE_MANIFEST_EXECUTOR = 'force_create_manifest';
const DEFAULT_MANIFEST = 'package.xml';
const MANIFEST_SAVE_PLACEHOLDER = 'manifest_input_save_placeholder';
const MANIFEST_SAVE_PROMPT = 'manifest_input_save_prompt';

export class ManifestCreateExecutor extends LibraryCommandletExecutor<string> {
  private sourcePaths: string[];
  private responseText: string | undefined;
  constructor(sourcePaths: string[], responseText: string | undefined) {
    super(
      nls.localize(CREATE_MANIFEST_EXECUTOR),
      CREATE_MANIFEST_EXECUTOR,
      OUTPUT_CHANNEL
    );
    this.sourcePaths = sourcePaths;
    this.responseText = responseText;
  }
  /* eslint-disable @typescript-eslint/no-unused-vars */
  public async run(
    response: ContinueResponse<string>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: vscode.CancellationToken
  ): Promise<boolean> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
    if (this.sourcePaths) {
      const packageXML = await ComponentSet.fromSource(
        this.sourcePaths
      ).getPackageXml();
      if (this.responseText === undefined) {
        // Canceled and declined to name the document
        await openUntitledDocument(packageXML);
      } else {
        saveDocument(this.responseText, packageXML);
      }
      return true;
    }
    return false;
  }
}

export async function forceCreateManifest(
  sourceUri: vscode.Uri,
  uris: vscode.Uri[] | undefined
) {
  if (!uris || uris.length < 1) {
    uris = [];
    uris.push(sourceUri);
  }
  const sourcePaths = uris.map(uri => uri.fsPath);
  const inputOptions = {
    placeHolder: nls.localize(MANIFEST_SAVE_PLACEHOLDER),
    prompt: nls.localize(MANIFEST_SAVE_PROMPT)
  } as vscode.InputBoxOptions;
  const responseText = await vscode.window.showInputBox(inputOptions);
  if (sourcePaths) {
    const commandlet = new SfdxCommandlet(
      new SfdxWorkspaceChecker(),
      new FilePathGatherer(sourceUri),
      new ManifestCreateExecutor(sourcePaths, responseText)
    );
    await commandlet.run();
  }
}

async function openUntitledDocument(packageXML: string) {
  const newManifest = await vscode.workspace.openTextDocument({
    content: packageXML,
    language: 'xml'
  });

  await vscode.window.showTextDocument(newManifest);
}

function saveDocument(response: string, packageXML: string) {
  const fileName = response ? appendExtension(response) : DEFAULT_MANIFEST;

  const manifestPath = join(workspaceUtils.getRootWorkspacePath(), 'manifest');
  if (!fs.existsSync(manifestPath)) {
    fs.mkdirSync(manifestPath);
  }
  const saveLocation = join(manifestPath, fileName);
  checkForDuplicateManifest(saveLocation, fileName);

  fs.writeFileSync(saveLocation, packageXML);
  void vscode.workspace.openTextDocument(saveLocation).then((newManifest: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    void vscode.window.showTextDocument(newManifest);
  });
}

function checkForDuplicateManifest(saveLocation: string, fileName: string) {
  if (fs.existsSync(saveLocation)) {
    void vscode.window.showErrorMessage(
      format(nls.localize('manifest_input_dupe_error'), fileName)
    );
    throw new Error(
      format(nls.localize('manifest_input_dupe_error'), fileName)
    );
  }
}

function appendExtension(input: string) {
  return parse(input).name?.concat('.xml');
}
