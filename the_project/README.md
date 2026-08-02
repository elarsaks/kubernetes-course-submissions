# Exercise 4.9 - The Project, Step 25

The complete Todo project has separate staging and production GitOps
environments managed by ArgoCD.

## Environments

The reusable Kustomize base is in `project/base`. Its overlays deploy to:

- `project-staging`: every commit to `master` builds multi-platform images and
  opens an automated PR updating the staging image tags. Staging's broadcaster
  logs NATS messages locally and does not need `BROADCAST_URL`. It has no
  database-backup CronJob.
- `project-production`: every Git tag builds multi-platform images and opens an
  automated PR updating the production image tags. Production forwards Todo
  events to the Generic webhook and includes the database-backup CronJob.

The two ArgoCD Applications are declarative manifests in `argocd/`:

```bash
kubectl apply -f argocd/project-staging-application.yaml
kubectl apply -f argocd/project-production-application.yaml
kubectl get applications -n argocd
```

## Secrets and local dependencies

Secrets are intentionally not stored in Git. Before syncing each environment,
apply its `todo-postgres-secret`; apply `broadcaster-secret` only in
`project-production`, with a `BROADCAST_URL` for the Generic service. Install
NATS in the shared `nats` namespace:

```bash
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm repo update
helm upgrade --install my-nats nats/nats --namespace nats --create-namespace
```

The local k3d cluster provides the `local-path` storage class used by the
project's PostgreSQL and image-cache PVCs.

## Verification

```bash
kustomize build project/overlays/staging
kustomize build project/overlays/production
kubectl get all -n project-staging
kubectl get all -n project-production
kubectl get cronjob -n project-staging   # no backup CronJob
kubectl get cronjob -n project-production # includes todo-postgres-backup
kubectl logs deployment/todo-broadcaster -n project-staging
```

The staging broadcaster logs messages beginning with `Received` and never
performs an external HTTP request. Production uses the `BROADCAST_URL` secret
to forward events.

GitHub Actions uses Docker Hub repository secrets and protected-branch-safe
automated PRs. Image tags are commit SHAs for staging and Git tag names for
production, so every deployed image is immutable and supports both
`linux/amd64` and `linux/arm64`.
