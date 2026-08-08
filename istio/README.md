# Exercise 5.2 - Getting Started with Istio Service Mesh

This exercise installs Istio 1.30.3 in ambient mode on a local k3d cluster,
deploys the Bookinfo sample application, and visualizes its service traffic with
Prometheus and Kiali.

## Reproduce the exercise

From the repository root, run:

```bash
make -C istio setup
make -C istio verify
```

`setup` creates the cluster and installs the pinned Istio, Gateway API,
Bookinfo, Prometheus, and Kiali versions. It can be run again against the same
cluster. `verify` checks rollout health, generates Bookinfo traffic, and asserts
that Prometheus and Kiali received ambient mesh telemetry.

The required local tools are Docker, k3d, kubectl, curl, tar, and jq. The
sections below explain the commands executed by the automation.

## Create the k3d cluster

Istio's ingress gateway conflicts with k3d's default Traefik installation, so
Traefik is disabled when the cluster is created.

```bash
k3d cluster create dwk-exercise-5-2 \
  --api-port 6550 \
  -p '9080:80@loadbalancer' \
  -p '9443:443@loadbalancer' \
  --agents 2 \
  --k3s-arg '--disable=traefik@server:*'
```

## Install Istio ambient mode

Download Istio and add `istioctl` to the current shell:

```bash
curl -L https://istio.io/downloadIstio | ISTIO_VERSION=1.30.3 sh -
cd istio-1.30.3
export PATH="$PWD/bin:$PATH"
```

Install the ambient profile with the k3d platform settings. k3s 1.35 searches
for executable CNI plugins in `/var/lib/rancher/k3s/data/cni`, so that path is
set explicitly.

```bash
istioctl install \
  --set profile=ambient \
  --set values.global.platform=k3d \
  --set values.cni.cniBinDir=/var/lib/rancher/k3s/data/cni \
  --skip-confirmation
```

Install the Kubernetes Gateway API CRDs:

```bash
kubectl apply --server-side -f \
  https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.1/experimental-install.yaml
```

## Deploy Bookinfo

Run these commands from the downloaded Istio directory:

```bash
kubectl apply -f samples/bookinfo/platform/kube/bookinfo.yaml
kubectl apply -f samples/bookinfo/platform/kube/bookinfo-versions.yaml
kubectl apply -f samples/bookinfo/gateway-api/bookinfo-gateway.yaml

kubectl annotate gateway bookinfo-gateway \
  networking.istio.io/service-type=ClusterIP \
  --namespace=default

kubectl label namespace default istio.io/dataplane-mode=ambient
```

The namespace label enrolls Bookinfo in the ambient data plane without adding
sidecars or restarting its workloads.

## Install observability tools

```bash
kubectl apply -f samples/addons/prometheus.yaml
kubectl apply -f samples/addons/kiali.yaml

kubectl rollout status deployment/prometheus -n istio-system
kubectl rollout status deployment/kiali -n istio-system
```

The Istio Prometheus sample is available at
`http://prometheus.istio-system:9090`, which the bundled Kiali configuration
uses automatically.

## Generate and inspect traffic

Forward the Bookinfo gateway and Kiali in separate terminals:

```bash
kubectl port-forward service/bookinfo-gateway-istio 8080:80
kubectl port-forward service/kiali -n istio-system 20001:20001
```

Generate traffic:

```bash
for i in {1..200}; do
  curl -s -o /dev/null http://localhost:8080/productpage
done
```

Open the application at <http://localhost:8080/productpage> and the Kiali graph
at <http://localhost:20001/kiali/>. Select the `default` namespace in Kiali.

## Verification

The local test confirmed:

- Istio control plane, CNI, and one `ztunnel` Pod per node were ready.
- The Bookinfo Gateway reported `PROGRAMMED=True`.
- All seven Bookinfo and gateway Pods were ready.
- `/productpage` returned HTTP 200.
- Prometheus recorded ambient TCP traffic between the gateway, product page,
  details, reviews, and ratings workloads.
- Kiali's workload graph contained 20 nodes and 14 traffic edges after 200
  requests.

Useful status commands:

```bash
kubectl get pods -n istio-system
kubectl get pods -n default
kubectl get gateway bookinfo-gateway
kubectl get namespace default --show-labels
```

Official references:

- <https://istio.io/latest/docs/ambient/getting-started/>
- <https://istio.io/latest/docs/ambient/install/platform-prerequisites/#k3d>
- <https://istio.io/latest/docs/ambient/getting-started/deploy-sample-app/>
- <https://istio.io/latest/docs/ambient/getting-started/secure-and-visualize/>
