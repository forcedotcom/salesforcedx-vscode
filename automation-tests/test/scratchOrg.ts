/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'fs';
import path from 'path';
import {
  DefaultTreeItem,
  InputBox,
  QuickOpenBox,
  Workbench
} from 'wdio-vscode-service';
import {
  EnvironmentSettings
} from './environmentSettings';
import {
  utilities
} from './utilities';

export class ScratchOrg {
  private testSuiteSuffixName: string = undefined;
  private reuseScratchOrg = false;
  private projectFolderPath: string = undefined;
  private prompt: QuickOpenBox | InputBox = undefined;
  private scratchOrgAliasName: string = undefined;

  public constructor(testSuiteSuffixName: string, reuseScratchOrg: boolean) {
    this.testSuiteSuffixName = testSuiteSuffixName;
    this.reuseScratchOrg = reuseScratchOrg;
  }

  public async setUp(): Promise<void> {
    await this.setUpTestingEnvironment();
    await this.createProject();
    await this.authorizeDevHub();
    await this.createDefaultScratchOrgViaCli();
  }

  public async tearDown(): Promise<void> {
    if (this.scratchOrgAliasName && !this.reuseScratchOrg) {
      const workbench = await (await browser.getWorkbench()).wait();
      await utilities.executeCommand(workbench, `sfdx force:org:delete -u ${this.scratchOrgAliasName} --noprompt`);
    }

    if (this.projectFolderPath) {
      await utilities.removeFolder(this.projectFolderPath);
    }
  }

  private async setUpTestingEnvironment(): Promise<void> {
    const tempFolderPath = path.join(__dirname, '..', 'e2e-temp');
    this.projectFolderPath = path.join(tempFolderPath, this.tempProjectName);

    // Clean up the temp folder, just in case there are stale files there.
    if (fs.existsSync(this.projectFolderPath)) {
      utilities.removeFolder(this.projectFolderPath);
      await utilities.pause(1);
    }

    // Now create the folders
    if (!fs.existsSync(tempFolderPath)) {
      utilities.createFolder(tempFolderPath);
      await utilities.pause(1);
    }

    utilities.createFolder(this.projectFolderPath);
    await utilities.pause(1);
  }

  private async createProject(): Promise<void> {
    const workbench = await (await browser.getWorkbench()).wait();

    this.prompt = await utilities.executeQuickPick(workbench, 'SFDX: Create Project');
    // Selecting "SFDX: Create Project" causes the extension to be loaded, and this takes a while.
    await utilities.pause(10);

    // Select the "Standard" project type.
    await this.prompt.getQuickPicks();
    await this.prompt.selectQuickPick('Standard');
    await utilities.pause(1);

    // Enter "TempProject" for project name.
    await this.prompt.setText(this.tempProjectName);
    await utilities.pause(1);

    // Press Enter/Return.
    await this.prompt.confirm();

    // Set the location of the project.
    const input = await this.prompt.input$;
    await input.setValue(this.projectFolderPath);
    await utilities.pause(1);

    // Click the OK button.
    await utilities.clickFilePathOkButton();

    // Verify the project was created and was loaded.
    const sidebar = workbench.getSideBar();
    const content = sidebar.getContent();
    const treeViewSection = await content.getSection(this.tempProjectName.toUpperCase());
    expect(treeViewSection).not.toEqual(undefined);

    const forceAppTreeItem = await treeViewSection.findItem('force-app') as DefaultTreeItem;
    expect(forceAppTreeItem).not.toEqual(undefined);

    await forceAppTreeItem.expand();

    // Yep, we need to wait a long time here.
    await utilities.pause(10);
  }

  private async authorizeDevHub(): Promise<void> {
    // This is essentially the "SFDX: Authorize a Dev Hub" command, but using the CLI and an auth file instead of the UI.
    const workbench = await (await browser.getWorkbench()).wait();
    const authFilePath = path.join(this.projectFolderPath, this.tempProjectName, 'authFile.json');
    const terminalView = await utilities.executeCommand(workbench, `sfdx force:org:display -u ${EnvironmentSettings.getInstance().devHubAliasName} --verbose --json > ${authFilePath}`);
    await utilities.pause(2);

    const authFilePathFileExists = fs.existsSync(authFilePath);
    expect(authFilePathFileExists).toEqual(true);

    await terminalView.executeCommand(`sfdx auth:sfdxurl:store -d -f ${authFilePath}`);
    await utilities.pause(2);

    const terminalText = await utilities.getTerminalViewText(terminalView, 10);
    expect(terminalText).toContain(`Successfully authorized ${EnvironmentSettings.getInstance().devHubUserName} with org ID`);
  }

  private async createDefaultScratchOrgViaCli(): Promise<void> {
    const userName = utilities.currentUserName();
    const workbench = await (await browser.getWorkbench()).wait();

    if (this.reuseScratchOrg) {
      const orgListFilePath = path.join(this.projectFolderPath, `force_org_list_${this.testSuiteSuffixName}.json`);
      await utilities.executeCommand(workbench, `sfdx force:org:list --json > ${orgListFilePath}`);
      await utilities.pause(2);

      const data = fs.readFileSync(orgListFilePath);
      const scratchOrgs = JSON.parse(data.toString()).result.scratchOrgs;
      for (const scratchOrg of scratchOrgs) {
        const alias = scratchOrg.alias as string;
        if (alias.includes('TempScratchOrg_') && alias.includes(userName) && alias.includes(this.testSuiteSuffixName)) {
          this.scratchOrgAliasName = alias;

          // Set the current scratch org.
          await this.setDefaultOrg(workbench, this.scratchOrgAliasName);

          return;
        }
      }
    }

    const definitionFile = 'config/project-scratch-def.json';

    // Org alias format - TempScratchOrg_yyyy_mm_dd_username_ticks_testSuiteSuffixName
    const currentDate = new Date();
    const ticks = currentDate.getTime();
    const day = ('0' + currentDate.getDate()).slice(-2);
    const month = ('0' + (currentDate.getMonth() + 1)).slice(-2);
    const year = currentDate.getFullYear();
    this.scratchOrgAliasName = `TempScratchOrg_${year}_${month}_${day}_${userName}_${ticks}_${this.testSuiteSuffixName}`;

    // Duration
    const durationDays = 1;

    const command = `sfdx force:org:create -f ${definitionFile} --setalias ${this.scratchOrgAliasName} --durationdays ${durationDays} --setdefaultusername --json --loglevel fatal`;
    const terminalView = await utilities.executeCommand(workbench, command);
    await utilities.pause(2);

    const terminalText = await utilities.getTerminalViewText(terminalView, 10);
    expect(terminalText).toContain('"status": 0');
    expect(terminalText).toContain('"scratchOrgInfo": {');
    expect(terminalText).toContain(`"SignupEmail": "${EnvironmentSettings.getInstance().devHubUserName}"`);

    // There is a bug with the CLI - if multiple scratch orgs are created at the same time, some of the
    // scratch orgs have a missing (blank) alias.  Call FixAlias() to re-apply the alias.  If this bug
    // gets fixed then FixAlias() can be removed.
    await this.fixAlias(workbench, terminalText);

    // Look for orgAliasName in the list of status bar items
    const statusBar = await workbench.getStatusBar();
    const scratchOrgStatusBarItem = await utilities.getStatusBarItemWhichIncludes(statusBar, this.scratchOrgAliasName);



    // jab
    debugger;
    // verify the correct org is set



    expect(scratchOrgStatusBarItem).not.toBeUndefined();
  }

  private get tempProjectName(): string {
    return 'TempProject-' + this.testSuiteSuffixName;
  }

  private async fixAlias(workbench: Workbench, terminalText: string): Promise<void> {
    const username = terminalText.match(/\"username\": \"(.*?)\"/i);
    expect(username).not.toEqual(undefined);
    expect(username.length).toBeGreaterThanOrEqual(2);

    const command = `sfdx alias:set ${this.scratchOrgAliasName}=${username[1]}`;
    await utilities.executeCommand(workbench, command);
    await utilities.pause(2);
  }

  private async setDefaultOrg(workbench: Workbench, scratchOrgAliasName: string): Promise<void> {
    const inputBox = await utilities.executeQuickPick(workbench, 'SFDX: Set a Default Org');
    await utilities.pause(1);

    let scratchOrgQuickPickItemWasFound = false;
    const userName = await utilities.currentUserName();
    const quickPicks = await inputBox.getQuickPicks();
    for (const quickPick of quickPicks) {
      const label = await quickPick.getLabel();
      if (scratchOrgAliasName) {
        // Find the org that was created in the "Run SFDX: Create a Default Scratch Org" step.
        if (label.includes(scratchOrgAliasName)) {
          await quickPick.select();
          await utilities.pause(3);
          scratchOrgQuickPickItemWasFound = true;
          break;
        }
      } else {
        // If the scratch or was already created (and not deleted),
        // and the "Run SFDX: Create a Default Scratch Org" step was skipped,
        // scratchOrgAliasName is undefined and as such, search for the first org
        // that starts with "TempScratchOrg_" and also has the current user's name.
        if (label.startsWith('TempScratchOrg_') && label.includes(userName)) {
          scratchOrgAliasName = label.split(' - ')[0];
          await quickPick.select();
          await utilities.pause(3);
          scratchOrgQuickPickItemWasFound = true;
          break;
        }
      }
    }
    expect(scratchOrgQuickPickItemWasFound).toBe(true);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Set a Default Org successfully ran');
    expect(successNotificationWasFound).toBe(true);

    // Look for orgAliasName in the list of status bar items
    const statusBar = await workbench.getStatusBar();
    const scratchOrgStatusBarItem = await utilities.getStatusBarItemWhichIncludes(statusBar, scratchOrgAliasName);
    expect(scratchOrgStatusBarItem).not.toBeUndefined();
  }
}
