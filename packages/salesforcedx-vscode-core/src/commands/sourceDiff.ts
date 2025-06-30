/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfWorkspaceChecker } from '@salesforce/salesforcedx-utils-vscode';
import { URI } from 'vscode-uri';
import { MetadataCacheExecutor, MetadataCacheResult, PathType } from '../conflict';
import * as differ from '../conflict/directoryDiffer';
import { WorkspaceContext } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { FilePathGatherer, SfCommandlet } from './util';
import { getUriFromActiveEditor } from './util/getUriFromActiveEditor';

const workspaceChecker = new SfWorkspaceChecker();

export const sourceDiff = async (sourceUri?: URI) => {
  const resolved =
    sourceUri ??
    (await getUriFromActiveEditor({
      message: 'source_diff_unsupported_type',
      exceptionKey: 'unsupported_type_on_diff'
    }));

  if (!resolved) {
    return;
  }

  const targetOrgorAlias = WorkspaceContext.getInstance().username;
  if (!targetOrgorAlias) {
    await notificationService.showErrorMessage(nls.localize('missing_default_org'));
    return;
  }
  const executor = new MetadataCacheExecutor(
    targetOrgorAlias,
    nls.localize('source_diff_text'),
    'source_diff',
    handleCacheResults
  );
  const commandlet = new SfCommandlet(workspaceChecker, new FilePathGatherer(resolved), executor);
  await commandlet.run();
};

export const sourceFolderDiff = async (explorerPath?: URI) => {
  const resolved =
    explorerPath ??
    (await getUriFromActiveEditor({
      message: 'source_diff_unsupported_type',
      exceptionKey: 'unsupported_type_on_diff'
    }));
  if (!resolved) {
    return;
  }

  const username = WorkspaceContext.getInstance().username;
  if (!username) {
    await notificationService.showErrorMessage(nls.localize('missing_default_org'));
    return;
  }

  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new FilePathGatherer(resolved),
    new MetadataCacheExecutor(
      username,
      nls.localize('source_diff_folder_text'),
      'source-diff-loader',
      handleCacheResults
    )
  );
  await commandlet.run();
};

const handleCacheResults = async (username: string, cache?: MetadataCacheResult): Promise<void> => {
  if (cache) {
    if (cache.selectedType === PathType.Individual && cache.cache.components) {
      await differ.diffOneFile(cache.selectedPath, cache.cache.components[0], username);
    } else if (cache.selectedType === PathType.Folder) {
      differ.diffFolder(cache, username);
    }
  } else {
    const message = nls.localize('source_diff_components_not_in_org');
    void notificationService.showErrorMessage(message);
    throw new Error(message);
  }
};
