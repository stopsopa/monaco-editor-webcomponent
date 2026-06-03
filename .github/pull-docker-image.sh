
set -e
set -x
set -o pipefail

IMAGE="$(/bin/bash playwright.sh --image)"

docker pull "${IMAGE}"

SIZE="$(docker image inspect "${IMAGE}" --format='{{.Size}}')"

# human readable
SIZE_HUMAN="$(numfmt --to=iec-i --suffix=B "${SIZE}")"

echo "Pulled image size: ${SIZE_HUMAN}"
