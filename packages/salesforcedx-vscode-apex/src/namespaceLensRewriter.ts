/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { isNotUndefined, isUndefined } from 'effect/Predicate';
import * as vscode from 'vscode';

const singleTest = new Set(['Run Test', 'Debug Test']);
const allTests = new Set(['Run All Tests', 'Debug All Tests']);

// Jorje sticks the namespace from sfdx-project.json (namespaceFromProject) on the arguments, like ns.class.method
// org may or may not actually use the namespace (ex: scratch org with --no-namespace)
// namespaceFromOrg represents the namespace that came from auth files (ie, when the org is created/auth'd)
export const rewriteNamespaceLens =
  (namespaceFromOrg?: string) =>
  (namespaceFromProject?: string) =>
    Effect.fn('apex.rewriteNamespaceLens')(function* (lens: vscode.CodeLens) {
      if (isNotUndefined(namespaceFromOrg) || !lens.command?.title || isUndefined(namespaceFromProject)) {
        // if the org is a namespaces, we preserve the namespace from the LS.
        // if the project has no namespace, we want to use what the LS provides (its use of the namespace is the cause of https://github.com/forcedotcom/salesforcedx-vscode/issues/6458 )
        return lens;
      }

      if (singleTest.has(lens.command.title)) {
        // namespace.class.method => class.method
        yield* Effect.logDebug('provideCodeLenses Middleware > Single test originally', {
          arguments: lens.command.arguments
        });
        lens.command.arguments = lens.command.arguments?.map((arg: string) =>
          arg.startsWith(`${namespaceFromProject}.`) && arg.split('.').length === 3
            ? arg.split('.').slice(-2).join('.')
            : arg
        );
        yield* Effect.logDebug('provideCodeLenses Middleware > Single test modified', {
          arguments: lens.command.arguments
        });
      } else if (allTests.has(lens.command.title)) {
        // namespace.class => class
        yield* Effect.logDebug('provideCodeLenses Middleware > All tests originally', {
          arguments: lens.command.arguments
        });
        lens.command.arguments = lens.command.arguments?.map((arg: string) =>
          arg.startsWith(`${namespaceFromProject}.`) && arg.split('.').length === 2 ? arg.split('.').at(-1) : arg
        );
        yield* Effect.logDebug('provideCodeLenses Middleware > All tests modified', {
          arguments: lens.command.arguments
        });
      }
      return lens;
    });
