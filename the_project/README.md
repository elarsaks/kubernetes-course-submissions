# Exercise 2.2 - The Project Todo Backend

The project displays the cached image and fetches todos from the separate `todo-backend` service. The form submits new todos through the Todo app, which forwards them to the backend.

## Build and deploy

```bash
docker build -t elarsaks/the-project:2.2.0 ./the_project
docker push elarsaks/the-project:2.2.0
docker build -t elarsaks/todo-backend:2.2.0 ./todo_backend
docker push elarsaks/todo-backend:2.2.0

kubectl apply -f the_project/manifests/persistentvolume.yaml
kubectl apply -f the_project/manifests/persistentvolumeclaim.yaml
kubectl apply -f the_project/manifests/deployment.yaml
kubectl apply -f todo_backend/manifests/deployment.yaml
kubectl rollout status deployment/the-project
kubectl rollout status deployment/todo-backend
```

Open `http://localhost:8081/` to view the Todo App.

The image cache and PersistentVolume behavior from Exercise 1.12 remain unchanged. Todo data is stored in memory by the backend and is lost when its Pod is recreated.

## Cleanup

```bash
kubectl delete -f the_project/manifests/deployment.yaml
kubectl delete -f the_project/manifests/persistentvolumeclaim.yaml
kubectl delete -f the_project/manifests/persistentvolume.yaml
docker exec k3d-k3s-default-server-0 rm -rf /tmp/kube-project
```
