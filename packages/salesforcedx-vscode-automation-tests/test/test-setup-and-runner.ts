/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import fs from 'fs/promises';
import path from 'path';
import * as utilities from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';
import { extensions } from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';
import { ExTester } from 'vscode-extension-tester';
import { ReleaseQuality } from 'vscode-extension-tester/out/util/codeUtil';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { EnvironmentSettings } from './environmentSettings';

class TestSetupAndRunner extends ExTester {
  protected static _exTestor: TestSetupAndRunner;

  constructor(
    extensionPath?: string | undefined,
    private spec?: string | undefined
  ) {
    super(extensionPath, ReleaseQuality.Stable, extensionPath);
  }

  public async setup(): Promise<void> {
    await this.downloadCode(EnvironmentSettings.getInstance().vscodeVersion);
    await this.downloadChromeDriver(EnvironmentSettings.getInstance().vscodeVersion);
    await this.installExtensions();
    await this.setupAndAuthorizeOrg();
  }

  public async runTests(): Promise<number> {
    const useExistingProject = EnvironmentSettings.getInstance().useExistingProject;
    utilities.log(`this.spec: ${this.spec}`);
    utilities.log(`EnvironmentSettings.getInstance().specFiles: ${EnvironmentSettings.getInstance().specFiles}`);
    utilities.log(`useExistingProject: ${useExistingProject}`);
    const resources = useExistingProject ? [useExistingProject] : [];
    utilities.log(`resources: ${useExistingProject}`);
    return super.runTests(this.spec || EnvironmentSettings.getInstance().specFiles, { resources });
  }
  public async installExtension(extension: string): Promise<void> {
    utilities.log(`SetUp - Started Install extension ${path.basename(extension)}`);
    await this.installVsix({ useYarn: false, vsixFile: extension });
  }

  public async installExtensions(excludeExtensions: utilities.ExtensionId[] = []): Promise<void> {
    const extensionsDir = path.resolve(path.join(EnvironmentSettings.getInstance().extensionPath));
    const extensionPattern = /^(?<publisher>.+?)\.(?<extensionId>.+?)-(?<version>\d+\.\d+\.\d+)(?:\.\d+)*$/;
    const extensionsDirEntries = (await fs.readdir(extensionsDir)).map(entry => path.resolve(extensionsDir, entry));
    const foundInstalledExtensions = await Promise.all(
      extensionsDirEntries
        .filter(async entry => {
          try {
            const stats = await fs.stat(entry);
            return stats.isDirectory();
          } catch (e) {
            utilities.log(`stat failed for file ${entry}`);
            return false;
          }
        })
        .map(entry => {
          const match = path.basename(entry).match(extensionPattern);
          if (match?.groups) {
            return {
              publisher: match.groups.publisher,
              extensionId: match.groups.extensionId,
              version: match.groups.version,
              path: entry
            };
          }
          return null;
        })
        .filter(Boolean)
        .filter(ext => extensions.find(refExt => refExt.extensionId === ext?.extensionId))
    );

    if (
      foundInstalledExtensions.length > 0 &&
      foundInstalledExtensions.every(ext => extensions.find(refExt => refExt.extensionId === ext?.extensionId))
    ) {
      utilities.log(
        `Found the following pre-installed extensions in dir ${extensionsDir}, skipping installation of vsix`
      );
      foundInstalledExtensions.forEach(ext => {
        utilities.log(`Extension ${ext?.extensionId} version ${ext?.version}`);
      });
      return;
    }

    const extensionsVsixs = utilities.getVsixFilesFromDir(extensionsDir);
    if (extensionsVsixs.length === 0) {
      throw new Error(`No vsix files were found in dir ${extensionsDir}`);
    }

    const mergeExcluded = Array.from(
      new Set([
        ...excludeExtensions,
        ...extensions.filter(ext => ext.shouldInstall === 'never').map(ext => ext.extensionId)
      ])
    );

    // Refactored part to use the extensions array
    extensionsVsixs.forEach(vsix => {
      const match = path.basename(vsix).match(/^(?<extension>.*?)(-(?<version>\d+\.\d+\.\d+))?\.vsix$/);
      if (match?.groups) {
        const { extension, version } = match.groups;
        const foundExtension = extensions.find(e => e.extensionId === extension);
        if (foundExtension) {
          foundExtension.vsixPath = vsix;
          // assign 'never' to this extension if its id is included in excluedExtensions
          foundExtension.shouldInstall = mergeExcluded.includes(foundExtension.extensionId) ? 'never' : 'always';
          // if not installing, don't verify, otherwise use default value
          foundExtension.shouldVerifyActivation =
            foundExtension.shouldInstall === 'never' ? false : foundExtension.shouldVerifyActivation;
          utilities.log(
            `SetUp - Found extension ${extension} version ${version} with vsixPath ${foundExtension.vsixPath}`
          );
        }
      }
    });

    // Iterate over the extensions array to install extensions
    for (const extensionObj of extensions.filter(ext => ext.vsixPath !== '' && ext.shouldInstall !== 'never')) {
      await this.installExtension(extensionObj.vsixPath);
    }
  }

  public async setupAndAuthorizeOrg() {
    const environmentSettings = EnvironmentSettings.getInstance();
    const devHubUserName = environmentSettings.devHubUserName;
    const devHubAliasName = environmentSettings.devHubAliasName;
    const SFDX_AUTH_URL = environmentSettings.sfdxAuthUrl;
    const orgId = environmentSettings.orgId;
    const sfdxAuthUrl = String(SFDX_AUTH_URL);
    const authFilePath = 'authFile.txt';

    // Create and write the SFDX Auth URL in a text file
    await fs.writeFile(authFilePath, sfdxAuthUrl);

    // Step 1: Authorize to Testing Org
    const authorizeOrg = await utilities.orgLoginSfdxUrl(authFilePath);
    expect(authorizeOrg.stdout).to.contain(`Successfully authorized ${devHubUserName} with org ID ${orgId}`);

    // Step 2: Set Alias for the Org
    const setAlias = await utilities.setAlias(devHubAliasName, devHubUserName);
    expect(setAlias.stdout).to.contain(devHubAliasName);
    expect(setAlias.stdout).to.contain(devHubUserName);
    expect(setAlias.stdout).to.contain('true');
  }

  static get exTester(): TestSetupAndRunner {
    if (TestSetupAndRunner.exTester) {
      return TestSetupAndRunner._exTestor;
    }
    TestSetupAndRunner._exTestor = new TestSetupAndRunner();
    return TestSetupAndRunner._exTestor;
  }
}

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
  .option('spec', {
    alias: 's',
    type: 'string',
    description: 'Glob pattern for test files',
    demandOption: false
  })
  .help().argv as { spec: string | undefined };

const testSetupAnRunner = new TestSetupAndRunner(EnvironmentSettings.getInstance().extensionPath, argv.spec);
async function run() {
  try {
    await testSetupAnRunner.setup();
    const result = await testSetupAnRunner.runTests();
    console.log(result);
    process.exit(result);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
