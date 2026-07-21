# Exercise 2.7 - Stateful Applications

The Ping-pong application stores its counter in PostgreSQL. PostgreSQL runs as a one-replica StatefulSet and receives a dedicated, dynamically provisioned `local-path` PersistentVolumeClaim from its `volumeClaimTemplates` definition.

Each `GET /pingpong` request atomically increments the database counter and returns its previous value:

```text
pong 0
pong 1
pong 2
```

The database-backed update prevents concurrent requests from losing increments. The counter survives replacement of both the Ping-pong Pod and the PostgreSQL Pod.

## Build and deploy

From the repository root:

```bash
docker build -t elarsaks/ping-pong:2.7.0 ./ping_pong
docker push elarsaks/ping-pong:2.7.0

kubectl apply -f exercises/manifests/namespace.yaml
kubectl apply -f ping_pong/manifests/postgres.yaml
kubectl rollout status statefulset/postgres -n exercises
kubectl apply -f ping_pong/manifests/deployment.yaml
kubectl apply -f log_output/manifests/configmap.yaml
kubectl apply -f log_output/manifests/deployment.yaml
kubectl rollout status deployment/ping-pong -n exercises
```

The PostgreSQL Service is headless, giving the StatefulSet Pod a stable network identity. An init container keeps Ping-pong from starting until PostgreSQL accepts connections; the application also retries its initial database setup.

## Verify

Call the application through the existing Ingress:

```bash
curl http://localhost:8081/pingpong
curl http://localhost:8081/pingpong
curl http://localhost:8081/pingpong
```

Inspect the stored value directly:

```bash
kubectl exec -n exercises postgres-0 -- \
  psql -U pingpong -d pingpong -c 'SELECT counter FROM ping_pong_counter;'
```

Delete PostgreSQL and confirm that the StatefulSet recreates it with the same claim and counter:

```bash
kubectl delete pod postgres-0 -n exercises
kubectl rollout status statefulset/postgres -n exercises
curl http://localhost:8081/pingpong
kubectl get pvc -n exercises
```

## Cleanup

```bash
kubectl delete -f log_output/manifests/deployment.yaml
kubectl delete -f ping_pong/manifests/deployment.yaml
kubectl delete -f ping_pong/manifests/postgres.yaml
```

Deleting the StatefulSet intentionally leaves `postgres-data-postgres-0` behind. Delete that claim separately only when the counter data is no longer needed:

```bash
kubectl delete pvc postgres-data-postgres-0 -n exercises
```
