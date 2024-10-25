/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor } from "../../../src/cli/commandExecutor";
import { CommandEventStream } from "../../../src/commands/commandEventStream";


describe('CompositeCliCommandExecution', () => {
  const commandEventStreamPostSpy = jest.spyOn(CommandEventStream.getInstance(), 'post');

});

describe('CliCommandExecutor', () => {
  describe('patchEnv', () => {
    it('should patch the environment with the base environment', () => {
      const baseEnvironment = new Map<string, string>();
      baseEnvironment.set('SFDX_ENV', 'test');
      const options = { env: { TEST: 'test' } };
      const patchedOptions = CliCommandExecutor.patchEnv(options, baseEnvironment);
      expect(patchedOptions.env).toEqual({ SFDX_ENV: 'test', TEST: 'test', SFDX_TOOL: 'salesforce-vscode-extensions' });
    });
  });
});
