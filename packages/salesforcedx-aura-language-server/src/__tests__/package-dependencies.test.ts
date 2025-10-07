import path from 'path';
import fs from 'fs';
import { globSync } from 'glob';

// These unit tests check that specified dependencies in package.json do not use
// ^ or ~ in the version range, either because those packages do not use semver
// and minor/patch updates will break functionality, or because they should only
// use an exact version.

const checkedPackagePatterns: RegExp[] = [/^@salesforce/i, /^@lwc/i];

const readJsonFile = (jsonFilePath: string): any => {
    try {
        return JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    } catch (e) {
        throw new Error(`Error reading json file from ${jsonFilePath}: ${e}`);
    }
};

const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
const packageJson = readJsonFile(packageJsonPath);

// if we're in a monorepo, find other packages in the monorepo and make sure
// references to those also use exact versions
const monorepoRootPath = path.join(packageJsonPath, '..', '..', '..');
const monorepoConfigPath = path.join(monorepoRootPath, 'lerna.json');
if (fs.existsSync(monorepoConfigPath)) {
    const monorepoConfig = readJsonFile(monorepoConfigPath);
    if (monorepoConfig.packages && Array.isArray(monorepoConfig.packages)) {
        monorepoConfig.packages.forEach((packageGlob: string) => {
            const matches = globSync(packageGlob, {
                cwd: monorepoRootPath,
            });
            matches.forEach((match) => {
                const peerPackageJsonPath = path.join(monorepoRootPath, match, 'package.json');
                const peerPackageJson = readJsonFile(peerPackageJsonPath);
                if (peerPackageJson.name !== packageJson.name) {
                    checkedPackagePatterns.push(new RegExp(`^${peerPackageJson.name}`, 'i'));
                }
            });
        });
    }
}

describe(`package.json dependencies for ${packageJson.name}`, () => {
    const dependencies: { [key: string]: string } = packageJson.dependencies;
    const devDependencies: { [key: string]: string } = packageJson.devDependencies;
    let testMatchFound = false;

    for (const [name, versionRange] of Object.entries(dependencies)) {
        checkedPackagePatterns.forEach((pattern) => {
            if (pattern.test(name)) {
                it(`should use a strict version for dependency ${name}`, () => {
                    expect(versionRange.trim()).not.toStartWith('^');
                    expect(versionRange.trim()).not.toStartWith('~');
                    expect(versionRange.trim()).not.toStartWith('>');
                    expect(versionRange.trim()).not.toStartWith('<');
                });
                testMatchFound = true;
            }
        });
    }

    for (const [name, versionRange] of Object.entries(devDependencies)) {
        checkedPackagePatterns.forEach((pattern) => {
            if (pattern.test(name)) {
                it(`should use a strict version for devDependency ${name}`, () => {
                    expect(versionRange.trim()).not.toStartWith('^');
                    expect(versionRange.trim()).not.toStartWith('~');
                    expect(versionRange.trim()).not.toStartWith('>');
                    expect(versionRange.trim()).not.toStartWith('<');
                });
                testMatchFound = true;
            }
        });
    }

    if (!testMatchFound) {
        it('does not have any matching dependencies', () => {
            console.log(`no dependencies matching expected patterns ${checkedPackagePatterns}`);
        });
    }
});
