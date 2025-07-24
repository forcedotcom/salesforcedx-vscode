/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isDirectory } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet, SourceComponent } from '@salesforce/source-deploy-retrieve-bundle';
import { MetadataCacheService, PathType } from '../../../src/conflict';
import { WorkspaceContext } from '../../../src/context';
import { SalesforcePackageDirectories } from '../../../src/salesforceProject';
import { componentSetUtils } from '../../../src/services/sdr/componentSetUtils';

// Mock TelemetryService
jest.mock('../../../src/telemetry', () => ({
  TelemetryService: {
    getInstance: jest.fn().mockReturnValue({
      sendException: jest.fn()
    })
  }
}));

// Mock LocalizationService
jest.mock('../../../src/messages', () => ({
  nls: {
    localize: jest.fn((key: string) => key)
  }
}));

// Mock ChannelService
jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
  ChannelService: jest.fn().mockImplementation(() => ({
    appendLine: jest.fn(),
    showChannelOutput: jest.fn()
  })),
  isDirectory: jest.fn(),
  createDirectory: jest.fn(),
  writeFile: jest.fn(),
  projectPaths: {
    relativeStateFolder: jest.fn().mockReturnValue('/test/state')
  }
}));

// Mock SalesforcePackageDirectories
jest.mock('../../../src/salesforceProject', () => ({
  SalesforcePackageDirectories: {
    getPackageDirectoryFullPaths: jest.fn().mockResolvedValue(['/package/dir'])
  }
}));

describe('MetadataCacheService', () => {
  let retrieveStub: jest.SpyInstance;
  let isDirectoryMock: jest.MockedFunction<typeof isDirectory>;
  const dummyComponentSet = new ComponentSet([
    { fullName: 'Test', type: 'apexclass' },
    { fullName: 'Test2', type: 'layout' }
  ]);

  beforeEach(() => {
    isDirectoryMock = isDirectory as jest.MockedFunction<typeof isDirectory>;
  });

  describe('createRetrieveOperation', () => {
    const dummyEmptyComponentSet = new ComponentSet([]);
    let workspaceContextStub: jest.SpyInstance;
    let setApiVersionStub: jest.SpyInstance;

    beforeEach(() => {
      workspaceContextStub = jest.spyOn(WorkspaceContext, 'getInstance').mockReturnValue({
        getConnection: async () => ({})
      } as any);

      setApiVersionStub = jest.spyOn(componentSetUtils, 'setApiVersion').mockImplementation(jest.fn());

      retrieveStub = jest.spyOn(dummyComponentSet, 'retrieve').mockResolvedValue({} as any);

      // Mock the getSourceComponents method on dummyComponentSet
      jest.spyOn(dummyComponentSet, 'getSourceComponents').mockReturnValue({
        toArray: () => [
          { fullName: 'Test', type: 'apexclass', content: '/test/path/Test.cls' },
          { fullName: 'Test2', type: 'layout', content: '/test/path/Test2.layout' }
        ]
      } as any);
    });

    it('should use the suppressEvents option to retrieve files with conflicts', async () => {
      const metadataCacheService = new MetadataCacheService('');
      jest.spyOn(metadataCacheService, 'getSourceComponents').mockResolvedValue(dummyComponentSet);

      await metadataCacheService.createRetrieveOperation();

      expect(workspaceContextStub).toHaveBeenCalled();
      expect(metadataCacheService.getSourceComponents).toHaveBeenCalled();
      expect(setApiVersionStub).toHaveBeenCalledWith(dummyComponentSet);
      const dummyRetrieveOptionsWithSuppressEvents = { suppressEvents: true };
      expect(retrieveStub).toHaveBeenCalledWith(expect.objectContaining(dummyRetrieveOptionsWithSuppressEvents));
    });

    describe('loadCache', () => {
      it('should exit quickly if there is nothing to retrieve', async () => {
        const metadataCacheService = new MetadataCacheService('');
        jest.spyOn(metadataCacheService, 'getSourceComponents').mockResolvedValue(dummyEmptyComponentSet);

        await metadataCacheService.loadCache('', '');

        expect(metadataCacheService.getSourceComponents).toHaveBeenCalled();
        expect(retrieveStub).not.toHaveBeenCalled();
      });

      it('should handle string componentPath', async () => {
        const metadataCacheService = new MetadataCacheService('test-user');
        jest.spyOn(metadataCacheService, 'getSourceComponents').mockResolvedValue(dummyComponentSet);
        jest.spyOn(metadataCacheService, 'saveProperties' as any).mockResolvedValue('/test/props.json');

        // Mock the sourceComponents property that processResults uses
        (metadataCacheService as any).sourceComponents = dummyComponentSet;

        const mockRetrieveResult = {
          components: dummyComponentSet,
          response: { fileProperties: [] }
        };
        jest.spyOn(metadataCacheService, 'createRetrieveOperation').mockResolvedValue({
          pollStatus: jest.fn().mockResolvedValue(mockRetrieveResult)
        } as any);

        const result = await metadataCacheService.loadCache('/test/path', '/project/path');

        expect(metadataCacheService.getSourceComponents).toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(result?.selectedPath).toBe('/test/path');
      });

      it('should handle array componentPath', async () => {
        const metadataCacheService = new MetadataCacheService('test-user');
        const componentPaths = ['/test/path1', '/test/path2'];
        jest.spyOn(metadataCacheService, 'getSourceComponents').mockResolvedValue(dummyComponentSet);
        jest.spyOn(metadataCacheService, 'saveProperties' as any).mockResolvedValue('/test/props.json');

        // Mock the sourceComponents property that processResults uses
        (metadataCacheService as any).sourceComponents = dummyComponentSet;

        const mockRetrieveResult = {
          components: dummyComponentSet,
          response: { fileProperties: [] }
        };
        jest.spyOn(metadataCacheService, 'createRetrieveOperation').mockResolvedValue({
          pollStatus: jest.fn().mockResolvedValue(mockRetrieveResult)
        } as any);

        const result = await metadataCacheService.loadCache(componentPaths, '/project/path');

        expect(metadataCacheService.getSourceComponents).toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(result?.selectedPath).toEqual(componentPaths);
        expect(result?.selectedType).toBe(PathType.Multiple);
      });

      it('should handle single file in array componentPath', async () => {
        const metadataCacheService = new MetadataCacheService('test-user');
        const componentPaths = ['/test/path1'];
        jest.spyOn(metadataCacheService, 'getSourceComponents').mockResolvedValue(dummyComponentSet);
        jest.spyOn(metadataCacheService, 'saveProperties' as any).mockResolvedValue('/test/props.json');

        // Mock the sourceComponents property that processResults uses
        (metadataCacheService as any).sourceComponents = dummyComponentSet;

        const mockRetrieveResult = {
          components: dummyComponentSet,
          response: { fileProperties: [] }
        };
        jest.spyOn(metadataCacheService, 'createRetrieveOperation').mockResolvedValue({
          pollStatus: jest.fn().mockResolvedValue(mockRetrieveResult)
        } as any);

        const result = await metadataCacheService.loadCache(componentPaths, '/project/path');

        expect(metadataCacheService.getSourceComponents).toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(result?.selectedPath).toEqual(componentPaths);
        expect(result?.selectedType).toBe(PathType.Multiple);
      });
    });
  });

  describe('initialize', () => {
    it('should initialize with string componentPath', () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      metadataCacheService.initialize('/test/path', '/project/path', false);

      // Access private properties for testing
      expect((metadataCacheService as any).componentPath).toBe('/test/path');
      expect((metadataCacheService as any).projectPath).toBe('/project/path');
      expect((metadataCacheService as any).isManifest).toBe(false);
    });

    it('should initialize with array componentPath', () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      const componentPaths = ['/test/path1', '/test/path2'];
      metadataCacheService.initialize(componentPaths, '/project/path', false);

      expect((metadataCacheService as any).componentPath).toEqual(componentPaths);
      expect((metadataCacheService as any).projectPath).toBe('/project/path');
      expect((metadataCacheService as any).isManifest).toBe(false);
    });

    it('should initialize with manifest flag', () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      metadataCacheService.initialize('/test/manifest.xml', '/project/path', true);

      expect((metadataCacheService as any).componentPath).toBe('/test/manifest.xml');
      expect((metadataCacheService as any).isManifest).toBe(true);
    });
  });

  describe('getSourceComponents', () => {
    beforeEach(() => {
      isDirectoryMock.mockResolvedValue(true);

      // Mock the getSourceComponents method on dummyComponentSet
      jest.spyOn(dummyComponentSet, 'getSourceComponents').mockReturnValue({
        toArray: () => [
          { fullName: 'Test', type: 'apexclass', content: '/test/path/Test.cls' },
          { fullName: 'Test2', type: 'layout', content: '/test/path/Test2.layout' }
        ]
      } as any);
    });

    it('should handle string componentPath', async () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      metadataCacheService.initialize('/test/path', '/project/path', false);

      // Mock ComponentSet.fromSource to return a ComponentSet
      jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(dummyComponentSet);

      const result = await metadataCacheService.getSourceComponents();

      expect(ComponentSet.fromSource).toHaveBeenCalledWith('/test/path');
      expect(result).toBe(dummyComponentSet);
    });

    it('should handle array componentPath', async () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      const componentPaths = ['/test/path1', '/test/path2'];
      metadataCacheService.initialize(componentPaths, '/project/path', false);

      // Mock ComponentSet.fromSource to return a ComponentSet
      jest.spyOn(ComponentSet, 'fromSource').mockReturnValue(dummyComponentSet);

      const result = await metadataCacheService.getSourceComponents();

      expect(ComponentSet.fromSource).toHaveBeenCalledWith(componentPaths);
      expect(result).toBe(dummyComponentSet);
    });

    it('should handle manifest componentPath', async () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      metadataCacheService.initialize('/test/manifest.xml', '/project/path', true);

      // Mock SalesforcePackageDirectories.getPackageDirectoryFullPaths directly
      jest.spyOn(SalesforcePackageDirectories, 'getPackageDirectoryFullPaths').mockResolvedValue(['/package/dir']);

      // Mock ComponentSet.fromManifest to return a ComponentSet
      jest.spyOn(ComponentSet, 'fromManifest').mockResolvedValue(dummyComponentSet);

      const result = await metadataCacheService.getSourceComponents();

      expect(ComponentSet.fromManifest).toHaveBeenCalledWith({
        manifestPath: '/test/manifest.xml',
        resolveSourcePaths: ['/package/dir'],
        forceAddWildcards: true
      });
      expect(result).toBe(dummyComponentSet);
    });

    it('should return empty ComponentSet when not initialized', async () => {
      const metadataCacheService = new MetadataCacheService('test-user');

      const result = await metadataCacheService.getSourceComponents();

      expect(result).toBeInstanceOf(ComponentSet);
      expect(result.size).toBe(0);
    });
  });

  describe('processResults', () => {
    it('should set PathType.Multiple for array componentPath', async () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      const componentPaths = ['/test/path1', '/test/path2'];
      metadataCacheService.initialize(componentPaths, '/project/path', false);

      const mockComponents = [
        { type: { name: 'ApexClass' }, fullName: 'TestClass', content: '/cache/path/TestClass.cls' } as SourceComponent
      ];
      const testComponentSet = new ComponentSet();
      jest.spyOn(testComponentSet, 'getSourceComponents').mockReturnValue({
        toArray: () => mockComponents
      } as any);

      const mockResult = {
        components: testComponentSet,
        response: { fileProperties: [] }
      };

      // Mock the sourceComponents property
      (metadataCacheService as any).sourceComponents = testComponentSet;

      const result = await metadataCacheService.processResults(mockResult as any);

      expect(result).toBeDefined();
      expect(result?.selectedPath).toEqual(componentPaths);
      expect(result?.selectedType).toBe(PathType.Multiple);
    });

    it('should set PathType.Folder for directory componentPath', async () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      metadataCacheService.initialize('/test/directory', '/project/path', false);

      isDirectoryMock.mockResolvedValue(true);

      const mockComponents = [
        { type: { name: 'ApexClass' }, fullName: 'TestClass', content: '/cache/path/TestClass.cls' } as SourceComponent
      ];
      const testComponentSet = new ComponentSet();
      jest.spyOn(testComponentSet, 'getSourceComponents').mockReturnValue({
        toArray: () => mockComponents
      } as any);

      const mockResult = {
        components: testComponentSet,
        response: { fileProperties: [] }
      };

      // Mock the sourceComponents property
      (metadataCacheService as any).sourceComponents = testComponentSet;

      const result = await metadataCacheService.processResults(mockResult as any);

      expect(result).toBeDefined();
      expect(result?.selectedPath).toBe('/test/directory');
      expect(result?.selectedType).toBe(PathType.Folder);
    });

    it('should set PathType.Manifest for manifest componentPath', async () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      metadataCacheService.initialize('/test/manifest.xml', '/project/path', true);

      const mockComponents = [
        { type: { name: 'ApexClass' }, fullName: 'TestClass', content: '/cache/path/TestClass.cls' } as SourceComponent
      ];
      const testComponentSet = new ComponentSet();
      jest.spyOn(testComponentSet, 'getSourceComponents').mockReturnValue({
        toArray: () => mockComponents
      } as any);

      const mockResult = {
        components: testComponentSet,
        response: { fileProperties: [] }
      };

      // Mock the sourceComponents property
      (metadataCacheService as any).sourceComponents = testComponentSet;

      const result = await metadataCacheService.processResults(mockResult as any);

      expect(result).toBeDefined();
      expect(result?.selectedPath).toBe('/test/manifest.xml');
      expect(result?.selectedType).toBe(PathType.Manifest);
    });

    it('should set PathType.Individual for single file componentPath', async () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      metadataCacheService.initialize('/test/file.cls', '/project/path', false);

      isDirectoryMock.mockResolvedValue(false);

      const mockComponents = [
        { type: { name: 'ApexClass' }, fullName: 'TestClass', content: '/cache/path/TestClass.cls' } as SourceComponent
      ];
      const testComponentSet = new ComponentSet();
      jest.spyOn(testComponentSet, 'getSourceComponents').mockReturnValue({
        toArray: () => mockComponents
      } as any);

      const mockResult = {
        components: testComponentSet,
        response: { fileProperties: [] }
      };

      // Mock the sourceComponents property
      (metadataCacheService as any).sourceComponents = testComponentSet;

      const result = await metadataCacheService.processResults(mockResult as any);

      expect(result).toBeDefined();
      expect(result?.selectedPath).toBe('/test/file.cls');
      expect(result?.selectedType).toBe(PathType.Individual);
    });

    it('should return undefined when no components', async () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      metadataCacheService.initialize('/test/path', '/project/path', false);

      const testComponentSet = new ComponentSet();
      jest.spyOn(testComponentSet, 'getSourceComponents').mockReturnValue({
        toArray: () => []
      } as any);

      const mockResult = {
        components: testComponentSet,
        response: { fileProperties: [] }
      };

      const result = await metadataCacheService.processResults(mockResult as any);

      expect(result).toBeUndefined();
    });

    it('should return undefined when no result', async () => {
      const metadataCacheService = new MetadataCacheService('test-user');
      metadataCacheService.initialize('/test/path', '/project/path', false);

      const result = await metadataCacheService.processResults(undefined);

      expect(result).toBeUndefined();
    });
  });

  describe('PathType enum', () => {
    it('should have Multiple value', () => {
      expect(PathType.Multiple).toBe('multiple');
    });

    it('should have all expected values', () => {
      expect(PathType.Folder).toBe('folder');
      expect(PathType.Individual).toBe('individual');
      expect(PathType.Multiple).toBe('multiple');
      expect(PathType.Manifest).toBe('manifest');
      expect(PathType.Unknown).toBe('unknown');
    });
  });
});
