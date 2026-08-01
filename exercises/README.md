# Exercise 4.3 - Prometheus

Prometheus was installed with Helm in the local k3d cluster. The release uses
two Prometheus StatefulSet replicas and one Alertmanager StatefulSet replica,
so the query below returns three StatefulSet-owned Pods in the `prometheus`
namespace.

## Install and access Prometheus

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install prom prometheus-community/prometheus \
  --namespace prometheus \
  --create-namespace \
  --set server.statefulSet.enabled=true \
  --set server.replicaCount=2 \
  --set alertmanager.persistence.enabled=false

kubectl port-forward svc/prom-prometheus-server -n prometheus 9090:80
```

Open [http://localhost:9090](http://localhost:9090) and run:

```promql
count(kube_pod_info{namespace="prometheus",created_by_kind="StatefulSet"})
```

The result is `3`: `prom-alertmanager-0`, `prom-prometheus-server-0`, and
`prom-prometheus-server-1`.

The same query can be verified through the Prometheus API:

```bash
curl -sG --data-urlencode \
  'query=count(kube_pod_info{namespace="prometheus",created_by_kind="StatefulSet"})' \
  http://localhost:9090/api/v1/query
```

## Exercise 2.3 - Keep Them Separated

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
