.PHONY: setup verify cleanup

setup:
	kubectl apply -f manifests/deployment.yaml

verify:
	./verify.sh

cleanup:
	kubectl delete -f manifests/deployment.yaml --ignore-not-found
