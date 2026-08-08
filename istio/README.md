# Exercise 5.2 - Getting Started with Istio Service Mesh

This exercise installs Istio 1.30.3 in ambient mode on a local k3d cluster,
deploys the Bookinfo sample application, visualizes its service traffic with
Prometheus and Kiali, enforces authorization policies, and manages traffic with
an Istio waypoint.

## Reproduce the exercise

From the repository root, run:

```bash
make -C istio setup
make -C istio verify
```

`setup` creates the cluster and installs the pinned Istio, Gateway API,
Bookinfo, Prometheus, Kiali, a waypoint, authorization policies, and an
`HTTPRoute`. It can be run again against the same cluster. `verify` checks the
authorization behavior, traffic split, rollout health, and ambient telemetry.

The required local tools are Docker, k3d, kubectl, curl, tar, and jq. The
sections below explain the commands executed by the automation.

## Create the k3d cluster

Istio's ingress gateway conflicts with k3d's default Traefik installation, so
Traefik is disabled when the cluster is created.

```bash
k3d cluster create dwk-exercise-5-2 \
  --image rancher/k3s:v1.35.5-k3s1 \
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

The exercise note's `http://prom-prometheus-server.monitoring:80` URL applies
when Prometheus was installed with the `prom` Helm release in the `monitoring`
namespace. This reproduction instead follows Istio's sample-app guide and uses
the bundled Prometheus and Kiali manifests, so no Kiali URL override is needed.

## Enforce authorization policies

The setup first applies
[`productpage-gateway-only.yaml`](manifests/productpage-gateway-only.yaml). This
L4 policy allows only the Bookinfo gateway service account to reach
`productpage`, and a request from the separately deployed `curl` service account
is verified to fail.

It then enrolls the namespace with a waypoint and applies
[`productpage-authorization.yaml`](manifests/productpage-authorization.yaml).
The final policies allow the waypoint through the ztunnel and allow only `GET`
requests from the `curl` service account at L7.

```bash
istioctl waypoint apply --enroll-namespace --wait
kubectl apply -f istio/manifests/productpage-authorization.yaml
```

Verification proves that `curl` can perform `GET`, while its `DELETE` request
and a request from the `reviews-v1` service account return
`RBAC: access denied`.

## Manage traffic

[`reviews-route.yaml`](manifests/reviews-route.yaml) attaches an `HTTPRoute` to
the `reviews` Service and sends 90% of requests to `reviews-v1` and 10% to
`reviews-v2`.

```bash
kubectl apply -f istio/manifests/reviews-route.yaml
```

The verification script sends 100 in-mesh requests and requires both versions
to be observed, with more responses from v1 than v2.

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
- The ztunnel policy denied direct access from an untrusted service account.
- The waypoint allowed `GET` from `curl` and denied its `DELETE` request.
- The waypoint denied access from the `reviews-v1` service account.
- The reviews route produced the expected predominantly-v1 traffic pattern.

Useful status commands:

```bash
kubectl get pods -n istio-system
kubectl get pods -n default
kubectl get gateway bookinfo-gateway
kubectl get gateway waypoint
kubectl get authorizationpolicy
kubectl get httproute reviews
kubectl get namespace default --show-labels
```

## Clean up

The exercise state is intentionally left running so it can be inspected and
graded. Afterward, delete the dedicated local cluster and all of its resources:

```bash
make -C istio cleanup
```

Official references:

- <https://istio.io/latest/docs/ambient/getting-started/>
- <https://istio.io/latest/docs/ambient/install/platform-prerequisites/#k3d>
- <https://istio.io/latest/docs/ambient/getting-started/deploy-sample-app/>
- <https://istio.io/latest/docs/ambient/getting-started/secure-and-visualize/>
- <https://istio.io/latest/docs/ambient/getting-started/enforce-auth-policies/>
- <https://istio.io/latest/docs/ambient/getting-started/manage-traffic/>
- <https://istio.io/latest/docs/ambient/getting-started/cleanup/>
