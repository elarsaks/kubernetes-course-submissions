#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="${NAMESPACE:-default}"
LOCAL_PORT="${LOCAL_PORT:-18082}"

for required_command in curl kubectl; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Required command not found: $required_command" >&2
    exit 1
  fi
done

kubectl rollout status deployment/wikipedia -n "$NAMESPACE" --timeout=180s

pod="$(kubectl get pod -n "$NAMESPACE" -l app=wikipedia \
  -o jsonpath='{.items[0].metadata.name}')"
init_reason="$(kubectl get pod "$pod" -n "$NAMESPACE" \
  -o jsonpath='{.status.initContainerStatuses[0].state.terminated.reason}')"
if [[ "$init_reason" != "Completed" ]]; then
  echo "The Wikipedia init container did not complete successfully." >&2
  exit 1
fi

refresher_ready="$(kubectl get pod "$pod" -n "$NAMESPACE" \
  -o jsonpath='{.status.containerStatuses[?(@.name=="wikipedia-refresher")].ready}')"
if [[ "$refresher_ready" != "true" ]]; then
  echo "The Wikipedia refresher sidecar is not ready." >&2
  exit 1
fi

refresh_log="$(kubectl logs "$pod" -n "$NAMESPACE" -c wikipedia-refresher --tail=1)"
refresh_delay="$(sed -nE 's/.*in ([0-9]+) seconds.*/\1/p' <<<"$refresh_log")"
if [[ -z "$refresh_delay" ]] || (( refresh_delay < 300 || refresh_delay > 900 )); then
  echo "The sidecar did not choose a delay between 5 and 15 minutes." >&2
  exit 1
fi

forward_log="$(mktemp)"
forward_pid=""
cleanup_forward() {
  if [[ -n "$forward_pid" ]]; then
    kill "$forward_pid" >/dev/null 2>&1 || true
  fi
  rm -f "$forward_log"
}
trap cleanup_forward EXIT

kubectl port-forward service/wikipedia -n "$NAMESPACE" \
  "$LOCAL_PORT:80" >"$forward_log" 2>&1 &
forward_pid=$!

page=""
for _ in {1..30}; do
  if page="$(curl -fsS "http://127.0.0.1:$LOCAL_PORT/")"; then
    break
  fi
  sleep 1
done

if [[ "$page" != *"Kubernetes"* || "$page" != *"Wikipedia"* ]]; then
  echo "nginx did not serve the Kubernetes Wikipedia page." >&2
  exit 1
fi

echo "Init container status: $init_reason"
echo "Sidecar refresh delay: ${refresh_delay}s"
echo "nginx served the downloaded Kubernetes Wikipedia page."
echo "Exercise 5.4 verification passed."
