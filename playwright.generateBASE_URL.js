// @ts-nocheck
export default function buildBASE_URL(prefix) {
  if (typeof prefix !== "string" || !prefix.trim()) {
    throw new Error(`buildBASE_URL error: prefix should be a non empty string`);
  }

  /** @type {import('./types.types.ts').ThType} ThType */
  const th = (msg) => new Error(`${prefix} buildBASE_URL error: ${msg}`);

  const log = (msg) => process.stdout.write(`${prefix} ${msg}\n`);

  function envcheck(name, ret) {
    if (typeof process.env[name] !== "string") {
      if (ret) return false;

      throw th(`process.env.${name} is not a string`);
    }

    if (!process.env[name].trim()) {
      if (ret) return false;

      throw th(`process.env.${name} is an ampty string`);
    }

    return true;
  }

  const protocolRegex = /^https?:\/\//;
  if (envcheck("BASE_URL", true)) {
    log(`existing BASE_URL: >${process.env.BASE_URL}<`);
  } else {
    envcheck("NODE_API_PROTOCOL");

    envcheck("NODE_API_HOST");

    if (!["http", "https"].includes(process.env.NODE_API_PROTOCOL)) {
      throw th(`process.env.NODE_API_PROTOCOL should be http or https`);
    }

    process.env.BASE_URL = `${process.env.NODE_API_PROTOCOL}://${process.env.NODE_API_HOST}`;

    if (envcheck("NODE_API_PORT", true)) {
      process.env.BASE_URL += `:${process.env.NODE_API_PORT}`;
    }

    log(`generated BASE_URL: >${process.env.BASE_URL}<`);
  }

  envcheck("BASE_URL");

  if (!protocolRegex.test(process.env.BASE_URL)) {
    throw th(`process.env.BASE_URL don't match ${protocolRegex}`);
  }
}

// module.exports = buildBASE_URL;
