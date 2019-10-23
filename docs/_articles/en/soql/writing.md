---
title: Write SOQL Queries
lang: en
---

View SOQL query snippet and see code-completion suggestions for your SOQL queries.

> NOTICE: The SOQL Language Server is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](./en/bugs-and-feedback).

## View Code-Completion Suggestions

To see code-completion suggestions, you will first need to create a `.soql` file. This file

To see code-completion suggestions, press Ctrl+space when you’re working in a `.cls` or `.trigger` file. To navigate between the suggestions, use the arrow keys. To auto-complete a suggestion from the list, press Enter. To change how suggestions are pre-selected, see [IntelliSense - Suggestion selection](https://code.visualstudio.com/docs/editor/intellisense).
![Animation showing code completion of a System.debug() statement](./images/apex_completion.gif)

## Insert Code Snippets

To see available Apex code snippets when you’re working in a `.cls` or `.trigger` file, run **Insert Snippet**. Snippets are available for class and interface definitions, a variety of statements, and much more. These code snippets are also available as code-completion suggestions.

## View or Jump to Definitions

You can preview, view, or go to definitions of:

- User-defined Apex
  - Classes (from definitions of extending classes)
  - Constructors
  - Interfaces (from definitions of implementing classes)
  - Methods
  - Properties
  - Variables (local and class variables)
- Standard objects
  - Fields (standard and custom fields)
  - Object definitions
- Custom objects
  - Fields
  - Object definitions

(See the [Enable Code Smartness for SObjects](#enable-code-smartness-for-sobjects) section of this topic for information on working with standard and custom objects.)

To preview a definition, hold down Ctrl (Windows or Linux) or Cmd (macOS) and hover over the item whose definition you want to see.

To view a definition, right-click the item and select **Peek Definition**, or press Alt+F12.

To jump to the location of a definition, right-click the item and select **Go to Definition**, or press F12.  
![Previewing, viewing, and jumping to a definition](./images/apex_go_to_definition.gif)

## Find All References

You can find all references to user-defined Apex:

- Classes
- Class variables
- Enums
- Interfaces
- Methods
- Properties

To find references to an item, right-click the item and select **Find All References**, or press Shift+F12.

## Check Syntax Errors in Your Code

If you leave out a `;`, `}`, or `)`, the syntax error is marked with a red squiggly line in the editor.

The Problems view in the bottom pane also lists the syntax errors. Double-click the problem to go to the source file.  
![Problems view, showing a missing semicolon in an Apex class](./images/apex_problems.png)

## View an Outline of Your Apex Class or Trigger

The Apex outline view shows the structure of the Apex class or trigger that’s open in the editor. For a list of the symbols in your file, press Ctrl+Shift+O (Windows or Linux) or Cmd+Shift+O (macOS). To jump to one of the symbols, select it in the list.  
![Outline view, showing the symbols in an Apex class](./images/apex_outline.png)

## Enable Code Smartness for SObjects

To activate the Apex extension’s code smartness features for standard and custom objects and their fields, including for custom fields on standard objects, press Ctrl+Shift+P (Windows or Linux) or Cmd+Shift+P (macOS), and then select **SFDX: Refresh SObject Definitions** from the command palette.

When you refresh your sObject definitions, VS Code uses your default org to generate faux Apex classes. These faux classes represent the standard and custom objects that the admin user has access to for your default scratch org, or the logged-in user of your sandbox or DE org. The classes are stored in a hidden directory on your local workstation. Don’t edit the faux classes! They are deleted and regenerated each time that you refresh your sObject definitions. To modify your sObjects, either modify the objects’ `.object-meta.xml` and `.field-meta.xml` files (and then run **SFDX: Push Source to Default Scratch Org** or **SFDX: Deploy Source to Org**), or make changes declaratively in your org (and then run **SFDX: Pull Source from Default Scratch Org** or **SFDX: Retrieve Source from Org**). Your user doesn’t automatically gain access to new custom objects, so be sure to assign new permissions to the user as necessary. To assign permissions from the command line, run `sfdx force:user:permset:assign -n YourPermSetName`.

The first time you launch the Salesforce CLI Integration extension (which is part of the Salesforce Extension Pack), if your project doesn’t contain any faux classes we run **SFDX: Refresh SObject Definitions** for you in the background.

After you add or edit standard or custom objects or their fields, be sure to rerun **SFDX: Refresh SObject Definitions**.
