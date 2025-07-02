/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ContinueResponse,
  LibraryCommandletExecutor,
  createDirectory,
  fileOrFolderExists,
  workspaceUtils,
  writeFile
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import { join, parse } from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import { FilePathGatherer, SfCommandlet, SfWorkspaceChecker } from './util';

const GENERATE_MANIFEST_EXECUTOR = 'project_generate_manifest';
const DEFAULT_MANIFEST = 'package.xml';
const MANIFEST_SAVE_PLACEHOLDER = 'manifest_input_save_placeholder';
const MANIFEST_SAVE_PROMPT = 'manifest_input_save_prompt';

class GenerateManifestExecutor extends LibraryCommandletExecutor<string> {
  private sourcePaths: string[];
  private responseText: string;
  constructor(sourcePaths: string[], responseText: string) {
    super(nls.localize(GENERATE_MANIFEST_EXECUTOR), GENERATE_MANIFEST_EXECUTOR, OUTPUT_CHANNEL);
    this.sourcePaths = sourcePaths;
    this.responseText = responseText;
  }

  public async run(
    response: ContinueResponse<string>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: vscode.CancellationToken
  ): Promise<boolean> {
    if (this.sourcePaths) {
      const packageXML = await ComponentSet.fromSource(this.sourcePaths).getPackageXml();
      // responseText is guaranteed to be a string here since we check for cancellation at the top level
      // If responseText is empty string, user clicked OK without entering a name (will use default filename)
      // If responseText has content, user entered a filename
      await saveDocument(this.responseText, packageXML);
      return true;
    }
    return false;
  }
}

export const projectGenerateManifest = async (sourceUri: URI, uris: URI[] | undefined): Promise<void> => {
  if (!uris || uris.length < 1) {
    uris = [];
    uris.push(sourceUri);
  }
  const sourcePaths = uris.map(uri => uri.fsPath);
  const inputOptions: vscode.InputBoxOptions = {
    placeHolder: nls.localize(MANIFEST_SAVE_PLACEHOLDER),
    prompt: nls.localize(MANIFEST_SAVE_PROMPT)
  };
  const responseText = await vscode.window.showInputBox(inputOptions);

  // If user cancelled the input (pressed Escape), don't proceed
  if (responseText === undefined) {
    void vscode.window.showWarningMessage(nls.localize('manifest_generation_cancelled'));
    return;
  }

  if (sourcePaths) {
    const commandlet = new SfCommandlet(
      new SfWorkspaceChecker(),
      new FilePathGatherer(sourceUri),
      new GenerateManifestExecutor(sourcePaths, responseText)
    );
    await commandlet.run();
  }
};

const saveDocument = async (response: string, packageXML: string): Promise<void> => {
  const fileName = response ? appendExtension(response) : DEFAULT_MANIFEST;

  const manifestPath = join(workspaceUtils.getRootWorkspacePath(), 'manifest');
  await createDirectory(manifestPath);
  const saveLocation = join(manifestPath, fileName);
  await checkForDuplicateManifest(saveLocation, fileName);

  await writeFile(saveLocation, packageXML);
  await vscode.workspace.openTextDocument(saveLocation).then((newManifest: any) => {
    void vscode.window.showTextDocument(newManifest);
  });
};

const checkForDuplicateManifest = async (saveLocation: string, fileName: string): Promise<void> => {
  if (await fileOrFolderExists(saveLocation)) {
    void vscode.window.showErrorMessage(nls.localize('manifest_input_dupe_error', fileName));
    throw new Error(nls.localize('manifest_input_dupe_error', fileName));
  }
};

const appendExtension = (input: string): string => parse(input).name?.concat('.xml');
