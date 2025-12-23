/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as vscode from 'vscode';

// These unit tests check that specified dependencies in package.json do not use
// ^ or ~ in the version range, either because those packages do not use semver
// and minor/patch updates will break functionality, or because they should only
// use an exact version.

const checkedPackagePatterns: RegExp[] = [/^@salesforce/i, /^@lwc/i];

const readJsonFile = async (jsonFilePath: string): Promise<Record<string, unknown>> => {
    try {
        const uri = vscode.Uri.file(jsonFilePath);
        const content = await vscode.workspace.fs.readFile(uri);
        const textContent = new TextDecoder().decode(content);
        return JSON.parse(textContent);
    } catch (e) {
        throw new Error(`Error reading json file from ${jsonFilePath}: ${String(e)}`);
    }
};

/** Check if a file exists using VS Code workspace APIs */
const pathExists = async (filePath: string): Promise<boolean> => {
    try {
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
};

// Async setup function to initialize test data
const setupTestData = async (): Promise<Record<string, unknown>> => {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = await readJsonFile(packageJsonPath);

    // if we're in a monorepo, find other packages in the monorepo and make sure
    // references to those also use exact versions
    const monorepoRootPath = path.join(packageJsonPath, '..', '..', '..');
    const monorepoConfigPath = path.join(monorepoRootPath, 'lerna.json');

    if (await pathExists(monorepoConfigPath)) {
        const monorepoConfig = await readJsonFile(monorepoConfigPath);
        const packages = monorepoConfig.packages;
        if (packages && Array.isArray(packages)) {
            const packagePromises = packages.map(async (packageGlob: string) => {
                // Simple pattern matching for common cases like "packages/*"
                if (packageGlob.endsWith('/*')) {
                    const baseDir = packageGlob.slice(0, -2);
                    const baseDirPath = path.join(monorepoRootPath, baseDir);
                    try {
                        const uri = vscode.Uri.file(baseDirPath);
                        const entries = await vscode.workspace.fs.readDirectory(uri);
                        const matchPromises = entries.map(async ([name, type]) => {
                            if (type === vscode.FileType.Directory) {
                                const peerPackageJsonPath = path.join(baseDirPath, name, 'package.json');
                                try {
                                    const peerPackageJson = await readJsonFile(peerPackageJsonPath);
                                    const peerName = peerPackageJson.name;
                                    const currentName = packageJson.name;
                                    if (peerName && currentName && peerName !== currentName) {
                                        checkedPackagePatterns.push(new RegExp(`^${String(peerName)}`, 'i'));
                                    }
                                } catch {
                                    // Skip if package.json doesn't exist or can't be read
                                }
                            }
                        });
                        await Promise.all(matchPromises);
                    } catch {
                        // Skip if directory doesn't exist
                    }
                }
            });
            await Promise.all(packagePromises);
        }
    }

    return packageJson;
};

describe('package.json dependencies', () => {
    let packageJson: Record<string, unknown>;
    let testMatchFound = false;

    beforeAll(async () => {
        packageJson = await setupTestData();
    });

    describe('dependencies validation', () => {
        it('should have loaded package.json', () => {
            expect(packageJson).toBeDefined();
            expect(packageJson.name).toBeDefined();
        });

        it('should use strict versions for matching dependencies', () => {
            if (!packageJson) return;

            const dependencies = packageJson.dependencies ?? {};
            const devDependencies = packageJson.devDependencies ?? {};

            for (const [name, versionRange] of Object.entries(dependencies)) {
                checkedPackagePatterns.forEach((pattern) => {
                    if (pattern.test(name)) {
                        expect(versionRange.trim()).not.toMatch(/^\^/);
                        expect(versionRange.trim()).not.toMatch(/^~/);
                        expect(versionRange.trim()).not.toMatch(/^>/);
                        expect(versionRange.trim()).not.toMatch(/^</);
                        testMatchFound = true;
                    }
                });
            }

            for (const [name, versionRange] of Object.entries(devDependencies)) {
                checkedPackagePatterns.forEach((pattern) => {
                    if (pattern.test(name)) {
                        expect(versionRange.trim()).not.toMatch(/^\^/);
                        expect(versionRange.trim()).not.toMatch(/^~/);
                        expect(versionRange.trim()).not.toMatch(/^>/);
                        expect(versionRange.trim()).not.toMatch(/^</);
                        testMatchFound = true;
                    }
                });
            }

            if (!testMatchFound) {
                console.log(`no dependencies matching expected patterns ${String(checkedPackagePatterns)}`);
            }
        });
    });
});
