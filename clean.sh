
set -e

find . \
  \( \
    -type d -name node_modules -prune -o \
    -type d -name .git -prune -o \
    -type d -name coverage -prune -o \
    -type d -name noprettier -prune \
  \) \
  -o \
  -type f \( -name "*.d.ts" -o -name "*.d.cts" \) -print0 \
| xargs -0 rm -f