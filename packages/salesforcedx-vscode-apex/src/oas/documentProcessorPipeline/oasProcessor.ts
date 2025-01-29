/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OpenAPIV3 } from 'openapi-types';
import { nls } from '../../messages';
import { ApexClassOASGatherContextResponse } from '../schemas';
import { MissingPropertiesInjectorStep } from './missingPropertiesInjectorStep';
import { OasValidationStep } from './oasValidationStep';
import { Pipeline } from './pipeline';
import { ProcessorInputOutput } from './processorStep';

export class OasProcessor {
  private context: ApexClassOASGatherContextResponse;
  private document: OpenAPIV3.Document;

  constructor(context: ApexClassOASGatherContextResponse, document: OpenAPIV3.Document) {
    this.context = context;
    this.document = document;
  }

  async process(): Promise<ProcessorInputOutput> {
    if (this.context.classDetail.annotations.includes('RestResource')) {
      // currently only OasValidation exists, in future this would have converters too
      const pipeline = new Pipeline(new MissingPropertiesInjectorStep()).addStep(
        new OasValidationStep(this.context.classDetail.name)
      );

      console.log('Executing pipeline with input:');
      console.log('context: ', JSON.stringify(this.context));
      console.log('document: ', this.document);
      const output = await pipeline.execute({ yaml: this.document });
      console.log('Pipeline output:', output);
      return output;
    }
    throw nls.localize('invalid_class_annotation_for_generating_oas_doc');
  }
}
