# Exercise 2.5 - Documentation and ConfigMaps

The Log Output application receives two values from the `log-output-config` ConfigMap:

- `information.txt` is mounted into the `log-server` container as a file.
- `MESSAGE` is passed to the `log-server` container as an environment variable.

The application prints both values before its usual timestamp, UUID, and Ping / Pongs count:

```text
file content: this text is from file
env variable: MESSAGE=hello world
2026-05-18T12:15:17.705Z: 8523ecb1-c716-4cb6-a044-b9e83bb98e43
Ping / Pongs: 3
```

## Build and deploy

From the repository root:

```bash
docker build -t elarsaks/log-output:2.5.0 ./log_output
docker push elarsaks/log-output:2.5.0

kubectl apply -f exercises/manifests/namespace.yaml
kubectl apply -f log_output/manifests/configmap.yaml
kubectl apply -f ping_pong/manifests/deployment.yaml
kubectl apply -f log_output/manifests/deployment.yaml
kubectl rollout status deployment/log-output -n exercises
```

The ConfigMap must be applied before the Deployment because the Pod references it when starting.

## Verify

Open the application through the cluster Ingress:

```bash
curl http://localhost:8081/
```

Inspect the injected configuration directly if needed:

```bash
kubectl exec deployment/log-output -n exercises -c log-server -- \
  cat /usr/src/app/config/information.txt
kubectl exec deployment/log-output -n exercises -c log-server -- \
  printenv MESSAGE
```

## Cleanup

```bash
kubectl delete -f log_output/manifests/deployment.yaml
kubectl delete -f ping_pong/manifests/deployment.yaml
kubectl delete -f log_output/manifests/configmap.yaml
```
