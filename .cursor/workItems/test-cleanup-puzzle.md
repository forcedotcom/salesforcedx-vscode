# Test Cleanup

let's chat about this test file (orgBrowser.spec.ts). I skipped a lot of tests because they were taking a long time. The basic should be

1. open vscode
2. wait for the project/fs to load in the explorer
3. click org browser
4. assert that there are metadata types in the org browser. At least a few. and that we should see one called CustomObject
5. click on CustomObject and make sure there are tree nodes in there
6. We also want to, as we do the test, capture logs (it helps with debugging and Cursor iteration).

Look at the tests and find redundancy. Propose changes, but don't make them without permission.

The proposals should be at the `test` level. For each test...does it need to exist? why/why not?

You can run the test via npm run test:web -w salesforcedx-vscode-org-browser (executed from the top of the salesforcedx-vscode project).

you may not ever run `npm run run:web`

Adding longer wait times is probably not the answer. Think harder.

### Improvement Recommendations

1. **✅ Create a Page Object Model** _(Completed)_

   - ✅ Extract Org Browser interactions into a dedicated class
   - ✅ Encapsulate selectors and common operations
   - ✅ Improve readability and maintainability

2. **✅ Use Test Fixtures** _(Completed)_

   - ✅ Create a custom fixture for CDP connection
   - ✅ Separate test configuration from test logic
   - ✅ Reuse setup/teardown logic across tests

3. **Simplify DOM Interaction**

   - Use more specific selectors instead of trying multiple ones
   - Leverage Playwright's built-in waiting mechanisms
   - Reduce the need for explicit timeouts

4. **Improve Error Handling**

   - Standardize error handling approach
   - Add descriptive error messages
   - Use soft assertions where appropriate

5. **Clean Up Diagnostic Code**

   - Remove excessive logging once tests are stable
   - Move screenshot capture to afterEach hook only on failure
   - Extract DOM inspection to a separate utility function

6. **Add Proper Documentation**
   - Document test purpose and steps
   - Add comments for complex sections
   - Include prerequisites and environment requirements

### Recommended Implementation Plan

1. ✅ Create OrgBrowserPage class with core functionality
2. ✅ Refactor test to use the page object model
3. ✅ Create CDP connection fixture
4. Simplify test assertions and error handling
5. Add proper documentation
6. Remove redundant tests
