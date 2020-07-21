/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import path = require('path');
import { nls } from '../messages';

const EXTENSION_NAME = 'salesforce.salesforcedx-vscode-lwc';

export class MetaSupport {
  private static instance: MetaSupport;
  private static sfdxUri = '.sfdx';
  private static resourceUri = path.join(MetaSupport.sfdxUri, 'resources');
  private static lwcResourceUri = path.join(
    MetaSupport.resourceUri,
    'lwcResources'
  );
  private static dir = path.join(
    vscode.workspace.rootPath!,
    MetaSupport.lwcResourceUri
  );
  private static resourceDir = path.join(
    vscode.workspace.rootPath!,
    MetaSupport.resourceUri
  );

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
    const listOfPaths: string[] = [];

    targetFileNames.forEach(targetFileName => {
      listOfPaths.push(path.join(thisExtPath, 'resources', 'static', targetFileName));
    });

    return listOfPaths;
  }

  /**
   * A Promise to setup Redhat XML API
   * @param inputCatalogs - a list of catalog file names
   * @param inputFileAssociations - a list of dictionary specifying file associations
   * @returns - None
   */
  private async setupRedhatXml(inputCatalogs: string[], inputFileAssociations: Array<{ systemId: string; pattern: string; }>) {
    const redHatExtension = vscode.extensions.getExtension('redhat.vscode-xml');
    const extensionApi = await redHatExtension!.activate();
    extensionApi.addXMLCatalogs(inputCatalogs);
    extensionApi.addXMLFileAssociations(inputFileAssociations);
  }

  /**
   * This function creates the js-meta.xml resource folder and
   * duplicates XSD and XML files to the .sfdx folder of developers.
   * It also calls Redhat XML APIs to setup required settings for the plugin to work.
   */
  public getMetaSupport() {
    // redHatExtension API reference: https://github.com/redhat-developer/vscode-xml/pull/292
    const redHatExtension = vscode.extensions.getExtension('redhat.vscode-xml');
    if (redHatExtension === undefined) {
      vscode.window.showInformationMessage(nls.localize('force_lightning_lwc_no_redhat_extension_found'));
    } else if (redHatExtension) {
      const pluginVersionNumber = redHatExtension!.packageJSON['version'];
      // checks plugin version greater than 0.13.0, might need to change.
      if (parseInt(pluginVersionNumber.split('.')[1], 10) >= 13 && parseInt(pluginVersionNumber.split('.')[2], 10) > 0) {
        const catalogs = this.getLocalFilePath(['js-meta-home.xml']);
        const fileAssociations = [
          {
            systemId: this.getLocalFilePath(['js-meta.xsd'])[0],
            pattern: '**/*js-meta.xml'
          }
        ];
        this.setupRedhatXml(catalogs, fileAssociations).catch(err => console.log('An Error occured: ' + err));
      } else {
        vscode.window.showInformationMessage(nls.localize('force_lightning_lwc_deprecated_redhat_extension'));
      }
    }
  }
}
