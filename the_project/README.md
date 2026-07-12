# Exercise 2.4 - The Project Namespace

The Todo App, Todo backend, and image-cache PVC run in the `project` namespace. The PersistentVolume remains cluster-scoped, as required by Kubernetes.

## Build and deploy

```bash
docker build -t elarsaks/the-project:2.2.0 ./the_project
docker push elarsaks/the-project:2.2.0
docker build -t elarsaks/todo-backend:2.2.0 ./todo_backend
docker push elarsaks/todo-backend:2.2.0

kubectl apply -f the_project/manifests/persistentvolume.yaml
kubectl apply -f the_project/manifests/namespace.yaml
kubectl apply -f the_project/manifests/persistentvolumeclaim.yaml
kubectl apply -f the_project/manifests/deployment.yaml
kubectl apply -f todo_backend/manifests/deployment.yaml
kubectl rollout status deployment/the-project -n project
kubectl rollout status deployment/todo-backend -n project
```

Open `http://localhost:8081/` to view the Todo App.

The image cache and PersistentVolume behavior from Exercise 1.12 remain unchanged. Todo data is stored in memory by the backend and is lost when its Pod is recreated.

## Cleanup

```bash
kubectl delete -f todo_backend/manifests/deployment.yaml
kubectl delete -f the_project/manifests/deployment.yaml
kubectl delete -f the_project/manifests/persistentvolumeclaim.yaml
kubectl delete -f the_project/manifests/persistentvolume.yaml
kubectl delete -f the_project/manifests/namespace.yaml
docker exec k3d-k3s-default-server-0 rm -rf /tmp/kube-project
```
