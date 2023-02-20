---
title: Salesforce Org Development Model
lang: en
---

## Org Development Model

Use the Org Development model to work with orgs that don’t have source tracking, such as sandboxes, Developer Edition (DE) orgs, or Trailhead Playgrounds, in Visual Studio Code. With this development model, you must track changes manually and deploy sets of changes to sandboxes and then to your production org. See the [Org Development Model](https://trailhead.salesforce.com/content/learn/modules/org-development-model) Trailhead module.

### Direct Deployment

Org based development is a straightforward way to deploy your metadata update to your org. In its simplest form, a developer workflow is similar to one of the following:
A single developer retrieves metadata from a sandbox or a scratch org, makes local changes, and deploys the changes back to production.
A single developer moves the metadata described in a manifest file from a Sandbox org to a Production org.
In this development model, your production org is the source of truth, and even if you use a source control tool, your production environment still holds the complete version of all your customizations.


![Demo](./images/changeset-demo.gif)

To start developing with this model:

- Create a project.
- Use the Org Picker to authorize an org you want develop against.
- Use the Manifest Builder or Org Browser to retrieve source from the default org.
- Make your planned updates.




