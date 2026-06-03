
# 
# /bin/bash links.sh
# /bin/bash links.sh drop
# 
set -e

export NODE_OPTIONS=""

THISFILE="${0}"
function error {
  cat <<EEE

  ${THISFILE} error: ${1}

EEE

  exit 1
}

if [ "${1}" != "" ]; then
  if [ "${1}" != "drop" ]; then
    error "unknown option: ${1}"
  fi
fi

find . -type f -name '*.tgz' -delete

npm pack

ZIP="$(find . -type f -name '*.tgz')";

if [ ! -f "${ZIP}" ]; then
  error "ZIP file not found: ${ZIP}"
fi


function unpackzip {

    TARGET="${1}"

    rm -rf "${TARGET}"

    mkdir -p "${TARGET}"

    cp "${ZIP}" "${TARGET}/"

(
    cd "${TARGET}"
    tar -zxvf *.tgz --strip-components=1
    pwd
    ls -la
    find . -type f
    cat <<EEE

    files in ${TARGET}

EEE
    find . -type f
    cat package.json
)
}

unpackzip "node_modules/composite-select"

unpackzip "vite-project/node_modules/composite-select"

if [ "${1}" = "drop" ]; then

  cat <<EEE

  removing local 'dist' directory

EEE

  rm -rf dist/
  mkdir -p dist
  touch dist/ALL_REMOVED_BY_LINKS_SH
fi

cat <<EEE

  ZIP >${ZIP}<
  ${0} success

EEE