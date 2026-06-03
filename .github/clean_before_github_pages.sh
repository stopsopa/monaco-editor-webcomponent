
_SHELL="$(ps "${$}" | grep "${$} " | grep -v grep | sed -rn "s/.*[-\/]+(bash|z?sh) .*/\1/p")"; # bash || sh || zsh
case ${_SHELL} in
  zsh)
    _DIR="$( cd "$( dirname "${(%):-%N}" )" && pwd -P )"
    _0="$( basename "${(%):-%N}" )"
    _SCRIPT="${(%):-%N}"
    _BINARY="/bin/zsh"
    _PWD="$(pwd)"
    ;;
  sh)
    _DIR="$( cd "$( dirname "${0}" )" && pwd -P )"
    _0="$( basename "${0}" )"
    _SCRIPT="${0}"
    _BINARY="/bin/sh"
    _PWD="$(pwd)"
    ;;
  *)
    _DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd -P )"
    _0="$( basename "${BASH_SOURCE[0]}" )"
    _SCRIPT="${BASH_SOURCE[0]}"
    _BINARY="/bin/bash"
    _PWD="$(pwd)"
    ;;
esac

cd "${_DIR}/.."

set -x
rm -rf .env*
rm -rf .git
rm -rf .github
rm -rf .gitignore
rm -rf .npmignore
rm -rf .tool-versions
rm -rf .prettierignore
rm -rf .vscode
rm -rf bash
rm -rf node_modules
rm -rf commitlint.config.js
rm -rf package.dev.json
rm -rf package.json
rm -rf playwright-async.config.js
rm -rf playwright-docker-defaults.sh
rm -rf playwright-report
rm -rf playwright.config.js
rm -rf playwright.sh
rm -rf prettier.config.cjs
rm -rf README.md
rm -rf release.config.js
rm -rf test-results
rm -rf vite-project/node_modules
rm -rf *.tgz
rm -rf .agent
rm -rf diff
rm -rf es.ts
rm -rf package-*
rm -rf tsconfig*
rm -rf xx.cjs


echo 'after clean_before_github_pages'

echo '========= ls -la ===============' 
ls -la
echo '========= ls -la vite-project ===============' 
ls -la vite-project/