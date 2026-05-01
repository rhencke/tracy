# Branch protection rules for main

This repository uses GitHub branch protection rules to ensure the stability and security of the `main` branch. The following protections are enforced:

- Require pull request reviews before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Restrict who can push to the branch (if applicable)

These rules help maintain code quality and prevent accidental changes to the main production branch.
