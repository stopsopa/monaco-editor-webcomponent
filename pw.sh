
# 
# Runs server then runs playwright tests and then stops server
# ENVFILE=.env.playwright /bin/bash pw.sh
#
# Don't use it if you already have running server and don't want to restart all the time
# 

set -e
export ENVFILE=".env.playwright"
source .env.sh

function cleanup {
  ps aux | grep "${PROJECT_NAME}" | /bin/bash bash/proc/reaper.sh
}

cleanup

trap cleanup EXIT

npx tsc -p tsconfig.json

node --env-file "${ENVFILE}" --watch server.ts --flag "${PROJECT_NAME}" & 

# sleep 1

/bin/bash build.sh

(
  cd vite-project 
  npm run build
)

echo curl http://${HOST}:${PORT}/health
curl http://${HOST}:${PORT}/health

/bin/bash playwright.sh "$@"