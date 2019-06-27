/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as fs from 'fs';
import { SfdxCommandletExecutor } from '../commands';
import { nls } from '../messages';
import { getRootWorkspacePath } from '../util';

export const folderTypes = new Set(['EmailTemplate', 'Report']);
export class ForceListMetadataExecutor extends SfdxCommandletExecutor<string> {
  private metadataType: string;
  private defaultUsernameOrAlias: string;

  public constructor(metadataType: string, defaultUsernameOrAlias: string) {
    super();
    this.metadataType = metadataType;
    this.defaultUsernameOrAlias = defaultUsernameOrAlias;
  }

  public build(data: {}): Command {
    let builder = new SfdxCommandBuilder()
      .withArg('force:mdapi:listmetadata')
      .withFlag('-m', this.metadataType)
      .withFlag('-u', this.defaultUsernameOrAlias)
      .withLogName(nls.localize('force_list_metadata_text'))
      .withJson();

    if (folderTypes.has(this.metadataType)) {
      builder = builder.withFlag('--folder', 'unfiled$public');
    }
    return builder.build();
  }
}

export async function forceListMetadata(
  metadataType: string,
  defaultUsernameOrAlias: string,
  outputPath: string
): Promise<string> {
  const execution = new CliCommandExecutor(
    new ForceListMetadataExecutor(metadataType, defaultUsernameOrAlias).build(
      {}
    ),
    { cwd: getRootWorkspacePath() }
  ).execute();

  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  fs.writeFileSync(outputPath, result);
  return result;
}
