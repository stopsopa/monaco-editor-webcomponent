
S="\\"

MYSQL_DB_CHANGE_DEFAULT=""
if [ "${MYSQL_DB_CHANGE}" != "" ]; then
    MYSQL_DB_CHANGE_DEFAULT="--env MYSQL_DB_CHANGE"
fi  

PLAYWRIGHT_TEST_MATCH_DEFAULT=""
if [ "${PLAYWRIGHT_TEST_MATCH}" != "" ]; then
    PLAYWRIGHT_TEST_MATCH_DEFAULT="--env PLAYWRIGHT_TEST_MATCH"
fi   

NODE_API_PORT_DEFAULT=""
if [ "${NODE_API_PORT}" != "" ]; then
    NODE_API_PORT_DEFAULT="--env NODE_API_PORT"
fi  

MYSQL_HOST_PASS=""
if [ "${1}" != "--nohost" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        MYSQL_HOST_PASS="--env MYSQL_HOST=host.docker.internal"
    # else # this case if uncommented then in some cases might double passing --net host which wouldn't make much sense, so let's prevent it
    #     _HOSTHANDLER="--net host"
    fi
fi

cat <<EOF
-w "/code" $S
${NODE_API_PORT_DEFAULT} $S
${PLAYWRIGHT_TEST_MATCH_DEFAULT} $S
--env CI=true $S
                                             $S
-v "\$(pwd)/composition:/code/composition"   $S
-v "\$(pwd)/vite-project:/code/vite-project" $S
-v "\$(pwd)/dist:/code/dist" $S
-v "\$(pwd)/test:/code/test" $S
                                             $S
-v "\$(pwd)/package.json:/code/package.json" $S
-v "\$(pwd)/node_modules:/code/node_modules" $S
-v "\$(pwd)/playwright-async.config.js:/code/playwright-async.config.js" $S
-v "\$(pwd)/playwright.config.js:/code/playwright.config.js" $S
-v "\$(pwd)/playwright.generateBASE_URL.js:/code/playwright.generateBASE_URL.js"
EOF

