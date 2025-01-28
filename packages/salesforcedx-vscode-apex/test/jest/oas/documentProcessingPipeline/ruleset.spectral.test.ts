/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Spectral } from '@stoplight/spectral-core';
import ruleset from '../../../../src/oas/documentProcessorPipeline/ruleset.spectral';

describe('ruleset', () => {
  it('open api version must be 3.0.0', async () => {
    const inputYaml = 'openapi: 2.0.0';
    const result = await runRulesetAgainstYaml(inputYaml);

    expect(JSON.stringify(result)).toMatch(/openapi-version/);
  });

  it('servers url should be present', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
  description: demoClass API
paths:
  /demoClass/doDelete:
    delete:
      summary: delete method
      operationId: doDelete
      responses:
        '200':
          description: OK
components:
  schemas:
    Account:
      type: object
      properties:
        Id:
          type: string`;

    const result = await runRulesetAgainstYaml(inputYaml);

    expect(JSON.stringify(result)).toMatch(/oas3-api-servers/);
  });

  it('apex REST supports these authentication mechanisms: Type: OAuth2 or Type: HTTP, Scheme: Bearer, at global level', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
  description: demoClass API
paths:
  /demoClass/doDelete:
    delete:
      summary: delete method
      operationId: doDelete
      responses:
        '200':
          description: OK
components:
  schemas:
    Account:
      type: object
      properties:
        Id:
          type: string
  securitySchemes:
    basicAuth: # <-- arbitrary name for the security scheme
      type: http
      scheme: basic`;

    const result = await runRulesetAgainstYaml(inputYaml);

    expect(JSON.stringify(result)).toMatch(/security-schemes/);
  });

  it('path.description is required', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
  description: demoClass API
paths:
  /demoClass/doDelete:
    delete:
      summary: delete method
      operationId: doDelete
      responses:
        '200':
          description: OK
components:
  schemas:
    Account:
      type: object
      properties:
        Id:
          type: string`;

    const result = await runRulesetAgainstYaml(inputYaml);

    expect(JSON.stringify(result)).toMatch(/paths-description/);
  });

  it('path.servers should not be present', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
  description: demoClass API
paths:
  /demoClass/doDelete:
    delete:
      summary: delete method
      operationId: doDelete
    servers:
      - url: https://files.example.com
      responses:
        '200':
          description: OK
components:
  schemas:
    Account:
      type: object
      properties:
        Id:
          type: string`;

    const result = await runRulesetAgainstYaml(inputYaml);

    expect(JSON.stringify(result)).toMatch(/paths-servers/);
  });

  it('path.options should not be present', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
  description: demoClass API
paths:
  /demoClass/doDelete:
    options:
      summary: delete method
      operationId: doDelete
      responses:
        '200':
          description: OK
components:
  schemas:
    Account:
      type: object
      properties:
        Id:
          type: string`;

    const result = await runRulesetAgainstYaml(inputYaml);

    expect(JSON.stringify(result)).toMatch(/paths-options/);
  });

  it('path.head should not be present', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
  description: demoClass API
paths:
  /demoClass/doDelete:
    head:
      summary: delete method
      operationId: doDelete
      responses:
        '200':
          description: OK
components:
  schemas:
    Account:
      type: object
      properties:
        Id:
          type: string`;

    const result = await runRulesetAgainstYaml(inputYaml);

    expect(JSON.stringify(result)).toMatch(/paths-head/);
  });

  it('path.trace should not be present', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
  description: demoClass API
paths:
  /demoClass/doDelete:
    trace:
      summary: delete method
      operationId: doDelete
      responses:
        '200':
          description: OK
components:
  schemas:
    Account:
      type: object
      properties:
        Id:
          type: string`;

    const result = await runRulesetAgainstYaml(inputYaml);

    expect(JSON.stringify(result)).toMatch(/paths-trace/);
  });
});

const runRulesetAgainstYaml = async (inputYaml: string) => {
  const spectral = new Spectral();

  spectral.setRuleset(ruleset);

  // we lint our document using the ruleset
  const result = await spectral.run(inputYaml);
  return result;
};
