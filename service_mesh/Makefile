.PHONY: setup verify cleanup

setup:
	./setup.sh

verify:
	./verify.sh

cleanup:
	kubectl delete namespace "$${NAMESPACE:-exercises}" --ignore-not-found
