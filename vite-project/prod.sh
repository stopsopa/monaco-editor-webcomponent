

set -e
( 
cd ../

/bin/bash links.sh


)

npm run build

npm run preview