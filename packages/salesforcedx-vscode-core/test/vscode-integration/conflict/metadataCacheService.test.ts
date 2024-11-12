/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import {
  ComponentSet,
  FileProperties,
  MetadataApiRetrieve,
  RetrieveResult,
  SourceComponent
} from '@salesforce/source-deploy-retrieve-bundle';
import {
  MetadataApiRetrieveStatus,
  RequestStatus
} from '@salesforce/source-deploy-retrieve-bundle/lib/src/client/types';
import * as AdmZip from 'adm-zip';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import {
  MetadataCacheExecutor,
  MetadataCacheResult,
  MetadataCacheService,
  PathType
} from '../../../src/conflict/metadataCacheService';
import { SalesforcePackageDirectories } from '../../../src/salesforceProject';
import { stubRootWorkspace } from '../util/rootWorkspace.test-util';

describe('Metadata Cache', () => {
  describe('Metadata Cache Executor', () => {
    const PROJ_ROOT = path.join(__dirname, '..', '..', '..', '..', 'test', 'vscode-integration', 'diffs');
    const usernameOrAlias = 'admin@ut-sandbox.org';
    const PROJECT_DIR = path.join(PROJ_ROOT, 'meta-proj');
    let workspaceStub: sinon.SinonStub;
    let executor: MetadataCacheExecutor;
    let componentStub: sinon.SinonStub;
    let operationStub: sinon.SinonStub;
    let processStub: sinon.SinonStub;

    beforeEach(() => {
      executor = new MetadataCacheExecutor(usernameOrAlias, 'Source Diff', 'source-diff-loader', handleCacheResults);
      operationStub = sinon.stub(MetadataCacheService.prototype, 'createRetrieveOperation');
      componentStub = sinon.stub(MetadataCacheService.prototype, 'getSourceComponents');
      processStub = sinon.stub(MetadataCacheService.prototype, 'processResults');
      workspaceStub = stubRootWorkspace(PROJECT_DIR);
    });

    afterEach(() => {
      componentStub.restore();
      processStub.restore();
      operationStub.restore();
      workspaceStub!.restore();
      shell.rm('-rf', PROJECT_DIR);
    });

    it('Should run metadata service', async () => {
      componentStub.resolves(new ComponentSet());
      const mockOperation = new MetadataApiRetrieve({
        usernameOrConnection: usernameOrAlias,
        components: new ComponentSet(),
        output: ''
      });
      const pollStatusStub = sinon.stub(mockOperation, 'pollStatus');
      pollStatusStub.callsFake(() => {});
      operationStub.resolves(mockOperation);
      processStub.resolves(undefined);
      sinon.stub(ConfigUtil, 'getUserConfiguredApiVersion').resolves('55.0');

      await executor.run({ data: PROJECT_DIR, type: 'CONTINUE' });

      expect(componentStub.callCount).to.equal(1);
      expect(operationStub.callCount).to.equal(1);
      expect(pollStatusStub.callCount).to.equal(1);
      expect(processStub.callCount).to.equal(1);
    });
  });

  describe('Metadata Cache Service', () => {
    const PROJ_ROOT = path.join(__dirname, '..', '..', '..', '..', 'test', 'vscode-integration', 'diffs');
    const TEST_ASSETS_FOLDER = path.join(__dirname, '..', '..', '..', '..', '..', 'system-tests', 'assets');
    const TEST_DATA_FOLDER = path.join(TEST_ASSETS_FOLDER, 'differ-testdata');
    const usernameOrAlias = 'admin@ut-sandbox.org';
    const PROJECT_DIR = path.join(PROJ_ROOT, 'meta-proj2');
    let workspaceStub: sinon.SinonStub;
    let packageStub: sinon.SinonStub;
    let service: MetadataCacheService;

    beforeEach(() => {
      service = new MetadataCacheService(usernameOrAlias);
      packageStub = sinon.stub(SalesforcePackageDirectories, 'getPackageDirectoryFullPaths').resolves([]);
      workspaceStub = stubRootWorkspace(PROJECT_DIR);
    });

    afterEach(() => {
      service.clearCache();
      packageStub.restore();
      workspaceStub!.restore();
      shell.rm('-rf', PROJECT_DIR);
    });

    it('Should clear cache directory', async () => {
      const cachePath = service.getCachePath();
      const tempFilePath = path.join(cachePath, 'TestFile.xml');

      shell.mkdir('-p', cachePath);
      shell.touch([tempFilePath]);

      expect(fs.existsSync(tempFilePath), `folder ${tempFilePath} should exist`).to.equal(true);

      const actualCachePath = service.clearCache();
      expect(actualCachePath).to.equal(cachePath);

      expect(fs.existsSync(actualCachePath), `folder ${actualCachePath} should not exist`).to.equal(false);
    });

    it('Should find one component', async () => {
      const projectPath = path.join(PROJECT_DIR, 'src');

      // populate project metadata
      const projectZip = new AdmZip();
      projectZip.addLocalFolder(TEST_DATA_FOLDER);
      projectZip.extractAllTo(projectPath);

      const componentPath = path.join(projectPath, 'aura', 'PictureGalleryCard', 'PictureGalleryCard.cmp');
      service.initialize(componentPath, PROJECT_DIR);
      const components = await service.getSourceComponents();

      expect(components.size).to.equal(1);
    });

    it('Should find components', async () => {
      const projectPath = path.join(PROJECT_DIR, 'src');

      // populate project metadata
      const projectZip = new AdmZip();
      projectZip.addLocalFolder(TEST_DATA_FOLDER);
      projectZip.extractAllTo(projectPath);

      service.initialize(projectPath, PROJECT_DIR);
      const components = await service.getSourceComponents();

      expect(components.size).to.equal(14);
    });

    it('Should find components using a manifest', async () => {
      const projectPath = path.join(PROJECT_DIR, 'src');
      const manifestPath = path.join(TEST_ASSETS_FOLDER, 'proj-testdata', 'manifest', 'one-class.xml');

      // populate project metadata
      const projectZip = new AdmZip();
      projectZip.addLocalFolder(TEST_DATA_FOLDER);
      projectZip.extractAllTo(projectPath);

      service.initialize(manifestPath, PROJECT_DIR, true);
      const components = await service.getSourceComponents();

      expect(components.size).to.equal(1);
    });

    it('Should return cache results', async () => {
      const projectPath = path.join(PROJECT_DIR, 'src');
      const cachePath = service.getCachePath();
      const retrieveRoot = path.join('main', 'default');

      // populate project metadata
      const projectZip = new AdmZip();
      projectZip.addLocalFolder(TEST_DATA_FOLDER);
      projectZip.extractAllTo(projectPath);
      projectZip.extractAllTo(path.join(cachePath, retrieveRoot));

      service.initialize(projectPath, PROJECT_DIR);
      await service.getSourceComponents();
      const results = loadMockCache(cachePath);

      const cache = await service.processResults(results);

      expect(cache).to.not.equal(undefined);
      expect(cache?.selectedPath).to.equal(projectPath);
      expect(cache?.selectedType).to.equal(PathType.Folder);
      expect(cache?.cachePropPath).to.equal(path.join(cachePath, 'prop', 'file-props.json'));

      expect(cache?.cache.baseDirectory).to.equal(cachePath);
      expect(cache?.cache.commonRoot).to.equal(retrieveRoot);

      expect(cache?.project.baseDirectory).to.equal(PROJECT_DIR);
      expect(cache?.project.commonRoot).to.equal('src');

      // verify contents of prop file
      if (cache?.cachePropPath) {
        const propObj = JSON.parse(
          fs.readFileSync(cache?.cachePropPath, {
            encoding: 'utf-8'
          })
        );

        expect(propObj.componentPath).to.equal(projectPath);
        expect(propObj.fileProperties.length).to.equal(1);
        const prop = propObj.fileProperties[0];
        expect(prop.fullName).to.equal('One');
        expect(prop.fileName).to.equal('One.cls');
      }
    });
  });

  const handleCacheResults = (username: string, cache?: MetadataCacheResult): Promise<void> => {
    return Promise.resolve();
  };

  const loadMockCache = (cachePath: string): RetrieveResult => {
    const props: FileProperties[] = [
      {
        id: '1',
        createdById: '2',
        createdByName: 'Me',
        createdDate: 'Today',
        fileName: 'One.cls',
        fullName: 'One',
        lastModifiedById: '3',
        lastModifiedByName: 'You',
        lastModifiedDate: 'Tomorrow',
        type: 'ApexClass'
      }
    ];

    const response: MetadataApiRetrieveStatus = {
      done: true,
      status: RequestStatus.Succeeded,
      success: true,
      id: '',
      fileProperties: props,
      zipFile: ''
    };

    const cacheComps = ComponentSet.fromSource(cachePath);
    const results = new RetrieveResult(response, cacheComps);
    return results;
  };

  describe('Static Methods', () => {
    const compOne = {
      fullName: 'HandlerCostCenter',
      type: {
        name: 'ApexClass'
      }
    };
    const compTwo = {
      fullName: 'Account',
      type: {
        name: 'CustomObject'
      }
    };
    const childComp = {
      fullName: 'AccountNumber',
      parent: compTwo,
      type: {
        name: 'CustomField'
      }
    };
    const fileProperties: FileProperties[] = [
      {
        fullName: 'HandlerCostCenter',
        lastModifiedDate: 'Today',
        type: 'ApexClass',
        id: '1',
        createdById: '2',
        createdByName: 'Me',
        createdDate: 'Today',
        fileName: 'One.cls',
        lastModifiedById: '3',
        lastModifiedByName: 'You'
      },
      {
        fullName: 'Account',
        lastModifiedDate: 'Yesterday',
        type: 'CustomObject',
        id: '2',
        createdById: '2',
        createdByName: 'Me',
        createdDate: 'Today',
        fileName: 'Two.cls',
        lastModifiedById: '3',
        lastModifiedByName: 'You'
      }
    ];

    it('Should correlate results correctly', () => {
      const cacheResults = {
        cache: {
          baseDirectory: path.normalize('/a/b'),
          commonRoot: 'c',
          components: [compOne, compTwo, childComp] as SourceComponent[]
        },
        project: {
          baseDirectory: path.normalize('/d'),
          commonRoot: path.normalize('e/f'),
          components: [compTwo, childComp, compOne] as SourceComponent[]
        },
        properties: fileProperties
      } as MetadataCacheResult;

      const components = MetadataCacheService.correlateResults(cacheResults);

      expect(components.length).to.equal(2);
      expect(components).to.have.deep.members([
        {
          cacheComponent: compOne,
          projectComponent: compOne,
          lastModifiedDate: 'Today'
        },
        {
          cacheComponent: compTwo,
          projectComponent: compTwo,
          lastModifiedDate: 'Yesterday'
        }
      ]);
    });

    it('Should correlate results for just a child component', () => {
      const cacheResults = {
        cache: {
          baseDirectory: path.normalize('/a/b'),
          commonRoot: 'c',
          components: [compOne, childComp] as SourceComponent[]
        },
        project: {
          baseDirectory: path.normalize('/d'),
          commonRoot: path.normalize('e/f'),
          components: [childComp, compOne] as SourceComponent[]
        },
        properties: fileProperties
      } as MetadataCacheResult;

      const components = MetadataCacheService.correlateResults(cacheResults);

      expect(components.length).to.equal(2);
      expect(components).to.have.deep.members([
        {
          cacheComponent: compOne,
          projectComponent: compOne,
          lastModifiedDate: 'Today'
        },
        {
          cacheComponent: childComp,
          projectComponent: childComp,
          lastModifiedDate: 'Yesterday'
        }
      ]);
    });
  });
});
