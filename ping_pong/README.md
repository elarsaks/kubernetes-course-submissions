# Exercise 1.9 - Ping Pong Application

Minimal Node.js HTTP server for DevOps with Kubernetes exercise 1.9.

## Behavior

`GET /pingpong` returns:

```text
pong 0
```

The number is an in-memory counter. Each successful request returns the current value and then increments it.

## Build

```bash
docker build -t elarsaks/ping-pong:1.9.0 .
```

If using k3d:

```bash
k3d image import elarsaks/ping-pong:1.9.0 -c k3s-default
```

## Deploy

Apply the ping-pong deployment and the Log Output manifest that owns the shared Ingress:

```bash
kubectl apply -f ping_pong/manifests/deployment.yaml
kubectl apply -f log_output/manifests/deployment.yaml
```

## Test

If your k3d cluster does not expose the Ingress controller yet, add a local port mapping:

```bash
k3d cluster edit k3s-default --port-add 8081:80@loadbalancer
```

Open:

```text
http://localhost:8081/pingpong
```

The response should increment on each request:

```text
pong 0
pong 1
pong 2
```
