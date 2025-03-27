/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Extension, ExtensionKind, Uri } from 'vscode';
import * as path from 'path';

export class MockRedhatExtension implements Extension<any> {
  public extensionKind = ExtensionKind.Workspace;
  constructor(version: string) {
    this.id = 'redhat.vscode-xml';
    this.extensionPath = path.join('extension', 'local', 'path');
    this.isActive = true;
    this.packageJSON = {
      name: 'vscode-xml',
      displayName: 'XML',
      description: 'XML Language Support by Red Hat',
      version: version,
      author: 'Red Hat',
      publisher: 'redhat'
    };
    this.api = new MockRhApi(this.extensionPath);
  }
  public extensionUri = Uri.parse('file://test');
  public id: string;
  public extensionPath: string;
  public isActive: boolean;
  public packageJSON: any;
  public api: any;

  public activate(): Thenable<any> {
    return Promise.resolve(this.api);
  }
  public exports: any;
}

class MockRhApi {
  public extentionPath: string;
  public listOfCatalogs: string[];
  public listOfAssociations: Array<{ systemId: string; pattern: string }>;
  constructor(extensionPath: string) {
    this.extentionPath = extensionPath;
    this.listOfCatalogs = [];
    this.listOfAssociations = [];
  }
  public addXMLCatalogs(catalogs: string[]) {
    catalogs.forEach(catalog => {
      this.listOfCatalogs.push(catalog);
    });
  }
  public isReady() {
    return true;
  }
  public addXMLFileAssociations(associations: Array<{ systemId: string; pattern: string }>) {
    associations.forEach(associate => {
      this.listOfAssociations.push({
        systemId: path.join(associate.systemId),
        pattern: associate.pattern
      });
    });
  }
}
