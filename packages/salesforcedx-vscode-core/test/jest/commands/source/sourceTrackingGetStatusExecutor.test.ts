import { SourceTrackingGetStatusExecutor } from '../../../../src/commands/source/sourceTrackingGetStatusExecutor';

/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
describe('SourceTrackingGetStatusExecutor', () => {
  describe('execute', () => {
    it('should get the source status summary and show it in the output', () => {});
  });
  describe('run', () => {
    it('should call execute and return true', async () => {
      const executor = new SourceTrackingGetStatusExecutor('', '', {
        local: true,
        remote: true
      });
      const executeMock = jest.fn();
      (executor as any).execute = executeMock;

      const result = await (executor as any).run();

      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(true);
    });
  });
});
