/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as vscode from 'vscode';
import path = require('path');
import semver = require('semver');

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
    const thisExtPath = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-lwc'
    )!.extensionPath;
    const listOfPaths: string[] = [];

    targetFileNames.forEach(targetFileName => {
      listOfPaths.push(path.join(thisExtPath, 'resources', 'static', targetFileName));
    });

    return listOfPaths;
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
      vscode.window.showInformationMessage(
        'Salesforce js-meta.xml intellisense requires RedHat XML Plugin'
      );
    } else if (redHatExtension) {
      // semver compares the version id: https://www.npmjs.com/package/semver#prerelease-identifiers
      if (
        semver.satisfies(redHatExtension!.packageJSON['version'], '>0.13.0')
      ) {
        // Append Redhat XML Settings
        async function setupRedhatXml(inputCatalogs: string[], inputFileAssociations: Array<{ systemId: string; pattern: string; }>) {
          const extensionApi = await redHatExtension!.activate();
          extensionApi.addXMLCatalogs(inputCatalogs);
          extensionApi.addXMLFileAssociations(inputFileAssociations);

        }
        // find the path to the sttic resouces
        const catalogs = this.getLocalFilePath(['js-meta-home.xml']);
        const fileAssociations = [
          {
            systemId: this.getLocalFilePath(['js-meta.xsd'])[0],
            pattern: '**/*js-meta.xml'
          }
        ];
        setupRedhatXml(catalogs, fileAssociations).catch(err => console.log('An Error occured: ' + err));
      } else {
        vscode.window.showInformationMessage(
          'Salesforce js-meta.xml intellisense requires RedHat XML Plugin Version 0.14.0 or above'
        );
      }
    }
  }
}
