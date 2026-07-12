# Exercise 2.1 - Connecting Pods

Minimal Node.js HTTP server for DevOps with Kubernetes exercise 2.1. The request count is kept in memory and exposed over HTTP for the Log output application.

## Behavior

`GET /pingpong` returns the current count and then increments it:

```text
pong 0
```

The Log output application reaches this endpoint through the `ping-pong` ClusterIP Service.

## Build

```bash
docker build -t elarsaks/ping-pong:1.11.1 .
```

If using k3d:

```bash
k3d image import elarsaks/ping-pong:1.11.1 -c k3s-default
```

## Deploy

Apply the ping-pong deployment and the Log Output manifest that owns the shared Ingress:

```bash
kubectl apply -f storage/manifests/persistentvolume.yaml
kubectl apply -f storage/manifests/persistentvolumeclaim.yaml
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
