# Exercise 4.1 - Readiness Probe

The Log Output deployment uses a readiness probe on `/status`. The endpoint
checks that the log files are available and successfully receives a response
from Ping-pong, so Log Output is not added to its Service until its dependency
is ready.

Ping-pong uses a readiness probe on `/readyz`. That endpoint runs `SELECT 1`
against PostgreSQL and returns HTTP 200 only when the database connection is
available. Without the database, Ping-pong stays unready and Log Output also
stays unready because it cannot receive a Ping-pong response.

To observe the dependency-aware readiness states, apply the namespace and
application resources without PostgreSQL:

```bash
kubectl apply -f exercises/manifests/namespace.yaml
kubectl apply -f ping_pong/manifests/deployment.yaml
kubectl apply -f log_output/manifests/configmap.yaml
kubectl apply -f log_output/manifests/deployment.yaml
kubectl get pods -n exercises
```

The Ping-pong pod remains `0/1`, and the Log Output pod remains unready because
its `/status` probe cannot receive data from Ping-pong. Applying
`ping_pong/manifests/postgres.yaml` makes the database available; the probes
then pass automatically and the pods become `1/1` and `2/2` respectively.

## Exercise 3.4 - Rewritten Routing

Log Output and Ping-pong are deployed to Google Kubernetes Engine behind a
shared Gateway API load balancer:

- `/` is routed unchanged to the `log-output` ClusterIP Service.
- `/pingpong` is rewritten to `/` and routed to the `ping-pong` ClusterIP
  Service.

Ping-pong no longer needs to know its cluster-level public path. It exposes its
counter at `/`, while the `HTTPRoute` owns the external `/pingpong` path and
rewrites the request before proxying it upstream.

Log Output also calls Ping-pong at its internal root URL,
`http://ping-pong:3000/`.

## Build and push

Only Ping-pong application code changed for this exercise. From the repository
root:

```bash
docker buildx build --platform linux/amd64 \
  -t elarsaks/ping-pong:3.4.0 --push ./ping_pong
```

The Log Output deployment continues to use the unchanged
`elarsaks/log-output:3.2.0` image.

## Deploy to GKE

Configure `kubectl` for the GKE cluster and confirm that Gateway API is
enabled:

```bash
gcloud container clusters get-credentials dwk-cluster --zone=europe-north1-b
kubectl get gatewayclass gke-l7-global-external-managed
```

Apply the updated resources:

```bash
kubectl apply -f exercises/manifests/namespace.yaml
kubectl apply -f ping_pong/manifests/postgres.yaml
kubectl apply -f ping_pong/manifests/deployment.yaml
kubectl apply -f log_output/manifests/configmap.yaml
kubectl apply -f log_output/manifests/deployment.yaml
kubectl apply -f exercises/manifests/gateway.yaml

kubectl rollout status statefulset/postgres -n exercises
kubectl rollout status deployment/ping-pong -n exercises
kubectl rollout status deployment/log-output -n exercises
```

## Verify

Wait until the Gateway and updated route are reconciled:

```bash
kubectl wait \
  --for=condition=Programmed \
  gateway/exercise-gateway \
  -n exercises \
  --timeout=20m

kubectl describe httproute exercise-route -n exercises
```

Get the external address and test both public routes:

```bash
GATEWAY_IP="$(kubectl get gateway exercise-gateway \
  -n exercises \
  -o jsonpath='{.status.addresses[0].value}')"

curl "http://${GATEWAY_IP}/"
curl "http://${GATEWAY_IP}/pingpong"
curl "http://${GATEWAY_IP}/pingpong"
```

The root path returns the Log Output response. The Ping-pong requests return
successive counter values.

Verify directly inside the cluster that Ping-pong serves its counter at `/`
and no longer exposes `/pingpong`:

```bash
kubectl exec deployment/log-output -n exercises -c log-server -- \
  node -e 'fetch("http://ping-pong:3000/").then(async r => console.log(r.status, await r.text()))'

kubectl exec deployment/log-output -n exercises -c log-server -- \
  node -e 'fetch("http://ping-pong:3000/pingpong").then(async r => console.log(r.status, await r.text()))'
```

The first command returns HTTP 200 with `pong N`; the second returns HTTP 404.

## Cleanup

Delete the GKE cluster when it is no longer needed to avoid ongoing charges:

```bash
gcloud container clusters delete dwk-cluster --zone=europe-north1-b
```
