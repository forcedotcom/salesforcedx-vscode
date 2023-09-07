---
title: Einstein for Developers FAQ
lang: en
---

**What is Einstein for Developers?**

Einstein for Developers is an AI-assisted tooling that is available as an easy-to-install VS Code extension built using Einstein, the secure, custom AI model from Salesforce.

**What data has Einstein for Developers been trained on?**

Einstein for Developers uses Salesforce’s trusted generative AI, CodeGen, to assist you through Salesforce development. CodeGen uses expertise that’s learned from anonymized code patterns.

**Where can I learn more about Einstein for Developers Privacy and Data Protection?**

See [Salesforce’s Trusted AI](https://www.salesforceairesearch.com/trusted-ai).

**Will my code ever be shared outside of my development environment?**

In short, no! Salesforce treats your code as confidential information under your Main Service Agreement (MSA) and doesn't disclose it to other Salesforce customers or anyone outside of Salesforce. Your code and entity schema may be used to improve Einstein for Developers and train CodeGen. Due to the nature of machine learning, Einstein for Developers can generate output that resembles code that was used to train the model.

**I still have some security concerns, what if my code contains proprietary info?**

Before using any code to label or build models, the research team scrubs all personally identifiable information (PII) and secrets info from the code. This information includes names, company names, phone numbers, address, and hard-coded API tokens. The data is encrypted at rest using customer-managed encryption keys. For more information see [Customer-managed encryption keys (CMEK)](https://cloud.google.com/kms/docs/cmek). We also ensure that only Salesforce employees handle your code, and not contractors.
