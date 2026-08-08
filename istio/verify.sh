#!/usr/bin/env bash

set -euo pipefail

K3D_CLUSTER_NAME="${K3D_CLUSTER_NAME:-dwk-exercise-5-2}"
BOOKINFO_PORT="${BOOKINFO_PORT:-18080}"
KIALI_PORT="${KIALI_PORT:-20001}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-19090}"
REQUEST_COUNT="${REQUEST_COUNT:-200}"

for required_command in curl jq kubectl; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Required command not found: $required_command" >&2
    exit 1
  fi
done

kubectl config use-context "k3d-$K3D_CLUSTER_NAME"

kubectl rollout status daemonset/istio-cni-node -n istio-system --timeout=120s
kubectl rollout status daemonset/ztunnel -n istio-system --timeout=120s
kubectl wait --for=condition=available deployment --all -n default --timeout=120s
kubectl rollout status deployment/prometheus -n istio-system --timeout=120s
kubectl rollout status deployment/kiali -n istio-system --timeout=120s
kubectl wait --for=condition=Programmed gateway/bookinfo-gateway --timeout=120s

dataplane_mode="$(kubectl get namespace default -o jsonpath='{.metadata.labels.istio\.io/dataplane-mode}')"
if [[ "$dataplane_mode" != "ambient" ]]; then
  echo "The default namespace is not enrolled in ambient mode." >&2
  exit 1
fi

bookinfo_log="$(mktemp)"
kiali_log="$(mktemp)"
prometheus_log="$(mktemp)"
bookinfo_pid=""
kiali_pid=""
prometheus_pid=""

cleanup_forwards() {
  for forward_pid in "$bookinfo_pid" "$kiali_pid" "$prometheus_pid"; do
    if [[ -n "$forward_pid" ]]; then
      kill "$forward_pid" >/dev/null 2>&1 || true
    fi
  done
  rm -f "$bookinfo_log" "$kiali_log" "$prometheus_log"
}
trap cleanup_forwards EXIT

kubectl port-forward service/bookinfo-gateway-istio "$BOOKINFO_PORT:80" \
  >"$bookinfo_log" 2>&1 &
bookinfo_pid=$!
kubectl port-forward service/kiali -n istio-system "$KIALI_PORT:20001" \
  >"$kiali_log" 2>&1 &
kiali_pid=$!
kubectl port-forward service/prometheus -n istio-system "$PROMETHEUS_PORT:9090" \
  >"$prometheus_log" 2>&1 &
prometheus_pid=$!

wait_for_url() {
  local url="$1"
  local service_name="$2"
  for _ in {1..30}; do
    if curl -fsS -o /dev/null "$url"; then
      return
    fi
    sleep 1
  done
  echo "$service_name did not become reachable at $url" >&2
  return 1
}

wait_for_url "http://127.0.0.1:$BOOKINFO_PORT/productpage" "Bookinfo"
wait_for_url "http://127.0.0.1:$KIALI_PORT/kiali/api/status" "Kiali"
wait_for_url "http://127.0.0.1:$PROMETHEUS_PORT/-/ready" "Prometheus"

for _ in $(seq 1 "$REQUEST_COUNT"); do
  curl -fsS -o /dev/null "http://127.0.0.1:$BOOKINFO_PORT/productpage"
done

# Allow Prometheus to scrape the newly generated traffic.
sleep 20

telemetry_series="$({
  curl -fsSG \
    --data-urlencode 'query=count(istio_tcp_sent_bytes_total)' \
    "http://127.0.0.1:$PROMETHEUS_PORT/api/v1/query"
} | jq -r '.data.result[0].value[1] // "0"')"

graph_edges="$({
  curl -fsS \
    "http://127.0.0.1:$KIALI_PORT/kiali/api/namespaces/graph?namespaces=default&graphType=workload&duration=120s&injectServiceNodes=true"
} | jq -r '.elements.edges | length')"

if (( telemetry_series < 1 )); then
  echo "Prometheus did not return Istio TCP telemetry." >&2
  exit 1
fi

if (( graph_edges < 1 )); then
  echo "Kiali did not return any workload traffic edges." >&2
  exit 1
fi

echo "Bookinfo HTTP status: 200"
echo "Ambient telemetry series: $telemetry_series"
echo "Kiali workload graph edges: $graph_edges"
echo "Exercise 5.2 verification passed."
