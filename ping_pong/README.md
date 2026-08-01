# Exercise 4.4 - Your canary

## Answer

The Ping-pong canary uses the `ping-pong-cpu` `AnalysisTemplate` in
`manifests/analysis-template.yaml`. Its Prometheus query sums the 5-minute
CPU usage rate of every non-empty container in the `exercises` namespace:

```promql
sum(rate(container_cpu_usage_seconds_total{
  namespace="exercises", container!="", container!="POD"
}[5m]))
```

The analysis runs once per minute for five measurements. A result above
`0.5` CPU cores fails the analysis, so an Argo Rollouts canary that references
this template is aborted and the stable Ping-pong version remains active.
The threshold is intentionally above the normal idle usage of the exercise
namespace, so a normal update is not rejected. To verify the rollback path,
temporarily change the threshold to a value below the current query result;
the first failing measurement aborts the canary before it is promoted.

Apply the template after Prometheus and the `exercises` namespace are ready:

```bash
kubectl apply -f ping_pong/manifests/analysis-template.yaml
kubectl apply -f ping_pong/manifests/postgres.yaml
kubectl delete deployment ping-pong -n exercises --ignore-not-found
kubectl apply -f ping_pong/manifests/deployment.yaml
kubectl get analysistemplate ping-pong-cpu -n exercises
kubectl get rollout ping-pong -n exercises
```

The delete is a one-time migration step because Kubernetes treats a
`Deployment` and a `Rollout` as different resource kinds even when they have
the same name.

The Ping-pong workload is an Argo Rollouts `Rollout` with two replicas. During
an update, one replica is assigned to the canary, then the CPU analysis runs.
If the analysis fails, Argo Rollouts aborts the update and scales the stable
ReplicaSet back to the desired replica count.

## Application and routing notes

The Ping-pong application exposes its counter at `/` and has no knowledge of
the public `/pingpong` path. The shared Gateway API `HTTPRoute` matches
`/pingpong`, rewrites the upstream path to `/`, and sends the request to the
`ping-pong` ClusterIP Service.

Each request atomically increments the counter stored in PostgreSQL.

## Build and push

From the repository root:

```bash
docker buildx build --platform linux/amd64 \
  -t elarsaks/ping-pong:3.4.0 --push ./ping_pong
```

## Deploy

The complete GKE and Gateway API deployment steps are documented in
`log_output/README.md` because Log Output, Ping-pong, PostgreSQL, the Gateway,
and the shared HTTPRoute are deployed together.

## Verify

Externally, replace `GATEWAY_IP` with the address shown by
`kubectl get gateway`:

```bash
curl "http://${GATEWAY_IP}/pingpong"
curl "http://${GATEWAY_IP}/pingpong"
```

The Gateway rewrites both requests to `/` before forwarding them to Ping-pong.
The responses contain increasing counter values, for example:

```text
pong 12
pong 13
```

The exact values depend on the counter already stored in PostgreSQL.

Inside the cluster, Ping-pong responds at its application-level root path:

```bash
kubectl exec deployment/log-output -n exercises -c log-server -- \
  node -e 'fetch("http://ping-pong:3000/").then(async r => console.log(r.status, await r.text()))'
```
