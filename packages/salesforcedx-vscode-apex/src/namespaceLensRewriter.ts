/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

const singleTest = ['Run Test', 'Debug Test'];
const allTests = ['Run All Tests', 'Debug All Tests'];

const orgHasNamespaceOrProjectDoesNot = (namespaceFromOrg?: string) => (namespaceFromProject?: string) =>
  namespaceFromOrg !== undefined || namespaceFromProject === undefined;

// Jorje sticks the namespace from sfdx-project.json (namespaceFromProject) on the arguments, like ns.class.method
// org may or may not actually use the namespace (ex: scratch org with --no-namespace)
// namespaceFromOrg represents the namespace that came from auth files (ie, when the org is created/auth'd)
export const rewriteNamespaceLens =
  (namespaceFromOrg?: string) => (namespaceFromProject?: string) => (lens: vscode.CodeLens) => {
    if (orgHasNamespaceOrProjectDoesNot(namespaceFromOrg)(namespaceFromProject) || !lens.command?.title) {
      // if the org is a namespaces, we preserve the namespace from the LS.
      // if the project has no namespace, we want to use what the LS provides (its use of the namespace is the cause of https://github.com/forcedotcom/salesforcedx-vscode/issues/6458 )
      return lens;
    }

    if (singleTest.includes(lens.command.title)) {
      // namespace.class.method => class.method
      console.debug(`provideCodeLenses Middleware > Single test originally: ${lens.command.arguments}`);
      lens.command.arguments = lens.command.arguments?.map((arg: string) =>
        arg.startsWith(`${namespaceFromProject}.`) && arg.split('.').length === 3
          ? arg.split('.').slice(-2).join('.')
          : arg
      );
      console.debug(`provideCodeLenses Middleware > Single test modified: ${lens.command.arguments}`);
    } else if (allTests.includes(lens.command.title)) {
      // namespace.class => class
      console.debug(`provideCodeLenses Middleware > All tests originally: ${lens.command.arguments}`);
      lens.command.arguments = lens.command.arguments?.map(
        rewriteClassArgument(namespaceFromOrg)(namespaceFromProject)
      );
      console.debug(`provideCodeLenses Middleware > All tests modified: ${lens.command.arguments}`);
    }
    return lens;
  };

/** ns.class => class when ns is not on the org but is in the project.  Ignores other namespaces besides the project namespace. */
export const rewriteClassArgument =
  (namespaceFromOrg?: string) =>
  (namespaceFromProject?: string) =>
  (arg: string): string => {
    if (orgHasNamespaceOrProjectDoesNot(namespaceFromOrg)(namespaceFromProject)) {
      return arg;
    }
    // the ! assertion is safe because we know it has at least one dot
    return arg.startsWith(`${namespaceFromProject}.`) && arg.split('.').length === 2 ? arg.split('.').at(-1)! : arg;
  };
