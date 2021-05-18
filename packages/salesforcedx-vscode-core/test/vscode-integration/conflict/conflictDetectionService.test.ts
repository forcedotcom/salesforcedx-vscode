/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fail } from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import { SfdxCommandlet } from '../../../src/commands/util';
import {
  CommonDirDirectoryDiffer,
  ConflictDetectionConfig,
  ConflictDetector
} from '../../../src/conflict';
import {
  MetadataCacheCallback,
  MetadataCacheResult
} from '../../../src/conflict/metadataCacheService';
import { nls } from '../../../src/messages';
import { stubRootWorkspace } from '../util/rootWorkspace.test-util';

describe('Conflict Detection Service Execution', () => {
  const PROJ_ROOT = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'test',
    'vscode-integration',
    'conflict'
  );
  const TEST_DATA_FOLDER = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'system-tests',
    'assets',
    'proj-testdata'
  );
  const PROJECT_DIR = path.join(PROJ_ROOT, 'conflict-proj');

  let workspaceStub: sinon.SinonStub;
  let executor: ConflictDetector;
  let executorSpy: sinon.SinonSpy;
  let metadataStub: sinon.SinonStub;
  let differStub: sinon.SinonStub;

  beforeEach(() => {
    differStub = sinon.stub(new CommonDirDirectoryDiffer(), 'diff');
    executor = new ConflictDetector({ diff: differStub });
    executorSpy = sinon.spy(ConflictDetector.prototype, 'createCacheExecutor');
    metadataStub = sinon.stub(SfdxCommandlet.prototype, 'run');
    workspaceStub = stubRootWorkspace(PROJECT_DIR);
  });

  afterEach(() => {
    executorSpy.restore();
    metadataStub.restore();
    differStub.restore();
    workspaceStub!.restore();
    shell.rm('-rf', PROJECT_DIR);
  });

  it('Should report differences', async () => {
    const username = 'admin@ut-sandbox.org';
    const cacheResults = {
      cache: { baseDirectory: path.normalize('/a/b'), commonRoot: 'c' },
      project: {
        baseDirectory: path.normalize('/d'),
        commonRoot: path.normalize('e/f')
      }
    } as MetadataCacheResult;
    const diffResults = {
      localRoot: path.normalize('/d/e/f'),
      remoteRoot: path.normalize('/a/b/c'),
      different: new Set<string>(['classes/HandlerCostCenter.cls']),
      scannedLocal: 0,
      scannedRemote: 0
    };
    differStub.returns(diffResults);

    const input: ConflictDetectionConfig = {
      username,
      manifest: path.join(
        TEST_DATA_FOLDER,
        'proj-testdata',
        'manifest',
        'one-class.xml'
      )
    };

    let args: any[] = [];
    let callback: MetadataCacheCallback;
    // short-circuit executor, and manually trigger callback
    metadataStub.callsFake(async () => {
      args = executorSpy.getCall(0).args;
      callback = args[1];
      await callback(cacheResults);
    });
    const results = await executor.checkForConflicts(input);

    expect(executorSpy.callCount).to.equal(1);
    expect(metadataStub.callCount).to.equal(1);
    expect(args[0]).to.equal(username);

    expect(differStub.callCount).to.equal(1);
    expect(differStub.getCall(0).args).to.eql([
      path.normalize('/d/e/f'),
      path.normalize('/a/b/c')
    ]);
    expect(results.different).to.have.keys([
      path.normalize('classes/HandlerCostCenter.cls')
    ]);
  });

  it('Should report an error during conflict detection', async () => {
    const username = 'admin@ut-sandbox.org';
    const cacheResults = undefined;

    const input: ConflictDetectionConfig = {
      username,
      manifest: path.join(
        TEST_DATA_FOLDER,
        'proj-testdata',
        'manifest',
        'one-class.xml'
      )
    };

    let args: any[] = [];
    let callback: MetadataCacheCallback;
    // short-circuit executor, and manually trigger callback
    metadataStub.callsFake(async () => {
      args = executorSpy.getCall(0).args;
      callback = args[1];
      await callback(cacheResults);
    });

    try {
      const results = await executor.checkForConflicts(input);
      fail('Failed to raise an exception during conflict detection');
    } catch (err) {
      expect(err.message).to.equal(
        nls.localize('conflict_detect_empty_results')
      );
      expect(executorSpy.callCount).to.equal(1);
      expect(metadataStub.callCount).to.equal(1);
      expect(args[0]).to.equal(username);
      expect(differStub.callCount).to.equal(0);
    }
  });
});
