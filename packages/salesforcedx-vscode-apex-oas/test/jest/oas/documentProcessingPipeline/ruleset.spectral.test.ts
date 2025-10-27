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

  it('paths.parameters in `cookie` is not allowed', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    parameters:
      - in: cookie
        name: csrftoken
        schema:
          type: string
    delete:
      summary: delete method
      requestBody:
        required: true
        description: 'truly great requestBody description'
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

    expect(JSON.stringify(result)).toMatch(/paths-parameters-in/);
  });

  it('operations.parameters in `cookie` is not allowed', async () => {
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
      description: 'great op description'
      parameters:
        - in: cookie
          name: csrftoken
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

    expect(JSON.stringify(result)).toMatch(/operations-parameters-in/);
  });

  it('paths.parameters description is required', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    parameters:
      - in: path
        name: id # Note the name is the same as in the path
        required: true
        schema:
          type: integer
          minimum: 1
    delete:
      summary: delete method
      requestBody:
        required: true
        description: 'truly great requestBody description'
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

    expect(JSON.stringify(result)).toMatch(/paths-parameters-description/);
  });

  it('operations.parameters description is required', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
  description: info description
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    delete:
      summary: delete method
      operationId: doDelete
      description: 'great op description'
      parameters:
        - in: path
          name: id # Note the name is the same as in the path
          required: true
          schema:
            type: integer
            minimum: 1
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

    expect(JSON.stringify(result)).toMatch(/operations-parameters-description/);
  });

  it('paths.parameters deprecated is not allowed', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    parameters:
      - in: path
        name: id # Note the name is the same as in the path
        required: true
        schema:
          type: integer
          minimum: 1
        description: desc
        deprecated: true
    delete:
      summary: delete method
      requestBody:
        required: true
        description: 'truly great requestBody description'
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

    expect(JSON.stringify(result)).toMatch(/paths-parameters-deprecated/);
  });

  it('operations.parameters deprecated is not allowed', async () => {
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
      parameters:
        - in: path
          name: id # Note the name is the same as in the path
          required: true
          schema:
            type: integer
            minimum: 1
          description: desc
          deprecated: true
      requestBody:
        required: true
        description: 'truly great requestBody description'
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

    expect(JSON.stringify(result)).toMatch(/operations-parameters-deprecated/);
  });

  it('paths.parameters explode should be false', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    parameters:
      - in: path
        name: id # Note the name is the same as in the path
        required: true
        schema:
          type: integer
          minimum: 1
        description: desc
        explode: true
    delete:
      summary: delete method
      requestBody:
        required: true
        description: 'truly great requestBody description'
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

    expect(JSON.stringify(result)).toMatch(/paths-parameters-explode/);
  });

  it('operations.parameters explode should be false', async () => {
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
      parameters:
        - in: path
          name: id # Note the name is the same as in the path
          required: true
          schema:
            type: integer
            minimum: 1
          description: desc
          explode: true
      requestBody:
        required: true
        description: 'truly great requestBody description'
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

    expect(JSON.stringify(result)).toMatch(/operations-parameters-explode/);
  });

  it('paths.parameters allowReserved should be false', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    parameters:
      - in: path
        name: id # Note the name is the same as in the path
        required: true
        schema:
          type: integer
          minimum: 1
        description: desc
        allowReserved: true
    delete:
      summary: delete method
      requestBody:
        required: true
        description: 'truly great requestBody description'
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

    expect(JSON.stringify(result)).toMatch(/paths-parameters-allowReserved/);
  });

  it('operations.parameters allowReserved should be false', async () => {
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
      parameters:
        - in: path
          name: id # Note the name is the same as in the path
          required: true
          schema:
            type: integer
            minimum: 1
          description: desc
          allowReserved: true
      requestBody:
        required: true
        description: 'truly great requestBody description'
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

    expect(JSON.stringify(result)).toMatch(/operations-parameters-allowReserved/);
  });

  it('paths.parameters content should be `application/json`', async () => {
    const inputYaml = `openapi: 3.0.0
info:
  title: demoClass API
  version: '1.0.0'
servers:
  - url: https://files.example.com
    description: Optional server description, e.g. Main (production) server
paths:
  /demoClass/doDelete:
    parameters:
      - in: path
        name: id # Note the name is the same as in the path
        required: true
        schema:
          type: integer
          minimum: 1
        description: desc
        content:
          text/plain
    delete:
      summary: delete method
      requestBody:
        required: true
        description: 'truly great requestBody description'
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

    expect(JSON.stringify(result)).toMatch(/paths-parameters-content/);
  });

  it('operations.parameters content should be `application/json`', async () => {
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
      parameters:
        - in: path
          name: id # Note the name is the same as in the path
          required: true
          schema:
            type: integer
            minimum: 1
          description: desc
          content:
            text/plain
      requestBody:
        required: true
        description: 'truly great requestBody description'
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

    expect(JSON.stringify(result)).toMatch(/operations-parameters-content/);
  });

  it('operations.responses.headers are not allowed', async () => {
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
      parameters:
        - in: path
          name: id # Note the name is the same as in the path
          required: true
          schema:
            type: integer
            minimum: 1
          description: desc
          content:
            text/plain
      requestBody:
        required: true
        description: 'truly great requestBody description'
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Pet"
      responses:
        '200':
          description: OK
          headers:
            X-RateLimit-Limit:
              schema:
                type: integer
              description: Request limit per hour.
components:
  schemas:
    Account:
      type: object
      properties:
        Id:
          type: string`;

    const result = await runRulesetAgainstYaml(inputYaml);

    expect(JSON.stringify(result)).toMatch(/response-headers/);
  });

  it('operations.responses.content should be application/json', async () => {
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
      parameters:
        - in: path
          name: id # Note the name is the same as in the path
          required: true
          schema:
            type: integer
            minimum: 1
          description: desc
          content:
            text/plain
      requestBody:
        required: true
        description: 'truly great requestBody description'
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Pet"
      responses:
        '200':
          description: OK
          content:
            text/plain:
              schema:
                type: string
components:
  schemas:
    Account:
      type: object
      properties:
        Id:
          type: string`;

    const result = await runRulesetAgainstYaml(inputYaml);

    expect(JSON.stringify(result)).toMatch(/response-content/);
  });

  it('request-media-encoding is not allowed', async () => {
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
          application/x-www-form-urlencoded:
            schema:
              type: object
              properties:
                color:
                  type: array
                  items:
                    type: string
            encoding:
              color: # color=red,green,blue
                style: form
                explode: false
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

    expect(JSON.stringify(result)).toMatch(/request-media-encoding/);
  });

  it('response-media-encoding is not allowed', async () => {
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
      parameters:
        - in: path
          name: id # Note the name is the same as in the path
          required: true
          schema:
            type: integer
            minimum: 1
          description: desc
          content:
            text/plain
      requestBody:
        required: true
        description: 'truly great requestBody description'
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Pet"
      responses:
        '200':
          description: OK
          content:
            application/x-www-form-urlencoded:
              schema:
                type: object
                properties:
                  color:
                    type: array
                    items:
                      type: string
              encoding:
                color: # color=red,green,blue
                  style: form
                  explode: false
components:
  schemas:
    Account:
      type: object
      properties:
        Id:
          type: string`;

    const result = await runRulesetAgainstYaml(inputYaml);

    expect(JSON.stringify(result)).toMatch(/response-media-encoding/);
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
    parameters:
      - in: path
        name: id # Note the name is the same as in the path
        required: true
        schema:
          type: integer
          minimum: 1
        description: The user ID
    delete:
      summary: delete method
      operationId: doDelete
      description: 'great op description'
      parameters:
        - in: path
          name: id # Note the name is the same as in the path
          required: true
          schema:
            type: integer
            minimum: 1
          description: The user ID
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Account"
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
    expect(JSON.stringify(result)).not.toMatch(/operations-callbacks/);
    expect(JSON.stringify(result)).not.toMatch(/operations-deprecated/);
    expect(JSON.stringify(result)).not.toMatch(/operations-security/);
    expect(JSON.stringify(result)).not.toMatch(/operations-servers/);
    expect(JSON.stringify(result)).not.toMatch(/request-body-description/);
    expect(JSON.stringify(result)).not.toMatch(/request-body-content/);
    expect(JSON.stringify(result)).not.toMatch(/paths-parameters-in/);
    expect(JSON.stringify(result)).not.toMatch(/operations-parameters-in/);
    expect(JSON.stringify(result)).not.toMatch(/paths-parameters-description/);
    expect(JSON.stringify(result)).not.toMatch(/operations-parameters-description/);
    expect(JSON.stringify(result)).not.toMatch(/paths-parameters-deprecated/);
    expect(JSON.stringify(result)).not.toMatch(/operations-parameters-deprecated/);
    expect(JSON.stringify(result)).not.toMatch(/paths-parameters-explode/);
    expect(JSON.stringify(result)).not.toMatch(/operations-parameters-explode/);
    expect(JSON.stringify(result)).not.toMatch(/paths-parameters-allowReserved/);
    expect(JSON.stringify(result)).not.toMatch(/operations-parameters-allowReserved/);
    expect(JSON.stringify(result)).not.toMatch(/paths-parameters-content/);
    expect(JSON.stringify(result)).not.toMatch(/operations-parameters-content/);
    expect(JSON.stringify(result)).not.toMatch(/response-headers/);
    expect(JSON.stringify(result)).not.toMatch(/response-content/);
    expect(JSON.stringify(result)).not.toMatch(/request-media-encoding/);
    expect(JSON.stringify(result)).not.toMatch(/response-media-encoding/);
  });
});

it('should not throw false positives when `parameters` property is missing', async () => {
  const inputYaml = `openapi: 3.0.0
info:
  title: MyRestResource
  version: 1.0.0
  description: This is auto-generated OpenAPI v3 spec for MyRestResource.
paths:
  /MyRestResource/doGet:
    get:
      summary: Retrieves an Account record by ID.
      description: >-
        This method handles HTTP GET requests to this endpoint. It parses the

        request URL to extract the Account ID, and then queries the database to
        fetch the

        corresponding Account record. The record is then returned as a JSON
        response.
      operationId: getAccountById
      responses:
        '200':
          description: The requested Account record.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Account'
  /MyRestResource/doPut:
    put:
      summary: doPut
      description: Creates a new Account record
      operationId: doPut
      responses:
        '200':
          description: Account created successfully
          content:
            application/json:
              schema:
                type: string
components:
  schemas:
    Account:
      type: object
      properties:
        Id:
          type: string
          description: The unique identifier of the Account.
        Name:
          type: string
          description: The name of the Account.
        Phone:
          type: string
          description: The phone number of the Account.
        Website:
          type: string
          description: The website URL of the Account.`;

  const result = await runRulesetAgainstYaml(inputYaml);

  expect(JSON.stringify(result)).not.toMatch(/paths-parameters-in/);
  expect(JSON.stringify(result)).not.toMatch(/operations-parameters-in/);
  expect(JSON.stringify(result)).not.toMatch(/paths-parameters-description/);
  expect(JSON.stringify(result)).not.toMatch(/operations-parameters-description/);
  expect(JSON.stringify(result)).not.toMatch(/paths-parameters-deprecated/);
  expect(JSON.stringify(result)).not.toMatch(/operations-parameters-deprecated/);
  expect(JSON.stringify(result)).not.toMatch(/paths-parameters-explode/);
  expect(JSON.stringify(result)).not.toMatch(/operations-parameters-explode/);
  expect(JSON.stringify(result)).not.toMatch(/paths-parameters-allowReserved/);
  expect(JSON.stringify(result)).not.toMatch(/operations-parameters-allowReserved/);
  expect(JSON.stringify(result)).not.toMatch(/paths-parameters-content/);
  expect(JSON.stringify(result)).not.toMatch(/operations-parameters-content/);
});

it('should not log info-contact & operation-tag-defined', async () => {
  const inputYaml = `openapi: 3.0.0
info:
  title: CaseManager
  version: 1.0.0
  description: This is auto-generated OpenAPI v3 spec for CaseManager.
paths:
  /CaseManager/getCaseById:
    get:
      summary: Retrieve a Case by ID
      description: Returns a Case based on the provided ID.
      tags:
        - Case Management
      parameters:
        - name: caseId
          in: path
          required: true
          description: The ID of the Case to retrieve.
          schema:
            type: string
      responses:
        '200':
          description: A Case with the provided ID.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Case'
      operationId: getCaseById
  /CaseManager/createCase:
    post:
      summary: Create a new Case
      description: Creates a new Case with the provided information.
      tags:
        - Case Management
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                subject:
                  type: string
                status:
                  type: string
                origin:
                  type: string
                priority:
                  type: string
      responses:
        '200':
          description: The newly created Case ID.
          content:
            application/json:
              schema:
                type: string
      operationId: createCase
  /CaseManager/deleteCase:
    delete:
      summary: Deletes a Case.
      description: Deletes the Case with the specified Id.
      operationId: deleteCase
      parameters:
        - name: caseId
          in: path
          required: true
          description: The Id of the Case to delete.
          schema:
            type: string
      responses:
        '204':
          description: The Case was deleted successfully.
  /CaseManager/upsertCase:
    put:
      summary: Upsert a Case
      description: Creates or updates a Case based on the provided information.
      tags:
        - Case Management
      parameters:
        - name: subject
          in: query
          required: true
          schema:
            type: string
        - name: status
          in: query
          required: true
          schema:
            type: string
        - name: origin
          in: query
          required: true
          schema:
            type: string
        - name: priority
          in: query
          required: true
          schema:
            type: string
        - name: id
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: The ID of the upserted Case.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Id'
      operationId: upsertCase
components:
  schemas:
    Case:
      type: object
      properties:
        CaseNumber:
          type: string
        Subject:
          type: string
        Status:
          type: string
        Origin:
          type: string
        Priority:
          type: string
    Id:
      type: string
      description: The unique identifier of a Case.`;

  const result = await runRulesetAgainstYaml(inputYaml);

  expect(JSON.stringify(result)).not.toMatch(/info-contact/);
  expect(JSON.stringify(result)).not.toMatch(/operation-tag-defined/);
  expect(JSON.stringify(result)).not.toMatch(/operation-tags/);
});

const runRulesetAgainstYaml = async (inputYaml: string) => {
  const spectral = new Spectral();

  spectral.setRuleset(ruleset);

  // we lint our document using the ruleset
  const result = await spectral.run(inputYaml);
  return result;
};
