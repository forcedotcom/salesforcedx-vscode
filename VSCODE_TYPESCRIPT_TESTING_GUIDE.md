# 🧪 VSCode Extension - TypeScript Testing Guide

**Branch:** `feat/typescript-vscode-extension`
**Status:** Ready for manual testing ✅

---

## 📋 Prerequisites Checklist

✅ **Done for you:**
- Switched to `feat/typescript-vscode-extension` branch
- Dependencies installed (`yarn install`)
- Templates library linked

⚠️ **Note:** Some build warnings are normal (node@22 build issues) - extension will still work

---

## 🚀 Part 1: Launch VSCode Extension in Debug Mode

### Step 1: Open VSCode Extension in VSCode

```bash
# Open the extension repository in VSCode
cd /Users/shubham.goyal/Services/SFCLI/salesforcedx-vscode
code .
```

### Step 2: Open the Extension Host

1. In VSCode, press `F5` or click **Run > Start Debugging**
2. Or from Command Palette (`Cmd+Shift+P`):
   - Type: "Debug: Start Debugging"
   - Select the configuration (usually "Launch Extensions")

3. **A new VSCode window will open** titled `[Extension Development Host]`
   - This is your test window with the extension loaded
   - Keep both windows open

### Step 3: Verify Extension is Loaded

In the Extension Development Host window:

1. Press `Cmd+Shift+P` to open Command Palette
2. Type: `SFDX:`
3. You should see all Salesforce commands available

✅ If you see Salesforce commands, the extension is loaded!

---

## 🧪 Part 2: Test Project Creation with TypeScript

### Test 1: Create TypeScript Project

In the **Extension Development Host** window:

1. **Open Command Palette:** `Cmd+Shift+P`

2. **Run:** `SFDX: Create Project`

3. **Follow the prompts:**
   - **Template:** Select `Standard`
   - **Project Name:** Enter `vscode-ts-test`
   - **LWC Language:** **SELECT TYPESCRIPT** ✨
     - This is the new option!
     - Should appear as `TypeScript` or `typescript`
   - **Location:** Choose `/Users/shubham.goyal/Desktop/vscode-tests/`

4. **Wait for project creation**
   - Output panel will show progress
   - Project folder will open automatically

### Verification ✅

After project creation, verify these files exist:

```bash
cd /Users/shubham.goyal/Desktop/vscode-tests/vscode-ts-test

# Check TypeScript configuration
ls -la tsconfig.json

# Check sfdx-project.json
cat sfdx-project.json | grep defaultLWCLanguage
# Should show: "defaultLWCLanguage": "typescript"

# Check package.json for TypeScript dependencies
cat package.json | grep typescript
# Should show: "typescript": "^5.8.0"
```

**Screenshot Opportunity:** Capture the LWC Language selection prompt showing TypeScript option

---

### Test 2: Create JavaScript Project (Regression)

Repeat the process but:
- Project Name: `vscode-js-test`
- **LWC Language:** Select `JavaScript` or leave as default

Verify:
- NO `tsconfig.json`
- NO `defaultLWCLanguage` in `sfdx-project.json`
- NO TypeScript dependencies

---

## 🧪 Part 3: Test LWC Component Creation with Auto-Detection

### Test 3: Auto-Detection in TypeScript Project

In the **Extension Development Host** window:

1. **Open the TypeScript project:**
   - File > Open Folder
   - Select: `/Users/shubham.goyal/Desktop/vscode-tests/vscode-ts-test`

2. **Open Command Palette:** `Cmd+Shift+P`

3. **Run:** `SFDX: Create Lightning Web Component`

4. **Follow the prompts:**
   - **Component Name:** `myAutoComponent`
   - **Directory:** `force-app/main/default/lwc` (default)
   - **Note:** Should NOT ask for language - auto-detects TypeScript! ✨

5. **Verify the component:**
   ```bash
   ls -la force-app/main/default/lwc/myAutoComponent/
   ```

Expected files:
```
myAutoComponent/
├── myAutoComponent.ts          ← TypeScript! (auto-detected)
├── myAutoComponent.html
├── myAutoComponent.js-meta.xml
├── .gitignore
└── __tests__/
    └── myAutoComponent.test.ts
```

**Key Test:** The extension should **automatically create `.ts` files** because it read `defaultLWCLanguage: "typescript"` from `sfdx-project.json`!

---

### Test 4: Auto-Detection in JavaScript Project

1. **Open the JavaScript project:**
   - File > Open Folder
   - Select: `/Users/shubham.goyal/Desktop/vscode-tests/vscode-js-test`

2. **Create LWC:** `SFDX: Create Lightning Web Component`
   - Component Name: `myJsComponent`

3. **Verify:**
   ```bash
   ls -la force-app/main/default/lwc/myJsComponent/*.js
   ```

Should create `.js` files (not `.ts`)

---

### Test 5: Manual TypeScript Selection (Fallback)

If project has no `defaultLWCLanguage`:

1. **Open a project without language specified** (or test-default-project)

2. **Create LWC:** `SFDX: Create Lightning Web Component`
   - Component Name: `manualTsComponent`
   - **Should prompt for language:** JavaScript or TypeScript
   - **Select:** TypeScript

3. **Verify:** Should create `.ts` files

---

## 🔍 Part 4: Test IntelliSense and TypeScript Features

### Test 6: TypeScript IntelliSense in VSCode

In the TypeScript project (`vscode-ts-test`):

1. **Open a TypeScript component:**
   ```
   force-app/main/default/lwc/myAutoComponent/myAutoComponent.ts
   ```

2. **Edit the file:**
   ```typescript
   import { LightningElement } from 'lwc';

   export default class MyAutoComponent extends LightningElement {
     message: string = 'Hello TypeScript!';

     handleClick() {
       this.message = 'Clicked!';
     }
   }
   ```

3. **Test IntelliSense:**
   - Type `this.` → Should show `message` and `handleClick` with types
   - Hover over `message` → Should show `string` type
   - Hover over `handleClick` → Should show function signature

4. **Test Type Checking:**
   - Try: `this.message = 123;` (wrong type)
   - Should show red squiggly line
   - Hover → Should show: "Type 'number' is not assignable to type 'string'"

**Screenshot Opportunity:** Capture IntelliSense showing TypeScript types

---

### Test 7: TypeScript Compilation

In integrated terminal:

```bash
cd /Users/shubham.goyal/Desktop/vscode-tests/vscode-ts-test

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Should compile without errors ✅
```

---

## 🎨 Part 5: Test User Experience Features

### Test 8: Quick Pick for LWC Language

1. **Watch for the language selection prompt**
   - Should appear when creating LWC in project without `defaultLWCLanguage`
   - Should have clear options:
     - `JavaScript` (with description)
     - `TypeScript` (with description)

2. **Verify prompt includes:**
   - Clear labels
   - Helpful descriptions
   - Default selection (JavaScript)

**Screenshot Opportunity:** Capture the language selection quick pick

---

### Test 9: Output Panel Messages

1. **Watch the Output panel** during project/component creation:
   - View > Output
   - Select: "Salesforce CLI"

2. **Verify messages show:**
   - "Creating project with TypeScript support..."
   - File creation progress
   - Success message

---

### Test 10: Error Handling

Test error scenarios:

1. **Create project with invalid name:**
   - Try: `my-project!@#` (invalid characters)
   - Should show error message

2. **Create component in non-SFDX project:**
   - Open a random folder (not SFDX project)
   - Try to create LWC
   - Should show appropriate error

---

## 📊 Part 6: Comprehensive Test Matrix

### Project Creation Tests

| Test | Template | Language | Expected Result | Status |
|------|----------|----------|-----------------|--------|
| 1 | Standard | TypeScript | Creates with TS config | [ ] |
| 2 | Standard | JavaScript | No TS config | [ ] |
| 3 | Empty | TypeScript | Creates with TS config | [ ] |
| 4 | Empty | JavaScript | No TS config | [ ] |
| 5 | Analytics | TypeScript | Creates with TS config | [ ] |

### Component Creation Tests

| Test | Project Type | Auto-Detect | Manual | Expected Files | Status |
|------|-------------|-------------|--------|----------------|--------|
| 6 | TypeScript | Yes | - | `.ts` files | [ ] |
| 7 | JavaScript | Yes | - | `.js` files | [ ] |
| 8 | No language | - | TypeScript | `.ts` files | [ ] |
| 9 | No language | - | JavaScript | `.js` files | [ ] |

### IntelliSense Tests

| Test | Feature | Expected Result | Status |
|------|---------|-----------------|--------|
| 10 | Type hints | Shows types on hover | [ ] |
| 11 | Auto-completion | Suggests with types | [ ] |
| 12 | Error detection | Shows type errors | [ ] |
| 13 | Go to definition | Works for TS files | [ ] |

---

## 🐛 Part 7: Things to Check

### Common Issues

**Issue 1: Extension not loading**
- **Check:** Extension Development Host window opened?
- **Fix:** Press F5 again or restart VS Code

**Issue 2: TypeScript option not showing**
- **Check:** Are you on the correct branch (`feat/typescript-vscode-extension`)?
- **Check:** Did dependencies install correctly?
- **Fix:** Run `yarn install` again

**Issue 3: IntelliSense not working**
- **Check:** Is TypeScript installed? Run `npm install` in project
- **Check:** VSCode TypeScript version (bottom-right status bar)
- **Fix:** Reload window (`Cmd+Shift+P` → "Developer: Reload Window")

**Issue 4: Auto-detection not working**
- **Check:** Does `sfdx-project.json` have `defaultLWCLanguage`?
- **Check:** Are you in the correct project directory?

---

## 📸 Screenshot Checklist

Take screenshots of these key moments:

1. [ ] Language selection prompt showing "TypeScript" option
2. [ ] Project creation output showing TypeScript setup
3. [ ] Generated project with `tsconfig.json` visible
4. [ ] Component auto-detection (no language prompt in TS project)
5. [ ] IntelliSense showing TypeScript types
6. [ ] Type error detection (red squiggles)
7. [ ] Successful `npm run build` output

---

## ✅ Success Criteria

### Project Creation
- [ ] TypeScript option appears in prompts
- [ ] Creates `tsconfig.json` when TypeScript selected
- [ ] Creates `defaultLWCLanguage: "typescript"` in `sfdx-project.json`
- [ ] Includes TypeScript dependencies in `package.json`
- [ ] JavaScript projects work without regression

### Component Creation
- [ ] Auto-detects TypeScript from `sfdx-project.json`
- [ ] Creates `.ts` files in TypeScript projects
- [ ] Creates `.js` files in JavaScript projects
- [ ] Prompts for language when not specified
- [ ] Manual selection works correctly

### Developer Experience
- [ ] IntelliSense shows TypeScript types
- [ ] Type checking works in real-time
- [ ] Compilation (`npm run build`) succeeds
- [ ] No errors in Extension Host console
- [ ] Clear, helpful prompts and messages

---

## 🎯 Part 8: Advanced Testing (Optional)

### Test 11: Multiple Projects

1. Create 3 projects:
   - One TypeScript
   - One JavaScript
   - One without specification

2. Switch between them in VSCode
3. Create components in each
4. Verify correct file types in each

### Test 12: Workspace with Mixed Projects

1. Open a workspace with both TS and JS projects
2. Create components in each
3. Verify auto-detection works per-project

### Test 13: Git Integration

1. In TypeScript project, check `.gitignore`:
   - Should include TypeScript artifacts (`lib/`, `dist/`, `*.tsbuildinfo`)

2. Stage files with Git
3. Verify TypeScript files are tracked correctly

---

## 🧹 Clean Up After Testing

```bash
# Remove test projects
rm -rf /Users/shubham.goyal/Desktop/vscode-tests/vscode-ts-test
rm -rf /Users/shubham.goyal/Desktop/vscode-tests/vscode-js-test

# Stop Extension Development Host
# Just close the window
```

---

## 📝 Test Report Template

### Environment
- **Date:** [DATE]
- **Tester:** [NAME]
- **VSCode Version:** [VERSION]
- **Node Version:** [VERSION]
- **Branch:** feat/typescript-vscode-extension

### Test Results

**Project Creation:** [PASS/FAIL]
- TypeScript Standard: [ ]
- JavaScript Standard: [ ]
- TypeScript Empty: [ ]
- Notes: _______________

**Component Creation:** [PASS/FAIL]
- Auto-detection TS: [ ]
- Auto-detection JS: [ ]
- Manual selection: [ ]
- Notes: _______________

**IntelliSense:** [PASS/FAIL]
- Type hints: [ ]
- Auto-completion: [ ]
- Error detection: [ ]
- Notes: _______________

**Issues Found:**
1. _______________
2. _______________

**Overall Status:** [PASS/FAIL/NEEDS WORK]

---

## 🎓 Tips for Effective Testing

1. **Keep both VSCode windows open:**
   - Main window: Extension source code
   - Extension Development Host: Testing

2. **Watch the Debug Console:**
   - View > Debug Console
   - Shows extension logs and errors

3. **Check Output Panel:**
   - View > Output
   - Select "Salesforce CLI"
   - Shows command execution details

4. **Use keyboard shortcuts:**
   - `Cmd+Shift+P`: Command Palette
   - `F5`: Start debugging
   - `Cmd+R`: Reload Extension Host

5. **Test incrementally:**
   - Test one feature at a time
   - Document results immediately
   - Take screenshots as you go

---

## 📞 Need Help?

If you encounter issues:

1. **Check Extension Host console:**
   - View > Toggle Developer Tools (in Extension Development Host)
   - Look for errors in Console tab

2. **Check main VSCode output:**
   - Look for build/compile errors

3. **Restart everything:**
   - Close Extension Development Host
   - Stop debugging (Shift+F5)
   - Restart (F5)

---

## 🎉 Ready to Test!

**Quick Start:**

```bash
# 1. Open VSCode
cd /Users/shubham.goyal/Services/SFCLI/salesforcedx-vscode
code .

# 2. Press F5 to launch Extension Development Host

# 3. In the new window:
#    - Cmd+Shift+P
#    - Type: SFDX: Create Project
#    - Follow the guide above!
```

**Have fun testing! 🚀**
