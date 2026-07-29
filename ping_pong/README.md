# Exercise 3.4 - Rewritten Routing

The Ping-pong application exposes its counter at `/` and has no knowledge of
the public `/pingpong` path. The shared Gateway API `HTTPRoute` matches
`/pingpong`, rewrites the upstream path to `/`, and sends the request to the
`ping-pong` ClusterIP Service.

Each request atomically increments the counter stored in PostgreSQL.

## Build and push

From the repository root:

```bash
docker buildx build --platform linux/amd64 \
  -t elarsaks/ping-pong:3.4.0 --push ./ping_pong
```

## Deploy

The complete GKE and Gateway API deployment steps are documented in
`log_output/README.md` because Log Output, Ping-pong, PostgreSQL, the Gateway,
and the shared HTTPRoute are deployed together.

## Verify

Externally, replace `GATEWAY_IP` with the address shown by
`kubectl get gateway`:

```bash
curl "http://${GATEWAY_IP}/pingpong"
curl "http://${GATEWAY_IP}/pingpong"
```

The Gateway rewrites both requests to `/` before forwarding them to Ping-pong.
The responses contain increasing counter values, for example:

```text
pong 12
pong 13
```

The exact values depend on the counter already stored in PostgreSQL.

Inside the cluster, Ping-pong responds at its application-level root path:

```bash
kubectl exec deployment/log-output -n exercises -c log-server -- \
  node -e 'fetch("http://ping-pong:3000/").then(async r => console.log(r.status, await r.text()))'
```
