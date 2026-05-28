#!/bin/bash

# This script wraps 'tsc --watch' and automatically runs prettier 
# on the generated .js files whenever a compilation completes.

# Usage: ./tsc-watch.sh

# Color constants for better visibility
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting tsc in watch mode with prettier auto-fix...${NC}"

# Run tsc and pipe its output line by line
# We look for the "Watching for file changes" message which tsc 
# prints after every successful (or unsuccessful) incremental build.
npx tsc -p tsconfig.watch.json --watch | while read -r line; do
    # Print the original tsc output
    printf "%s\n" "$line"

    # Check if compilation finished
    if [[ "$line" == *"Watching for file changes."* ]]; then
        echo -e "${GREEN}✨ Compilation finished. Running prettier on JS files...${NC}"
        cat <<EEE


        Prettier process ...


EEE

        
        # Run prettier on all .js files in the composition directory.
        # Prettier is very fast and will only write to files that actually need fixing.
        ./node_modules/.bin/prettier --config prettier.config.ts --write .
    fi
done
