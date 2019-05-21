/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer,
  PostconditionChecker,
  PreconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { Uri } from 'vscode';
import { channelService } from '../../channels';
import { notificationService } from '../../notifications';
import { sfdxCoreSettings } from '../../settings';
import { telemetryService } from '../../telemetry';
import { AURA_METADATA_TYPE, LWC_METADATA_TYPE } from './metadataTypeConstants';

export class InternalDevWorkspaceChecker implements PreconditionChecker {
  public check(): boolean {
    return sfdxCoreSettings.getInternalDev();
  }
}

export class FileInternalPathGatherer
  implements ParametersGatherer<{ outputdir: string }> {
  private filePath: string;
  public constructor(uri: Uri) {
    // add some validations here.
    this.filePath = uri.fsPath;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ outputdir: string }>
  > {
    const outputdir = this.filePath;
    return outputdir
      ? { type: 'CONTINUE', data: { outputdir } }
      : { type: 'CANCEL' };
  }
}

export class InternalSourcePathChecker
  implements PostconditionChecker<{ outputdir: string }> {
  private metadataType: string;
  public constructor(metadataType: string) {
    this.metadataType = metadataType;
  }
  public async check(
    inputs: ContinueResponse<{ outputdir: string }> | CancelResponse
  ): Promise<ContinueResponse<{ outputdir: string }> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const sourcePath = inputs.data.outputdir;
      if (
        this.metadataType === AURA_METADATA_TYPE &&
        sourcePath.indexOf('/components/') !== -1
      ) {
        return inputs;
      }

      if (
        this.metadataType === LWC_METADATA_TYPE &&
        sourcePath.indexOf('/modules/') !== -1
      ) {
        return inputs;
      }

      const errorMessage = 'Invalid folders to create aura or lwc';
      telemetryService.sendError(errorMessage);
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
    }
    return { type: 'CANCEL' };
  }
}
