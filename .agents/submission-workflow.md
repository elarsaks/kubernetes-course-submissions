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
<exercise-number> <exercise title>
```

Accepted title forms include:

```text
<exercise-number> Exercise title
Exercise <exercise-number> Exercise title
<exercise-number>: Exercise title
<exercise-number> - Exercise title
```

When the title matches, the workflow publishes:

- branch `<exercise-number>`
- tag `<exercise-number>`
- GitHub Release `<exercise-number>`

The course submission URL should point to the generated release or exercise branch, depending on what the exercise asks for.

## Future Session Checklist

1. Start from updated `master`.
2. Create a feature branch with a neutral name.
3. Make only the exercise changes needed for the current task.
4. Keep app-level docs and the root `README.md` in sync.
5. Commit with a neutral message.
6. Open a PR whose title starts with the exercise number when a release should be generated.
7. After merging, confirm the release workflow completed and use the generated URL for submission.

## Project App Shape

The Project exercises use `the_project/`.

The app is a minimal Node.js HTTP server in `the_project/app/index.js`. Keep the image tag, Kubernetes manifest, app README, and root README aligned with the current exercise.

Expected behavior:

```text
Application <startup-random-hash>. Request <request-random-hash>
```

The Kubernetes manifest should deploy the current exercise image, expose container port `3000`, and use the Service type required by the exercise instructions.
