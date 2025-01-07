/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve-bundle';
import * as fs from 'fs';
import { join, parse } from 'path';
import { format } from 'util';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import { workspaceUtils } from '../util';
import { FilePathGatherer, SfCommandlet, SfWorkspaceChecker } from './util';

const GENERATE_MANIFEST_EXECUTOR = 'project_generate_manifest';
const DEFAULT_MANIFEST = 'package.xml';
const MANIFEST_SAVE_PLACEHOLDER = 'manifest_input_save_placeholder';
const MANIFEST_SAVE_PROMPT = 'manifest_input_save_prompt';

export class GenerateManifestExecutor extends LibraryCommandletExecutor<string> {
  private sourcePaths: string[];
  private responseText: string | undefined;
  constructor(sourcePaths: string[], responseText: string | undefined) {
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

export const projectGenerateManifest = async (sourceUri: vscode.Uri, uris: vscode.Uri[] | undefined): Promise<void> => {
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
    const commandlet = new SfCommandlet(
      new SfWorkspaceChecker(),
      new FilePathGatherer(sourceUri),
      new GenerateManifestExecutor(sourcePaths, responseText)
    );
    await commandlet.run();
  }
};

const openUntitledDocument = async (packageXML: string): Promise<void> => {
  const newManifest = await vscode.workspace.openTextDocument({
    content: packageXML,
    language: 'xml'
  });

  void vscode.window.showTextDocument(newManifest);
};

const saveDocument = async (response: string, packageXML: string): Promise<void> => {
  const fileName = response ? appendExtension(response) : DEFAULT_MANIFEST;

  const manifestPath = join(workspaceUtils.getRootWorkspacePath(), 'manifest');
  if (!fs.existsSync(manifestPath)) {
    fs.mkdirSync(manifestPath);
  }
  const saveLocation = join(manifestPath, fileName);
  checkForDuplicateManifest(saveLocation, fileName);

  fs.writeFileSync(saveLocation, packageXML);
  await vscode.workspace.openTextDocument(saveLocation).then((newManifest: any) => {
    void vscode.window.showTextDocument(newManifest);
  });
};

const checkForDuplicateManifest = (saveLocation: string, fileName: string): void => {
  if (fs.existsSync(saveLocation)) {
    void vscode.window.showErrorMessage(format(nls.localize('manifest_input_dupe_error'), fileName));
    throw new Error(format(nls.localize('manifest_input_dupe_error'), fileName));
  }
};

const appendExtension = (input: string): string => parse(input).name?.concat('.xml');
