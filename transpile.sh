

if [ $# -eq 0 ]; then
    echo "Usage: $0 <file1> [file2 ...]"
    exit 1
fi

export NODE_OPTIONS="";

FILES=("$@")

while true; do
    echo "Running transpilation for ${FILES[*]}..."
    # printf "%s\n" "${FILES[@]}" | NODE_OPTIONS="" DEBUG=true node es.ts

# RENDERED="$(node render.ts choice.js/composition/composite-select/CompositeManager.ts 2>&1)"    

# if [ "${?}" != "0" ]; then
#   cat <<EEE

# failed: node render.ts choice.js/composition/composite-select/CompositeManager.ts
# ${RENDERED}

# EEE

#   exit 1
# fi

# cat <<EEE | DEBUG=true node es.ts
# $(printf "%s\n" "${FILES[@]}")
# ${RENDERED}
# EEE

printf "%s\n" "${FILES[@]}" | DEBUG=true node es.ts

    echo "Waiting for changes..."
    node bash/fs/watch.cjs "${FILES[@]}"
    STATUS=$?
    if [ $STATUS -eq 130 ]; then
        exit $STATUS
    fi
done