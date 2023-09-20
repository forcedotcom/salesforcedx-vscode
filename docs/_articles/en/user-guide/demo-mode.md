---
title: Activate Demo Mode
lang: en
---

If you’re setting up a machine to use for demos at a conference (or for other public use), set up demo mode. When in demo mode, VS Code warns users who authorize business or production orgs of the potential security risks of using these orgs on shared machines.

To activate demo mode, add an environment variable called `SFDX_ENV` and set its value to `DEMO`: `SFDX_ENV=DEMO`.

When you’re done with your event, run **SFDX: Log Out from All Authorized Orgs**.
