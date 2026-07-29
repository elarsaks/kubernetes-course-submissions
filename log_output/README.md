# Exercise 3.3 - To the Gateway

Log Output and Ping-pong are deployed to Google Kubernetes Engine behind a
shared Gateway API load balancer:

- `/` is routed to the `log-output` ClusterIP Service.
- `/pingpong` is routed to the `ping-pong` ClusterIP Service.

The `Gateway` uses GKE's `gke-l7-global-external-managed` GatewayClass. An
`HTTPRoute` attached to it defines the two path-based routing rules. Route
rewriting is intentionally not used in this exercise, so Ping-pong continues
to handle `/pingpong` itself.

The application code is unchanged from exercise 3.2, so the deployment reuses
the existing `3.2.0` container images.

## Deploy to GKE

Configure `kubectl` for the GKE cluster and enable the Gateway API:

```bash
gcloud container clusters get-credentials dwk-cluster --zone=europe-north1-b
gcloud container clusters update dwk-cluster \
  --location=europe-north1-b \
  --gateway-api=standard
```

Apply the application resources:

```bash
kubectl apply -f exercises/manifests/namespace.yaml
kubectl apply -f ping_pong/manifests/postgres.yaml
kubectl rollout status statefulset/postgres -n exercises
kubectl apply -f ping_pong/manifests/deployment.yaml
kubectl apply -f log_output/manifests/configmap.yaml
kubectl apply -f log_output/manifests/deployment.yaml
kubectl rollout status deployment/ping-pong -n exercises
kubectl rollout status deployment/log-output -n exercises
```

If exercise 3.2 is already running in the cluster, remove its Ingress. Then
apply the Gateway and route:

```bash
kubectl delete ingress log-output -n exercises --ignore-not-found
kubectl apply -f exercises/manifests/gateway.yaml
```

Provisioning the external load balancer and making both backends healthy can
take several minutes.

## Verify

Wait until the Gateway is programmed and has an address:

```bash
kubectl get gateway exercise-gateway -n exercises --watch
```

Replace `GATEWAY_IP` with the displayed address:

```bash
curl http://GATEWAY_IP/
curl http://GATEWAY_IP/pingpong
curl http://GATEWAY_IP/pingpong
```

The root path returns the Log Output response. The Ping-pong requests return
successive counter values such as `pong 0` and `pong 1`.

If the Gateway remains unavailable, inspect the Gateway, route, and Services:

```bash
kubectl describe gateway exercise-gateway -n exercises
kubectl describe httproute exercise-route -n exercises
kubectl get pods,services -n exercises
```

## Cleanup

Delete the GKE cluster when it is no longer needed to avoid ongoing charges:

```bash
gcloud container clusters delete dwk-cluster --zone=europe-north1-b
```
