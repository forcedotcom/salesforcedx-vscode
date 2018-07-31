/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { nls } from '../messages';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';
import {
  FileType,
  ManifestOrSourcePathGatherer,
  SelectedPath
} from './forceSourceRetrieve';

export class ForceSourceDeployExecutor extends SfdxCommandletExecutor<
  SelectedPath
> {
  public build(data: SelectedPath): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_deploy_text'))
      .withArg('force:source:deploy');
    if (data.type === FileType.Manifest) {
      commandBuilder.withFlag('--manifest', data.filePath);
    } else {
      commandBuilder.withFlag('--sourcepath', data.filePath);
    }
    return commandBuilder.build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceSourceDeploy(explorerPath: any) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    new ManifestOrSourcePathGatherer(explorerPath),
    new ForceSourceDeployExecutor()
  );
  await commandlet.run();
}
