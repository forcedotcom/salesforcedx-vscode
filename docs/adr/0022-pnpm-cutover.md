# Package management: pnpm

The monorepo uses pnpm for dependency installation, workspace commands, and lockfile generation, while Wireit remains the task orchestrator. pnpm keeps its default strict dependency isolation with no hoisting compatibility mode so package manifests must declare what they use; the pinned `packageManager`, single `pnpm-lock.yaml`, and frozen CI installs keep dependency resolution consistent.
