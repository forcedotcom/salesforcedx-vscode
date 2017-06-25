import { expect } from 'chai';

import { Command, CommandBuilder } from '../../../src/impl/cli';

describe('Command Builder Tests', () => {
  describe('Command Builder Initialization', () => {
    it('Should store the command string', () => {
      const actual = new CommandBuilder('sfdx').build();

      expect(actual.command).to.equal('sfdx');
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
  });
});
