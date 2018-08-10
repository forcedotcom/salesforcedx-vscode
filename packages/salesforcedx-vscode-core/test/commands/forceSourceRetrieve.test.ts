/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  FileType,
  ForceSourceRetrieveExecutor,
  ManifestOrSourcePathGatherer
} from './../../src/commands/forceSourceRetrieve';

import { nls } from '../../src/messages';

describe('Force Source Retrieve with Manifest Option', () => {
  it('Should build the source retrieve command', () => {
    const manifestPath = path.join('path', 'to', 'manifest', 'package.xml');
    const sourceRetrieve = new ForceSourceRetrieveExecutor();
    const sourceRetrieveCommand = sourceRetrieve.build({
      filePath: manifestPath,
      type: FileType.Manifest
    });
    expect(sourceRetrieveCommand.toCommand()).to.equal(
      `sfdx force:source:retrieve --manifest ${manifestPath}`
    );
    expect(sourceRetrieveCommand.description).to.equal(
      nls.localize('force_source_retrieve_text')
    );
  });
});

describe('Force Source Retrieve with Sourcepath Option', () => {
  it('Should build the source retrieve command', () => {
    const sourcePath = path.join('path', 'to', 'sourceFile');
    const sourceRetrieve = new ForceSourceRetrieveExecutor();
    const sourceRetrieveCommand = sourceRetrieve.build({
      filePath: sourcePath,
      type: FileType.Source
    });
    expect(sourceRetrieveCommand.toCommand()).to.equal(
      `sfdx force:source:retrieve --sourcepath ${sourcePath}`
    );
    expect(sourceRetrieveCommand.description).to.equal(
      nls.localize('force_source_retrieve_text')
    );
  });
});

describe('Manifest or Sourcepath Gatherer', () => {
  it("Should return an object of type 'Source'", async () => {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const sourcePath = { fsPath: path.join('path', 'to', 'sourceFile') };
      const gatherer = new ManifestOrSourcePathGatherer(sourcePath);
      const response = await gatherer.gather();
      if (response.type === 'CONTINUE') {
        expect(response.data.type).to.equal(FileType.Source);
        expect(response.data.filePath).to.equal(sourcePath.fsPath);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    } else {
      expect.fail('The workspace root path was undefined');
    }
  });

  it("Should return an object of type 'Manifest'", async () => {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const manifestPath = {
        fsPath: path.join(workspaceRootPath, 'manifest', 'file')
      };
      const gatherer = new ManifestOrSourcePathGatherer(manifestPath);
      const response = await gatherer.gather();
      if (response.type === 'CONTINUE') {
        expect(response.data.type).to.equal(FileType.Manifest);
        expect(response.data.filePath).to.equal(manifestPath.fsPath);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    } else {
      expect.fail('The workspace root path was undefined');
    }
  });
});
