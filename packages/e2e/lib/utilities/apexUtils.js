"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApexClass = createApexClass;
exports.createApexClassWithTest = createApexClassWithTest;
exports.createApexClassWithBugs = createApexClassWithBugs;
exports.createAnonymousApexFile = createAnonymousApexFile;
exports.createApexController = createApexController;
const commandPrompt_1 = require("./commandPrompt");
const miscellaneous_1 = require("./miscellaneous");
const workbench_1 = require("./workbench");
const textEditorView_1 = require("./textEditorView");
async function createApexClass(name, classText, breakpoint) {
    (0, miscellaneous_1.log)(`calling createApexClass(${name})`);
    // Using the Command palette, run SFDX: Create Apex Class to create the main class
    const inputBox = await (0, commandPrompt_1.executeQuickPick)('SFDX: Create Apex Class', miscellaneous_1.Duration.seconds(2));
    // Set the name of the new Apex Class
    await inputBox.setText(name);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    await inputBox.confirm();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    await inputBox.confirm();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    // Modify class content
    const workbench = (0, workbench_1.getWorkbench)();
    const textEditor = await (0, textEditorView_1.getTextEditor)(workbench, name + '.cls');
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    await textEditor.setText(classText);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    await textEditor.save();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    if (breakpoint) {
        await textEditor.toggleBreakpoint(breakpoint);
    }
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
}
async function createApexClassWithTest(name) {
    (0, miscellaneous_1.log)(`calling createApexClassWithTest()`);
    const classText = [
        `public with sharing class ${name} {`,
        `\tpublic static void SayHello(string name){`,
        `\t\tSystem.debug('Hello, ' + name + '!');`,
        `\t}`,
        `}`
    ].join('\n');
    await createApexClass(name, classText, 3);
    const testText = [
        `@IsTest`,
        `public class ${name}Test {`,
        `\t@IsTest`,
        `\tstatic void validateSayHello() {`,
        `\t\tSystem.debug('Starting validate');`,
        `\t\t${name}.SayHello('Cody');`,
        ``,
        `\t\tSystem.assertEquals(1, 1, 'all good');`,
        `\t}`,
        `}`
    ].join('\n');
    await createApexClass(name + 'Test', testText, 6);
}
async function createApexClassWithBugs() {
    (0, miscellaneous_1.log)(`calling createApexClassWithBugs()`);
    const classText = [
        `public with sharing class AccountService {`,
        `\tpublic Account createAccount(String accountName, String accountNumber, String tickerSymbol) {`,
        `\t\tAccount newAcct = new Account(`,
        `\t\t\tName = accountName,`,
        `\t\t\tAccountNumber = accountNumber,`,
        `\t\t\tTickerSymbol = accountNumber`,
        `\t\t);`,
        `\t\treturn newAcct;`,
        `\t}`,
        `}`
    ].join('\n');
    await createApexClass('AccountService', classText);
    const testText = [
        `@IsTest`,
        `private class AccountServiceTest {`,
        `\t@IsTest`,
        `\tstatic void should_create_account() {`,
        `\t\tString acctName = 'Salesforce';`,
        `\t\tString acctNumber = 'SFDC';`,
        `\t\tString tickerSymbol = 'CRM';`,
        `\t\tTest.startTest();`,
        `\t\tAccountService service = new AccountService();`,
        `\t\tAccount newAcct = service.createAccount(acctName, acctNumber, tickerSymbol);`,
        `\t\tinsert newAcct;`,
        `\t\tTest.stopTest();`,
        `\t\tList<Account> accts = [ SELECT Id, Name, AccountNumber, TickerSymbol FROM Account WHERE Id = :newAcct.Id ];`,
        `\t\tSystem.assertEquals(1, accts.size(), 'should have found new account');`,
        `\t\tSystem.assertEquals(acctName, accts[0].Name, 'incorrect name');`,
        `\t\tSystem.assertEquals(acctNumber, accts[0].AccountNumber, 'incorrect account number');`,
        `\t\tSystem.assertEquals(tickerSymbol, accts[0].TickerSymbol, 'incorrect ticker symbol');`,
        `\t}`,
        `}`
    ].join('\n');
    await createApexClass('AccountServiceTest', testText);
}
async function createAnonymousApexFile() {
    (0, miscellaneous_1.log)(`calling createAnonymousApexFile()`);
    const workbench = (0, workbench_1.getWorkbench)();
    // Using the Command palette, run File: New File...
    const inputBox = await (0, commandPrompt_1.executeQuickPick)('Create: New File...', miscellaneous_1.Duration.seconds(1));
    // Set the name of the new Anonymous Apex file
    await inputBox.setText('Anonymous.apex');
    await inputBox.confirm();
    await inputBox.confirm();
    const textEditor = await (0, textEditorView_1.getTextEditor)(workbench, 'Anonymous.apex');
    const fileContent = ["System.debug('¡Hola mundo!');", ''].join('\n');
    await textEditor.setText(fileContent);
    await textEditor.save();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
}
async function createApexController() {
    (0, miscellaneous_1.log)(`calling createApexController()`);
    const classText = [
        `public class MyController {`,
        `\tprivate final Account account;`,
        `\tpublic MyController() {`,
        `\t\taccount = [SELECT Id, Name, Phone, Site FROM Account `,
        `\t\tWHERE Id = :ApexPages.currentPage().getParameters().get('id')];`,
        `\t}`,
        `\tpublic Account getAccount() {`,
        `\t\treturn account;`,
        `\t}`,
        `\tpublic PageReference save() {`,
        `\t\tupdate account;`,
        `\t\treturn null;`,
        `\t}`,
        `}`
    ].join('\n');
    await createApexClass('MyController', classText);
}
//# sourceMappingURL=apexUtils.js.map