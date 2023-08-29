---
title: Einstein for Developers Overview
lang: en
---

Einstein for Developers is an AI-powered developer tool that is available as an easy-to-install VS Code extension built using CodeGen, Salesforce’s secure, custom AI model. Use the tool to enhance developer productivity by quickly generating code using natural language instructions.

Einstein for Developers assists you throughout the Salesforce development process with expertise learned from anonymized code patterns. The long-term goals of our suite of AI-powered developer tools are to increase productivity and provide helpful assistance for complex coding tasks. We aim to enforce development best practices with our code generation and just-in-time code completion features eventually. AI-assisted tooling will also make it easier for new developers to onboard to the Salesforce Platform.

## Current Capabilities

The beta focuses on natural language to Apex code generation. This feature, used along with IntelliSense, makes Apex development tooling in Visual Studio Code even richer. Familiarity with Visual Studio Code is assumed.

Currently, the Einstein for Devs extension can:

- Generate code from natural language instructions within an existing Apex class, trigger, or anonymous Apex file. A new command in the VS Code Command Palette, `Einstein: Generate Code`, lets you enter in a prompt describing what you'd like to build and then generate Apex code within your editor.
- Sidebar stuff here.

At this time, the tool does not:

- Create _new_ Apex class files through natural language prompts. Apex files must already be created to trigger the command.
- Take into account any metadata (or context) from your local project or Salesforce org. Generated code is determined by your prompt only.

We plan to follow up with inline code completion and LWC code generation in the coming months.

## About Trusted Generative AI at Salesforce

Salesforce’s Einstein solutions are designed, developed, and delivered based on five principles for trusted generative AI.

**Accuracy**: We prioritize accuracy, precision, and recall in our models, and we back our model outputs up with explanations and sources whenever possible. We recommend that a human check model output before sharing with end users.

**Safety:** We work to mitigate bias, toxicity, and harmful outputs in our models using industry-leading techniques. We protect the privacy of personally identifiable information (PII) in our data by adding guardrails around this data.

**Honesty:** We ensure that the data we use in our models respects data provenance and we that have consent to use the data.

**Empowerment:** Whenever possible, we design models to include human involvement as part of the workflow.

**Sustainability:** We strive to build right-sized models that prioritize accuracy and to reduce our carbon footprint.

Learn more at [Salesforce AI Research: Trusted AI](https://www.salesforceairesearch.com/trusted-ai).

## About the CodeGen Model

CodeGen is a powerful language model capable of generating text and code. The release of CodeGen 1.0 as an open-source project in 2022 could generate code in six different programming languages. Since then, the CodeGen model, integrated into Einstein for Developers and Einstein Flow, has been re-trained and fine-tuned to address specific Salesforce use cases, including Apex and LWC. This refinement significantly enhances the model’s ability to customize and tailor Salesforce solutions.
