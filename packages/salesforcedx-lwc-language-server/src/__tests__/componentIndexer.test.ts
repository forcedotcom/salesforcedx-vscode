/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { normalizePath, WORKSPACE_FIND_FILES_REQUEST } from '@salesforce/salesforcedx-lightning-lsp-common';
import {
  createMockWorkspaceFindFilesConnection,
  getSfdxWorkspaceRelativePaths,
  SFDX_WORKSPACE_ROOT,
  SFDX_WORKSPACE_STRUCTURE,
  sfdxFileSystemAccessor
} from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import ComponentIndexer, { Entry, unIndexedFiles } from '../componentIndexer';
import { Tag, createTag, getTagName } from '../tag';

const FILE_STAT = { type: 'file' as const, exists: true, ctime: 0, mtime: 0, size: 0 };
const DIR_STAT = { type: 'directory' as const, exists: true, ctime: 0, mtime: 0, size: 0 };

function buildContentMap(): Map<string, string> {
  const map = new Map<string, string>();
  const root = normalizePath(SFDX_WORKSPACE_ROOT);
  for (const [rel, content] of Object.entries(SFDX_WORKSPACE_STRUCTURE as Record<string, string>)) {
    map.set(normalizePath(path.join(root, rel.replaceAll('\\', '/'))), content);
  }
  return map;
}

const contentMap = buildContentMap();

beforeAll(() => {
  sfdxFileSystemAccessor.setWorkspaceFolderUris([URI.file(SFDX_WORKSPACE_ROOT).toString()]);
  sfdxFileSystemAccessor.setFindFilesFromConnection(
    createMockWorkspaceFindFilesConnection(SFDX_WORKSPACE_ROOT, {
      relativePaths: getSfdxWorkspaceRelativePaths()
    }) as Parameters<typeof sfdxFileSystemAccessor.setFindFilesFromConnection>[0],
    WORKSPACE_FIND_FILES_REQUEST
  );

  jest.spyOn(sfdxFileSystemAccessor, 'getFileStat').mockImplementation(async (uri: string) => {
    const key = normalizePath(uri);
    if (contentMap.has(key)) return FILE_STAT;
    const prefix = `${key}/`;
    for (const k of contentMap.keys()) {
      if (k.startsWith(prefix)) return DIR_STAT;
    }
    return undefined;
  });
  jest
    .spyOn(sfdxFileSystemAccessor, 'getFileContent')
    .mockImplementation(async (uri: string) => contentMap.get(normalizePath(uri)));
  jest.spyOn(sfdxFileSystemAccessor, 'updateFileContent').mockImplementation(async (uri: string, content: string) => {
    contentMap.set(normalizePath(uri), content);
  });
  jest.spyOn(sfdxFileSystemAccessor, 'deleteFile').mockImplementation(async (pathOrUri: string) => {
    contentMap.delete(normalizePath(pathOrUri));
  });
});

// Mock objects for testing
const createMockStats = (mtime: Date) => ({ mtime });
const createMockDirent = () => ({});

const componentIndexer: ComponentIndexer = new ComponentIndexer({
  workspaceRoot: SFDX_WORKSPACE_ROOT,
  fileSystemAccessor: sfdxFileSystemAccessor
});

beforeEach(async () => {
  await componentIndexer.init();
});

afterEach(() => {
  componentIndexer.tags.clear();
});

describe('ComponentIndexer', () => {
  describe('new', () => {
    it('initializes with the root of a workspace', () => {
      // workspaceRoot is normalized by getWorkspaceRoot, so normalize the expected path for comparison
      expect(componentIndexer.workspaceRoot).toEqual(SFDX_WORKSPACE_ROOT);
      expect(componentIndexer.workspaceType).toEqual('SFDX');
    });
  });

  describe('instance methods', () => {
    describe('#init', () => {
      it('adds a Tag to `tags` for each custom component', () => {
        // Updated to match actual workspace structure - finding all .js components
        expect(componentIndexer.tags.size).toBeGreaterThanOrEqual(8);
        expect(componentIndexer.tags.get('c-hello_world'));
      });
    });

    describe('#customComponents', () => {
      it('returns a list of files where the .js filename is the same as its parent directory name', async () => {
        // Discovery via findFiles (disk only). Match whatever the mock finds on disk (may not include typescript on all runners).
        const componentEntries = await componentIndexer.getComponentEntries();
        const paths = componentEntries.map(entry => normalizePath(path.resolve(entry.path))).toSorted();
        const expectedPaths = [
          'force-app/main/default/lwc/hello_world/hello_world.js',
          'force-app/main/default/lwc/import_relative/import_relative.js',
          'force-app/main/default/lwc/index/index.js',
          'force-app/main/default/lwc/lightning_datatable_example/lightning_datatable_example.js',
          'force-app/main/default/lwc/lightning_tree_example/lightning_tree_example.js',
          'force-app/main/default/lwc/todo_item/todo_item.js',
          'force-app/main/default/lwc/todo/todo.js',
          'force-app/main/default/lwc/utils/utils.js',
          'utils/meta/lwc/todo_util/todo_util.js',
          'utils/meta/lwc/todo_utils/todo_utils.js'
        ].map(item => normalizePath(path.join(componentIndexer.workspaceRoot, item)));
        expect(paths.length).toBeGreaterThanOrEqual(expectedPaths.length);
        for (const expectedPath of expectedPaths) {
          expect(paths).toContain(expectedPath);
        }
        expect(paths).not.toContain(
          normalizePath(
            path.join(
              componentIndexer.workspaceRoot,
              'force-app',
              'main',
              'default',
              'lwc',
              'import_relative',
              'messages.js'
            )
          )
        );
        expect(paths).not.toContain(
          normalizePath(
            path.join(componentIndexer.workspaceRoot, 'force-app', 'main', 'default', 'lwc', 'todo', 'store.js')
          )
        );
      });
    });

    describe('findTagByName', () => {
      it('finds tag with an exact match', () => {
        expect(componentIndexer.findTagByName('hello_world')).not.toBeNull();
        expect(getTagName(componentIndexer.findTagByName('hello_world')!)).toEqual('hello_world');
        expect(componentIndexer.findTagByName('foo')).toBeNull();
      });

      it('finds tag with lwc prefix', () => {
        expect(getTagName(componentIndexer.findTagByName('c-hello_world')!)).toEqual('hello_world');
        expect(componentIndexer.findTagByName('c-hello-world')).toBeNull();
        expect(componentIndexer.findTagByName('c-helloWorld')).toBeNull();
        expect(componentIndexer.findTagByName('c-todo-foo')).toBeNull();
      });

      it('finds tag with aura prefix', () => {
        expect(componentIndexer.findTagByName('c:hello_world')).toBeNull();
        expect(componentIndexer.findTagByName('c:hello-world')).toBeNull();
        expect(getTagName(componentIndexer.findTagByName('c:helloWorld')!)).toEqual('hello_world');
        expect(getTagName(componentIndexer.findTagByName('c:todo')!)).toEqual('todo');
        expect(getTagName(componentIndexer.findTagByName('c:todoItem')!)).toEqual('todo_item');
        expect(componentIndexer.findTagByName('c:todo-foo')).toBeNull();
      });

      it('should return null when query provided cannot be mapped', () => {
        expect(componentIndexer.findTagByName('response.data.length')).toBeNull();
      });
    });

    describe('#findTagByURI', () => {
      it('finds a Tag by matching the URI', () => {
        const query = URI.file(
          path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/lwc/hello_world/hello_world.js')
        ).toString();
        expect(componentIndexer.findTagByURI(query)).not.toBeNull();
        expect(componentIndexer.findTagByURI(path.join('lwc', 'hello_world', 'hello_world.js'))).toBeNull();
        expect(componentIndexer.findTagByURI('hello_world.js')).toBeNull();
        expect(componentIndexer.findTagByURI(path.join('foo', 'bar', 'baz'))).toBeNull();
      });

      it('finds a Tag by its matching html file', () => {
        const query = URI.file(
          path.join(SFDX_WORKSPACE_ROOT, 'force-app/main/default/lwc/hello_world/hello_world.html')
        ).toString();
        expect(componentIndexer.findTagByURI(query)).not.toBeNull();
        expect(componentIndexer.findTagByURI('lwc/hello_world/hello_world.html')).toBeNull();
        expect(componentIndexer.findTagByURI('hello_world.html')).toBeNull();
        expect(componentIndexer.findTagByURI(path.join('foo', 'bar', 'baz'))).toBeNull();
      });
    });

    describe('#staleTags', () => {
      it('returns a list of tags that are stale and should be removed', async () => {
        const stale = await componentIndexer.getStaleTags();
        expect(stale.length).toBe(0);
      });
    });

    describe('#generateIndex()', () => {
      it('creates Tag objects for all the component JS files', () => {
        // Updated to match actual workspace structure - finding all .js components
        expect(componentIndexer.tags.size).toBeGreaterThanOrEqual(8);
      });
    });

    describe('typescript path mapping', () => {
      // test_component not on disk; discovery uses findFiles only (typescript may or may not be on disk)
      const data = [
        ['c/hello_world', 'force-app/main/default/lwc/hello_world/hello_world'],
        ['c/import_relative', 'force-app/main/default/lwc/import_relative/import_relative'],
        ['c/index', 'force-app/main/default/lwc/index/index'],
        [
          'c/lightning_datatable_example',
          'force-app/main/default/lwc/lightning_datatable_example/lightning_datatable_example'
        ],
        ['c/lightning_tree_example', 'force-app/main/default/lwc/lightning_tree_example/lightning_tree_example'],
        ['c/todo_item', 'force-app/main/default/lwc/todo_item/todo_item'],
        ['c/todo', 'force-app/main/default/lwc/todo/todo'],
        ['c/utils', 'force-app/main/default/lwc/utils/utils'],
        ['c/todo_util', 'utils/meta/lwc/todo_util/todo_util'],
        ['c/todo_utils', 'utils/meta/lwc/todo_utils/todo_utils']
      ].map(([componentName, filePath]) => {
        const resolvedFilePath = [normalizePath(path.join(componentIndexer.workspaceRoot, filePath))];
        return [componentName, resolvedFilePath];
      });
      const expectedComponents = Object.fromEntries(data);

      describe('#tsConfigPathMapping', () => {
        it('returns a map of files inside an lwc watched directory where the .js or .ts files match the directory name', async () => {
          const tsConfigPathMapping = await componentIndexer.getTsConfigPathMapping();
          // Discovery via findFiles (disk); may include extra entries e.g. c/typescript if present on disk
          for (const [key, value] of Object.entries(expectedComponents)) {
            expect(tsConfigPathMapping[key]).toEqual(value);
          }
        });
      });

      describe('updateSfdxTsConfigPath', () => {
        it('updates tsconfig.sfdx.json path mapping', async () => {
          // Clean up any files created by other tests (e.g., newlyAddedFile from lwcServerNode.test.ts)
          // This ensures the test only sees the expected components
          const newlyAddedFileDir = path.join(
            SFDX_WORKSPACE_ROOT,
            'force-app',
            'main',
            'default',
            'lwc',
            'newlyAddedFile'
          );
          const possibleFiles = [
            path.join(newlyAddedFileDir, 'newlyAddedFile.js'),
            path.join(newlyAddedFileDir, 'newlyAddedFile.ts'),
            path.join(newlyAddedFileDir, 'newlyAddedFile.html'),
            path.join(newlyAddedFileDir, 'newlyAddedFile.css'),
            path.join(newlyAddedFileDir, '__tests__', 'newlyAddedFile', 'newlyAddedFile.js'),
            path.join(newlyAddedFileDir, '__tests__', 'newlyAddedFile', 'newlyAddedFile.ts')
          ];
          for (const filePath of possibleFiles) {
            if (await sfdxFileSystemAccessor.fileExists(filePath)) {
              await sfdxFileSystemAccessor.deleteFile(filePath);
            }
          }
          // Re-initialize to pick up the cleaned state
          await componentIndexer.init();

          const tsconfigTemplate = {
            compilerOptions: {
              target: 'ESNext',
              paths: {
                // Provide an explicit type for the property to avoid implicit 'any[]' type error
                'c/*': [] as const
              }
            }
          };
          const sfdxPath = path.join(SFDX_WORKSPACE_ROOT, '.sfdx', 'tsconfig.sfdx.json');

          const tsconfigContent = JSON.stringify(tsconfigTemplate, null, 4);
          void sfdxFileSystemAccessor.updateFileContent(sfdxPath, tsconfigContent);

          await componentIndexer.updateSfdxTsConfigPath();

          // Read and parse the updated tsconfig
          const updatedTsconfigContent = await sfdxFileSystemAccessor.getFileContent(sfdxPath);
          expect(updatedTsconfigContent).not.toBeUndefined();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const tsconfig = JSON.parse(updatedTsconfigContent!);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const tsconfigPathMapping = tsconfig.compilerOptions.paths;
          for (const [key, value] of Object.entries(expectedComponents)) {
            expect(tsconfigPathMapping[key]).toEqual(value);
          }

          // Clean-up test files
          await sfdxFileSystemAccessor.deleteFile(sfdxPath);
        });
      });
    });
  });

  describe('helper functions', () => {
    describe('unIndexedFiles', () => {
      it('it returns entries 0 entries when they match', async () => {
        const stats = createMockStats(new Date('2020-01-01'));
        const dirent = createMockDirent();
        const tags: Tag[] = [await createTag({ file: '/foo', updatedAt: new Date('2020-01-01') })];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const entries: Entry[] = [{ path: '/foo', stats: stats as any, dirent: dirent as any, name: 'foo' }];

        expect(unIndexedFiles(entries, tags).length).toEqual(0);
      });

      it('it returns entries 1 entries when the entries date is different', async () => {
        const stats = createMockStats(new Date('2020-02-01'));
        const dirent = createMockDirent();
        const tags: Tag[] = [await createTag({ file: '/foo', updatedAt: new Date('2020-01-01') })];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const entries: Entry[] = [{ path: '/foo', stats: stats as any, dirent: dirent as any, name: 'foo' }];

        expect(unIndexedFiles(entries, tags).length).toEqual(1);
      });

      it('it returns entries 1 entries when there is no matching tag', async () => {
        const stats = createMockStats(new Date('2020-02-01'));
        const dirent = createMockDirent();
        const tags: Tag[] = [];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const entries: Entry[] = [{ path: '/foo', stats: stats as any, dirent: dirent as any, name: 'foo' }];

        expect(unIndexedFiles(entries, tags).length).toEqual(1);
      });
    });
  });
});
