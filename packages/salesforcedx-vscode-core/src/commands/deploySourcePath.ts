/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse, SfWorkspaceChecker } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import type { URI } from 'vscode-uri';
import { getConflictMessagesFor } from '../conflict/messages';
import { nls } from '../messages';
import { salesforceCoreSettings } from '../settings';
import { DeployExecutor } from './deployExecutor';
import { SourcePathChecker } from './retrieveSourcePath';
import { LibraryPathsGatherer, SfCommandlet } from './util';
import { CompositePostconditionChecker } from './util/compositePostconditionChecker';
import { getUriFromActiveEditor } from './util/getUriFromActiveEditor';
import { TimestampConflictChecker } from './util/timestampConflictChecker';

class LibraryDeploySourcePathExecutor extends DeployExecutor<string[]> {
  constructor(showChannelOutput: boolean = true) {
    super(nls.localize('deploy_this_source_text'), 'deploy_with_sourcepath');
    this.showChannelOutput = showChannelOutput;
  }

  public async getComponents(response: ContinueResponse<string[]>): Promise<ComponentSet> {
    const paths = typeof response.data === 'string' ? [response.data] : response.data;
    const componentSet = ComponentSet.fromSource(paths);

    return componentSet;
  }
}

export const deploySourcePaths = async (
  sourceUri: URI | URI[] | undefined,
  uris: URI[] | undefined,
  isDeployOnSave?: boolean | undefined
) => {
  // When the source is deployed via the command palette, both sourceUri and uris are
  // each undefined, and sourceUri needs to be obtained from the active text editor.
  const resolvedSourceUri =
    sourceUri ??
    (await getUriFromActiveEditor({
      message: 'deploy_select_file_or_directory',
      exceptionKey: 'deploy_with_sourcepath'
    }));
  if (!resolvedSourceUri) {
    return;
  }
  // When a single file is selected and "Deploy Source from Org" is executed,
  // sourceUri is passed, and the uris array contains a single element, the same
  // path as sourceUri.
  //
  // When multiple files are selected and "Deploy Source from Org" is executed,
  // sourceUri is passed, and is the path to the first selected file, and the uris
  // array contains an array of all paths that were selected.
  //
  // When editing a file and "Deploy This Source from Org" is executed,
  // sourceUri is passed, but uris is undefined.

  // When "Push-or-deploy-on-save" is enabled, the first parameter
  // passed in (sourceUri) is actually an array and not a single URI.

  const resolvedUris = uris?.length ? uris : Array.isArray(resolvedSourceUri) ? resolvedSourceUri : [resolvedSourceUri];

  const messages = getConflictMessagesFor('deploy_with_sourcepath');

  if (messages) {
    const showOutputPanel = !(isDeployOnSave && !salesforceCoreSettings.getDeployOnSaveShowOutputPanel());

    const commandlet = new SfCommandlet<string[]>(
      new SfWorkspaceChecker(),
      new LibraryPathsGatherer(resolvedUris),
      new LibraryDeploySourcePathExecutor(showOutputPanel),
      new CompositePostconditionChecker(new SourcePathChecker(), new TimestampConflictChecker(false, messages))
    );

    await commandlet.run();
  }
};
