/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as AdmZip from 'adm-zip';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as shell from 'shelljs';
import { stub } from 'sinon';
import {
  CommonDirDirectoryDiffer,
  ConflictDetectionConfig,
  ConflictDetector
} from '../../../src/conflict';
import { nls } from '../../../src/messages';
import { stubRootWorkspace } from '../util/rootWorkspace.test-util';

describe('Conflict Detection Service', () => {
  it('Should build the source retrieve command', () => {
    const detector = new ConflictDetector(new CommonDirDirectoryDiffer());
    const tempPath = detector.getCachePath('MyOrg');
    const manifestPath = path.join(tempPath, 'package.xml');

    const sourceRetrieveCommand = detector.buildRetrieveOrgSourceCommand(
      'MyOrg',
      tempPath,
      manifestPath
    );

    expect(sourceRetrieveCommand.toCommand()).to.equal(
      `sfdx force:mdapi:retrieve --retrievetargetdir ${tempPath} --unpackaged ${manifestPath} --targetusername MyOrg`
    );

    expect(sourceRetrieveCommand.description).to.equal(
      nls.localize('conflict_detect_retrieve_org_source')
    );
  });

  it('Should build the source convert command', () => {
    const detector = new ConflictDetector(new CommonDirDirectoryDiffer());
    const tempPath = detector.getCachePath('MyOtherOrg');
    const packagedPath = path.join(tempPath, 'unpackaged');
    const convertedPath = path.join(tempPath, 'converted');

    const sourceRetrieveCommand = detector.buildMetadataApiConvertOrgSourceCommand(
      packagedPath,
      convertedPath
    );

    expect(sourceRetrieveCommand.toCommand()).to.equal(
      `sfdx force:mdapi:convert --rootdir ${packagedPath} --outputdir ${convertedPath}`
    );

    expect(sourceRetrieveCommand.description).to.equal(
      nls.localize('conflict_detect_convert_org_source')
    );
  });
});

describe('Conflict Detection Service Execution', () => {
  const TEST_ROOT = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'test',
    'vscode-integration',
    'conflict'
  );
  const TEST_DATA_FOLDER = path.join(TEST_ROOT, 'testdata');
  const PROJECT_DIR = path.join(TEST_ROOT, 'conflict-proj');

  let workspaceStub: sinon.SinonStub;
  let executor: ConflictDetector;
  let executeCommandSpy: sinon.SinonStub;

  beforeEach(() => {
    executor = new ConflictDetector(new CommonDirDirectoryDiffer());
    executeCommandSpy = stub(executor, 'executeCommand');
    workspaceStub = stubRootWorkspace(PROJECT_DIR);
  });

  afterEach(() => {
    executeCommandSpy.restore();
    workspaceStub!.restore();
  });

  it('Should find differences', async () => {
    const usernameOrAlias = 'admin@ut-sandbox.org';
    const cachePath = executor.getCachePath(usernameOrAlias);

    // populate project metadata
    const projectZip = new AdmZip();
    projectZip.addLocalFolder(path.join(TEST_DATA_FOLDER, 'proj-source'));
    projectZip.extractAllTo(path.join(PROJECT_DIR, 'force-app'));

    // simulate retrieval of remote metadata
    executeCommandSpy.onCall(0).callsFake(() => {
      const zip = new AdmZip();
      zip.addLocalFolder(path.join(TEST_DATA_FOLDER, 'org-source'));
      zip.writeZip(path.join(cachePath, 'unpackaged.zip'));
    });

    // simulate conversion to source format
    executeCommandSpy.onCall(1).callsFake(() => {
      shell.cp(
        '-R',
        path.join(cachePath, 'unpackaged/'),
        path.join(cachePath, 'converted/')
      );
    });

    const input: ConflictDetectionConfig = {
      usernameOrAlias,
      packageDir: 'force-app',
      manifest: path.join(TEST_DATA_FOLDER, 'org-source', 'package.xml')
    };

    const results = await executor.checkForConflicts(input);
    expect(executeCommandSpy.callCount).to.equal(2);
    expect(results.different).to.have.keys([
      path.join('main', 'default', 'classes', 'HandlerCostCenter.cls')
    ]);

    // verify temp file cleanup
    expect(
      fs.existsSync(cachePath),
      `folder ${cachePath} should be deleted`
    ).to.equal(false);
  });
});
