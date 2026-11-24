---
name: snyk
description: Use when a Snyk finding blocks a change or PR, or when asked to diagnose Snyk results. Run the Snyk CLI scan and explain findings by severity.
review: never
review-complexity: medium
---

# Snyk

1. Check CLI availability with `snyk --version`. If unavailable, ask the consumer to install the Snyk CLI, then resume.
2. Run `snyk test --all-projects` from the repository root. If the CLI reports missing authentication, ask the consumer to run `snyk auth`, then rerun the scan.
3. Read the complete scan output. A nonzero exit can mean findings; distinguish findings from execution, configuration, or authentication errors. For multi-project output, account for every project.
4. Report findings in descending severity: Critical, High, Medium, Low, Info. For each, include the project, package and installed version, issue/CVE, direct or transitive status when shown, and fixed version or remediation when available. Preserve Snyk's wording and don't infer missing details. If no findings, say so.
5. If the scan cannot run, give the exact blocker and the command the consumer must run; don't claim a result.

Snyk links shown in GitHub checks or PRs cannot be inspected here. Diagnose those findings only through `snyk test --all-projects`; ask the consumer to provide the CLI output if it isn't available.
