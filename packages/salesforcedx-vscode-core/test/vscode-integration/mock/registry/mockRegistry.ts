/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '@salesforce/source-deploy-retrieve';

export const mockRegistryData = {
  types: {
    /**
     * Metadata with no content and is contained in a folder type component
     *
     * e.g. Report in ReportFolder
     */
    xmlinfolder: {
      id: 'xmlinfolder',
      directoryName: 'xmlinfolders',
      name: 'XmlInFolder',
      suffix: 'xif',
      folderType: 'xmlinfolderfolder'
    },
    /**
     * Folder metadata type for XmlInFolder type
     *
     * e.g. ReportFolder for Report
     */
    xmlinfolderfolder: {
      id: 'xmlinfolderfolder',
      directoryName: 'xmlinfolders',
      name: 'XmlInFolder',
      suffix: 'xifFolder',
      folderContentType: 'xmlinfolder'
    },
    /**
     * Metadata with a content file that has the same suffix as the xml (minus the -meta.xml)
     *
     * e.g. ApexClass
     */
    matchingcontentfile: {
      id: 'matchingcontentfile',
      directoryName: 'matchingContentFiles',
      inFolder: false,
      name: 'MatchingContentFile',
      suffix: 'mcf',
      strategies: {
        adapter: 'matchingContentFile',
        transformer: 'standard'
      }
    },
    /**
     * Metadata with mixed content that requires replacement of the suffix.
     *
     * e.g. Document
     */
    document: {
      id: 'document',
      directoryName: 'documents',
      inFolder: true,
      name: 'Document',
      suffix: 'document',
      folderType: 'documentfolder',
      strategies: {
        adapter: 'mixedContent'
      }
    },
    /**
     * Metadata with content of any file type in a folder type component
     *
     * e.g. Document in DocumentFolder
     */
    mixedcontentinfolder: {
      id: 'mixedcontentinfolder',
      directoryName: 'mixedContentInFolders',
      inFolder: true,
      name: 'MixedContentInFolder',
      suffix: 'mcif',
      strictDirectoryName: true,
      folderType: 'mciffolder',
      strategies: {
        adapter: 'mixedContent'
      }
    },
    /**
     * Metadata types with children that are not decomposed into separate files
     *
     * e.g. CustomLabels
     */
    nondecomposed: {
      id: 'nondecomposedparent',
      name: 'nondecomposedparent',
      suffix: 'nondecomposed',
      directoryName: 'nondecomposed',
      inFolder: false,
      strictDirectoryName: false,
      children: {
        types: {
          nondecomposedchild: {
            id: 'nondecomposedchild',
            name: 'nondecomposedchild',
            ignoreParentName: true,
            uniqueIdElement: 'id',
            directoryName: 'nondecomposed',
            suffix: 'nondecomposed'
          }
        },
        suffixes: {
          nondecomposed: 'nondecomposed'
        },
        directories: {
          nondecomposed: 'nondecomposed'
        }
      },
      strategies: {
        adapter: 'default',
        transformer: 'nonDecomposed',
        recomposition: 'startEmpty'
      }
    },
    /**
     * Metadata whose content is directory(ies) containing files of any extension
     *
     * e.g. ExperienceBundle
     */
    mixedcontentdirectory: {
      id: 'mixedcontentdirectory',
      directoryName: 'mixedcontentdirectories',
      inFolder: false,
      name: 'MixedContentDirectory',
      strictDirectoryName: true,
      strategies: {
        adapter: 'mixedContent'
      }
    },
    bundle: {
      id: 'bundle',
      directoryName: 'bundles',
      inFolder: false,
      name: 'Bundle',
      strictDirectoryName: true,
      strategies: {
        adapter: 'bundle',
        transformer: 'bundle'
      }
    },
    mciffolder: {
      id: 'mciffolder',
      directoryName: 'mixedContentInFolders',
      inFolder: false,
      name: 'McifFolder',
      suffix: 'mcifFolder',
      folderContentType: 'mixedcontentinfolder'
    },
    decomposed: {
      id: 'decomposed',
      directoryName: 'decomposeds',
      inFolder: false,
      name: 'Decomposed',
      suffix: 'decomposed',
      strictDirectoryName: true,
      children: {
        types: {
          x: {
            id: 'x',
            directoryName: 'xs',
            name: 'X',
            suffix: 'x'
          },
          y: {
            id: 'y',
            directoryName: 'ys',
            name: 'Y',
            suffix: 'y'
          }
        },
        suffixes: {
          x: 'x',
          y: 'y'
        },
        directories: {
          xs: 'x',
          ys: 'y'
        }
      },
      strategies: {
        adapter: 'decomposed',
        transformer: 'decomposed',
        decomposition: 'folderPerType'
      }
    },
    /**
     * Metadata with one content of any file extension
     *
     * e.g. StaticResource
     */
    mixedcontentsinglefile: {
      id: 'mixedcontentsinglefile',
      directoryName: 'mixedSingleFiles',
      inFolder: false,
      name: 'MixedContentSingleFile',
      suffix: 'mixedSingleFile',
      strictDirectoryName: true,
      strategies: {
        adapter: 'mixedContent',
        transformer: 'staticResource'
      }
    },
    decomposedtoplevel: {
      id: 'decomposedtoplevel',
      directoryName: 'decomposedTopLevels',
      inFolder: false,
      name: 'DecomposedTopLevel',
      suffix: 'dtl',
      strictDirectoryName: true,
      children: {
        types: {
          g: {
            id: 'g',
            directoryName: 'gs',
            name: 'G',
            suffix: 'g'
          }
        },
        suffixes: {
          g: 'g'
        },
        directories: {
          gs: 'g'
        }
      },
      strategies: {
        adapter: 'decomposed',
        transformer: 'decomposed',
        decomposition: 'topLevel'
      }
    },
    missingstrategies: {
      id: 'missingstrategies',
      directoryName: 'missingStrategies',
      name: 'MissingStrategies',
      suffix: 'ms',
      strategies: {
        adapter: 'thisdoesnotexist',
        transformer: 'thisdoesnotexist'
      }
    }
  },
  suffixes: {
    xif: 'xmlinfolder',
    xifFolder: 'xmlinfolderfolder',
    mcf: 'matchingcontentfile',
    missing: 'typewithoutdef',
    mcifFolder: 'mciffolder',
    decomposed: 'decomposed',
    mcif: 'mixedcontentinfolder',
    mixedSingleFile: 'mixedcontentsinglefile',
    dtl: 'decomposedtoplevel',
    ms: 'missingstrategies'
  },
  strictDirectoryNames: {
    mixedContentDirectories: 'mixedcontentdirectory',
    bundles: 'bundle',
    decomposed: 'decomposed',
    mixedSingleFiles: 'mixedcontentsinglefile',
    mixedContentInFolders: 'mixedcontentinfolder',
    decomposedTopLevels: 'decomposedtoplevel'
  },
  childTypes: {
    x: 'decomposed',
    y: 'decomposed',
    g: 'decomposedtoplevel',
    badchildtype: 'mixedcontentsinglefile'
  },
  apiVersion: '52.0'
};

export const mockRegistry = new RegistryAccess(mockRegistryData);
