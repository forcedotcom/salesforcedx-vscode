/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseDebuggerCommand } from './baseDebuggerCommand';
import { DebuggerRequest, ReferenceRequest } from './protocol';

export class ReferencesCommand extends BaseDebuggerCommand {
  protected static createGetReferenceRequest(
    apexReferences: number[]
  ): DebuggerRequest {
    return {
      getReferencesRequest: {
        reference: apexReferences.map(apexReference => {
          const result: ReferenceRequest = {
            reference: apexReference
          };
          return result;
        })
      }
    };
  }

  public constructor(debuggedRequestId: string, ...apexReferences: number[]) {
    super(
      'references',
      debuggedRequestId,
      undefined,
      ReferencesCommand.createGetReferenceRequest(apexReferences)
    );
  }
}
