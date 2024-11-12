/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const dummyLastModifiedDateCache = '2023-03-17T17:52:51.000Z';
export const dummyLastModifiedDateLocal = '2023-03-16T17:52:51.000Z';
export const testData = {
  dummyMetadataCacheResult: {
    selectedPath: [
      '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls-meta.xml',
      '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls',
      '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls-meta.xml',
      '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls'
    ],
    selectedType: 'individual',
    cache: {
      baseDirectory: '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com',
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
          xml: '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679149492372/main/default/classes/TestFriday2.cls-meta.xml',
          parent: undefined,
          content:
            '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679149492372/main/default/classes/TestFriday2.cls',
          parentType: undefined,
          treeContainer: {},
          forceIgnore: {
            DEFAULT_IGNORE: ['**/*.dup', '**/.*', '**/package2-descriptor.json', '**/package2-manifest.json']
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
          xml: '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679149492372/main/default/classes/TestApex22.cls-meta.xml',
          parent: undefined,
          content:
            '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679149492372/main/default/classes/TestApex22.cls',
          parentType: undefined,
          treeContainer: {},
          forceIgnore: {
            DEFAULT_IGNORE: ['**/*.dup', '**/.*', '**/package2-descriptor.json', '**/package2-manifest.json']
          }
        }
      ]
    },
    cachePropPath:
      '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/prop/file-props.json',
    project: {
      baseDirectory: '/Users/test.user/scratchpad/TestProject-1',
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
          xml: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls-meta.xml',
          parent: undefined,
          content: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls',
          parentType: undefined,
          treeContainer: {},
          forceIgnore: {
            DEFAULT_IGNORE: ['**/*.dup', '**/.*', '**/package2-descriptor.json', '**/package2-manifest.json'],
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
            forceIgnoreDirectory: '/Users/test.user/scratchpad/TestProject-1'
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
          xml: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls-meta.xml',
          parent: undefined,
          content: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls',
          parentType: undefined,
          treeContainer: {},
          forceIgnore: {
            DEFAULT_IGNORE: ['**/*.dup', '**/.*', '**/package2-descriptor.json', '**/package2-manifest.json'],
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
            forceIgnoreDirectory: '/Users/test.user/scratchpad/TestProject-1'
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
  },
  dummyCorrelatedComponents: [
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
        xml: '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150223956/main/default/classes/TestFriday2.cls-meta.xml',
        parent: undefined,
        content:
          '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150223956/main/default/classes/TestFriday2.cls',
        parentType: undefined,
        treeContainer: {},
        forceIgnore: {
          DEFAULT_IGNORE: ['**/*.dup', '**/.*', '**/package2-descriptor.json', '**/package2-manifest.json']
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
        xml: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls-meta.xml',
        parent: undefined,
        content: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls',
        parentType: undefined,
        treeContainer: {},
        forceIgnore: {
          DEFAULT_IGNORE: ['**/*.dup', '**/.*', '**/package2-descriptor.json', '**/package2-manifest.json'],
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
          forceIgnoreDirectory: '/Users/test.user/scratchpad/TestProject-1'
        }
      },
      lastModifiedDate: dummyLastModifiedDateCache
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
        xml: '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150223956/main/default/classes/TestApex22.cls-meta.xml',
        parent: undefined,
        content:
          '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150223956/main/default/classes/TestApex22.cls',
        parentType: undefined,
        treeContainer: {},
        forceIgnore: {
          DEFAULT_IGNORE: ['**/*.dup', '**/.*', '**/package2-descriptor.json', '**/package2-manifest.json']
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
        xml: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls-meta.xml',
        parent: undefined,
        content: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls',
        parentType: undefined,
        treeContainer: {},
        forceIgnore: {
          DEFAULT_IGNORE: ['**/*.dup', '**/.*', '**/package2-descriptor.json', '**/package2-manifest.json'],
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
          forceIgnoreDirectory: '/Users/test.user/scratchpad/TestProject-1'
        }
      },
      lastModifiedDate: dummyLastModifiedDateCache
    }
  ],
  dummyDiffs: [
    {
      projectPath: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls',
      cachePath:
        '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150703854/main/default/classes/TestFriday2.cls'
    },
    {
      projectPath: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestFriday2.cls-meta.xml',
      cachePath:
        '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679150703854/main/default/classes/TestFriday2.cls-meta.xml'
    }
  ],
  dummyDiffs2: [
    {
      projectPath: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls',
      cachePath:
        '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679151464361/main/default/classes/TestApex22.cls'
    },
    {
      projectPath: '/Users/test.user/scratchpad/TestProject-1/force-app/main/default/classes/TestApex22.cls-meta.xml',
      cachePath:
        '/var/folders/71/2811gwnx2n7fwqyyf99ctsfm0000gn/T/.sfdx/diff/test-ph2qxpndpvi7@example.com/metadataPackage_1679151464361/main/default/classes/TestApex22.cls-meta.xml'
    }
  ]
};
