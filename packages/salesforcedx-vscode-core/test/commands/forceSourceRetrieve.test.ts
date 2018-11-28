/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
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

describe('Sourcepath Gatherer', () => {
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
});

describe('Manifest Gatherer', () => {
  let showOpenDialogStub: sinon.SinonStub;
  before(() => {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const manifestDir = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'manifest'
      );
      if (!fs.existsSync(manifestDir)) {
        fs.mkdirSync(manifestDir);
      }
    } else {
      expect.fail('The workspace root path was undefined');
    }
  });

  after(() => {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const manifestDir = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'manifest'
      );
      if (fs.existsSync(manifestDir)) {
        fs.rmdirSync(manifestDir);
      }
    }
  });

  beforeEach(() => {
    showOpenDialogStub = sinon.stub(vscode.window, 'showOpenDialog');
  });
  afterEach(() => {
    showOpenDialogStub.restore();
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const manifestDir = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'manifest'
      );
      if (fs.existsSync(manifestDir)) {
        fs.readdirSync(manifestDir).forEach(file => {
          const fileWithPath = path.join(manifestDir, file);
          fs.unlinkSync(fileWithPath);
        });
      }
    }
  });

  it("Should return an object of type 'Manifest' with full path to manifest file ", async () => {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const manifestPath = {
        fsPath: path.join(workspaceRootPath, 'manifest', 'project.xml')
      };
      fs.writeFileSync(manifestPath.fsPath, '');
      const gatherer = new ManifestOrSourcePathGatherer(manifestPath);
      const response = await gatherer.gather();
      if (response.type === 'CONTINUE') {
        expect(response.data.type).to.equal(FileType.Manifest);
        expect(response.data.filePath).to.equal(manifestPath.fsPath);
        expect(showOpenDialogStub.calledOnce).to.eq(false);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    } else {
      expect.fail('The workspace root path was undefined');
    }
  });

  it("Should return an object of type 'Manifest' from manifest directory path containing a single manifest ", async () => {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const manifestPath = {
        fsPath: path.join(workspaceRootPath, 'manifest')
      };
      const manifestXmlFileWithPath = path.join(
        workspaceRootPath,
        'manifest',
        'project.xml'
      );
      fs.writeFileSync(manifestXmlFileWithPath, '');
      const gatherer = new ManifestOrSourcePathGatherer(manifestPath);
      const response = await gatherer.gather();
      if (response.type === 'CONTINUE') {
        expect(response.data.type).to.equal(FileType.Manifest);
        expect(response.data.filePath).to.equal(manifestXmlFileWithPath);
        expect(showOpenDialogStub.calledOnce).to.eq(false);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    } else {
      expect.fail('The workspace root path was undefined');
    }
  });

  it("Should return an object of type 'Manifest' from manifest directory path containing a single manifest ", async () => {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const manifestPath = {
        fsPath: path.join(workspaceRootPath, 'manifest')
      };
      const manifestXmlFileWithPath = path.join(
        workspaceRootPath,
        'manifest',
        'project.xml'
      );
      fs.writeFileSync(manifestXmlFileWithPath, '');
      const gatherer = new ManifestOrSourcePathGatherer(manifestPath);
      const response = await gatherer.gather();
      if (response.type === 'CONTINUE') {
        expect(response.data.type).to.equal(FileType.Manifest);
        expect(response.data.filePath).to.equal(manifestXmlFileWithPath);
        expect(showOpenDialogStub.calledOnce).to.eq(false);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    } else {
      expect.fail('The workspace root path was undefined');
    }
  });

  it("Should return an object of type 'Manifest' from manifest directory path containing a single manifest file ", async () => {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const manifestPath = {
        fsPath: path.join(workspaceRootPath, 'manifest')
      };
      const manifestXmlFileWithPath = path.join(
        workspaceRootPath,
        'manifest',
        'project.xml'
      );
      fs.writeFileSync(manifestXmlFileWithPath, '');
      const gatherer = new ManifestOrSourcePathGatherer(manifestPath);
      const response = await gatherer.gather();
      if (response.type === 'CONTINUE') {
        expect(response.data.type).to.equal(FileType.Manifest);
        expect(response.data.filePath).to.equal(manifestXmlFileWithPath);
        expect(showOpenDialogStub.calledOnce).to.eq(false);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    } else {
      expect.fail('The workspace root path was undefined');
    }
  });

  it('Should make the user choose a manifest file if there are more than one in the manifest directory ', async () => {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const manifestPath = {
        fsPath: path.join(workspaceRootPath, 'manifest')
      };
      const manifestXmlFileWithPath = path.join(
        workspaceRootPath,
        'manifest',
        'project.xml'
      );
      fs.writeFileSync(manifestXmlFileWithPath, '');
      const manifestXmlFileWithPath2 = path.join(
        workspaceRootPath,
        'manifest',
        'project2.xml'
      );
      fs.writeFileSync(manifestXmlFileWithPath2, '');
      showOpenDialogStub.resolves([{ fsPath: manifestXmlFileWithPath2 }]);
      const gatherer = new ManifestOrSourcePathGatherer(manifestPath);
      const response = await gatherer.gather();
      if (response.type === 'CONTINUE') {
        expect(response.data.type).to.equal(FileType.Manifest);
        expect(response.data.filePath).to.equal(manifestXmlFileWithPath2);
        expect(showOpenDialogStub.calledOnce).to.eq(true);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    } else {
      expect.fail('The workspace root path was undefined');
    }
  });

  it('Should open a select dialog if there are no manifest files in the directory ', async () => {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const manifestPath = {
        fsPath: path.join(workspaceRootPath, 'manifest')
      };
      showOpenDialogStub.resolves(undefined);
      const gatherer = new ManifestOrSourcePathGatherer(manifestPath);
      const response = await gatherer.gather();
      if (response.type === 'CANCEL') {
        expect(showOpenDialogStub.calledOnce).to.eq(true);
      } else {
        expect.fail('Response should be of type CancelResponse');
      }
    } else {
      expect.fail('The workspace root path was undefined');
    }
  });

  it('Should cancel request if there are multiple manifest files and user selects cancel ', async () => {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const manifestPath = {
        fsPath: path.join(workspaceRootPath, 'manifest')
      };
      const manifestXmlFileWithPath = path.join(
        workspaceRootPath,
        'manifest',
        'project.xml'
      );
      fs.writeFileSync(manifestXmlFileWithPath, '');
      const manifestXmlFileWithPath2 = path.join(
        workspaceRootPath,
        'manifest',
        'project2.xml'
      );
      fs.writeFileSync(manifestXmlFileWithPath2, '');
      showOpenDialogStub.resolves(undefined);
      const gatherer = new ManifestOrSourcePathGatherer(manifestPath);
      const response = await gatherer.gather();
      if (response.type === 'CANCEL') {
        expect(showOpenDialogStub.calledOnce).to.eq(true);
      } else {
        expect.fail('Response should be of type CancelResponse');
      }
    } else {
      expect.fail('The workspace root path was undefined');
    }
  });
});
