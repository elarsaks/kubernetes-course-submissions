# Submission Workflow Notes

This repository is used for DevOps with Kubernetes course submissions.

## Repository Layout

- `log_output/` contains the Log Output exercise app.
- `the_project/` contains The Project exercise app.
- Each app should keep its own `README.md`, `Dockerfile`, source files, and Kubernetes manifests.
- The root `README.md` should list every completed exercise and link to the matching released exercise branch.

## Release Workflow

`.github/workflows/release.yml` publishes submissions after pull requests are merged into `master`.

The workflow only creates an exercise release when the merged PR title starts with an exercise number:

```text
1.5 The Project: Kubernetes Port Forward
```

Accepted title forms include:

```text
1.5 Exercise title
Exercise 1.5 Exercise title
1.5: Exercise title
1.5 - Exercise title
```

When the title matches, the workflow publishes:

- branch `1.5`
- tag `1.5`
- GitHub Release `1.5`

The course submission URL should point to the generated release or exercise branch, depending on what the exercise asks for.

## Future Session Checklist

1. Start from updated `master`.
2. Create a feature branch with a neutral name.
3. Make only the exercise changes needed for the current task.
4. Keep app-level docs and the root `README.md` in sync.
5. Commit with a neutral message.
6. Open a PR whose title starts with the exercise number when a release should be generated.
7. After merging, confirm the release workflow completed and use the generated URL for submission.

## Current Exercise 1.5 Shape

Exercise 1.5 uses `the_project/`.

The app is a minimal Node.js HTTP server in `the_project/app/index.js`.

Expected behavior:

```text
Application <startup-random-hash>. Request <request-random-hash>
```

The Kubernetes manifest deploys `elarsaks/the-project:1.5.0` and exposes container port `3000`.
