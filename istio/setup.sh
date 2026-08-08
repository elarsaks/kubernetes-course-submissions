#!/usr/bin/env bash

set -euo pipefail

ISTIO_VERSION="${ISTIO_VERSION:-1.30.3}"
GATEWAY_API_VERSION="${GATEWAY_API_VERSION:-1.5.1}"
K3D_CLUSTER_NAME="${K3D_CLUSTER_NAME:-dwk-exercise-5-2}"
K3D_API_PORT="${K3D_API_PORT:-6550}"
K3D_HTTP_PORT="${K3D_HTTP_PORT:-9080}"
K3D_HTTPS_PORT="${K3D_HTTPS_PORT:-9443}"

for required_command in curl docker k3d kubectl tar; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Required command not found: $required_command" >&2
    exit 1
  fi
done

if ! k3d cluster list --no-headers | awk '{print $1}' | grep -Fxq "$K3D_CLUSTER_NAME"; then
  k3d cluster create "$K3D_CLUSTER_NAME" \
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

kubectl rollout status daemonset/istio-cni-node -n istio-system --timeout=180s
kubectl rollout status daemonset/ztunnel -n istio-system --timeout=180s
kubectl wait --for=condition=available deployment --all -n default --timeout=180s
kubectl rollout status deployment/prometheus -n istio-system --timeout=180s
kubectl rollout status deployment/kiali -n istio-system --timeout=180s
kubectl wait --for=condition=Programmed gateway/bookinfo-gateway --timeout=180s

echo
echo "Istio ambient and Bookinfo are ready on k3d cluster $K3D_CLUSTER_NAME."
kubectl get gateway bookinfo-gateway
