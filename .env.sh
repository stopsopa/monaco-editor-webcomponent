
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

ENVFILE="${ENVFILE:-.env}"

if [[ -f "${DIR}/${ENVFILE}" ]]; then
    # https://unix.stackexchange.com/a/79065
    eval "$(/bin/bash "${DIR}/bash/exportsource.sh" "${DIR}/${ENVFILE}")"
fi

source "${DIR}/bash/require_non_empty_var.sh"

# -----------------------------------------------------------------------------
# Validation
# -----------------------------------------------------------------------------

require_non_empty_var "${0}" "HOST"
require_non_empty_and_matching_var "${0}" "PORT" "^[0-9]+$"
# require_non_empty_var "${0}" "NODE_API_HOST"
# require_non_empty_and_matching_var "${0}" "NODE_API_PROTOCOL" "^(http|https)$"
# require_non_empty_and_matching_var "${0}" "NODE_API_PORT" "^[0-9]+$"

# export NODE_OPTIONS="${NODE_OPTIONS} --experimental-transform-types"

# NODE_OPTIONS="" node --env-file=.env node_modules/.bin/envprocessor --mask "^(PROJECT_NAME|FLAG|HOST|VITE_)" public/preprocessed.js
