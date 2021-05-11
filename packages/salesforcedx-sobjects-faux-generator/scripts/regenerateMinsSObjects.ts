#!/usr/bin/env node

/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

/**
 * Simple script to re-generate file `minSObjects.json`
 *
 * To run:
 *    npx ts-node ./scripts/regenerateMinsSObjects.ts <token> <instance_url>
 */
import * as fs from 'fs';
import * as path from 'path';
import { SObjectShortDescription } from '../src/describe';
import { OrgObjectDetailRetriever } from '../src/retriever';
import { SObject } from '../src/types';

import { Connection, Org } from '@salesforce/core';

// tslint:disable-next-line:no-floating-promises
(async () => {
  const args = process.argv.slice(2);

  if (args.length <= 0) {
    console.log(
      'Usage:\n ./scripts/' + path.basename(__filename) + ' <aliasOrUsername>'
    );
    process.exit(1);
  }
  const aliasOrUsername = args[0];
  const connection = await createConnection(aliasOrUsername);

  await generateLocalSobjectJSON(connection);
})();

async function createConnection(aliasOrUsername: string) {
  return (await Org.create({ aliasOrUsername })).getConnection();
}

async function generateLocalSobjectJSON(connection: Connection) {
  const sobjectNames = [
    'Account',
    'Attachment',
    'Case',
    'Contact',
    'Contract',
    'Lead',
    'Note',
    'Opportunity',
    'Order',
    'Pricebook2',
    'PricebookEntry',
    'Product2',
    'RecordType',
    'Report',
    'Task',
    'User'
  ];

  const retriever = new OrgObjectDetailRetriever(connection, {
    select: sobj => true
  });

  const output = initializeOutput(sobjectNames);
  await retriever.retrieve(output);
  console.log(JSON.stringify(output.getTypeNames(), null, 2));

  const targetFileName = path.join(
    path.basename(__filename),
    '../src/data/minSObjects.new.json'
  );
  console.log('Generating: ' + targetFileName);
  fs.writeFileSync(
    targetFileName,
    JSON.stringify({
      typeNames: output.getTypeNames(),
      standard: output.getStandard().map(removeCustomFields)
    })
  );
}
function initializeOutput(sobjectNames: string[]) {
  const typeNames: SObjectShortDescription[] = sobjectNames.map(s => ({
    name: s,
    custom: false
  }));

  const standard: SObject[] = [];
  const custom: SObject[] = [];
  const result = { error: {} };

  /* tslint:disable */
  return {
    sfdxPath: '',
    addTypeNames: (sobjShort: SObjectShortDescription[]) => {
      typeNames.push(...sobjShort);
    },
    getTypeNames: () => typeNames,

    addStandard: (defs: SObject[]) => {
      standard.push(...defs);
    },
    getStandard: () => standard,

    addCustom: (defs: SObject[]) => {
      custom.push(...defs);
    },
    getCustom: () => custom,

    setError: (message: string, stack: any) => {
      result.error = { message, stack };
    }
  };
}

function removeCustomFields(sobject: SObject) {
  sobject.fields = sobject.fields.filter(f => !f.custom);
  return sobject;
}
