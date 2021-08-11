/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  FileProperties,
  SourceComponent
} from '@salesforce/source-deploy-retrieve';
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
import { bundle, decomposed, document, matchingContentFile, mixedContentInFolder, mockRegistryData } from '../mock/registry';
import { stubRootWorkspace } from '../util/rootWorkspace.test-util';

describe('Timestamp Conflict Detector Execution', () => {
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
    cacheStub = sinon.stub(
      PersistentStorageService.prototype,
      'getPropertiesForFile'
    );
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
        components: [matchingContentFile.COMPONENTS[0]]
      },
      project: {
        baseDirectory: path.normalize('/d'),
        commonRoot: path.normalize('e/f'),
        components: [matchingContentFile.COMPONENTS[0]]
      },
      properties: [
        {
          fullName: matchingContentFile.COMPONENT_NAMES[0],
          lastModifiedDate: 'Today',
          type: mockRegistryData.types.matchingcontentfile.name
        }
      ] as FileProperties[]
    } as MetadataCacheResult;

    const diffResults = [
      {
        projectPath: '/d/e/f/path/to/matchingContentFiles/a.mcf',
        cachePath: '/a/b/c/path/to/matchingContentFiles/a.mcf'
      }
    ] as differ.ComponentDiff[];

    const storageResult = {
      lastModifiedDate: 'Yesteday'
    };

    differStub.returns(diffResults);
    cacheStub.returns(storageResult);

    const results = await executor.createDiffs(cacheResults);

    expect(executorSpy.callCount).to.equal(1);
    expect(cacheStub.callCount).to.equal(1);

    expect(differStub.callCount).to.equal(1);
    expect(differStub.getCall(0).args).to.eql([
      matchingContentFile.COMPONENTS[0],
      matchingContentFile.COMPONENTS[0]
    ]);
    const expectedDifferent = new Set([{
      localRelPath: matchingContentFile.CONTENT_PATHS[0],
      remoteRelPath: matchingContentFile.CONTENT_PATHS[0],
      localLastModifiedDate: 'Yesteday',
      remoteLastModifiedDate: 'Today'
    }]);
    expect(results.different.size).to.eql(expectedDifferent.size);
    expect([...results.different][0].localLastModifiedDate).to.eql('Yesteday');
    expect([...results.different][0].remoteLastModifiedDate).to.eql('Today');
    expect([...results.different][0].remoteRelPath).to.eql(matchingContentFile.CONTENT_PATHS[0]);
    expect([...results.different][0].localRelPath).to.eql(matchingContentFile.CONTENT_PATHS[0]);
    expect(results.different).to.eql(expectedDifferent);
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
        components: [decomposed.DECOMPOSED_COMPONENT]
      },
      properties: [
        {
          fullName: 'a',
          lastModifiedDate: 'Today',
          type: mockRegistryData.types.decomposed.name
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
        components: [mixedContentInFolder.COMPONENTS[0]]
      },
      project: {
        baseDirectory: path.normalize('/d'),
        commonRoot: path.normalize('e/f'),
        components: [] as SourceComponent[]
      },
      properties: [
        {
          fullName: mixedContentInFolder.COMPONENT_NAMES[0],
          lastModifiedDate: 'Today',
          type: mockRegistryData.types.mixedcontentinfolder.name
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
        components: [bundle.COMPONENT]
      },
      project: {
        baseDirectory: path.normalize('/d'),
        commonRoot: path.normalize('e/f'),
        components: [bundle.COMPONENT]
      },
      properties: [
        {
          fullName: 'a',
          lastModifiedDate: 'Today',
          type: mockRegistryData.types.bundle.name
        }
      ] as FileProperties[]
    } as MetadataCacheResult;

    const storageResult = {
      lastModifiedDate: 'Today'
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
        components: [document.COMPONENT]
      },
      project: {
        baseDirectory: path.normalize('/d'),
        commonRoot: path.normalize('e/f'),
        components: [document.COMPONENT]
      },
      properties: [
        {
          fullName: document.COMPONENT.name,
          lastModifiedDate: 'Today',
          type: mockRegistryData.types.document.name
        }
      ] as FileProperties[]
    } as MetadataCacheResult;

    const diffResults = [] as differ.ComponentDiff[];

    const storageResult = {
      lastModifiedDate: 'Yesteday'
    };

    differStub.returns(diffResults);
    cacheStub.returns(storageResult);

    const results = await executor.createDiffs(cacheResults);

    expect(executorSpy.callCount).to.equal(1);
    expect(cacheStub.callCount).to.equal(1);

    expect(differStub.callCount).to.equal(1);
    expect(differStub.getCall(0).args).to.eql([
      document.COMPONENT,
      document.COMPONENT
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
