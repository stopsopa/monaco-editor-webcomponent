set -e
echo "${0}: fixing require(*.js) to require(*.cjs)"
find ./dist/cjs -type f -name "*.js" | while read -r file; do
  echo "Renaming ${file} to ${file%.js}.cjs..."
  perl -pi -e 's#require\("(.*?)\.js"\)#require\("\1.cjs"\)#g' "${file}"
  mv "${file}" "${file%.js}.cjs"
done


