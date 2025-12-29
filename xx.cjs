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
    [`server`]: {
      command: `
set -e
        
node --env-file=.env server.js
`,
      description: `run server`,
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
