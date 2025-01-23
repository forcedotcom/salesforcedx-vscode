/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const goodDoc =
  "```yaml\nopenapi: 3.0.0\ninfo:\n  title: SimpleRestResource\n  version: '1.0.0'\npaths:\n  /SimpleRestResource/doGet:\n    get:\n      summary: ''\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/String'\ncomponents:\n  schemas:\n    String:\n      type: string\n```";
const badDoc =
  "```yaml\nopenapi: 3.0.0\ninfo:\n  title: SimpleRestResource\n  version: '1.0.0'\npaths:\n  /SimpleRestResource/doDelete:\n    delete:\n      summary: ''\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/String'\ncomponents:\n  schemas:\n    String:\n      type: string\n```\n";
function cleanYamlString(input: string): string {
  return input
    .replace(/^```yaml\n/, '') // Remove leading triple backtick (if any)
    .replace(/\n```$/, '') // Remove trailing triple backtick (if any)
    .replace(/```\n\s*$/, '') // Remove trailing triple backtick with new line (if any)
    .trim(); // Ensure no extra spaces
}

console.log(cleanYamlString(goodDoc));
console.log(cleanYamlString(badDoc));
