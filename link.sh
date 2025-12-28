set -x
set -e
(
    cd monaco-editor/src/
    rm -rf monaco-web-component.js
    rm -rf monaco-web-component.d.ts
    ln -s ../../monaco-web-component.js .
    ln -s ../../monaco-web-component.d.ts .
    ls -la
)