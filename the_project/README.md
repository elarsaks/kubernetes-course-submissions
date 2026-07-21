# Exercise 2.8 - The Project, Step 11

The Todo backend stores Todos in PostgreSQL instead of application memory. PostgreSQL runs as a one-replica StatefulSet and receives persistent `local-path` storage through a `volumeClaimTemplates` definition.

Database access is configured through Kubernetes resources:

- `project-config` provides `POSTGRES_HOST` and `POSTGRES_PORT`.
- `todo-postgres-secret` provides the database name, username, and password.
- The backend uses parameterized queries when reading and inserting Todos.

The backend creates the `todos` table at startup and inserts the three example Todos only when the table is empty. Todos therefore survive replacement of both the backend Pod and the PostgreSQL Pod.

## Build and deploy

From the repository root:

```bash
docker build -t elarsaks/the-project:2.8.0 ./the_project
docker build -t elarsaks/todo-backend:2.8.0 ./todo_backend
docker push elarsaks/the-project:2.8.0
docker push elarsaks/todo-backend:2.8.0

kubectl apply -f the_project/manifests/namespace.yaml
kubectl apply -f the_project/manifests/configmap.yaml
kubectl apply -f todo_backend/manifests/postgres.yaml
kubectl rollout status statefulset/todo-postgres -n project

kubectl apply -f the_project/manifests/persistentvolume.yaml
kubectl apply -f the_project/manifests/persistentvolumeclaim.yaml
kubectl apply -f todo_backend/manifests/deployment.yaml
kubectl apply -f the_project/manifests/deployment.yaml
kubectl rollout status deployment/todo-backend -n project
kubectl rollout status deployment/the-project -n project
```

Open `http://localhost:8081/` to view and create Todos.

## Verify database persistence

Create a Todo through the UI, then inspect the database:

```bash
kubectl exec -n project todo-postgres-0 -- \
  psql -U todo -d todos -c 'SELECT id, content FROM todos ORDER BY id;'
```

Restart PostgreSQL and confirm that the rows remain:

```bash
kubectl delete pod todo-postgres-0 -n project
kubectl wait --for=condition=Ready pod/todo-postgres-0 -n project --timeout=180s
kubectl exec -n project todo-postgres-0 -- \
  psql -U todo -d todos -c 'SELECT id, content FROM todos ORDER BY id;'
```

Restart the backend and refresh the UI to confirm that its in-memory lifecycle does not affect the Todos:

```bash
kubectl delete pod -n project -l app=todo-backend
kubectl rollout status deployment/todo-backend -n project --timeout=180s
```

## Cleanup

```bash
kubectl delete -f the_project/manifests/deployment.yaml
kubectl delete -f todo_backend/manifests/deployment.yaml
kubectl delete -f todo_backend/manifests/postgres.yaml
kubectl delete -f the_project/manifests/persistentvolumeclaim.yaml
kubectl delete -f the_project/manifests/configmap.yaml
kubectl delete -f the_project/manifests/persistentvolume.yaml
```

Deleting the StatefulSet intentionally leaves its database claim and the `project` namespace behind. Delete them separately only when the Todo data is no longer needed:

```bash
kubectl delete pvc todo-postgres-data-todo-postgres-0 -n project
kubectl delete -f the_project/manifests/namespace.yaml
```
