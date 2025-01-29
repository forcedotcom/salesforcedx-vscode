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

  it('paths.<method>.description is required', async () => {
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

    expect(JSON.stringify(result)).toMatch(/paths-method-description/);
  });

  it('paths.<method>.servers should not be present', async () => {
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

    expect(JSON.stringify(result)).toMatch(/paths-method-servers/);
  });

  it('paths.<method>.options should not be present', async () => {
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

    expect(JSON.stringify(result)).toMatch(/paths-method-options/);
  });

  it('paths.<method>.head should not be present', async () => {
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

    expect(JSON.stringify(result)).toMatch(/paths-method-head/);
  });

  it('paths.<method>.trace should not be present', async () => {
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

    expect(JSON.stringify(result)).toMatch(/paths-method-trace/);
  });

  it('info.description is required', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
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

    expect(JSON.stringify(result)).toMatch(/info-description/);
  });

  it('operations-description is required', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
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

    expect(JSON.stringify(result)).toMatch(/operations-description/);
  });

  it('operations-operationId is required', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    delete:
      summary: delete method
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

    expect(JSON.stringify(result)).toMatch(/operations-operationId/);
  });

  it('operations-callbacks should not be present', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    delete:
      summary: delete method
      callbacks: # Callback definition
        myEvent: # Event name
          "{$request.body#/callbackUrl}": # The callback URL,
            # Refers to the passed URL
            post:
              requestBody: # Contents of the callback message
                required: true
                content:
                  application/json:
                    schema:
                      type: object
                      properties:
                        message:
                          type: string
                          example: Some event happened
                      required:
                        - message
              responses: # Expected responses to the callback message
                "200":
                  description: Your server returns this code if it accepts the callback
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

    expect(JSON.stringify(result)).toMatch(/operations-callbacks/);
  });

  it('operations-deprecated should not be present', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    delete:
      deprecated: true
      summary: delete method
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

    expect(JSON.stringify(result)).toMatch(/operations-deprecated/);
  });

  it('operations-security should not be present', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    delete:
      security:
        - OAuth2: [admin]
      summary: delete method
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

    expect(JSON.stringify(result)).toMatch(/operations-security/);
  });

  it('operations-servers should not be present', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    delete:
      servers:
        - url: https://files.example.com
        description: Override base path for all operations with the /files path
      summary: delete method
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

    expect(JSON.stringify(result)).toMatch(/operations-servers/);
  });

  it('request body description is required', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    delete:
      summary: delete method
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Pet"
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

    expect(JSON.stringify(result)).toMatch(/request-body-description/);
  });

  it('requestBody content must be /application/json', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    delete:
      summary: delete method
      requestBody:
        required: true
        description: 'truly great requestBody description'
        content:
          text/plain:
            schema:
              type: string
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

    expect(JSON.stringify(result)).toMatch(/request-body-content/);
  });

  it('should not log errors when all rules are met', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
  description: 'great description'
servers:
  - url: /services/apexrest
    description: 'description at its best'
paths:
  /demoClass/doDelete:
    description: 'great path description'
    delete:
      summary: delete method
      operationId: doDelete
      description: 'great op description'
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

    expect(JSON.stringify(result)).not.toMatch(/openapi-version/);
    expect(JSON.stringify(result)).not.toMatch(/oas3-api-servers/);
    expect(JSON.stringify(result)).not.toMatch(/security-schemes/);
    expect(JSON.stringify(result)).not.toMatch(/paths-method-description/);
    expect(JSON.stringify(result)).not.toMatch(/paths-method-servers/);
    expect(JSON.stringify(result)).not.toMatch(/paths-method-options/);
    expect(JSON.stringify(result)).not.toMatch(/paths-method-head/);
    expect(JSON.stringify(result)).not.toMatch(/paths-method-trace/);
    expect(JSON.stringify(result)).not.toMatch(/info-description/);
    expect(JSON.stringify(result)).not.toMatch(/operations-description/);
    expect(JSON.stringify(result)).not.toMatch(/operations-operationId/);
    expect(JSON.stringify(result)).not.toMatch(/operations-callbacks/);
    expect(JSON.stringify(result)).not.toMatch(/operations-deprecated/);
    expect(JSON.stringify(result)).not.toMatch(/operations-security/);
    expect(JSON.stringify(result)).not.toMatch(/operations-servers/);
    expect(JSON.stringify(result)).not.toMatch(/request-body-description/);
    expect(JSON.stringify(result)).not.toMatch(/request-body-content/);
  });
});

const runRulesetAgainstYaml = async (inputYaml: string) => {
  const spectral = new Spectral();

  spectral.setRuleset(ruleset);

  // we lint our document using the ruleset
  const result = await spectral.run(inputYaml);
  return result;
};
