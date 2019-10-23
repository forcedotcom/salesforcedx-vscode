/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { PreconditionChecker } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import { CompositePreconditionChecker } from '../../../../src/commands/util';

describe('Precondition Checkers', () => {
  describe('CompositePreconditionChecker', () => {
    it('Should return false if one precondition checker is false', async () => {
      const compositePreconditionsChecker = new CompositePreconditionChecker(
        new class implements PreconditionChecker {
          public async check(): Promise<boolean> {
            return Promise.resolve(false);
          }
        }(),
        new class implements PreconditionChecker {
          public async check(): Promise<boolean> {
            return Promise.resolve(true);
          }
        }()
      );
      const response = await compositePreconditionsChecker.check();
      expect(response).to.be.eql(false);
    });

    it('Should return true if all precondition checkers are true', async () => {
      const compositePreconditionsChecker = new CompositePreconditionChecker(
        new class implements PreconditionChecker {
          public async check(): Promise<boolean> {
            return Promise.resolve(true);
          }
        }(),
        new class implements PreconditionChecker {
          public async check(): Promise<boolean> {
            return Promise.resolve(true);
          }
        }()
      );
      const response = await compositePreconditionsChecker.check();
      expect(response).to.be.eql(true);
    });
  });
});
