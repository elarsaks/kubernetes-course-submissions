#!/usr/bin/env bash

set -euo pipefail

K3D_CLUSTER_NAME="${K3D_CLUSTER_NAME:-dwk-exercise-5-2}"
NAMESPACE="${NAMESPACE:-exercises}"
LOG_OUTPUT_PORT="${LOG_OUTPUT_PORT:-18081}"
KIALI_PORT="${KIALI_PORT:-20001}"
REQUEST_COUNT="${REQUEST_COUNT:-100}"

for required_command in curl jq kubectl; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Required command not found: $required_command" >&2
    exit 1
  fi
done

kubectl config use-context "k3d-$K3D_CLUSTER_NAME"

for workload in ping-pong greeter-v1 greeter-v2 log-output; do
  kubectl rollout status "deployment/$workload" -n "$NAMESPACE" --timeout=120s
done
kubectl wait --for=condition=Programmed gateway/waypoint -n "$NAMESPACE" --timeout=120s
kubectl wait --for=condition=Programmed gateway/log-output-gateway -n "$NAMESPACE" --timeout=120s

dataplane_mode="$(kubectl get namespace "$NAMESPACE" -o jsonpath='{.metadata.labels.istio\.io/dataplane-mode}')"
waypoint="$(kubectl get namespace "$NAMESPACE" -o jsonpath='{.metadata.labels.istio\.io/use-waypoint}')"
if [[ "$dataplane_mode" != "ambient" || "$waypoint" != "waypoint" ]]; then
  echo "Namespace $NAMESPACE is not enrolled in ambient mode with its waypoint." >&2
  exit 1
fi

route_backends="$(kubectl get httproute greeter -n "$NAMESPACE" -o json | \
  jq -r '.spec.rules[0].backendRefs[] | "\(.name)=\(.weight)"')"
if [[ "$route_backends" != *"greeter-svc-v1=75"* || "$route_backends" != *"greeter-svc-v2=25"* ]]; then
  echo "The greeter HTTPRoute does not contain the expected 75/25 split." >&2
  exit 1
fi

gateway_log="$(mktemp)"
kiali_log="$(mktemp)"
gateway_pid=""
kiali_pid=""

cleanup_forwards() {
  for forward_pid in "$gateway_pid" "$kiali_pid"; do
    if [[ -n "$forward_pid" ]]; then
      kill "$forward_pid" >/dev/null 2>&1 || true
    fi
  done
  rm -f "$gateway_log" "$kiali_log"
}
trap cleanup_forwards EXIT

kubectl port-forward service/log-output-gateway-istio -n "$NAMESPACE" \
  "$LOG_OUTPUT_PORT:80" >"$gateway_log" 2>&1 &
gateway_pid=$!
kubectl port-forward service/kiali -n istio-system \
  "$KIALI_PORT:20001" >"$kiali_log" 2>&1 &
kiali_pid=$!

wait_for_url() {
  local url="$1"
  local name="$2"
  for _ in {1..30}; do
    if curl -fsS -o /dev/null "$url"; then
      return
    fi
    sleep 1
  done
  echo "$name did not become reachable at $url" >&2
  return 1
}

wait_for_url "http://127.0.0.1:$LOG_OUTPUT_PORT/" "Log Output"
wait_for_url "http://127.0.0.1:$KIALI_PORT/kiali/api/status" "Kiali"

responses="$(for _ in $(seq 1 "$REQUEST_COUNT"); do
  curl -fsS "http://127.0.0.1:$LOG_OUTPUT_PORT/"
done)"

for expected_line in "file content:" "env variable:" "Ping / Pongs:" "Greeter:"; do
  if [[ "$responses" != *"$expected_line"* ]]; then
    echo "Log Output response is missing: $expected_line" >&2
    exit 1
  fi
done

v1_count="$(grep -c 'Greeter: Hello from greeter v1' <<<"$responses" || true)"
v2_count="$(grep -c 'Greeter: Hello from greeter v2' <<<"$responses" || true)"
if (( v1_count <= v2_count || v2_count < 1 || v1_count + v2_count != REQUEST_COUNT )); then
  echo "The expected 75/25 greeter split was not observed (v1=$v1_count, v2=$v2_count)." >&2
  exit 1
fi

graph_edges=0
graph_workloads=""
for _ in {1..12}; do
  graph_json="$(curl -fsS \
    "http://127.0.0.1:$KIALI_PORT/kiali/api/namespaces/graph?namespaces=$NAMESPACE&graphType=workload&duration=300s&injectServiceNodes=true")"
  graph_edges="$(jq -r '.elements.edges | length' <<<"$graph_json")"
  graph_workloads="$(jq -r '.elements.nodes[].data.workload // empty' <<<"$graph_json")"
  if (( graph_edges >= 2 )) && \
    grep -Fxq greeter-v1 <<<"$graph_workloads" && \
    grep -Fxq greeter-v2 <<<"$graph_workloads"; then
    break
  fi
  sleep 5
done

if (( graph_edges < 2 )) || \
  ! grep -Fxq greeter-v1 <<<"$graph_workloads" || \
  ! grep -Fxq greeter-v2 <<<"$graph_workloads"; then
  echo "Kiali did not show traffic through both greeter versions." >&2
  exit 1
fi

echo "Log Output includes the Ping-pong value and greeter response."
echo "Greeter traffic distribution: v1=$v1_count, v2=$v2_count"
echo "Kiali workload graph edges: $graph_edges"
echo "Exercise 5.3 verification passed."
