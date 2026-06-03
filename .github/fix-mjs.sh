set -e
echo "${0}: fixing import(*.js) to import(*.mjs)"
find ./dist/esm -type f -name "*.js" | while read -r file; do
  echo "Renaming ${file} to ${file%.js}.mjs..."
  perl -pi -e 's#import ([^\s]+) from "(.*?)\.js";#import \1 from "\2.mjs";#g' "${file}"
  mv "${file}" "${file%.js}.mjs"
done


