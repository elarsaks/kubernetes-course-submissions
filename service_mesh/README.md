# Exercise 5.3 - Log App, the Service Mesh Edition

This exercise deploys Log Output to an Istio ambient service mesh and extends
it with two versions of a greeter service. An `HTTPRoute` attached to the stable
`greeter-svc` Service sends 75% of requests to v1 and 25% to v2.

## Architecture

Log Output calls both `ping-pong` and `greeter-svc` for every request. The
namespace's waypoint processes calls to `greeter-svc` and applies its weighted
route:

```text
Gateway -> Log Output -> greeter-svc -> 75% greeter-svc-v1
                                   `-> 25% greeter-svc-v2
                    `-> Ping-pong -> PostgreSQL
```

The three greeter Services have distinct roles:

- `greeter-svc` is the stable address used by Log Output and the parent of the
  `HTTPRoute`.
- `greeter-svc-v1` selects only Pods labeled `version: v1`.
- `greeter-svc-v2` selects only Pods labeled `version: v2`.

## Run locally

Exercise 5.2 provides the local k3d cluster, Istio ambient installation,
Prometheus, and Kiali. Set it up first if it is not already running:

```bash
make -C istio setup
```

Then build, import, and deploy exercise 5.3:

```bash
make -C service_mesh setup
make -C service_mesh verify
```

The verification sends 100 requests, checks that every Log Output response
contains its original data and a greeting, verifies that both greeter versions
receive traffic with v1 receiving the larger share, and checks that Kiali
contains traffic edges for the `exercises` namespace.

To inspect the application and Kiali manually, run these in separate terminals:

```bash
kubectl port-forward service/log-output-gateway-istio -n exercises 8080:80
kubectl port-forward service/kiali -n istio-system 20001:20001
```

Open <http://localhost:8080/> and <http://localhost:20001/kiali/>. Select the
`exercises` namespace in Kiali and generate traffic with:

```bash
for i in {1..100}; do curl -s http://localhost:8080/; done
```

Clean up only the exercise 5.3 namespace with:

```bash
make -C service_mesh cleanup
```
