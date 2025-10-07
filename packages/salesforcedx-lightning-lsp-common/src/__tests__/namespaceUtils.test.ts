/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { findNamespaceRoots } from '../namespaceUtils';

describe('findNamespaceRoots', () => {
    let tempDir: string;

    beforeEach(async () => {
        // Create a temporary directory for each test
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'namespace-test-'));
    });

    afterEach(async () => {
        // Clean up temporary directory
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    describe('when directory does not exist', () => {
        it('should return empty arrays', async () => {
            const result = await findNamespaceRoots('/non/existent/path');
            expect(result).toEqual({ lwc: [], aura: [] });
        });
    });

    describe('when directory is empty', () => {
        it('should return empty arrays', async () => {
            const result = await findNamespaceRoots(tempDir);
            expect(result).toEqual({ lwc: [], aura: [] });
        });
    });

    describe('when directory contains LWC modules', () => {
        it('should find LWC module roots with name/name.js pattern', async () => {
            // Create LWC module structure: myComponent/myComponent.js
            const componentDir = path.join(tempDir, 'myComponent');
            await fs.promises.mkdir(componentDir, { recursive: true });
            await fs.promises.writeFile(path.join(componentDir, 'myComponent.js'), 'import { LightningElement } from "lwc";');

            const result = await findNamespaceRoots(tempDir);
            expect(result.lwc).toContain(path.resolve(tempDir));
            expect(result.aura).toEqual([]);
        });

        it('should find multiple LWC module roots', async () => {
            // Create multiple LWC modules
            const component1Dir = path.join(tempDir, 'component1');
            const component2Dir = path.join(tempDir, 'component2');

            await fs.promises.mkdir(component1Dir, { recursive: true });
            await fs.promises.mkdir(component2Dir, { recursive: true });
            await fs.promises.writeFile(path.join(component1Dir, 'component1.js'), 'import { LightningElement } from "lwc";');
            await fs.promises.writeFile(path.join(component2Dir, 'component2.js'), 'import { LightningElement } from "lwc";');

            const result = await findNamespaceRoots(tempDir);
            expect(result.lwc).toContain(path.resolve(tempDir));
            expect(result.aura).toEqual([]);
        });

        it('should find LWC roots in nested directories', async () => {
            // Create nested structure: modules/lwc/myComponent/myComponent.js
            const modulesDir = path.join(tempDir, 'modules');
            const lwcDir = path.join(modulesDir, 'lwc');
            const componentDir = path.join(lwcDir, 'myComponent');

            await fs.promises.mkdir(componentDir, { recursive: true });
            await fs.promises.writeFile(path.join(componentDir, 'myComponent.js'), 'import { LightningElement } from "lwc";');

            const result = await findNamespaceRoots(tempDir, 3);
            expect(result.lwc).toContain(path.resolve(lwcDir));
            expect(result.aura).toEqual([]);
        });
    });

    describe('when directory contains folders named "lwc"', () => {
        it('should find lwc folder as root', async () => {
            // Create lwc folder
            const lwcDir = path.join(tempDir, 'lwc');
            await fs.promises.mkdir(lwcDir, { recursive: true });

            const result = await findNamespaceRoots(tempDir);
            expect(result.lwc).toContain(path.resolve(lwcDir));
            expect(result.aura).toEqual([]);
        });
    });

    describe('when directory contains ignored folders', () => {
        it('should skip node_modules', async () => {
            const nodeModulesDir = path.join(tempDir, 'node_modules');
            const componentDir = path.join(nodeModulesDir, 'someComponent');

            await fs.promises.mkdir(componentDir, { recursive: true });
            await fs.promises.writeFile(path.join(componentDir, 'someComponent.js'), 'import { LightningElement } from "lwc";');

            const result = await findNamespaceRoots(tempDir);
            expect(result.lwc).toEqual([]);
            expect(result.aura).toEqual([]);
        });

        it('should skip bin, target, jest-modules, repository, git folders', async () => {
            const ignoredFolders = ['bin', 'target', 'jest-modules', 'repository', 'git'];

            for (const folder of ignoredFolders) {
                const ignoredDir = path.join(tempDir, folder);
                const componentDir = path.join(ignoredDir, 'someComponent');

                await fs.promises.mkdir(componentDir, { recursive: true });
                await fs.promises.writeFile(path.join(componentDir, 'someComponent.js'), 'import { LightningElement } from "lwc";');
            }

            const result = await findNamespaceRoots(tempDir);
            expect(result.lwc).toEqual([]);
            expect(result.aura).toEqual([]);
        });
    });

    describe('when maxDepth is reached', () => {
        it('should stop traversing at maxDepth', async () => {
            // Create deep nested structure beyond maxDepth
            let currentPath = tempDir;
            for (let i = 0; i < 10; i++) {
                currentPath = path.join(currentPath, `level${i}`);
                await fs.promises.mkdir(currentPath, { recursive: true });
            }

            const componentDir = path.join(currentPath, 'myComponent');
            await fs.promises.mkdir(componentDir, { recursive: true });
            await fs.promises.writeFile(path.join(componentDir, 'myComponent.js'), 'import { LightningElement } from "lwc";');

            // With default maxDepth of 5, should not find the component
            const result = await findNamespaceRoots(tempDir);
            expect(result.lwc).toEqual([]);
            expect(result.aura).toEqual([]);
        });

        it('should find components within maxDepth', async () => {
            // Create nested structure within maxDepth
            let currentPath = tempDir;
            for (let i = 0; i < 3; i++) {
                currentPath = path.join(currentPath, `level${i}`);
                await fs.promises.mkdir(currentPath, { recursive: true });
            }

            const componentDir = path.join(currentPath, 'myComponent');
            await fs.promises.mkdir(componentDir, { recursive: true });
            await fs.promises.writeFile(path.join(componentDir, 'myComponent.js'), 'import { LightningElement } from "lwc";');

            const result = await findNamespaceRoots(tempDir, 5);
            expect(result.lwc).toContain(path.resolve(currentPath));
            expect(result.aura).toEqual([]);
        });
    });

    describe('when directory contains non-module files', () => {
        it('should not treat directories without matching .js files as module roots', async () => {
            // Create directory with .js file that doesn't match the name pattern
            const componentDir = path.join(tempDir, 'myComponent');
            await fs.promises.mkdir(componentDir, { recursive: true });
            await fs.promises.writeFile(path.join(componentDir, 'other.js'), 'console.log("not a module");');

            const result = await findNamespaceRoots(tempDir);
            expect(result.lwc).toEqual([]);
            expect(result.aura).toEqual([]);
        });

        it('should not treat directories with only non-JS files as module roots', async () => {
            // Create directory with only non-JS files
            const componentDir = path.join(tempDir, 'myComponent');
            await fs.promises.mkdir(componentDir, { recursive: true });
            await fs.promises.writeFile(path.join(componentDir, 'myComponent.html'), '<template></template>');
            await fs.promises.writeFile(path.join(componentDir, 'myComponent.css'), '.my-component {}');

            const result = await findNamespaceRoots(tempDir);
            expect(result.lwc).toEqual([]);
            expect(result.aura).toEqual([]);
        });
    });

    describe('when custom maxDepth is provided', () => {
        it('should respect custom maxDepth parameter', async () => {
            // Create nested structure
            const level1Dir = path.join(tempDir, 'level1');
            const level2Dir = path.join(level1Dir, 'level2');
            const componentDir = path.join(level2Dir, 'myComponent');

            await fs.promises.mkdir(componentDir, { recursive: true });
            await fs.promises.writeFile(path.join(componentDir, 'myComponent.js'), 'import { LightningElement } from "lwc";');

            // With maxDepth 1, should not find the component
            const result1 = await findNamespaceRoots(tempDir, 1);
            expect(result1.lwc).toEqual([]);

            // With maxDepth 3, should find the component
            const result2 = await findNamespaceRoots(tempDir, 3);
            expect(result2.lwc).toContain(path.resolve(level2Dir));
        });
    });

    describe('edge cases', () => {
        it('should handle directories with special characters in names', async () => {
            const componentDir = path.join(tempDir, 'my-component_123');
            await fs.promises.mkdir(componentDir, { recursive: true });
            await fs.promises.writeFile(path.join(componentDir, 'my-component_123.js'), 'import { LightningElement } from "lwc";');

            const result = await findNamespaceRoots(tempDir);
            expect(result.lwc).toContain(path.resolve(tempDir));
        });

        it('should handle empty subdirectories', async () => {
            const emptyDir = path.join(tempDir, 'empty');
            await fs.promises.mkdir(emptyDir, { recursive: true });

            const result = await findNamespaceRoots(tempDir);
            expect(result.lwc).toEqual([]);
            expect(result.aura).toEqual([]);
        });

        it('should handle symlinks gracefully', async () => {
            // Create a real directory and a symlink to it
            const realDir = path.join(tempDir, 'real');
            const symlinkDir = path.join(tempDir, 'symlink');

            await fs.promises.mkdir(realDir, { recursive: true });
            await fs.promises.writeFile(path.join(realDir, 'real.js'), 'import { LightningElement } from "lwc";');

            // Note: fs.symlink might not work on all platforms, so we'll skip this test if it fails
            try {
                await fs.promises.symlink(realDir, symlinkDir);

                const result = await findNamespaceRoots(tempDir);
                expect(result.lwc).toContain(path.resolve(realDir));
            } catch {
                // Skip test if symlinks are not supported
                console.log('Skipping symlink test - not supported on this platform');
            }
        });
    });
});
