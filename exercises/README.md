# Exercise 2.3 - Keep Them Separated

The `exercises` namespace contains the Log output and Ping-pong applications. Apply the namespace before their manifests:

```bash
kubectl apply -f exercises/manifests/namespace.yaml
kubectl apply -f ping_pong/manifests/deployment.yaml
kubectl apply -f log_output/manifests/deployment.yaml
```

Inspect exercise resources with:

```bash
kubectl get all -n exercises
```
