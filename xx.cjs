// to install go to: https://stopsopa.github.io//pages/bash/index.html#xx

// https://stopsopa.github.io/viewer.html?file=%2Fpages%2Fbash%2Fxx%2Fxx-template.cjs
// edit: https://github.com/stopsopa/stopsopa.github.io/blob/master/pages/bash/xx/xx-template.cjs

// 🚀 -
// ✅ -
// ⚙️  -
// 🗑️  -
// 🛑 -
// to call other xx commands from inside any xx command use:
//    shopt -s expand_aliases && source ~/.bashrc
// after that just do:
//   xx <command_name>

module.exports = (setup) => {
  return {
    help: {
      command: `
set -e 
source .env
# source .env.sh
export NODE_OPTIONS=""
        
cat <<EEE

  🐙 GitHub: $(git ls-remote --get-url origin | awk '{\$1=\$1};1' | tr -d '\\n' | sed -E 's/git@github\\.com:([^/]+)\\/(.+)\\.git/https:\\/\\/github.com\\/\\1\\/\\2/g')

  arango admin:
    http://localhost:\${PORT}

-- DEV NOTES --

EEE

      `,
      description: "Status of all things",
      source: false,
      confirm: false,
    },
    [`git monaco-editor`]: {
      command: `
set -e
        
rm -rf git-monaco-editor
git clone git@github.com:microsoft/monaco-editor.git git-monaco-editor
cd git-monaco-editor
git fetch --tags
git checkout v0.55.1

cat <<EEE

--- this is expected --- vvv
--- this is expected --- vvv
--- this is expected --- vvv
--- this is expected --- vvv

    Cloning into 'git-monaco-editor'...
    remote: Enumerating objects: 50712, done.
    remote: Counting objects: 100% (113/113), done.
    remote: Compressing objects: 100% (49/49), done.
    remote: Total 50712 (delta 91), reused 64 (delta 64), pack-reused 50599 (from 2)
    Receiving objects: 100% (50712/50712), 136.17 MiB | 1.70 MiB/s, done.
    Resolving deltas: 100% (29412/29412), done.
    Note: switching to 'v0.55.1'.

    You are in 'detached HEAD' state. You can look around, make experimental
    changes and commit them, and you can discard any commits you make in this
    state without impacting any branches by switching back to a branch.

    If you want to create a new branch to retain commits you create, you may
    do so (now or later) by using -c with the switch command. Example:

      git switch -c <new-branch-name>

    Or undo this operation with:

      git switch -

    Turn off this advice by setting config variable advice.detachedHead to false

    HEAD is now at 516f350b Fixes missing language exports (#5121)

--- this is expected ---  ^^^
--- this is expected ---  ^^^
--- this is expected ---  ^^^
--- this is expected ---  ^^^
EEE

`,
      description: `remove directory and clone fresh monaco repository and switching to particular tag`,
      confirm: false,
    },
    [`dev`]: {
      command: `   
node --env-file=.env server.js
      `,
      confirm: false,
    },
    [`link`]: {
      command: `
/bin/bash link.sh       
`,
      description: `run catalog-ui-service`,
      confirm: false,
    },

    ...setup,
  };
};
