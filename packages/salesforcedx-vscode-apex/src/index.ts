import * as vscode from "vscode";
import * as child_process from "child_process";
import * as path from "path";
import * as net from "net";
import * as portFinder from "portfinder";
import * as languageServer from "./language-server";
import {
  LanguageClient,
  LanguageClientOptions,
  SettingMonitor,
  ServerOptions,
  StreamInfo
} from "vscode-languageclient";

export function activate(context: vscode.ExtensionContext) {
  console.log("Salesforce Apex Language Server Extension Activated");
  const apexServer = languageServer.createLanguageServer(context).start();
  context.subscriptions.push(apexServer);
}

export function deactivate() {
  console.log("Salesforce Apex Language Server Extension Deactivated");
}
