---
title: Write Aura Components
redirect_from: '/articles/frameworks/aura'
---
## Syntax Highlighting
The Aura Components Extension offers syntax highlighting for Aura markup, HTML, CSS, and JavaScript on .cmp, .component, .app files and more. This example shows syntax highlighting for JavaScript. 

  ![Colored syntax highlighting in a .js file from an Aura bundle](../../images/V2_lightning_syntax.png)

## Code Completion
Invoke code completion with Ctrl+Space when you’re working with Aura markup. View additional information about tag names and attributes directly in the editor. 

#### Tags
![Aura Tag Completion](../../images/V2_aura_tag_completion.png)
- **Note:** If you have any Lightning Web Components in your workspace, those components will also appear in the list of suggested completions. The Lightning Web Component suggestions will be displayed with the proper Aura syntax.

#### Attributes
![Aura Attribute Completion](../../images/V2_aura_attribute_completion.png)

## View Component Documentation on Hover
Hovering over a component name or attribute shows component documentation in the editor, as well as links to the Component Library. You can see reference documentation for Aura components and Lightning web components nested within Aura components.

Here's reference documentation for the `lightning:card` component.
![Aura Component Reference](../../images/V2_comp_reference_aura.png)

## View or Jump to Definitions
You can preview, view, or go to definitions of:
- Aura Tags
- LWC Tags
- JavaScript
  - Methods
  - Variables

To preview a definition, hold down Ctrl (Windows or Linux) or Cmd (macOS) and hover over the item whose definition you want to see.

To view a definition, right-click the item and select Peek Definition, or press Alt+F12.

To jump to the location of a definition, right-click the item and select Go to Definition, or press F12.

## Outline view
Outline view allows you to see the outline of your component—i.e. its HTML tags and JavaScript properties. Invoke it with Ctrl+Shift+O on Windows and Linux and Cmd+Shift+O on Mac.

![List of symbols in a .js file from an Aura bundle](../../images/V2_outline_view.png)

## Lightning Explorer (Beta)
As a beta feature, Lightning Explorer View is a preview and isn’t part of the “Services” under your master subscription agreement with Salesforce. Use this feature at your sole discretion, and make your purchase decisions only on the basis of generally available products and features. Salesforce doesn’t guarantee general availability of this feature within any particular time frame or at all, and we can discontinue it at any time. Lightning Explorer is for evaluation purposes only, not for production use. It’s offered as is and isn’t supported, and Salesforce has no liability for any harm or damage arising out of or in connection with it. All restrictions, Salesforce reservation of rights, obligations concerning the Services, and terms for related Non-Salesforce Applications and Content apply equally to your use of this feature. The use of this feature is governed by the [Salesforce.com Program Agreement](https://trailblazer.me/resource/documents/documents/pdf/TermsOfUse_en_US.pdf). If you encounter any problems, or want to request an enhancement, open a Github issue.

Lightning Explorer lets you view reference documentation for both Aura components and Lightning web components. To enable it, go to **Preferences > Settings**. Enter `lightning explorer` in the search bar. Then, click the checkbox next to **salesforcedx-vscode-lightning:Show Lightning Explorer**.

![Show Lightning Explorer](../../images/V2_show_lightning_explorer.png)

To use Lightning Explorer, click the lightning bolt icon on the left hand side of the screen. Click a namespace to see all of the available components. Lightning web components and Aura have different lightning icons.

![Click Lightning Explorer](../../images/V2_click_lightning_icon.png)
Under the c namespace, we've selected the Lightning web component `c-wire-get-object-info`. When you click on the name of the component, its corresponding file shows up in the main code panel. 


Here's the Aura component `force:inputField`. The blue icon to the right of the component name opens your browser to the component reference in the Component Library. 
![Open Component Library](../../images/V2_input_field_comp_lib.png)
Your custom Aura components and documentation are also available in the Aura Components extension. To learn more about writing documentation for your Aura components, see the [Lightning Aura Components Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/components_documentation.htm).  





