# Exercise 5.4 - Wikipedia with Init and Sidecar Containers

This exercise serves Wikipedia content from nginx without adding fetching logic
to the nginx container itself. All three containers share an ephemeral
`emptyDir` volume:

```text
download-kubernetes-page (init container)
                 |
                 v
       emptyDir: index.html <--- wikipedia-refresher (sidecar)
                 |
                 v
               nginx
```

The init container downloads the Kubernetes Wikipedia article before nginx is
allowed to start. nginx mounts the shared content at
`/usr/share/nginx/html`. The sidecar sleeps for a randomly selected 300–900
seconds, downloads `Special:Random` to a temporary file, and atomically replaces
`index.html`. A failed refresh leaves the previously downloaded page intact.

## Run locally

Use any Kubernetes cluster with outbound internet access:

```bash
make -C wikipedia setup
make -C wikipedia verify
```

To open the page in a browser:

```bash
kubectl port-forward service/wikipedia 8080:80
```

Then visit <http://localhost:8080/>.

Inspect the init container and sidecar:

```bash
kubectl get pods -l app=wikipedia
kubectl logs deployment/wikipedia -c download-kubernetes-page
kubectl logs deployment/wikipedia -c wikipedia-refresher -f
```

The initial page is always the Kubernetes article. After 5–15 minutes, refresh
the browser to see the random article downloaded by the sidecar.

Clean up with:

```bash
make -C wikipedia cleanup
```
