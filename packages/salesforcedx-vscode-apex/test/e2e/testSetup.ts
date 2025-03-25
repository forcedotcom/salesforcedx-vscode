/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'fs';
import path from 'path';
import * as utilities from './utilities/index';
import { EnvironmentSettings as Env } from './environmentSettings';
import { ProjectConfig, ProjectShapeOption } from './utilities/index';

export class TestSetup {
  public testSuiteSuffixName: string = '';
  public tempFolderPath = path.join(__dirname, '..', 'e2e-temp');
  public projectFolderPath: string | undefined;
  public aliasAndUserNameWereVerified = false;
  public scratchOrgAliasName: string | undefined;
  public scratchOrgId: string | undefined;

  private constructor() {}

  public get tempProjectName(): string {
    return 'TempProject-' + this.testSuiteSuffixName;
  }

  public static async setUp(testReqConfig: utilities.TestReqConfig): Promise<TestSetup> {
    const testSetup = new TestSetup();
    testSetup.testSuiteSuffixName = testReqConfig.testSuiteSuffixName;
    utilities.log('');
    utilities.log(`${testSetup.testSuiteSuffixName} - Starting TestSetup.setUp()...`);
    /* The expected workspace will be open up after setUpTestingWorkspace */
    await testSetup.setUpTestingWorkspace(testReqConfig.projectConfig);
    if (testReqConfig.projectConfig.projectShape !== ProjectShapeOption.NONE) {
      await utilities.verifyExtensionsAreRunning(utilities.getExtensionsToVerifyActive());
      const scratchOrgEdition = testReqConfig.scratchOrgEdition || 'developer';
      testSetup.updateScratchOrgDefWithEdition(scratchOrgEdition);
      if (process.platform === 'darwin') testSetup.setJavaHomeConfigEntry(); // Extra config needed for Apex LSP on GHA
      if (testReqConfig.isOrgRequired) await utilities.setUpScratchOrg(testSetup, scratchOrgEdition);
      await utilities.reloadAndEnableExtensions(); // This is necessary in order to update JAVA home path
    }
    testSetup.setWorkbenchHoverDelay();
    utilities.log(`${testSetup.testSuiteSuffixName} - ...finished TestSetup.setUp()`);
    return testSetup;
  }

  public async tearDown(checkForUncaughtErrors: boolean = true): Promise<void> {
    if (checkForUncaughtErrors) await utilities.checkForUncaughtErrors();
    try {
      await utilities.deleteScratchOrg(this.scratchOrgAliasName);
      await utilities.deleteScratchOrgInfo(this);
    } catch (error) {
      utilities.log(`Deleting scratch org (or info) failed with Error: ${(error as Error).message}`);
    }
  }

  private async initializeNewSfProject() {
    if (!fs.existsSync(this.tempFolderPath)) {
      utilities.createFolder(this.tempFolderPath);
    }
    await utilities.generateSfProject(this.tempProjectName, this.tempFolderPath); // generate a sf project for 'new'
    this.projectFolderPath = path.join(this.tempFolderPath, this.tempProjectName);
  }

  public async setUpTestingWorkspace(projectConfig: ProjectConfig) {
    utilities.log(`${this.testSuiteSuffixName} - Starting setUpTestingWorkspace()...`);
    let projectName;
    switch (projectConfig.projectShape) {
      case ProjectShapeOption.NEW:
        await this.initializeNewSfProject();
        break;

      case ProjectShapeOption.NAMED:
        if (projectConfig.githubRepoUrl) {
          // verify if folder matches the github repo url
          const repoExists = await utilities.gitRepoExists(projectConfig.githubRepoUrl);
          if (!repoExists) {
            this.throwError(`Repository does not exist or is inaccessible: ${projectConfig.githubRepoUrl}`);
          }
          const repoName = utilities.getRepoNameFromUrl(projectConfig.githubRepoUrl);
          if (!repoName) {
            this.throwError(`Unable to determine repository name from URL: ${projectConfig.githubRepoUrl}`);
          } else {
            projectName = repoName;
            if (projectConfig.folderPath) {
              const localProjName = utilities.getFolderName(projectConfig.folderPath);
              if (localProjName !== repoName) {
                this.throwError(
                  `The local project ${localProjName} does not match the required Github repo ${repoName}`
                );
              } else {
                // If it is a match, use the local folder directly. Local dev use only.
                this.projectFolderPath = projectConfig.folderPath;
              }
            } else {
              // Clone the project from Github URL directly
              this.projectFolderPath = path.join(this.tempFolderPath, repoName);
              await utilities.gitClone(projectConfig.githubRepoUrl, this.projectFolderPath);
            }
          }
        } else {
          // missing info, throw an error
          this.throwError(`githubRepoUrl is required for named project shape`);
        }
        break;

      case ProjectShapeOption.ANY:
        // ANY: workspace is designated to open when wdio is initialized
        if (projectConfig.folderPath) {
          this.projectFolderPath = projectConfig.folderPath;
          projectName = utilities.getFolderName(projectConfig.folderPath);
        } else {
          // Fallback: if no folder specified, create a new sf project instead
          await this.initializeNewSfProject();
        }
        break;

      case ProjectShapeOption.NONE:
        // NONE: no project open in the workspace by default
        /* create the e2e-temp folder to benefit further testing */
        this.projectFolderPath = path.join(this.tempFolderPath, this.tempProjectName);
        if (!fs.existsSync(this.tempFolderPath)) {
          utilities.createFolder(this.tempFolderPath);
        }
        break;

      default:
        this.throwError(`Invalid project shape: ${projectConfig.projectShape}`);
    }

    if ([ProjectShapeOption.NAMED, ProjectShapeOption.NEW].includes(projectConfig.projectShape)) {
      utilities.log(`Project folder to open: ${this.projectFolderPath}`);
      await utilities.openFolder(this.projectFolderPath!);
      // Verify the project was loaded.
      await utilities.verifyProjectLoaded(projectName ?? this.tempProjectName);
    }
  }

  private throwError(message: string) {
    utilities.log(message);
    throw new Error(message);
  }

  public updateScratchOrgDefWithEdition(scratchOrgEdition: utilities.OrgEdition) {
    if (scratchOrgEdition === 'enterprise') {
      const projectScratchDefPath = path.join(this.projectFolderPath!, 'config', 'project-scratch-def.json');
      let projectScratchDef = fs.readFileSync(projectScratchDefPath, 'utf8');
      projectScratchDef = projectScratchDef.replace(`"edition": "Developer"`, `"edition": "Enterprise"`);
      fs.writeFileSync(projectScratchDefPath, projectScratchDef, 'utf8');
    }
  }

  private setJavaHomeConfigEntry(): void {
    const vscodeSettingsPath = path.join(this.projectFolderPath!, '.vscode', 'settings.json');
    if (!Env.getInstance().javaHome) {
      return;
    }
    if (!fs.existsSync(path.dirname(vscodeSettingsPath))) {
      fs.mkdirSync(path.dirname(vscodeSettingsPath), { recursive: true });
    }

    let settings = fs.existsSync(vscodeSettingsPath) ? JSON.parse(fs.readFileSync(vscodeSettingsPath, 'utf8')) : {};

    settings = {
      ...settings,
      ...(process.env.JAVA_HOME ? { 'salesforcedx-vscode-apex.java.home': process.env.JAVA_HOME } : {})
    };
    fs.writeFileSync(vscodeSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
    utilities.log(
      `${this.testSuiteSuffixName} - Set 'salesforcedx-vscode-apex.java.home' to '${process.env.JAVA_HOME}' in ${vscodeSettingsPath}`
    );
  }
  private setWorkbenchHoverDelay(): void {
    const vscodeSettingsPath = path.join(this.projectFolderPath!, '.vscode', 'settings.json');

    if (!fs.existsSync(path.dirname(vscodeSettingsPath))) {
      fs.mkdirSync(path.dirname(vscodeSettingsPath), { recursive: true });
    }

    let settings = fs.existsSync(vscodeSettingsPath) ? JSON.parse(fs.readFileSync(vscodeSettingsPath, 'utf8')) : {};

    // Update settings to set workbench.hover.delay
    settings = {
      ...settings,
      'workbench.hover.delay': 300000
    };

    fs.writeFileSync(vscodeSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
    utilities.log(`${this.testSuiteSuffixName} - Set 'workbench.hover.delay' to '300000' in ${vscodeSettingsPath}`);
  }
}
