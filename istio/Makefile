.PHONY: setup verify cleanup

setup:
	./setup.sh

verify:
	./verify.sh

cleanup:
	k3d cluster delete "$${K3D_CLUSTER_NAME:-dwk-exercise-5-2}"
