/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channel';
import { nls } from '../messages';

const EXTENSION_NAME = 'salesforce.salesforcedx-vscode-lwc';

type XMLExtensionApi = {
  addXMLCatalogs: (catalogs: string[]) => void;
  addXMLFileAssociations: (fileAssociations: { systemId: string; pattern: string }[]) => void;
};

export class MetaSupport {
  private static instance: MetaSupport;

  public static initializeSupport() {
    if (!MetaSupport.instance) {
      MetaSupport.instance = new MetaSupport();
    }
    return MetaSupport.instance;
  }

  /**
   * Returns path to the XSD and XML files from the extension folder.
   * TODO: use npm install to deliever these files.
   * @param targetFileName - a list of file names
   * @returns - a list of path for each file name
   */
  private getLocalFilePath(targetFileNames: [string]) {
    const thisExtPath = vscode.extensions.getExtension(EXTENSION_NAME)!.extensionPath;
    return targetFileNames.map(targetFileName => path.join(thisExtPath, 'resources', 'static', targetFileName));
  }

  /**
   * A Promise to setup Redhat XML API
   * @param inputCatalogs - a list of catalog file names
   * @param inputFileAssociations - a list of dictionary specifying file associations
   * @returns - None
   */
  private async setupRedhatXml(
    inputCatalogs: string[],
    inputFileAssociations: { systemId: string; pattern: string }[],
    redHatExtension: vscode.Extension<XMLExtensionApi>
  ) {
    try {
      if (!redHatExtension.isActive) {
        await redHatExtension.activate();
      }
      redHatExtension.exports.addXMLCatalogs(inputCatalogs);
      redHatExtension.exports.addXMLFileAssociations(inputFileAssociations);
    } catch (error) {
      channelService.appendLine(nls.localize('lightning_lwc_fail_redhat_extension'));
      const errorMsg = error.message ?? error;
      channelService.appendLine(errorMsg);
    }
  }

  /**
   * This function checks the enviornment and passes relevant settings
   * to set up RedHat XML
   */
  public async getMetaSupport(): Promise<void> {
    // redHatExtension API reference: https://github.com/redhat-developer/vscode-xml/pull/292
    const redHatExtension = vscode.extensions.getExtension<XMLExtensionApi>('redhat.vscode-xml');
    if (redHatExtension === undefined) {
      return channelService.appendLine(nls.localize('lightning_lwc_no_redhat_extension_found'));
    }
    const pluginVersionNumber = redHatExtension.packageJSON['version'];

    if (typeof pluginVersionNumber !== 'string') {
      channelService.appendLine(nls.localize('lightning_lwc_no_redhat_extension_found'));
      return;
    }
    // checks if the installed plugin version is exactly 0.14.0 or 0.16+,
    // 0.15.0 has a regression and 0.13.0 or earlier versions are not supported
    const [major, minor] = pluginVersionNumber.split('.').map(i => parseInt(i, 10));

    if (major >= 1 || minor === 14 || minor >= 16) {
      const catalogs = this.getLocalFilePath(['js-meta-home.xml']);
      const fileAssociations = [
        {
          systemId: this.getLocalFilePath(['js-meta.xsd'])[0],
          pattern: '**/*js-meta.xml'
        }
      ];
      await this.setupRedhatXml(catalogs, fileAssociations, redHatExtension);
    } else if (minor === 15) {
      channelService.appendLine(nls.localize('lightning_lwc_redhat_extension_regression'));
    } else {
      channelService.appendLine(nls.localize('lightning_lwc_deprecated_redhat_extension'));
    }
  }
}
