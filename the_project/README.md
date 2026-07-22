# Exercise 2.9 - The Project, Step 12

The Project includes an hourly Kubernetes CronJob that creates a Todo in the form:

```text
Read https://en.wikipedia.org/wiki/Example_article
```

Each Job requests `https://en.wikipedia.org/wiki/Special:Random` without following redirects, reads the article URL from the `Location` response header, and posts the resulting Todo to the existing Todo backend. If an unusually long article URL exceeds the configured Todo length, the generator requests another random article.

The CronJob uses `project-config` for its backend URL, Wikipedia URL, Todo length, and retry limit. It runs at minute zero of every hour, forbids overlapping runs, and retains a small Job history for inspection.

## Build and deploy

Starting from a running exercise 2.8 deployment, build and publish the generator:

```bash
docker build -t elarsaks/todo-generator:2.9.0 ./todo_generator
docker push elarsaks/todo-generator:2.9.0

kubectl apply -f the_project/manifests/configmap.yaml
kubectl apply -f todo_generator/manifests/cronjob.yaml
```

For k3d development, the image can be imported instead of pushed:

```bash
k3d image import elarsaks/todo-generator:2.9.0 -c k3s-default
```

## Verify immediately

Create a one-off Job from the CronJob instead of waiting for the next hour:

```bash
JOB_NAME="random-wikipedia-todo-manual-$(date +%s)"
kubectl create job --from=cronjob/random-wikipedia-todo "$JOB_NAME" -n project
kubectl wait --for=condition=Complete "job/$JOB_NAME" -n project --timeout=180s
kubectl logs "job/$JOB_NAME" -n project
```

The log should contain `Created Todo: Read https://en.wikipedia.org/wiki/...`. Confirm that PostgreSQL contains the new Todo:

```bash
kubectl exec -n project todo-postgres-0 -- \
  psql -U todo -d todos -c \
  "SELECT id, content FROM todos WHERE content LIKE 'Read https://en.wikipedia.org/wiki/%' ORDER BY id DESC LIMIT 5;"
```

Inspect the hourly schedule and Job history:

```bash
kubectl get cronjob random-wikipedia-todo -n project
kubectl get jobs -n project -l app=random-wikipedia-todo
```

## Cleanup

```bash
kubectl delete -f todo_generator/manifests/cronjob.yaml
kubectl delete job "$JOB_NAME" -n project
```
