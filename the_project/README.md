# Exercise 3.11 - The Project, Step 19

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

## Branch cleanup

The `.github/workflows/delete-environment.yaml` workflow listens for deleted
branches. It ignores tag deletions and `master`, derives the same namespace
name used by the deployment workflow, and deletes that namespace from GKE.

Deleting a branch therefore removes its Deployments, Services, Ingress, and
persistent volume claims with the namespace.

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

## DBaaS vs DIY PostgreSQL

The current project uses a DIY PostgreSQL deployment: a one-replica
`StatefulSet` with a `ReadWriteOnce` persistent volume claim. A reasonable
DBaaS alternative on GCP would be Cloud SQL for PostgreSQL.

| Area | DIY PostgreSQL in GKE | DBaaS (Cloud SQL) |
| --- | --- | --- |
| Initialization | Apply the StatefulSet, Service, Secret, and PVC manifests. This is quick and fits naturally into the existing Kustomize deployment, but storage, credentials, readiness, and upgrade decisions are ours. | Create a Cloud SQL instance, database, user, network/private-IP connectivity, and Kubernetes Secret. This usually takes more initial configuration and the instance may take longer to provision, but the database server is then ready without running a database Pod. |
| Cost | There is no separate database service fee. We pay for the GKE node capacity and persistent disk, including capacity reserved for this workload. A small development database can share an existing node cheaply. | We pay for a dedicated Cloud SQL instance, storage, backups, and network egress where applicable. The minimum continuously running instance can cost more than a small DIY database, although it can be stopped or scaled for non-production use depending on the availability requirements. |
| Maintenance | We handle PostgreSQL image updates, vulnerability patches, resource sizing, disk expansion, monitoring, failed-Pod recovery, and high availability. One replica is a single point of failure, and deleting the PVC can lose the data. | Google handles the database host, PostgreSQL maintenance options, automated failover features, and much of the monitoring and infrastructure work. We still manage schema migrations, users, application compatibility, costs, and the chosen availability tier. |
| Backups and restore | We must arrange them, for example with scheduled `pg_dump` exports to durable object storage plus tested restore procedures, or carefully coordinated volume snapshots. Scheduling, retention, encryption, consistency, and recovery testing are all our responsibility. | Cloud SQL provides configurable automated backups, on-demand backups, and point-in-time recovery when enabled. Creating a restored instance is easier and more repeatable, but retention and recovery still need to be configured, tested, and paid for. Backups should be kept independently when protection from account or region-wide failures is required. |
| Scaling and availability | Scaling storage or replicas requires Kubernetes and PostgreSQL expertise. A single Pod is simple but does not provide seamless failover. | Vertical scaling, regional availability, and replicas are supported service features, with extra cost and some operational constraints. The service reduces database operations work but adds provider dependence and network configuration. |

For this course project and its small workload, DIY PostgreSQL is the simpler and
cheaper way to get started because the GKE cluster and deployment pipeline
already exist. It is also useful for learning StatefulSets and persistent
storage. For a production application where the data is valuable, the
maintenance and recovery burden would usually make DBaaS preferable: the
ongoing service cost buys managed patching and much easier backups, point-in-
time recovery, and failover. I would choose DBaaS unless minimizing the monthly
bill or retaining full control of the database infrastructure was more
important than reducing operational risk.

## PostgreSQL backups

The root Kustomization includes the `todo-postgres-backup` CronJob. It runs
once every 24 hours at midnight UTC, uses `pg_dump --format=custom`, and
uploads the dump to the `todo/` prefix in a Google Cloud Storage bucket. The
backup image contains both the PostgreSQL client and the Google Cloud CLI.

The bucket name and service-account key are intentionally supplied at runtime.
Create the bucket and a service account with the minimum upload and download
permissions, then create the Kubernetes secrets in the namespace where the
project is deployed. Do not commit the key file or the generated Secret:

```bash
kubectl create secret generic storage-sa-key \
  --namespace project \
  --from-file=key.json=key.json

kubectl create secret generic storage-backup-config \
  --namespace project \
  --from-literal=bucket=my-todo-backups
```

For a branch environment, replace `project` with that branch's namespace.
The service-account key is mounted read-only and is used through
`GOOGLE_APPLICATION_CREDENTIALS`. The CronJob has `concurrencyPolicy: Forbid`
so a slow backup cannot overlap the next scheduled backup. It retains the
last three successful and failed Jobs for troubleshooting.

After creating the secrets, verify the schedule and run a one-off test:

```bash
kubectl get cronjob todo-postgres-backup -n project
kubectl create job --from=cronjob/todo-postgres-backup todo-postgres-backup-test -n project
kubectl logs -n project -l job-name=todo-postgres-backup-test --follow
```

The service account should have only the permissions required for the bucket,
such as `roles/storage.objectCreator` and `roles/storage.objectViewer`. A
service-account key is less safe than GKE Workload Identity, so Workload
Identity is preferable for a production deployment.

## Resource requests and limits

The project now sets CPU and memory requests and limits for every application
container. Requests are the resources Kubernetes reserves for scheduling;
limits cap how much a container may consume. The values are intentionally
small because the current workload is small, but the limits leave room for
short CPU or memory spikes:

| Workload | CPU request / limit | Memory request / limit |
| --- | --- | --- |
| Frontend | 10m / 250m | 32Mi / 128Mi |
| Todo backend | 10m / 250m | 32Mi / 128Mi |
| PostgreSQL | 50m / 500m | 64Mi / 256Mi |
| Backend PostgreSQL init container | 5m / 50m | 16Mi / 32Mi |
| Wikipedia generator | 10m / 250m | 32Mi / 128Mi |
| Database backup | 25m / 500m | 64Mi / 256Mi |

The initial values were chosen after checking the running Pods with
`kubectl top pods`. The observed steady-state usage was approximately 1--22m
CPU and 28--44Mi memory, so the requests cover normal usage while the limits
allow the database and batch jobs to handle brief spikes. They should be
revisited after observing the application under realistic traffic.
