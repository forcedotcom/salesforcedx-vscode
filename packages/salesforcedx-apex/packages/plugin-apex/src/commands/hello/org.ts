/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@salesforce/plugin-apex', 'org');

export default class Org extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx hello:org --targetusername myOrg@example.com --targetdevhubusername devhub@org.com
  Hello world! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  My hub org id is: 00Dxx000000001234
  `,
    `$ sfdx hello:org --name myname --targetusername myOrg@example.com
  Hello myname! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  `
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    name: flags.string({
      char: 'n',
      description: messages.getMessage('nameFlagDescription')
    }),
    force: flags.boolean({
      char: 'f',
      description: messages.getMessage('forceFlagDescription')
    })
  };

  protected static requiresUsername = true;
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {
    try {
      const name = this.flags.name || 'world';

      // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
      const conn = this.org!.getConnection();
      const query = 'Select Name, TrialExpirationDate from Organization';

      // The type we are querying for
      interface Organization {
        Name: string;
        TrialExpirationDate: string;
      }

      // Query the org
      const result = await conn.query<Organization>(query);

      // Organization will always return one result, but this is an example of throwing an error
      // The output and --json will automatically be handled for you.
      if (!result.records || result.records.length <= 0) {
        throw new SfdxError(
          messages.getMessage('errorNoOrgResults', [this.org!.getOrgId()])
        );
      }

      // Organization always only returns one result
      const orgName = result.records[0].Name;
      const trialExpirationDate = result.records[0].TrialExpirationDate;

      let outputString = `Hello ${name}! This is org: ${orgName}`;
      if (trialExpirationDate) {
        const date = new Date(trialExpirationDate).toDateString();
        outputString = `${outputString} and I will be around until ${date}!`;
      }
      this.ux.log(outputString);

      // this.hubOrg is NOT guaranteed because supportsHubOrgUsername=true, as opposed to requiresHubOrgUsername.
      if (this.hubOrg) {
        const hubOrgId = this.hubOrg.getOrgId();
        this.ux.log(`My hub org id is: ${hubOrgId}`);
      }

      if (this.flags.force && this.args.file) {
        this.ux.log(`You input --force and a file: ${this.args.file}`);
      }

      // Return an object to be displayed with --json
      return { orgId: this.org!.getOrgId(), outputString };
    } catch (e) {
      return Promise.reject(e);
    }
  }
}
