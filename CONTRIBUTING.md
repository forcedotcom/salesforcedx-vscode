## Contributing

1. Familiarize yourself with the codebase by reading the [docs](https://developer.salesforce.com/tools/vscode) and the [development](contributing/developing.md) doc.
1. Create a new discussion before starting your project so that we are aware of what you are trying to add/fix. On that discussion, we will give you the approval to proceed if your suggestion fits in our roadmap, offer suggestions, or let you know if there is already an effort in progress.
1. Fork this repository.
1. The [README](README.md) has details on how to set up your environment.
1. Optional: Create a _topic_ branch in your fork based on the correct branch (usually the **develop** branch). Note, this step is recommended but technically not required if contributing using a fork.
1. Edit the code in your fork.
1. Sign the CLA (see [CLA](#cla) below)
1. Send us a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in. We will only accept and review pull requests that contain unit tests.
1. Please provide us with a one-pager with your pull request to help us understand your code. In the one-pager, explain what the change is, why it is necessary, and how you made the change. The one-pager should include a test plan so we can get an idea of how you have tested your code changes. We would also greatly appreciate a short demo video of the expected behavior of your feature.

### Committing

1. We enforce commit message format. We recommend using [commitizen](https://github.com/commitizen/cz-cli) by installing it with `npm install -g commitizen` and running `npm run commit-init`. When you commit, we recommend that you use `npm run commit`, which prompts you with a series of questions to format the commit message. Or you can use our VS Code Task `Commit`.
1. The commit message format that we expect is: `type: commit message`. Valid types are: feat, fix, improvement, docs, style, refactor, perf, test, build, ci, chore and revert.
1. Before commit and push, Husky runs several hooks to ensure the commit message is in the correct format and that everything lints and compiles properly.

### CLA

External contributors will be required to sign a Contributor's License
Agreement. You can do so by going to https://cla.salesforce.com/sign-cla.

## Pull Requests

- Develop features and bug fixes in your fork of the repository.
- When you are done, create a pull request for us to review.
- When we review your pull request, we will create a feature branch from your code to trigger the required checks and keep the feature branch updated with your fork.

### Merging Pull Requests

- Pull request merging is restricted to squash & merge only.
