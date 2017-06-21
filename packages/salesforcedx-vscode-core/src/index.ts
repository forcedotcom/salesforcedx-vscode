import * as vscode from "vscode";
import * as child_process from "child_process";
import * as path from "path";
import * as net from "net";
import * as status from "./status";
import * as scratchOrgDecorator from "./scratch-org-decorator";
import * as commands from "./commands";

function registerCommands(): vscode.Disposable {
  let forceAuthWebLoginCmd = vscode.commands.registerCommand(
    "sfdx.force.auth.web.login",
    commands.forceAuthWebLogin
  );
  let forceOrgCreateCmd = vscode.commands.registerCommand(
    "sfdx.force.org.create",
    commands.forceOrgCreate
  );
  let forceOrgOpenCmd = vscode.commands.registerCommand(
    "sfdx.force.org.open",
    commands.forceOrgOpen
  );
  let forceSourcePullCmd = vscode.commands.registerCommand(
    "sfdx.force.source.pull",
    commands.forceSourcePull
  );
  let forceSourcePushCmd = vscode.commands.registerCommand(
    "sfdx.force.source.push",
    commands.forceSourcePush
  );
  let forceSourceStatusCmd = vscode.commands.registerCommand(
    "sfdx.force.source.status",
    commands.forceSourceStatus
  );
  let forceApexTestRunCmd = vscode.commands.registerCommand(
    "sfdx.force.apex.test.run",
    commands.forceApexTestRun
  );
  return vscode.Disposable.from(
    forceOrgCreateCmd,
    forceOrgOpenCmd,
    forceSourcePullCmd,
    forceSourcePushCmd,
    forceApexTestRunCmd
  );
}

export function activate(context: vscode.ExtensionContext) {
  console.log("SFDX CLI Extension Activated");
  const commands = registerCommands();
  context.subscriptions.push(commands);
  scratchOrgDecorator.showOrg();
  scratchOrgDecorator.monitorConfigChanges();
}

export function deactivate() {
  console.log("SFDX CLI Extension Deactivated");
}
