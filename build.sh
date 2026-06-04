# 
# /bin/bash build.sh 
# /bin/bash build.sh cjs
# /bin/bash build.sh esm
# 
set -e

export NODE_OPTIONS=""

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

ARG="${1}"

function build_cjs() {
  cat <<EEE

=== build_cjs:
$ npx tsc -p tsconfig.cjs.json

EEE

  npx tsc -p tsconfig.cjs.json
  /bin/bash .github/fix-cjs.sh
}

function build_esm() {
  cat <<EEE

=== build_esm:
$ npx tsc -p tsconfig.just_for_the_time_of_compilation.json 

EEE
  npx tsc -p tsconfig.just_for_the_time_of_compilation.json 
}

echo "=== Linking ==="
npm run monaco:skip

npx tsc -p tsconfig.watch.json

echo web-component/Module.ts | DEBUG=true node es.ts

(
  cd vite-project
  
  npm run build
  
  ls -la node_modules
)

/bin/bash links.sh

if [[ -z "${ARG}" ]]; then
  echo "Running full build..."
  rm -rf dist
  build_cjs
  build_esm
  if [[ -f "${DIR}/.github/override.sh" ]]; then
    /bin/bash "${DIR}/.github/override.sh"
  fi
  exit 0
fi

if [[ "${ARG}" == "cjs" ]]; then
  echo "Running CJS build..."
  build_cjs
  exit 0
fi

if [[ "${ARG}" == "esm" ]]; then
  echo "Running ESM build..."
  build_esm
  exit 0
fi

echo "${0} error: Invalid argument >${ARG}<. Only 'cjs' or 'esm' are allowed."
exit 1
