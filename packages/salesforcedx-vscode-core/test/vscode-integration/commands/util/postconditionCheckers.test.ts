/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancelResponse,
  ContinueResponse,
  LocalComponent,
  PostconditionChecker
} from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as fs from 'fs';
import { join } from 'path';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { channelService } from '../../../../src/channels';
import {
  CommandletExecutor,
  ConflictDetectionMessages,
  EmptyPostChecker,
  OverwriteComponentPrompt,
  PathStrategyFactory,
  SfCommandlet
} from '../../../../src/commands/util';
import { CompositePostconditionChecker } from '../../../../src/commands/util/compositePostconditionChecker';
import { TimestampConflictChecker } from '../../../../src/commands/util/timestampConflictChecker';
import { conflictView, DirectoryDiffResults } from '../../../../src/conflict';
import { TimestampFileProperties } from '../../../../src/conflict/directoryDiffer';
import { WorkspaceContext } from '../../../../src/context';
import * as workspaceUtil from '../../../../src/context/workspaceOrgType';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { salesforceCoreSettings } from '../../../../src/settings';
import { MetadataDictionary, workspaceUtils } from '../../../../src/util';
import { OrgType } from './../../../../src/context/workspaceOrgType';

describe('Postcondition Checkers', () => {
  let env: SinonSandbox;
  describe('EmptyPostconditionChecker', () => {
    it('Should return CancelResponse if input passed in is CancelResponse', async () => {
      const postChecker = new EmptyPostChecker();
      const response = await postChecker.check({ type: 'CANCEL' });
      expect(response.type).to.equal('CANCEL');
    });
    it('Should return ContinueResponse unchanged if input passed in is ContinueResponse', async () => {
      const postChecker = new EmptyPostChecker();
      const input: ContinueResponse<string> = {
        type: 'CONTINUE',
        data: 'test'
      };
      const response = await postChecker.check(input);
      expect(response.type).to.equal('CONTINUE');
      if (response.type === 'CONTINUE') {
        expect(response.data).to.equal('test');
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });

  describe('CompositePostconditionChecker', () => {
    it('Should return CancelResponse if input passed in is CancelResponse', async () => {
      const postChecker = new CompositePostconditionChecker(
        new (class implements PostconditionChecker<{}> {
          public async check(): Promise<CancelResponse | ContinueResponse<{}>> {
            throw new Error('This should not be called');
          }
        })()
      );
      const response = await postChecker.check({ type: 'CANCEL' });
      expect(response.type).to.equal('CANCEL');
    });

    it('Should proceed to next checker if previous checker in composite checker is ContinueResponse', async () => {
      const compositePostconditionChecker = new CompositePostconditionChecker(
        new (class implements PostconditionChecker<string> {
          public async check(): Promise<CancelResponse | ContinueResponse<string>> {
            return { type: 'CONTINUE', data: 'package.xml' };
          }
        })(),
        new (class implements PostconditionChecker<string> {
          public async check(): Promise<CancelResponse | ContinueResponse<string>> {
            return { type: 'CONTINUE', data: 'package.xml' };
          }
        })()
      );

      const response = await compositePostconditionChecker.check({
        type: 'CONTINUE',
        data: 'package.xml'
      });
      expect(response.type).to.equal('CONTINUE');
    });

    it('Should not proceed to next checker if previous checker in composite checker is CancelResponse', async () => {
      const compositePostconditionChecker = new CompositePostconditionChecker(
        new (class implements PostconditionChecker<string> {
          public async check(): Promise<CancelResponse | ContinueResponse<string>> {
            return { type: 'CANCEL' };
          }
        })(),
        new (class implements PostconditionChecker<string> {
          public async check(): Promise<CancelResponse | ContinueResponse<string>> {
            throw new Error('This should not be called');
          }
        })()
      );

      await compositePostconditionChecker.check({
        type: 'CONTINUE',
        data: 'package.xml'
      });
    });

    // tslint:disable:no-unused-expression
    it('Should call executor if composite checker is ContinueResponse', async () => {
      let executed = false;
      const commandlet = new SfCommandlet(
        new (class {
          public check(): boolean {
            return true;
          }
        })(),
        new (class {
          public async gather(): Promise<CancelResponse | ContinueResponse<string>> {
            return { type: 'CONTINUE', data: 'package.xml' };
          }
        })(),
        new (class implements CommandletExecutor<string> {
          public execute(response: ContinueResponse<string>): void {
            executed = true;
          }
        })(),
        new CompositePostconditionChecker<string>(
          new (class implements PostconditionChecker<string> {
            public async check(): Promise<CancelResponse | ContinueResponse<string>> {
              return { type: 'CONTINUE', data: 'package.xml' };
            }
          })()
        )
      );

      await commandlet.run();

      expect(executed).to.be.true;
    });

    it('Should not call executor if composite checker is CancelResponse', async () => {
      const commandlet = new SfCommandlet(
        new (class {
          public check(): boolean {
            return true;
          }
        })(),
        new (class {
          public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
            return { type: 'CONTINUE', data: 'package.xml' };
          }
        })(),
        new (class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            throw new Error('This should not be called');
          }
        })(),
        new CompositePostconditionChecker<{}>(
          new (class implements PostconditionChecker<{}> {
            public async check(): Promise<CancelResponse | ContinueResponse<{}>> {
              return { type: 'CANCEL' };
            }
          })()
        )
      );

      await commandlet.run();
    });
  });

  describe('OverwriteComponentPrompt', () => {
    let existsStub: SinonStub;
    let modalStub: SinonStub;
    let promptStub: SinonStub;
    const checker = new OverwriteComponentPrompt();

    beforeEach(() => {
      env = createSandbox();
      existsStub = env.stub(fs, 'existsSync');
      modalStub = env.stub(notificationService, 'showWarningModal');
    });

    afterEach(() => env.restore());

    describe('Check Components Exist', () => {
      beforeEach(() => {
        promptStub = env.stub(checker, 'promptOverwrite');
      });

      it('Should not prompt overwrite if components do not exist', async () => {
        existsStub.returns(true);
        const data = generateComponents(2);
        pathExists(false, data[0], '.t-meta.xml');
        pathExists(false, data[1], '.t-meta.xml');

        await checker.check({ type: 'CONTINUE', data });

        expect(promptStub.notCalled).to.equal(true);
      });

      it('Should prompt overwrite for components that exist', async () => {
        existsStub.returns(false);
        const data = generateComponents(2);
        pathExists(true, data[0], '.t-meta.xml');

        await checker.check({ type: 'CONTINUE', data });

        expect(promptStub.firstCall.args[0]).to.eql([data[0]]);
      });

      it('Should prompt overwrite for EPT components that exist', async () => {
        existsStub.returns(false);
        const data = {
          fileName: 'Test1',
          outputdir: 'package/tests',
          type: 'ExperiencePropertyTypeBundle',
          suffix: 'json'
        };
        pathExists(true, data, '/schema.json');

        await checker.check({ type: 'CONTINUE', data });

        expect(promptStub.firstCall.args[0]).to.eql([data]);
      });

      it('Should prompt overwrite for EPT components that does not exist', async () => {
        existsStub.returns(false);
        const data = {
          fileName: 'Test1',
          outputdir: 'package/tests',
          type: 'ExperiencePropertyTypeBundle',
          suffix: 'json'
        };

        await checker.check({ type: 'CONTINUE', data });

        expect(promptStub.firstCall).to.null;
      });

      it('Should determine a component exists if at least one of its file extensions do', async () => {
        const dictionaryStub = env.stub(MetadataDictionary, 'getInfo');
        dictionaryStub.returns({
          pathStrategy: PathStrategyFactory.createDefaultStrategy(),
          extensions: ['.a', '.b', '.c']
        });
        existsStub.returns(false);
        const data = generateComponents(1);
        pathExists(true, data[0], '.c');

        await checker.check({ type: 'CONTINUE', data });

        expect(existsStub.firstCall.returnValue).to.equal(false);
        expect(existsStub.secondCall.returnValue).to.equal(false);
        expect(promptStub.firstCall.args[0]).to.eql([data[0]]);
      });
    });

    describe('Overwrite Dialog Message', () => {
      it('Should show every action when there are multiple components to overwrite', async () => {
        await checker.promptOverwrite(generateComponents(2));

        expect(modalStub.firstCall.args.slice(1)).to.eql([
          nls.localize('warning_prompt_overwrite'),
          nls.localize('warning_prompt_skip'),
          nls.localize('warning_prompt_overwrite_all') + ' (2)',
          nls.localize('warning_prompt_skip_all') + ' (2)'
        ]);
      });

      it('Should only show overwrite and cancel for one component', async () => {
        await doPrompt(generateComponents(1), [undefined]);

        expect(modalStub.firstCall.args.slice(1)).to.eql([nls.localize('warning_prompt_overwrite')]);
      });

      it('Should show correct message for one component', async () => {
        const components = generateComponents(1);

        await doPrompt(components, [undefined]);

        expect(modalStub.firstCall.args[0]).to.equal(
          nls.localize('warning_prompt_overwrite_message', components[0].type, components[0].fileName, '', '')
        );
      });

      it('Should show correct message for 1 < components <= 10 ', async () => {
        const components = generateComponents(2);
        const expectedBody = `${components[1].type}:${components[1].fileName}\n`;

        await doPrompt(components, [undefined]);

        expect(modalStub.firstCall.args[0]).to.equal(
          nls.localize(
            'warning_prompt_overwrite_message',
            components[0].type,
            components[0].fileName,
            nls.localize('warning_prompt_other_existing', 1),
            expectedBody
          )
        );
      });

      it('Should show correct message for components > 10', async () => {
        const components = generateComponents(12);
        let expectedBody = '';
        for (const component of components.slice(1, 11)) {
          expectedBody += `${component.type}:${component.fileName}\n`;
        }
        expectedBody += `${nls.localize('warning_prompt_other_not_shown', 1)}`;

        await doPrompt(components, [undefined]);

        expect(modalStub.firstCall.args[0]).to.equal(
          nls.localize(
            'warning_prompt_overwrite_message',
            components[0].type,
            components[0].fileName,
            nls.localize('warning_prompt_other_existing', 11),
            expectedBody
          )
        );
      });
    });

    describe('Overwrite Dialog Actions', () => {
      it('Should skip all', async () => {
        const components = generateComponents(2);
        const actions = [`${nls.localize('warning_prompt_skip_all')} (2)`];

        const response = await doPrompt(components, actions);

        expect(response.type).to.equal('CANCEL');
      });

      it('Should overwrite all', async () => {
        const components = generateComponents(2);
        const actions = [`${nls.localize('warning_prompt_overwrite_all')} (2)`];

        const response = (await doPrompt(components, actions)) as ContinueResponse<LocalComponent[] | LocalComponent>;

        expect(response.data).to.eql(components);
      });

      it('Should skip one and overwrite remaining', async () => {
        const components = generateComponents(3);
        const actions = [nls.localize('warning_prompt_skip'), nls.localize('warning_prompt_overwrite_all') + ' (2)'];

        const response = (await doPrompt(components, actions)) as ContinueResponse<LocalComponent[] | LocalComponent>;

        expect(response.data).to.eql(components.slice(1));
      });

      it('Should overwrite one and skip remaining', async () => {
        const components = generateComponents(3);
        const actions = [nls.localize('warning_prompt_overwrite'), nls.localize('warning_prompt_skip_all') + ' (2)'];

        const response = (await doPrompt(components, actions)) as ContinueResponse<LocalComponent[] | LocalComponent>;

        expect(response.data).to.eql(components.slice(0, 1));
      });

      it('Should cancel', async () => {
        const components = generateComponents(3);
        const actions = [undefined];

        const response = await doPrompt(components, actions);

        expect(response.type).to.equal('CANCEL');
      });
    });

    const doPrompt = async (components: LocalComponent[], actions: any[]) => {
      components.forEach((component, index) => {
        pathExists(true, component, '.t-meta.xml');
        if (index < actions.length) {
          modalStub.onCall(index).returns(actions[index]);
        }
      });

      return await checker.check({
        type: 'CONTINUE',
        data: components
      });
    };

    const generateComponents = (count: number) => {
      const data = [];
      for (let i = 1; i <= count; i++) {
        data.push({
          fileName: `Test${i}`,
          outputdir: 'package/tests',
          type: 'TestType',
          suffix: 't'
        });
      }
      return data;
    };

    const pathExists = (value: boolean, forComponent: LocalComponent, withExtension: string) => {
      const path = join(
        workspaceUtils.getRootWorkspacePath(),
        `package/tests/${forComponent.fileName}${withExtension}`
      );
      existsStub.withArgs(path).returns(value);
    };
  });

  describe('TimestampConflictChecker', () => {
    const mockWorkspaceContext = { getConnection: () => {} } as any;
    let modalStub: SinonStub;
    let settingsStub: SinonStub;
    let conflictViewStub: SinonStub;
    let appendLineStub: SinonStub;
    let channelOutput: string[] = [];

    beforeEach(() => {
      env = createSandbox();
      channelOutput = [];
      modalStub = env.stub(notificationService, 'showWarningModal');
      settingsStub = env.stub(salesforceCoreSettings, 'getConflictDetectionEnabled');
      conflictViewStub = env.stub(conflictView, 'visualizeDifferences');
      appendLineStub = env.stub(channelService, 'appendLine');
      env.stub(WorkspaceContext, 'getInstance').returns(mockWorkspaceContext);
      env.stub(workspaceUtil, 'getWorkspaceOrgType').returns(OrgType.NonSourceTracked);
      appendLineStub.callsFake(line => channelOutput.push(line));
    });

    afterEach(() => env.restore());

    const emptyMessages: ConflictDetectionMessages = {
      warningMessageKey: '',
      commandHint: i => i as string
    };

    const retrieveMessages: ConflictDetectionMessages = {
      warningMessageKey: 'conflict_detect_conflicts_during_retrieve',
      commandHint: i => i as string
    };

    const validInput: ContinueResponse<string> = {
      type: 'CONTINUE',
      data: 'package.xml'
    };

    it('Should return CancelResponse if input passed in is CancelResponse', async () => {
      const postChecker = new TimestampConflictChecker(false, emptyMessages);
      const response = await postChecker.check({ type: 'CANCEL' });
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return ContinueResponse unchanged if input is ContinueResponse and conflict detection is disabled', async () => {
      const postChecker = new TimestampConflictChecker(false, emptyMessages);

      settingsStub.returns(false);
      const response = await postChecker.check(validInput);

      expect(response.type).to.equal('CONTINUE');
      if (response.type === 'CONTINUE') {
        expect(response.data).to.equal('package.xml');
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return CancelResponse when a username is not defined.', async () => {
      const postChecker = new TimestampConflictChecker(false, emptyMessages);
      settingsStub.returns(true);

      const response = await postChecker.check(validInput);
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return ContinueResponse when no conflicts are detected', async () => {
      const postChecker = new TimestampConflictChecker(false, emptyMessages);
      const response = await postChecker.handleConflicts('manifest.xml', 'admin@example.com', {
        different: new Set<TimestampFileProperties>()
      } as DirectoryDiffResults);

      expect(response.type).to.equal('CONTINUE');
      expect((response as ContinueResponse<string>).data).to.equal('manifest.xml');
      expect(appendLineStub.notCalled).to.equal(true);
    });

    it('Should post a warning and return CancelResponse when conflicts are detected and cancelled', async () => {
      const postChecker = new TimestampConflictChecker(false, retrieveMessages);
      const results = {
        different: new Set<TimestampFileProperties>([
          {
            localRelPath: 'main/default/objects/Property__c/fields/Broker__c.field-meta.xml',
            remoteRelPath: 'main/default/objects/Property__c/fields/Broker__c.field-meta.xml'
          },
          {
            localRelPath: 'main/default/aura/auraPropertySummary/auraPropertySummaryController.js',
            remoteRelPath: 'main/default/objects/Property__c/fields/Broker__c.field-meta.xml'
          }
        ]),
        scannedLocal: 4,
        scannedRemote: 6
      } as DirectoryDiffResults;
      modalStub.returns('Cancel');

      const response = await postChecker.handleConflicts('package.xml', 'admin@example.com', results);
      expect(response.type).to.equal('CANCEL');

      expect(modalStub.firstCall.args.slice(1)).to.eql([
        nls.localize('conflict_detect_show_conflicts'),
        nls.localize('conflict_detect_override')
      ]);

      expect(channelOutput).to.include.members([
        nls.localize('conflict_detect_conflict_header_timestamp', 2),
        'Broker__c.field-meta.xml',
        'auraPropertySummaryController.js',
        nls.localize('conflict_detect_command_hint', 'package.xml')
      ]);

      expect(conflictViewStub.calledOnce).to.equal(true);
    });

    it('Should post a warning and return ContinueResponse when conflicts are detected and overwritten', async () => {
      const postChecker = new TimestampConflictChecker(false, retrieveMessages);
      const results = {
        different: new Set<TimestampFileProperties>([
          {
            localRelPath: 'MyClass.cls',
            remoteRelPath: 'MyClass.cls'
          }
        ])
      } as DirectoryDiffResults;
      modalStub.returns(nls.localize('conflict_detect_override'));

      const response = await postChecker.handleConflicts('manifest.xml', 'admin@example.com', results);
      expect(response.type).to.equal('CONTINUE');

      expect(modalStub.firstCall.args.slice(1)).to.eql([
        nls.localize('conflict_detect_show_conflicts'),
        nls.localize('conflict_detect_override')
      ]);
    });

    it('Should post a warning and return CancelResponse when conflicts are detected and conflicts are shown', async () => {
      const postChecker = new TimestampConflictChecker(false, retrieveMessages);
      const results = {
        different: new Set<TimestampFileProperties>([
          {
            localRelPath: 'MyClass.cls',
            remoteRelPath: 'MyClass.cls'
          }
        ])
      } as DirectoryDiffResults;
      modalStub.returns(nls.localize('conflict_detect_show_conflicts'));

      const response = await postChecker.handleConflicts('manifest.xml', 'admin@example.com', results);
      expect(response.type).to.equal('CANCEL');

      expect(modalStub.firstCall.args.slice(1)).to.eql([
        nls.localize('conflict_detect_show_conflicts'),
        nls.localize('conflict_detect_override')
      ]);

      expect(conflictViewStub.calledOnce).to.equal(true);
    });
  });
});
