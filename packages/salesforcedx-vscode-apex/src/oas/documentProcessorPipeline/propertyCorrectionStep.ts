/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OpenAPIV3 } from 'openapi-types';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';

export class PropertyCorrectionStep implements ProcessorStep {
  process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    let fixedYaml = this.ensureServersIsPresent(input.openAPIDoc);
    fixedYaml = this.ensureInfoVersionIsPresent(fixedYaml);

    return new Promise(resolve => {
      resolve({ ...input, openAPIDoc: fixedYaml });
    });
  }

  private ensureInfoVersionIsPresent(yaml: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> {
    return { ...yaml, ...{ info: { ...yaml.info, ...{ version: '1.0.0' } } } };
  }

  private ensureServersIsPresent(yaml: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> {
    return { ...yaml, ...{ servers: [{ url: '/services/apexrest' }] } };
  }
}
