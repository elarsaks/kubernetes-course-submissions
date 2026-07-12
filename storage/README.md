# Exercise 1.11 - Shared PersistentVolume

The PersistentVolume and PersistentVolumeClaim in `manifests/` provide shared local storage for the `ping-pong` and `log-output` applications. The local path must exist on the k3d agent before applying the PersistentVolume:

```bash
docker exec k3d-k3s-default-server-0 mkdir -p /tmp/kube
kubectl apply -f storage/manifests/persistentvolume.yaml
kubectl apply -f storage/manifests/persistentvolumeclaim.yaml
```

The volume stores `ping-pong.txt` and `log.txt`. Its contents survive Pod replacement but are tied to the local cluster node.
