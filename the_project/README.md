# Exercise 1.12 - The Project Image Cache

The project displays a random image from Lorem Picsum. The image is cached in a PersistentVolume and refreshed after ten minutes. If the API is temporarily unavailable, an existing cached image is served.

## Build and push

```bash
docker build -t elarsaks/the-project:1.12.0 ./the_project
docker push elarsaks/the-project:1.12.0
```

## Deploy locally with k3d

The local PV is tied to the default k3d server node:

```bash
docker exec k3d-k3s-default-server-0 mkdir -p /tmp/kube-project
kubectl apply -f the_project/manifests/persistentvolume.yaml
kubectl apply -f the_project/manifests/persistentvolumeclaim.yaml
kubectl apply -f the_project/manifests/deployment.yaml
kubectl rollout status deployment/the-project
```

Open `http://localhost:8081/`. The page loads the cached image from `/image.jpg`.

## Test caching

```bash
curl -I http://localhost:8081/image.jpg
kubectl exec deployment/the-project -- stat /usr/src/app/files/image.jpg
```

Accessing the app repeatedly within ten minutes reuses the same file. After ten minutes, the next request downloads a new image. Restarting the Pod does not remove the image because it is stored on the PersistentVolume.

## Cleanup

```bash
kubectl delete -f the_project/manifests/deployment.yaml
kubectl delete -f the_project/manifests/persistentvolumeclaim.yaml
kubectl delete -f the_project/manifests/persistentvolume.yaml
docker exec k3d-k3s-default-server-0 rm -rf /tmp/kube-project
```
