# Exercise 3.7 - The Project, Step 16

The Todo application is automatically built, published, and deployed to a
separate Google Kubernetes Engine namespace for each branch.

## Application

The root Kustomization deploys the complete project into the namespace chosen
by the workflow:

- Todo frontend
- Todo backend
- PostgreSQL
- Hourly Wikipedia Todo generator
- Persistent image and database storage
- Service and Ingress resources

The persistent volume claims use GKE's `standard-rwo` storage class. The
frontend Deployment uses the `Recreate` strategy so two Pods do not compete
for its `ReadWriteOnce` image-cache volume during an update.

## Deployment pipeline

The GitHub Actions workflow in `.github/workflows/main.yaml`:

1. Authenticates to Google Cloud through Workload Identity Federation.
2. Builds the frontend, backend, and generator images.
3. Pushes commit-tagged images to the `kubernetes-course` Artifact Registry
   repository.
4. Replaces the Kustomize image mappings with the published image names.
5. Creates a namespace for the branch and sets it as the Kustomize namespace.
6. Applies the complete project to `dwk-cluster`.
7. Waits for PostgreSQL, backend, and frontend rollouts to complete.

Image tags contain the branch name and commit SHA, making every deployment
traceable to its source commit.

The `master` branch is always deployed to the `project` namespace. Other
branches use a sanitized version of their branch name as the namespace, for
example `feature/demo` becomes `feature-demo`.

The workflow uses the GitHub environment `GKE_PROJECT` with these environment
secrets:

- `GKE_PROJECT`
- `SERVICE_ACCOUNT`
- `WORKLOAD_IDENTITY_PROVIDER`

The CI service account can write to the course's Artifact Registry repository
and deploy to the GKE cluster.

## Manual deployment

Configure `kubectl`, inspect the rendered resources, and apply them from the
repository root:

```bash
gcloud container clusters get-credentials dwk-cluster \
  --project=dwk-gke-503313 \
  --zone=europe-north1-b

kubectl kustomize .
kubectl create namespace project --dry-run=client --output=yaml | kubectl apply -f -
kubectl apply -k .
```

Verify the deployment:

```bash
kubectl rollout status statefulset/todo-postgres -n project --timeout=10m
kubectl rollout status deployment/todo-backend -n project --timeout=10m
kubectl rollout status deployment/the-project -n project --timeout=10m
kubectl get pods,pvc,svc,ingress -n project
```

When the Ingress has an external address, test the application:

```bash
PROJECT_IP="$(kubectl get ingress the-project \
  -n project \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"

curl -i "http://${PROJECT_IP}/"
```

A successful deployment returns `HTTP/1.1 200 OK` and the Todo application
HTML.
