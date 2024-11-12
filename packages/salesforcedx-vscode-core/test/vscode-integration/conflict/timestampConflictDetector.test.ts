/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileProperties, SourceComponent } from '@salesforce/source-deploy-retrieve-bundle';
import { fail } from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import { channelService } from '../../../src/channels';
import { PersistentStorageService } from '../../../src/conflict';
import * as differ from '../../../src/conflict/componentDiffer';
import { TimestampFileProperties } from '../../../src/conflict/directoryDiffer';
import { MetadataCacheResult } from '../../../src/conflict/metadataCacheService';
import { TimestampConflictDetector } from '../../../src/conflict/timestampConflictDetector';
import { nls } from '../../../src/messages';
import { stubRootWorkspace } from '../util/rootWorkspace.test-util';

describe('Timestamp Conflict Detector Execution', () => {
  const TODAY = '2023-01-28T00:15:28.000Z';
  const YESTERDAY = '2023-01-27T00:15:28.000Z';
  const PROJ_ROOT = path.join(__dirname, '..', '..', '..', '..', 'test', 'vscode-integration', 'conflict');
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
  const PROJECT_DIR = path.join(PROJ_ROOT, 'proj');

  let workspaceStub: sinon.SinonStub;
  let executor: TimestampConflictDetector;
  let executorSpy: sinon.SinonSpy;
  let differStub: sinon.SinonStub;
  let cacheStub: sinon.SinonStub;
  let channelServiceStub: sinon.SinonStub;

  beforeEach(() => {
    differStub = sinon.stub(differ, 'diffComponents');
    executor = new TimestampConflictDetector();
    executorSpy = sinon.spy(executor, 'createDiffs');
    cacheStub = sinon.stub(PersistentStorageService.prototype, 'getPropertiesForFile');
    channelServiceStub = sinon.stub(channelService, 'appendLine');
    workspaceStub = stubRootWorkspace(PROJECT_DIR);
  });

  afterEach(() => {
    executorSpy.restore();
    differStub.restore();
    workspaceStub.restore();
    cacheStub.restore();
    channelServiceStub.restore();
    shell.rm('-rf', PROJECT_DIR);
  });

  it('Should report differences', async () => {
    const cacheResults = {
      cache: {
        baseDirectory: path.normalize('/a/b'),
        commonRoot: 'c',
        components: [
          {
            fullName: 'HandlerCostCenter',
            type: {
              name: 'ApexClass'
            }
          }
        ] as SourceComponent[]
      },
      project: {
        baseDirectory: path.normalize('/d'),
        commonRoot: path.normalize('e/f'),
        components: [
          {
            fullName: 'HandlerCostCenter',
            type: {
              name: 'ApexClass'
            }
          }
        ] as SourceComponent[]
      },
      properties: [
        {
          fullName: 'HandlerCostCenter',
          lastModifiedDate: TODAY,
          type: 'ApexClass'
        }
      ] as FileProperties[]
    } as MetadataCacheResult;

    const diffResults = [
      {
        projectPath: '/d/e/f/classes/HandlerCostCenter.cls',
        cachePath: '/a/b/c/classes/HandlerCostCenter.cls'
      }
    ] as differ.ComponentDiff[];

    const storageResult = {
      lastModifiedDate: YESTERDAY
    };

    differStub.returns(diffResults);
    cacheStub.returns(storageResult);

    const results = await executor.createDiffs(cacheResults);

    expect(executorSpy.callCount).to.equal(1);
    expect(cacheStub.callCount).to.equal(1);

    expect(differStub.callCount).to.equal(1);
    expect(differStub.getCall(0).args).to.eql([
      {
        fullName: 'HandlerCostCenter',
        type: {
          name: 'ApexClass'
        }
      },
      {
        fullName: 'HandlerCostCenter',
        type: {
          name: 'ApexClass'
        }
      }
    ]);

    expect(results.different).to.eql(
      new Set([
        {
          localRelPath: path.normalize('classes/HandlerCostCenter.cls'),
          remoteRelPath: path.normalize('classes/HandlerCostCenter.cls'),
          localLastModifiedDate: YESTERDAY,
          remoteLastModifiedDate: TODAY
        }
      ])
    );
  });

  it('Should not report differences if the component is only local', async () => {
    const cacheResults = {
      cache: {
        baseDirectory: path.normalize('/a/b'),
        commonRoot: 'c',
        components: [] as SourceComponent[]
      },
      project: {
        baseDirectory: path.normalize('/d'),
        commonRoot: path.normalize('e/f'),
        components: [
          {
            fullName: 'HandlerCostCenter',
            type: {
              name: 'ApexClass'
            }
          }
        ] as SourceComponent[]
      },
      properties: [
        {
          fullName: 'HandlerCostCenter',
          lastModifiedDate: TODAY,
          type: 'ApexClass'
        }
      ] as FileProperties[]
    } as MetadataCacheResult;

    const results = await executor.createDiffs(cacheResults);

    expect(executorSpy.callCount).to.equal(1);
    expect(cacheStub.callCount).to.equal(0);
    expect(differStub.callCount).to.equal(0);
    expect(results.different).to.eql(new Set<TimestampFileProperties>());
  });

  it('Should not report differences if the component is only remote', async () => {
    const cacheResults = {
      cache: {
        baseDirectory: path.normalize('/a/b'),
        commonRoot: 'c',
        components: [
          {
            fullName: 'HandlerCostCenter',
            type: {
              name: 'ApexClass'
            }
          }
        ] as SourceComponent[]
      },
      project: {
        baseDirectory: path.normalize('/d'),
        commonRoot: path.normalize('e/f'),
        components: [] as SourceComponent[]
      },
      properties: [
        {
          fullName: 'HandlerCostCenter',
          lastModifiedDate: TODAY,
          type: 'ApexClass'
        }
      ] as FileProperties[]
    } as MetadataCacheResult;

    const results = await executor.createDiffs(cacheResults);

    expect(executorSpy.callCount).to.equal(1);
    expect(cacheStub.callCount).to.equal(0);
    expect(differStub.callCount).to.equal(0);
    expect(results.different).to.eql(new Set<TimestampFileProperties>());
  });

  it('Should not report differences if the timestamps match', async () => {
    const cacheResults = {
      cache: {
        baseDirectory: path.normalize('/a/b'),
        commonRoot: 'c',
        components: [
          {
            fullName: 'HandlerCostCenter',
            type: {
              name: 'ApexClass'
            }
          }
        ] as SourceComponent[]
      },
      project: {
        baseDirectory: path.normalize('/d'),
        commonRoot: path.normalize('e/f'),
        components: [
          {
            fullName: 'HandlerCostCenter',
            type: {
              name: 'ApexClass'
            }
          }
        ] as SourceComponent[]
      },
      properties: [
        {
          fullName: 'HandlerCostCenter',
          lastModifiedDate: TODAY,
          type: 'ApexClass'
        }
      ] as FileProperties[]
    } as MetadataCacheResult;

    const storageResult = {
      lastModifiedDate: TODAY
    };

    cacheStub.returns(storageResult);

    const results = await executor.createDiffs(cacheResults);

    expect(executorSpy.callCount).to.equal(1);
    expect(cacheStub.callCount).to.equal(1);
    expect(differStub.callCount).to.equal(0);
    expect(results.different).to.eql(new Set<TimestampFileProperties>());
  });

  it('Should not report differences if the files match', async () => {
    const cacheResults = {
      cache: {
        baseDirectory: path.normalize('/a/b'),
        commonRoot: 'c',
        components: [
          {
            fullName: 'HandlerCostCenter',
            type: {
              name: 'ApexClass'
            }
          }
        ] as SourceComponent[]
      },
      project: {
        baseDirectory: path.normalize('/d'),
        commonRoot: path.normalize('e/f'),
        components: [
          {
            fullName: 'HandlerCostCenter',
            type: {
              name: 'ApexClass'
            }
          }
        ] as SourceComponent[]
      },
      properties: [
        {
          fullName: 'HandlerCostCenter',
          lastModifiedDate: TODAY,
          type: 'ApexClass'
        }
      ] as FileProperties[]
    } as MetadataCacheResult;

    const diffResults = [] as differ.ComponentDiff[];

    const storageResult = {
      lastModifiedDate: YESTERDAY
    };

    differStub.returns(diffResults);
    cacheStub.returns(storageResult);

    const results = await executor.createDiffs(cacheResults);

    expect(executorSpy.callCount).to.equal(1);
    expect(cacheStub.callCount).to.equal(1);

    expect(differStub.callCount).to.equal(1);
    expect(differStub.getCall(0).args).to.eql([
      {
        fullName: 'HandlerCostCenter',
        type: {
          name: 'ApexClass'
        }
      },
      {
        fullName: 'HandlerCostCenter',
        type: {
          name: 'ApexClass'
        }
      }
    ]);

    expect(results.different).to.eql(new Set<TimestampFileProperties>());
  });

  it('Should return empty diffs for an undefined retrieve result', async () => {
    const cacheResults = undefined;

    const diffs = await executor.createDiffs(cacheResults);

    expect(channelServiceStub.callCount).to.equal(0);
    expect(executorSpy.callCount).to.equal(1);
    expect(differStub.callCount).to.equal(0);
    expect(diffs.different).to.eql(new Set<string>());
  });
});
