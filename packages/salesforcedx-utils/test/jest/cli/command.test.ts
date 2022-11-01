import { CommandBuilder } from '../../../src';
import { Command } from '../../../src/cli/command';

describe('Command unit tests.', () => {
  const testCommand = 'iAmACommand';

  it('Should be able to create a command.', () => {
    const commandBuilderInst = new CommandBuilder(testCommand);
    const command = new Command(commandBuilderInst);
    expect(command).toBeInstanceOf(Command);
    expect(command.command).toEqual(testCommand);
    expect(command.description).toBeUndefined();
    expect(command.args).toEqual([]);
    expect(command.logName).toBeUndefined();
  });

  it('Should be able to pass a fully built builder.', () => {
    const commandBuilderInst = new CommandBuilder(testCommand)
      .withDescription('test description')
      .withArg('immaArg')
      .withFlag('--silent', 'quiet')
      .withJson()
      .withLogName('testLogName');

    const command = new Command(commandBuilderInst);
    expect(command).toBeInstanceOf(Command);
    expect(command.command).toEqual(commandBuilderInst.command);
    expect(command.description).toEqual(commandBuilderInst.description);
    expect(command.args).toEqual(commandBuilderInst.args);
    expect(command.logName).toEqual(commandBuilderInst.logName);
  });

  it('Should return description for toString if exists.', () => {
    const testDescription = 'super cool descrption';
    const commandBuilderInst = new CommandBuilder(testCommand);
    commandBuilderInst.withDescription(testDescription);
    const command = new Command(commandBuilderInst);
    expect(command.toString()).toEqual(testDescription);
  });

  it('Should construct string if no description provided.', () => {
    const commandBuilderInst = new CommandBuilder(testCommand)
      .withArg('immaArg')
      .withFlag('--silent', 'quiet')
      .withJson()
      .withLogName('testLogName');

    const command = new Command(commandBuilderInst);
    expect(command.toString()).toMatchSnapshot();
  });

  it('Should build a command.', () => {
    const commandBuilderInst = new CommandBuilder(testCommand)
      .withDescription('test description')
      .withArg('immaArg')
      .withFlag('--silent', 'quiet')
      .withJson()
      .withLogName('testLogName');

    const command = new Command(commandBuilderInst);
    expect(command.toCommand()).toMatchSnapshot();
  });
});
