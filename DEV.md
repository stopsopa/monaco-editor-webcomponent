# launch for development

```bash
# terminal 1
xx server

# terminal 2
xx transpile

# ocassionally run
xx typecheck

# terminal 3
cd vite-project
/bin/bash dev.sh
  # when any changes done beyond vite-project/
  # then stop and run again /bin/bash dev.sh


```

urls

```
http://0.0.0.0:5699/vite-project/dist/

```

# to run tests

```
/bin/bash pw.sh
# that will run server, run build, run playwright tests and stop server

# go see
xx playwright
# for more sophisticated ways to run tests

```

# unit tests

```
# after a build (or `xx transpile`) - the tests import compiled .js siblings
CONCURRENCY=10 node --test "web-component/**/*.test.ts"
```

# checks before publishing

```
/bin/bash build.sh
node scripts/check-package.ts
# package.json vs package.dev.json shared fields, exports targets exist (wildcard: .js and .d.ts sets match), tarball whitelist
```

# what is published to npm

Only what `tsconfig.build.json` compiles (`dist/esm`, `dist/types`) plus `web-component/Module.js` (the bundle for CDN use).
`package.json` "exports" uses a wildcard (`"./*"` → `dist/esm/*.js` + `dist/types/*.d.ts`), so every file in `dist` is
importable as `composite-monaco-diff/<path>` and is public API. What lands in `dist` is decided by "include" in
`tsconfig.build.json` - add a file there to publish it, nothing to change in `package.json`. Demo pages are never published.
The package is ESM only.
