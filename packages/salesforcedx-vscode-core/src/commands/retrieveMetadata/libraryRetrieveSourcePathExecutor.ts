/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse, LocalComponent } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet, RetrieveResult } from '@salesforce/source-deploy-retrieve-bundle';
import { ComponentLike } from '@salesforce/source-deploy-retrieve-bundle/lib/src/resolve/types';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { SalesforcePackageDirectories } from '../../salesforceProject';
import { workspaceUtils } from '../../util';
import { RetrieveExecutor } from '../baseDeployRetrieve';

export class LibraryRetrieveSourcePathExecutor extends RetrieveExecutor<LocalComponent[]> {
  private openAfterRetrieve: boolean;

  constructor(openAfterRetrieve = false) {
    super(nls.localize('retrieve_this_source_text'), 'retrieve_with_sourcepath');
    this.openAfterRetrieve = openAfterRetrieve;
  }

  protected async getComponents(response: ContinueResponse<LocalComponent[]>): Promise<ComponentSet> {
    const toRetrieve = new ComponentSet(response.data.map(lc => ({ fullName: lc.fileName, type: lc.type })));
    const packageDirs = await SalesforcePackageDirectories.getPackageDirectoryFullPaths();
    const localSourceComponents = ComponentSet.fromSource({
      fsPaths: packageDirs,
      include: toRetrieve
    });
    for (const component of localSourceComponents) {
      toRetrieve.add(component);
    }
    return toRetrieve;
  }

  protected async postOperation(result: RetrieveResult | undefined) {
    await super.postOperation(result);

    // assumes opening only one component
    if (result && this.openAfterRetrieve) {
      const componentToOpen = result.components.getSourceComponents().first();

      if (componentToOpen) {
        const dirPath = (await SalesforcePackageDirectories.getDefaultPackageDir()) || '';
        const defaultOutput = path.join(workspaceUtils.getRootWorkspacePath(), dirPath);
        const compSet = ComponentSet.fromSource(defaultOutput);
        await this.openResources(this.findResources(componentToOpen, compSet));
      }
    }
  }

  private findResources(filter: ComponentLike, compSet?: ComponentSet): string[] {
    if (compSet && compSet.size > 0) {
      const oneComp = compSet.getSourceComponents(filter).first();

      const filesToOpen = [];
      if (oneComp) {
        if (oneComp.xml) {
          filesToOpen.push(oneComp.xml);
        }

        for (const filePath of oneComp.walkContent()) {
          filesToOpen.push(filePath);
        }
      }
      return filesToOpen;
    }
    return [];
  }

  private async openResources(filesToOpen: string[]): Promise<void> {
    for (const file of filesToOpen) {
      const showOptions: vscode.TextDocumentShowOptions = {
        preview: false
      };
      const document = await vscode.workspace.openTextDocument(file);
      vscode.window.showTextDocument(document, showOptions);
    }
  }
}
