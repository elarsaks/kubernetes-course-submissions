#!/usr/bin/env bash

set -euo pipefail

ISTIO_VERSION="${ISTIO_VERSION:-1.30.3}"
K3D_CLUSTER_NAME="${K3D_CLUSTER_NAME:-dwk-exercise-5-2}"
NAMESPACE="${NAMESPACE:-exercises}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"

for required_command in curl docker k3d kubectl; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Required command not found: $required_command" >&2
    exit 1
  fi
done

if ! k3d cluster list --no-headers | awk '{print $1}' | grep -Fxq "$K3D_CLUSTER_NAME"; then
  echo "Cluster $K3D_CLUSTER_NAME does not exist. Run 'make -C istio setup' first." >&2
  exit 1
fi

kubectl config use-context "k3d-$K3D_CLUSTER_NAME"

if ! kubectl get deployment istiod -n istio-system >/dev/null 2>&1; then
  echo "Istio is not installed. Run 'make -C istio setup' first." >&2
  exit 1
fi

docker build -t log-output:5.3 "$repo_dir/log_output"
docker build -t ping-pong:5.3 "$repo_dir/ping_pong"
docker build --build-arg 'GREETING=Hello from greeter v1' \
  -t greeter:5.3-v1 "$repo_dir/greeter"
docker build --build-arg 'GREETING=Hello from greeter v2' \
  -t greeter:5.3-v2 "$repo_dir/greeter"

k3d image import -c "$K3D_CLUSTER_NAME" \
  log-output:5.3 ping-pong:5.3 greeter:5.3-v1 greeter:5.3-v2

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
istioctl="$istio_download_dir/istio-$ISTIO_VERSION/bin/istioctl"

kubectl apply -f "$script_dir/manifests/namespace.yaml"
"$istioctl" waypoint apply -n "$NAMESPACE" --enroll-namespace --wait

kubectl apply -f "$script_dir/manifests/postgres.yaml"
kubectl apply -f "$script_dir/manifests/apps.yaml"
kubectl apply -f "$script_dir/manifests/greeters.yaml"
kubectl apply -f "$script_dir/manifests/routes.yaml"
kubectl annotate gateway log-output-gateway -n "$NAMESPACE" \
  networking.istio.io/service-type=ClusterIP --overwrite

kubectl rollout status statefulset/postgres -n "$NAMESPACE" --timeout=180s
kubectl rollout status deployment/ping-pong -n "$NAMESPACE" --timeout=180s
kubectl rollout status deployment/greeter-v1 -n "$NAMESPACE" --timeout=180s
kubectl rollout status deployment/greeter-v2 -n "$NAMESPACE" --timeout=180s
kubectl rollout status deployment/log-output -n "$NAMESPACE" --timeout=180s
kubectl wait --for=condition=Programmed gateway/waypoint -n "$NAMESPACE" --timeout=180s
kubectl wait --for=condition=Programmed gateway/log-output-gateway -n "$NAMESPACE" --timeout=180s

echo
echo "Exercise 5.3 is ready in namespace $NAMESPACE."
kubectl get gateway,httproute -n "$NAMESPACE"
