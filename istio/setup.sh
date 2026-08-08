#!/usr/bin/env bash

set -euo pipefail

ISTIO_VERSION="${ISTIO_VERSION:-1.30.3}"
GATEWAY_API_VERSION="${GATEWAY_API_VERSION:-1.5.1}"
K3S_IMAGE="${K3S_IMAGE:-rancher/k3s:v1.35.5-k3s1}"
K3D_CLUSTER_NAME="${K3D_CLUSTER_NAME:-dwk-exercise-5-2}"
K3D_API_PORT="${K3D_API_PORT:-6550}"
K3D_HTTP_PORT="${K3D_HTTP_PORT:-9080}"
K3D_HTTPS_PORT="${K3D_HTTPS_PORT:-9443}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for required_command in curl docker k3d kubectl tar; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Required command not found: $required_command" >&2
    exit 1
  fi
done

if ! k3d cluster list --no-headers | awk '{print $1}' | grep -Fxq "$K3D_CLUSTER_NAME"; then
  k3d cluster create "$K3D_CLUSTER_NAME" \
    --image "$K3S_IMAGE" \
    --api-port "$K3D_API_PORT" \
    -p "$K3D_HTTP_PORT:80@loadbalancer" \
    -p "$K3D_HTTPS_PORT:443@loadbalancer" \
    --agents 2 \
    --k3s-arg '--disable=traefik@server:*'
fi

kubectl config use-context "k3d-$K3D_CLUSTER_NAME"

istio_download_dir="$(mktemp -d)"
cleanup_download() {
  rm -r "$istio_download_dir"
}
trap cleanup_download EXIT

(
  cd "$istio_download_dir"
  curl -fsSL https://istio.io/downloadIstio | \
    ISTIO_VERSION="$ISTIO_VERSION" sh -
)

istio_dir="$istio_download_dir/istio-$ISTIO_VERSION"
istioctl="$istio_dir/bin/istioctl"

"$istioctl" install \
  --set profile=ambient \
  --set values.global.platform=k3d \
  --set values.cni.cniBinDir=/var/lib/rancher/k3s/data/cni \
  --skip-confirmation

kubectl apply --server-side -f \
  "https://github.com/kubernetes-sigs/gateway-api/releases/download/v$GATEWAY_API_VERSION/experimental-install.yaml"
kubectl wait --for=condition=Established \
  crd/gateways.gateway.networking.k8s.io \
  --timeout=120s

kubectl apply -f "$istio_dir/samples/bookinfo/platform/kube/bookinfo.yaml"
kubectl apply -f "$istio_dir/samples/bookinfo/platform/kube/bookinfo-versions.yaml"
kubectl apply -f "$istio_dir/samples/bookinfo/gateway-api/bookinfo-gateway.yaml"
kubectl annotate gateway bookinfo-gateway \
  networking.istio.io/service-type=ClusterIP \
  --namespace=default \
  --overwrite
kubectl label namespace default istio.io/dataplane-mode=ambient --overwrite

kubectl apply -f "$istio_dir/samples/addons/prometheus.yaml"
kubectl apply -f "$istio_dir/samples/addons/kiali.yaml"
kubectl apply -f "$istio_dir/samples/curl/curl.yaml"

kubectl rollout status daemonset/istio-cni-node -n istio-system --timeout=180s
kubectl rollout status daemonset/ztunnel -n istio-system --timeout=180s
kubectl wait --for=condition=available deployment --all -n default --timeout=180s
kubectl rollout status deployment/prometheus -n istio-system --timeout=180s
kubectl rollout status deployment/kiali -n istio-system --timeout=180s
kubectl wait --for=condition=Programmed gateway/bookinfo-gateway --timeout=180s

# Follow the authorization tutorial: first demonstrate that an untrusted
# service account is denied by ztunnel, then add a waypoint for L7 policy.
kubectl apply -f "$script_dir/manifests/productpage-gateway-only.yaml"
kubectl rollout status deployment/curl -n default --timeout=180s

if kubectl exec deployment/curl -- \
  curl -fsS -o /dev/null http://productpage:9080/productpage; then
  echo "Expected the gateway-only policy to deny the curl service account." >&2
  exit 1
fi

"$istioctl" waypoint apply --enroll-namespace --wait
kubectl wait --for=condition=Programmed gateway/waypoint --timeout=180s
kubectl apply -f "$script_dir/manifests/productpage-authorization.yaml"

# Route 90% of reviews traffic to v1 and 10% to v2, as in the traffic tutorial.
kubectl apply -f "$script_dir/manifests/reviews-route.yaml"

echo
echo "Istio ambient, Bookinfo, authorization policies, and traffic routing are ready."
kubectl get gateway bookinfo-gateway waypoint
