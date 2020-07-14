/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as vscode from 'vscode';
import path = require('path');

const EXTENSION_NAME = 'salesforce.salesforcedx-vscode-lwc';

export class MetaSupport {
  private static instance: MetaSupport;
  private static sfdxUri = '.sfdx';
  private static resourceUri = path.join(MetaSupport.sfdxUri, 'resources');
  private static lwcResourceUri = path.join(MetaSupport.resourceUri, 'lwcResources');
  private static dir = path.join(vscode.workspace.rootPath!, MetaSupport.lwcResourceUri);
  private static resourceDir = path.join(vscode.workspace.rootPath!, MetaSupport.resourceUri);

  public static initializeSupport() {
    if (!MetaSupport.instance) {
      MetaSupport.instance = new MetaSupport();
    }
    return MetaSupport.instance;
  }

  private createLWCResourceFolder() {
    /**
     * creates LWCResource folder if not exist
     */
    if (!fs.existsSync(MetaSupport.resourceDir)) {
      fs.mkdirSync(MetaSupport.resourceDir);
      fs.mkdirSync(MetaSupport.dir);
    } else if (!fs.existsSync(MetaSupport.dir)) {
      fs.mkdirSync(MetaSupport.dir);
    }
  }

  private getLocalFile(targetFileName: string, destinationPath: string) {
    const thisExtPath = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-lwc'
    )!.extensionPath;
    const resourcepath = path.join(
      thisExtPath,
      'resources',
      'static',
      targetFileName
    );
    fs.copyFileSync(resourcepath, destinationPath);
  }

  public getMetaSupport() {
    /**
     * This is the public facing fuction that creates the resource folder and duplicates the relative files.
     */
    this.createLWCResourceFolder();
    this.getLocalFile('js-meta.xsd', path.join(MetaSupport.dir, 'js-meta.xsd'));
    this.getLocalFile('js-meta-home.xml', path.join(MetaSupport.dir, 'js-meta-home.xml'));

    // console.log(require.resolve('lwc-resources'));
  }
}
