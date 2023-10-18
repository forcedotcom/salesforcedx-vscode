---
title: Development Models
lang: en
---

## Overview

Salesforce Extensions for VS Code support Org Development and Package Development models to authorize, create, and switch orgs in your project. At a high level, both development models follow the same ALM process. But the models differ in the way that they let you manage changes to your org. Controlling change is a significant deal in software development, and you can choose the development model that best suits your situation if you understand your options.

Choosing which model works for you depends on a number of things:

- The complexity of the change.
- The size of the team involved in development and their skill level.
- The metadata you’ll work on.

The choice of Development model determines your path from development to deployment. Each development model had its pros, cons, and limitations. In choosing which option to use for a specific deployment, weigh your objectives, your team’s skills, and limitations in Salesforce. You can use different approaches for different projects, or even blend approaches on a single project.

Salesforce Extensions for VS Code supports Org Development and Package Development models to authorize, create and switch orgs in your project:

- **Org Development Model**: Allows you work with orgs that don’t have source tracking, such as non-source tracked sandboxes, Developer Edition (DE) org, Trailhead Playground, or even a production org to retrieve and deploy code directly.
- **Package Development Model**: Allows you to create self-contained applications or libraries that are deployed to your org as a single package. These packages are typically developed against source-tracked orgs such as scratch orgs and sandboxes. This development model uses org source tracking, source control, and continuous integration and deployment.

Salesforce Extensions for VS Code runs commands against the org that you’ve set as your default org for development.
