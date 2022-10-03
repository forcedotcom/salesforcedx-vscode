import { Command } from '../../../src/cli/command';
import {
  CommandBuilder,
  FATAL,
  JSON_FLAG,
  LOG_LEVEL_FLAG
} from '../../../src/cli/commandBuilder';

describe('CommandBuild unit tests', () => {
  const testCommandStr = 'Test Command';
  const testDescription = 'This is a test description';

  let commandBuilderInst: CommandBuilder;

  beforeEach(() => {
    commandBuilderInst = new CommandBuilder(testCommandStr);
  });

  it('Should be a be able to create an instance and build a command.', () => {
    expect(commandBuilderInst).toBeDefined();
    expect(commandBuilderInst).toBeInstanceOf(CommandBuilder);
    const testCommand = commandBuilderInst.build();
    expect(testCommand).toBeInstanceOf(Command);
    expect(testCommand.command).toEqual(testCommandStr);
  });

  it('Should be able to set description.', () => {
    const testCommand = commandBuilderInst
      .withDescription(testDescription)
      .build();
    expect(testCommand.description).toEqual(testDescription);
  });

  it('Should be able to set a flag.', () => {
    const testArgOne = '--do-a-thing';
    const testCommand = commandBuilderInst.withArg(testArgOne);
    expect(testCommand.args).toContain(testArgOne);
  });

  it('Should have special handling for the json flag.', () => {
    const testCommand = commandBuilderInst.withArg(JSON_FLAG);
    expect(testCommand.args).toEqual(
      expect.arrayContaining([JSON_FLAG, LOG_LEVEL_FLAG, FATAL])
    );
  });

  it('Should be able to set json flags.', () => {
    const testCommand = commandBuilderInst.withJson().build();
    expect(testCommand.args).toEqual(
      expect.arrayContaining([JSON_FLAG, LOG_LEVEL_FLAG, FATAL])
    );
  });

  it('Should be able to set a log name.', () => {
    const testLogName = 'aLogIsALogOfCourseOfCourse';
    const testCommand = commandBuilderInst.withLogName(testLogName).build();
    expect(testCommand.logName).toEqual(testLogName);
  });

  it('Should be able to chain it all together.', () => {
    const testArg = 'fakeArgForSure';
    const testFlag = '--do-a-thing';
    const testFlagValue = 'thingsAreValuable';
    const testLogName = 'saveItForLater';

    const testCommand = commandBuilderInst
      .withDescription(testDescription)
      .withArg(testArg)
      .withFlag(testFlag, testFlagValue)
      .withJson()
      .withLogName(testLogName)
      .build();
    expect(testCommand.description).toEqual(testDescription);
    expect(testCommand.args).toContain(testArg);
    expect(testCommand.args).toEqual(
      expect.arrayContaining([testFlag, testFlagValue])
    );
    expect(testCommand.args).toEqual(
      expect.arrayContaining([JSON_FLAG, LOG_LEVEL_FLAG, FATAL])
    );
    expect(testCommand.logName).toEqual(testLogName);
  });
});
