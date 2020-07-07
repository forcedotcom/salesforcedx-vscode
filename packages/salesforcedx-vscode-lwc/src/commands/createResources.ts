/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as vscode from 'vscode';
import path = require('path');

export function createLWCResource() {
  /**
   * creates all resources required for js-meta.xml autocomplete
   */

  const sfdxUri = '.sfdx';
  const lwcResourceUri = path.join(sfdxUri, 'lwcResources');

  // Creating a lwc resource folder if it does not exist
  const dir = path.join(vscode.workspace.rootPath!, lwcResourceUri);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  // copy file to developer local
  function getlocalfile(targetFileName: string, destinationPath: string) {
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

  getlocalfile('js-meta.xsd', path.join(dir, 'js-meta.xsd'));
  getlocalfile('js-meta-home.xml', path.join(dir, 'js-meta-home.xml'));
}

export function addJsMetaSetting() {
  /**
   * This file addes additional settings to the existing .vscode settings file
   * It is important to make sure if one were to expand these settings to support more XSDs
   * we need to have a better solution.
   */
  const vsCodeSettingsPath = path.join(
    vscode.workspace.rootPath!,
    '.vscode/settings.json'
  );
  const fileContents = fs.readFileSync(vsCodeSettingsPath, 'utf8');
  const settings = JSON.parse(fileContents);

  function saveFile() {
    fs.writeFile(
      vsCodeSettingsPath,
      JSON.stringify(settings, null, '\t'),
      err => {
        console.log('error writing to settings');
      }
    );
  }

  if (!('xml.catalogs' in settings)) {
    settings['xml.catalogs'] = ['.sfdx/lwcResources/js-meta-home.xml'];
    settings['xml.fileAssociations'] = [
      {
        systemId: '.sfdx/lwcResources/js-meta.xsd',
        pattern: '**/*js-meta.xml'
      }
    ];
    saveFile();

  } else {
    // checking for catalog settings
    if (!settings['xml.catalogs'].includes('.sfdx/lwcResources/js-meta-home.xml')) {
      settings['xml.catalogs'].push('.sfdx/lwcResources/js-meta-home.xml');
      saveFile();
    }

    // checking for fileassociation settings
    if (!settings['xml.fileAssociations'].some((element: { systemId: string; }) => element.systemId === '.sfdx/lwcResources/js-meta.xsd')) {
      settings['xml.fileAssociations'].push({ systemId: '.sfdx/lwcResources/js-meta.xsd', pattern: '**/*js-meta.xml' });
      saveFile();
    }
  }
}
