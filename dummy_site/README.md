# Exercise 5.1 - DIY CRD & Controller

This exercise defines a namespaced `DummySite` custom resource. The controller
watches `DummySite` objects, downloads `spec.website_url`, and creates a
ConfigMap, an NGINX Deployment, and a Service that serves the downloaded HTML.

## Apply and test

```bash
kubectl apply -f manifests/crd.yaml
kubectl apply -f manifests/serviceaccount.yaml
kubectl apply -f manifests/clusterrole.yaml
kubectl apply -f manifests/clusterrolebinding.yaml
kubectl apply -f manifests/deployment.yaml
kubectl apply -f manifests/dummysite.yaml

kubectl get dummysites
kubectl get deployment,service,configmap -l managed-by=dummy-site-controller
kubectl port-forward service/example-service 8080:80
```

Open http://localhost:8080 after the Deployment becomes ready. The controller
needs outbound network access to download the requested page.
