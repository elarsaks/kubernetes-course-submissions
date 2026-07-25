# Exercise 3.2 - Back to Ingress

Log Output and Ping-pong are deployed to Google Kubernetes Engine behind one
Ingress:

- `/` is routed to the `log-output` NodePort Service.
- `/pingpong` is routed to the `ping-pong` NodePort Service.

Both applications return HTTP 200 from `/`, allowing the GKE Ingress health
checks to mark both backends healthy.

## Build and push

From the repository root:

```bash
docker buildx build --platform linux/amd64 \
  -t elarsaks/log-output:3.2.0 --push ./log_output

docker buildx build --platform linux/amd64 \
  -t elarsaks/ping-pong:3.2.0 --push ./ping_pong
```

## Deploy to GKE

Configure `kubectl` for the GKE cluster, then apply the resources:

```bash
gcloud container clusters get-credentials dwk-cluster --zone=europe-north1-b

kubectl apply -f exercises/manifests/namespace.yaml
kubectl apply -f ping_pong/manifests/postgres.yaml
kubectl rollout status statefulset/postgres -n exercises
kubectl apply -f ping_pong/manifests/deployment.yaml
kubectl apply -f log_output/manifests/configmap.yaml
kubectl apply -f log_output/manifests/deployment.yaml
kubectl rollout status deployment/ping-pong -n exercises
kubectl rollout status deployment/log-output -n exercises
```

The Ingress is included in `log_output/manifests/deployment.yaml`. Provisioning
its external address and making both backends healthy can take several minutes.

## Verify

Wait for the Ingress address:

```bash
kubectl get ingress -n exercises --watch
```

Replace `INGRESS_IP` with that address:

```bash
curl http://INGRESS_IP/
curl http://INGRESS_IP/pingpong
curl http://INGRESS_IP/pingpong
```

The root path returns the Log Output response. The Ping-pong requests return
successive counter values such as `pong 0` and `pong 1`.

If the Ingress remains unavailable, inspect its backends and events:

```bash
kubectl describe ingress log-output -n exercises
kubectl get pods,services -n exercises
```

## Cleanup

Delete the GKE cluster when it is no longer needed to avoid ongoing charges:

```bash
gcloud container clusters delete dwk-cluster --zone=europe-north1-b
```
