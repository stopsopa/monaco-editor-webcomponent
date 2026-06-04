// used in:
//   https://stopsopa.github.io/pages/node/index.rendered.html#express-template
//
// node --env-file .env server-template.ts
// express extension: https://raw.githubusercontent.com/stopsopa/roderic/86495ef554314d388e7f6ef10ee4de6d12bcbcff/libs/express-extend-res.js?token=GHSAT0AAAAAACVQ4Q66S6J6DLZRVFB5DQLSZXEOC2Q
// pnpm install "@types/express" "@types/lodash" "@types/node" "@types/serve-index"

import path from "path";

import express from "express";

import type { Application, Request, Response, NextFunction } from "express";

// use multer for multipart/form-data https://github.com/expressjs/multer

// https://www.npmjs.com/package/cookie-parser
// import cookieParser from "cookie-parser";

// https://stackoverflow.com/a/23613092
import serveIndex from "serve-index";

// import { template } from "./lib/template.ts";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "");

const distDir = path.resolve(root, "dist");
const publicDir = path.resolve(root, "public");
const wget = path.resolve(root, "composite-select");

const { HOST: host, PORT: portRaw } = process.env;

if (!host || !portRaw) {
  throw new Error("HOST and PORT environment variables are required");
}

const port = parseInt(portRaw, 10);

const app: Application = express();

app.use(express.urlencoded({ extended: false }));

app.use(express.json());

// app.get("/test", async (req: Request, res: Response, next: NextFunction) => {
//   const tmp = "parent.dynamic.html";

//   try {
//     const content = template(tmp, {
//       req,
//       res,
//       ...req.query,
//       ...req.body,
//       child: "relative/parent.html",
//     });

//     return res.send(content);
//   } catch (e: any) {
//     console.error(`Error rendering ${tmp}`, e);

//     return res.status(500).send(`Template Error: ${e.message}`);
//   }
// });

app.use(
  express.static(distDir, {
    maxAge: "356d",
    index: false,
  }),
);
app.use(
  express.static(wget, {
    maxAge: "356d",
    index: false,
  }),
);

app.use(
  express.static(root, {
    maxAge: "356d",
    index: false,
  }),
);

app.get("/vite-project/dist*", (req, res, next) => {
  if (path.extname(req.path)) {
    return next();
  }
  res.sendFile(path.resolve(root, "vite-project/dist/index.html"));
});

app.use(
  "/public",
  serveIndex(publicDir, {
    icons: true,
    view: "details",
    hidden: false,
  }),
);

app.listen(port, host, () => {
  console.log(
    `\n 🌎  Server is running\n` +
      `    <monaco-diff> (scripts)  http://${host}:${port}/web-component/web-component/from-scripts/index.html\n` +
      `    <monaco-diff> (JS API)   http://${host}:${port}/web-component/web-component/from-js/index.html\n` +
      `    MonacoDiffManager        http://${host}:${port}/web-component/manager/index.html\n`,
  );
});
