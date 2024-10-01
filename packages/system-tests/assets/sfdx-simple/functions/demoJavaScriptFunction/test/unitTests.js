const expect = require('chai').expect;
const sinon = require('sinon');
const sdk = require('@salesforce/salesforce-sdk');

const execute = require('../');

/**
 * DemoJavaScriptFunction unit tests.
 */

 describe('Unit Tests', () => {

    let sandbox;
    let mockContext;
    let mockLogger;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockContext = sandbox.createStubInstance(sdk.Context);
        mockContext.org = sandbox.createStubInstance(sdk.Org);
        mockContext.org.data = sandbox.createStubInstance(sdk.DataApi);
        mockLogger = sandbox.createStubInstance(sdk.Logger);
        mockContext.logger = mockLogger;
    });

    afterEach(() => {
        sandbox.restore();
    });

     it('Invoke DemoJavaScriptFunction', async () => {
        // Mock Accounts query
        const accounts = {
            'totalSize':3,
            'done':true,
            'records':[
                {
                    'attributes':
                        {'type':'Account','url':'/services/data/v50.0/sobjects/Account/001xx000003GYNjAAO'},
                        'Name':'Global Media'
                },
                {
                    'attributes':
                        {'type':'Account','url':'/services/data/v50.0/sobjects/Account/001xx000003GYNkAAO'},
                        'Name':'Acme'
                },
                {
                    'attributes':
                    {'type':'Account','url':'/services/data/v50.0/sobjects/Account/001xx000003GYNlAAO'},
                    'Name':'salesforce.com'
                }
            ]
        };
        mockContext.org.data.query.callsFake(() => {
            return Promise.resolve(accounts);
        });

        // Invoke function
        const results = await execute({ data: {} }, mockContext, mockLogger)
        
        // Validate
        expect(mockContext.org.data.query.callCount).to.be.eql(1);
        expect(mockLogger.info.callCount).to.be.eql(2);
        expect(results).to.be.not.undefined;
        expect(results).has.property('totalSize');
        expect(results.totalSize).to.be.eql(accounts.totalSize);
    });
});
