# Exercise 1.13 - The Project Todo UI

The project now displays the cached image from Exercise 1.12 together with a Todo UI. The page has an input limited to 140 characters, a Send button that does not submit data yet, and three hardcoded todos.

## Build and deploy

```bash
docker build -t elarsaks/the-project:1.13.0 ./the_project
docker push elarsaks/the-project:1.13.0

kubectl apply -f the_project/manifests/persistentvolume.yaml
kubectl apply -f the_project/manifests/persistentvolumeclaim.yaml
kubectl apply -f the_project/manifests/deployment.yaml
kubectl rollout status deployment/the-project
```

Open `http://localhost:8081/` to view the Todo App.

The image cache and PersistentVolume behavior from Exercise 1.12 remain unchanged. The Send button is intentionally non-functional; submitting todos is implemented in a later exercise.

## Cleanup

```bash
kubectl delete -f the_project/manifests/deployment.yaml
kubectl delete -f the_project/manifests/persistentvolumeclaim.yaml
kubectl delete -f the_project/manifests/persistentvolume.yaml
docker exec k3d-k3s-default-server-0 rm -rf /tmp/kube-project
```
