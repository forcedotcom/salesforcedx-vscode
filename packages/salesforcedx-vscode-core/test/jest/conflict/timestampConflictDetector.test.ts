import { MetadataCacheService } from '../../../src/conflict';
import * as diffUtils from '../../../src/conflict/componentDiffer';
import { PersistentStorageService } from './../../../src/conflict/persistentStorageService';
import { TimestampConflictDetector } from './../../../src/conflict/timestampConflictDetector';

describe('TimestampConflictDetector', () => {
  const dummyMetadataCacheResult = {
    selectedPath: [
      '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls-meta.xml',
      '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls',
      '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls-meta.xml',
      '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls'
    ],
    selectedType: 'individual',
    cache: {
      baseDirectory:
        '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com',
      commonRoot: 'metadataPackage_1679149492372/main/default/classes',
      components: [
        {
          markedForDelete: false,
          name: 'TestFriday2',
          type: {
            id: 'apexclass',
            name: 'ApexClass',
            suffix: 'cls',
            directoryName: 'classes',
            inFolder: false,
            strictDirectoryName: false,
            strategies: {
              adapter: 'matchingContentFile'
            }
          },
          xml:
            '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679149492372/main/default/classes/TestFriday2.cls-meta.xml',
          parent: undefined,
          content:
            '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679149492372/main/default/classes/TestFriday2.cls',
          parentType: undefined,
          treeContainer: {},
          forceIgnore: {
            DEFAULT_IGNORE: [
              '**/*.dup',
              '**/.*',
              '**/package2-descriptor.json',
              '**/package2-manifest.json'
            ]
          }
        },
        {
          markedForDelete: false,
          name: 'TestApex22',
          type: {
            id: 'apexclass',
            name: 'ApexClass',
            suffix: 'cls',
            directoryName: 'classes',
            inFolder: false,
            strictDirectoryName: false,
            strategies: {
              adapter: 'matchingContentFile'
            }
          },
          xml:
            '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679149492372/main/default/classes/TestApex22.cls-meta.xml',
          parent: undefined,
          content:
            '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679149492372/main/default/classes/TestApex22.cls',
          parentType: undefined,
          treeContainer: {},
          forceIgnore: {
            DEFAULT_IGNORE: [
              '**/*.dup',
              '**/.*',
              '**/package2-descriptor.json',
              '**/package2-manifest.json'
            ]
          }
        }
      ]
    },
    cachePropPath:
      '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/prop/file-props.json',
    project: {
      baseDirectory: '/Users/kenneth.lewis/scratchpad/TestProject-1',
      commonRoot: 'force-app/main/default/classes',
      components: [
        {
          markedForDelete: false,
          name: 'TestApex22',
          type: {
            id: 'apexclass',
            name: 'ApexClass',
            suffix: 'cls',
            directoryName: 'classes',
            inFolder: false,
            strictDirectoryName: false,
            strategies: {
              adapter: 'matchingContentFile'
            }
          },
          xml:
            '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls-meta.xml',
          parent: undefined,
          content:
            '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls',
          parentType: undefined,
          treeContainer: {},
          forceIgnore: {
            DEFAULT_IGNORE: [
              '**/*.dup',
              '**/.*',
              '**/package2-descriptor.json',
              '**/package2-manifest.json'
            ],
            parser: {
              _rules: [
                {
                  origin: 'package.xml',
                  pattern: 'package.xml',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/jsconfig.json',
                  pattern: '**/jsconfig.json',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/.eslintrc.json',
                  pattern: '**/.eslintrc.json',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/__tests__/**',
                  pattern: '**/__tests__/**',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/*.dup',
                  pattern: '**/*.dup',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/.*',
                  pattern: '**/.*',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/package2-descriptor.json',
                  pattern: '**/package2-descriptor.json',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/package2-manifest.json',
                  pattern: '**/package2-manifest.json',
                  negative: false,
                  regex: {}
                }
              ],
              _ignoreCase: true,
              _allowRelativePaths: false,
              _ignoreCache: {
                'force-app/': {
                  ignored: false,
                  unignored: false
                },
                'force-app/main/': {
                  ignored: false,
                  unignored: false
                },
                'force-app/main/default/': {
                  ignored: false,
                  unignored: false
                },
                'force-app/main/default/classes/': {
                  ignored: false,
                  unignored: false
                },
                'force-app/main/default/classes/TestApex22.cls': {
                  ignored: false,
                  unignored: false
                },
                'force-app/main/default/classes/TestApex22.cls-meta.xml': {
                  ignored: false,
                  unignored: false
                }
              },
              _testCache: {},
              _added: true
            },
            forceIgnoreDirectory:
              '/Users/kenneth.lewis/scratchpad/TestProject-1'
          }
        },
        {
          markedForDelete: false,
          name: 'TestFriday2',
          type: {
            id: 'apexclass',
            name: 'ApexClass',
            suffix: 'cls',
            directoryName: 'classes',
            inFolder: false,
            strictDirectoryName: false,
            strategies: {
              adapter: 'matchingContentFile'
            }
          },
          xml:
            '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls-meta.xml',
          parent: undefined,
          content:
            '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls',
          parentType: undefined,
          treeContainer: {},
          forceIgnore: {
            DEFAULT_IGNORE: [
              '**/*.dup',
              '**/.*',
              '**/package2-descriptor.json',
              '**/package2-manifest.json'
            ],
            parser: {
              _rules: [
                {
                  origin: 'package.xml',
                  pattern: 'package.xml',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/jsconfig.json',
                  pattern: '**/jsconfig.json',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/.eslintrc.json',
                  pattern: '**/.eslintrc.json',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/__tests__/**',
                  pattern: '**/__tests__/**',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/*.dup',
                  pattern: '**/*.dup',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/.*',
                  pattern: '**/.*',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/package2-descriptor.json',
                  pattern: '**/package2-descriptor.json',
                  negative: false,
                  regex: {}
                },
                {
                  origin: '**/package2-manifest.json',
                  pattern: '**/package2-manifest.json',
                  negative: false,
                  regex: {}
                }
              ],
              _ignoreCase: true,
              _allowRelativePaths: false,
              _ignoreCache: {
                'force-app/': {
                  ignored: false,
                  unignored: false
                },
                'force-app/main/': {
                  ignored: false,
                  unignored: false
                },
                'force-app/main/default/': {
                  ignored: false,
                  unignored: false
                },
                'force-app/main/default/classes/': {
                  ignored: false,
                  unignored: false
                },
                'force-app/main/default/classes/TestFriday2.cls': {
                  ignored: false,
                  unignored: false
                },
                'force-app/main/default/classes/TestFriday2.cls-meta.xml': {
                  ignored: false,
                  unignored: false
                }
              },
              _testCache: {},
              _added: true
            },
            forceIgnoreDirectory:
              '/Users/kenneth.lewis/scratchpad/TestProject-1'
          }
        }
      ]
    },
    properties: [
      {
        createdById: '00553000003ljqmAAA',
        createdByName: 'User User',
        createdDate: '2023-03-17T17:52:11.000Z',
        fileName: 'unpackaged/classes/TestFriday2.cls',
        fullName: 'TestFriday2',
        id: '01p53000007O0RPAA0',
        lastModifiedById: '00553000003ljqmAAA',
        lastModifiedByName: 'User User',
        lastModifiedDate: '2023-03-17T17:52:51.000Z',
        manageableState: 'unmanaged',
        type: 'ApexClass'
      },
      {
        createdById: '00553000003ljqmAAA',
        createdByName: 'User User',
        createdDate: '2023-03-17T05:56:05.000Z',
        fileName: 'unpackaged/classes/TestApex22.cls',
        fullName: 'TestApex22',
        id: '01p53000007NnTdAAK',
        lastModifiedById: '00553000003ljqmAAA',
        lastModifiedByName: 'User User',
        lastModifiedDate: '2023-03-17T05:57:08.000Z',
        manageableState: 'unmanaged',
        type: 'ApexClass'
      },
      {
        createdById: '00553000003ljqmAAA',
        createdByName: 'User User',
        createdDate: '2023-03-18T14:24:48.652Z',
        fileName: 'unpackaged/package.xml',
        fullName: 'unpackaged/package.xml',
        id: '',
        lastModifiedById: '00553000003ljqmAAA',
        lastModifiedByName: 'User User',
        lastModifiedDate: '2023-03-18T14:24:48.652Z',
        manageableState: 'unmanaged',
        type: 'Package'
      }
    ]
  };
  const dummyCorrelatedComponents = [
    {
      cacheComponent: {
        markedForDelete: false,
        name: 'TestFriday2',
        type: {
          id: 'apexclass',
          name: 'ApexClass',
          suffix: 'cls',
          directoryName: 'classes',
          inFolder: false,
          strictDirectoryName: false,
          strategies: {
            adapter: 'matchingContentFile'
          }
        },
        xml:
          '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150223956/main/default/classes/TestFriday2.cls-meta.xml',
        parent: undefined,
        content:
          '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150223956/main/default/classes/TestFriday2.cls',
        parentType: undefined,
        treeContainer: {},
        forceIgnore: {
          DEFAULT_IGNORE: [
            '**/*.dup',
            '**/.*',
            '**/package2-descriptor.json',
            '**/package2-manifest.json'
          ]
        }
      },
      projectComponent: {
        markedForDelete: false,
        name: 'TestFriday2',
        type: {
          id: 'apexclass',
          name: 'ApexClass',
          suffix: 'cls',
          directoryName: 'classes',
          inFolder: false,
          strictDirectoryName: false,
          strategies: {
            adapter: 'matchingContentFile'
          }
        },
        xml:
          '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls-meta.xml',
        parent: undefined,
        content:
          '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls',
        parentType: undefined,
        treeContainer: {},
        forceIgnore: {
          DEFAULT_IGNORE: [
            '**/*.dup',
            '**/.*',
            '**/package2-descriptor.json',
            '**/package2-manifest.json'
          ],
          parser: {
            _rules: [
              {
                origin: 'package.xml',
                pattern: 'package.xml',
                negative: false,
                regex: {}
              },
              {
                origin: '**/jsconfig.json',
                pattern: '**/jsconfig.json',
                negative: false,
                regex: {}
              },
              {
                origin: '**/.eslintrc.json',
                pattern: '**/.eslintrc.json',
                negative: false,
                regex: {}
              },
              {
                origin: '**/__tests__/**',
                pattern: '**/__tests__/**',
                negative: false,
                regex: {}
              },
              {
                origin: '**/*.dup',
                pattern: '**/*.dup',
                negative: false,
                regex: {}
              },
              {
                origin: '**/.*',
                pattern: '**/.*',
                negative: false,
                regex: {}
              },
              {
                origin: '**/package2-descriptor.json',
                pattern: '**/package2-descriptor.json',
                negative: false,
                regex: {}
              },
              {
                origin: '**/package2-manifest.json',
                pattern: '**/package2-manifest.json',
                negative: false,
                regex: {}
              }
            ],
            _ignoreCase: true,
            _allowRelativePaths: false,
            _ignoreCache: {
              'force-app/': {
                ignored: false,
                unignored: false
              },
              'force-app/main/': {
                ignored: false,
                unignored: false
              },
              'force-app/main/default/': {
                ignored: false,
                unignored: false
              },
              'force-app/main/default/classes/': {
                ignored: false,
                unignored: false
              },
              'force-app/main/default/classes/TestFriday2.cls': {
                ignored: false,
                unignored: false
              },
              'force-app/main/default/classes/TestFriday2.cls-meta.xml': {
                ignored: false,
                unignored: false
              }
            },
            _testCache: {},
            _added: true
          },
          forceIgnoreDirectory: '/Users/kenneth.lewis/scratchpad/TestProject-1'
        }
      },
      lastModifiedDate: '2023-03-17T17:52:51.000Z'
    },
    {
      cacheComponent: {
        markedForDelete: false,
        name: 'TestApex22',
        type: {
          id: 'apexclass',
          name: 'ApexClass',
          suffix: 'cls',
          directoryName: 'classes',
          inFolder: false,
          strictDirectoryName: false,
          strategies: {
            adapter: 'matchingContentFile'
          }
        },
        xml:
          '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150223956/main/default/classes/TestApex22.cls-meta.xml',
        parent: undefined,
        content:
          '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150223956/main/default/classes/TestApex22.cls',
        parentType: undefined,
        treeContainer: {},
        forceIgnore: {
          DEFAULT_IGNORE: [
            '**/*.dup',
            '**/.*',
            '**/package2-descriptor.json',
            '**/package2-manifest.json'
          ]
        }
      },
      projectComponent: {
        markedForDelete: false,
        name: 'TestApex22',
        type: {
          id: 'apexclass',
          name: 'ApexClass',
          suffix: 'cls',
          directoryName: 'classes',
          inFolder: false,
          strictDirectoryName: false,
          strategies: {
            adapter: 'matchingContentFile'
          }
        },
        xml:
          '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls-meta.xml',
        parent: undefined,
        content:
          '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls',
        parentType: undefined,
        treeContainer: {},
        forceIgnore: {
          DEFAULT_IGNORE: [
            '**/*.dup',
            '**/.*',
            '**/package2-descriptor.json',
            '**/package2-manifest.json'
          ],
          parser: {
            _rules: [
              {
                origin: 'package.xml',
                pattern: 'package.xml',
                negative: false,
                regex: {}
              },
              {
                origin: '**/jsconfig.json',
                pattern: '**/jsconfig.json',
                negative: false,
                regex: {}
              },
              {
                origin: '**/.eslintrc.json',
                pattern: '**/.eslintrc.json',
                negative: false,
                regex: {}
              },
              {
                origin: '**/__tests__/**',
                pattern: '**/__tests__/**',
                negative: false,
                regex: {}
              },
              {
                origin: '**/*.dup',
                pattern: '**/*.dup',
                negative: false,
                regex: {}
              },
              {
                origin: '**/.*',
                pattern: '**/.*',
                negative: false,
                regex: {}
              },
              {
                origin: '**/package2-descriptor.json',
                pattern: '**/package2-descriptor.json',
                negative: false,
                regex: {}
              },
              {
                origin: '**/package2-manifest.json',
                pattern: '**/package2-manifest.json',
                negative: false,
                regex: {}
              }
            ],
            _ignoreCase: true,
            _allowRelativePaths: false,
            _ignoreCache: {
              'force-app/': {
                ignored: false,
                unignored: false
              },
              'force-app/main/': {
                ignored: false,
                unignored: false
              },
              'force-app/main/default/': {
                ignored: false,
                unignored: false
              },
              'force-app/main/default/classes/': {
                ignored: false,
                unignored: false
              },
              'force-app/main/default/classes/TestApex22.cls': {
                ignored: false,
                unignored: false
              },
              'force-app/main/default/classes/TestApex22.cls-meta.xml': {
                ignored: false,
                unignored: false
              }
            },
            _testCache: {},
            _added: true
          },
          forceIgnoreDirectory: '/Users/kenneth.lewis/scratchpad/TestProject-1'
        }
      },
      lastModifiedDate: '2023-03-17T05:57:08.000Z'
    }
  ];
  const dummyDiffs = [
    {
      projectPath:
        '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls',
      cachePath:
        '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150703854/main/default/classes/TestFriday2.cls'
    },
    {
      projectPath:
        '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls-meta.xml',
      cachePath:
        '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150703854/main/default/classes/TestFriday2.cls-meta.xml'
    }
  ];
  const dummyDiffs2 = [
    {
      projectPath:
        '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls',
      cachePath:
        '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679151464361/main/default/classes/TestApex22.cls'
    },
    {
      projectPath:
        '/Users/kenneth.lewis/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls-meta.xml',
      cachePath:
        '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679151464361/main/default/classes/TestApex22.cls-meta.xml'
    }
  ];
  let persistentStorageServiceMock: jest.SpyInstance;
  let correlateResultsStub: jest.SpyInstance;
  let diffComponentsStub: jest.SpyInstance;

  describe('createDiffs', () => {
    beforeEach(() => {
      correlateResultsStub = jest
        .spyOn(MetadataCacheService, 'correlateResults')
        .mockReturnValue(dummyCorrelatedComponents as any);
      persistentStorageServiceMock = jest
        .spyOn(PersistentStorageService, 'getInstance')
        .mockReturnValue({
          makeKey: jest.fn(),
          getPropertiesForFile: jest.fn().mockResolvedValueOnce({
            lastModifiedDate: '2023-03-18T17:52:51.000Z'
          })
        } as any);
      diffComponentsStub = jest
        .spyOn(diffUtils, 'diffComponents')
        .mockReturnValueOnce(dummyDiffs)
        .mockReturnValueOnce(dummyDiffs2);
    });

    it('should return diff results for only the files that trip the timestamp conflict detector', async () => {
      const timestampConflictDetector = new TimestampConflictDetector();

      const diffs = timestampConflictDetector.createDiffs(
        dummyMetadataCacheResult as any
      );

      expect(correlateResultsStub).toHaveBeenCalledWith(
        dummyMetadataCacheResult
      );
      expect(persistentStorageServiceMock).toHaveBeenCalled();
      expect(diffComponentsStub).toHaveBeenCalledTimes(2);
      expect(diffs.different.size).toBe(3);
    });

    it('should return diff results for all files passed in when the skipTimestampCheck option is used', async () => {
      const timestampConflictDetector = new TimestampConflictDetector();

      const diffs = timestampConflictDetector.createDiffs(
        dummyMetadataCacheResult as any,
        true
      );

      expect(correlateResultsStub).toHaveBeenCalledWith(
        dummyMetadataCacheResult
      );
      expect(persistentStorageServiceMock).toHaveBeenCalled();
      expect(diffComponentsStub).toHaveBeenCalledTimes(2);
      expect(diffs.different.size).toBe(4);
    });
  });
});
