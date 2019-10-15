/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import {
  CommandletExecutor,
  SfdxCommandlet
} from '../../../../src/commands/util';

// tslint:disable:no-unused-expression
describe('SfdxCommandlet', () => {
  it('Should not proceed if checker fails', async () => {
    const commandlet = new SfdxCommandlet(
      new class {
        public check(): boolean {
          return false;
        }
      }(),
      new class implements ParametersGatherer<{}> {
        public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
          throw new Error('This should not be called');
        }
      }(),
      new class implements CommandletExecutor<{}> {
        public execute(response: ContinueResponse<{}>): void {
          throw new Error('This should not be called');
        }
      }()
    );

    await commandlet.run();
  });

  it('Should not call executor if gatherer is CANCEL', async () => {
    const commandlet = new SfdxCommandlet(
      new class {
        public check(): boolean {
          return true;
        }
      }(),
      new class implements ParametersGatherer<{}> {
        public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
          return { type: 'CANCEL' };
        }
      }(),
      new class implements CommandletExecutor<{}> {
        public execute(response: ContinueResponse<{}>): void {
          throw new Error('This should not be called');
        }
      }()
    );

    await commandlet.run();
  });

  it('Should call executor if gatherer is CONTINUE', async () => {
    let executed = false;
    const commandlet = new SfdxCommandlet(
      new class {
        public check(): boolean {
          return true;
        }
      }(),
      new class implements ParametersGatherer<{}> {
        public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
          return { type: 'CONTINUE', data: {} };
        }
      }(),
      new class implements CommandletExecutor<{}> {
        public execute(response: ContinueResponse<{}>): void {
          executed = true;
        }
      }()
    );

    await commandlet.run();

    expect(executed).to.be.true;
  });
});
