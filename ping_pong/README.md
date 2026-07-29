# Exercise 3.3 - To the Gateway

The Ping-pong application is deployed to Google Kubernetes Engine behind the
shared Gateway API load balancer. The `HTTPRoute` sends requests for
`/pingpong` to the `ping-pong` ClusterIP Service, where each request atomically
increments the counter stored in PostgreSQL.

Route rewriting is introduced in the next exercise. For exercise 3.3, the
application itself still handles `/pingpong`.

The application code is unchanged from exercise 3.2, so the deployment reuses
the existing `elarsaks/ping-pong:3.2.0` image.

## Deploy

The complete GKE and Gateway API deployment steps are documented in
`log_output/README.md` because Log Output, Ping-pong, PostgreSQL, the Gateway,
and the shared HTTPRoute are deployed together.

## Verify

Replace `GATEWAY_IP` with the address shown by `kubectl get gateway`:

```bash
curl http://GATEWAY_IP/pingpong
curl http://GATEWAY_IP/pingpong
```

Expected responses:

```text
pong 0
pong 1
```
