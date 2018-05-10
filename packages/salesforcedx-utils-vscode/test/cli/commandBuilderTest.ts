/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';

import { Command, CommandBuilder, SfdxCommandBuilder } from '../../src/cli';

describe('CommandBuilder tests', () => {
  describe('CommandBuilder initialization', () => {
    it('Should store the command string', () => {
      const actual = new CommandBuilder('sfdx').build();

      expect(actual.command).to.equal('sfdx');
    });

    it('Should store the description', () => {
      const actual = new CommandBuilder('sfdx')
        .withDescription('Runs the sfdx top-level command')
        .build();

      expect(actual.command).to.equal('sfdx');
      expect(actual.description).to.equal('Runs the sfdx top-level command');
    });

    it('Should store --json arg', () => {
      const actual = new CommandBuilder('sfdx').withJson().build();

      expect(actual.command).to.equal('sfdx');
      expect(actual.args).to.eql(['--json', '--loglevel', 'fatal']);
    });

    it('Should store the command arg', () => {
      const actual = new CommandBuilder('sfdx')
        .withArg('force:org:display')
        .build();

      expect(actual.command).to.equal('sfdx');
      expect(actual.args).to.eql(['force:org:display']);
    });

    it('Should store the command args', () => {
      const actual = new CommandBuilder('sfdx')
        .withArg('force:org:display')
        .withArg('--help')
        .build();

      expect(actual.command).to.equal('sfdx');
      expect(actual.args).to.eql(['force:org:display', '--help']);
    });

    it('Should store the command flag', () => {
      const actual = new CommandBuilder('sfdx')
        .withArg('force:org:display')
        .withFlag('--targetusername', 'someOrg')
        .build();

      expect(actual.command).to.equal('sfdx');
      expect(actual.args).to.eql([
        'force:org:display',
        '--targetusername',
        'someOrg'
      ]);
    });

    describe('SfdxCommandBuilder initialization', () => {
      it('Should have the sfdx command by default', () => {
        const actual = new SfdxCommandBuilder()
          .withArg('force:org:display')
          .withFlag('--targetusername', 'someOrg');

        expect(actual.command).to.equal('sfdx');
        expect(actual.args).to.eql([
          'force:org:display',
          '--targetusername',
          'someOrg'
        ]);
      });
    });
  });
});
