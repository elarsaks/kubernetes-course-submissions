# Exercise 3.2 - Back to Ingress

The Ping-pong application is deployed to Google Kubernetes Engine behind the
shared Ingress. Requests to `/pingpong` are routed to the `ping-pong` NodePort
Service and atomically increment the counter stored in PostgreSQL.

The application also returns HTTP 200 from `/`. GKE Ingress checks that path
even though external Ping-pong traffic is routed to `/pingpong`.

## Build

From the repository root:

```bash
docker buildx build --platform linux/amd64 \
  -t elarsaks/ping-pong:3.2.0 --push ./ping_pong
```

## Deploy

The complete deployment steps are documented in `log_output/README.md` because
Log Output, Ping-pong, PostgreSQL, and their shared Ingress are deployed
together for this exercise.

## Verify

Replace `INGRESS_IP` with the address shown by `kubectl get ingress`:

```bash
curl http://INGRESS_IP/pingpong
curl http://INGRESS_IP/pingpong
```

Expected responses:

```text
pong 0
pong 1
```
