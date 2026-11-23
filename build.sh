#
# Builds everything that is published or deployed:
#   1. syncs the Monaco version / CDN list (npm run monaco:skip)
#   2. compiles every *.ts next to its source (tsconfig.watch.json) - demos and docs load these .js files
#   3. bundles web-component/Module.ts -> web-component/Module.js (es.ts, for CDN usage)
#   4. builds the React demo app (vite-project)
#   5. packs + unpacks the npm package into node_modules (links.sh)
#   6. compiles the npm package: dist/esm + dist/types (tsconfig.build.json) and syntax-checks the output
#
# Run from anywhere:
#   /bin/bash build.sh        # everything
#   /bin/bash build.sh esm    # steps 1-5, then only (re)compile dist without wiping it first
#
# The package is ESM only. There is no CommonJS build: the code needs a browser (custom elements, Monaco's
# AMD loader), so require() has no consumer.
#
set -e
set -x

export NODE_OPTIONS=""

_SHELL="$(ps -p $$ -o comm=)"; # bash || sh || zsh
_SHELL="$(basename ${_SHELL//-/})"
case ${_SHELL} in
  zsh)
    _DIR="$( cd "$( dirname "${(%):-%x}" )" && pwd -P )"
    ;;
  sh)
    _DIR="$( cd "$( dirname "${0}" )" && pwd -P )"
    ;;
  *)
    _DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd -P )"
    ;;
esac

cd "${_DIR}"

ARG="${1}"

if [[ -n "${ARG}" && "${ARG}" != "esm" ]]; then
  echo "${0} error: Invalid argument ARG=>${ARG}<. Only 'esm' (or no argument) is allowed."
  exit 1
fi

function build_esm() {
  cat <<EEE

=== build_esm:
$ npx tsc -p tsconfig.build.json

EEE
  npx tsc -p tsconfig.build.json

  # Cheap smoke test: every emitted file has to be parseable as an ES module.
  # (the files cannot be imported in node - they need a DOM - but a syntax check catches a broken build)
  local FILE
  while IFS= read -r FILE; do
    node --check "${FILE}"
  done <<< "$(find dist/esm -type f -name '*.js')"
}

echo "=== Linking ==="
npm run monaco:skip

./node_modules/.bin/tsc -p tsconfig.watch.json

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
  build_esm
  if [[ -f "${_DIR}/.github/override.sh" ]]; then
    /bin/bash "${_DIR}/.github/override.sh"
  fi
  exit 0
fi

echo "Running ESM build..."
build_esm
