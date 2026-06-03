import path from "node:path";

import fs from "fs";

import template from "lodash/template.js";

/**
    /**
 * WARNING: This method is not safe because it forwards get and post without validation to template
     * /
     const render = produceRender(filePath, {
    fs,
    path,
    req,
    res,
    ...req.query,
    ...req.body,
    });

    const content = render(filePath);

    return res.send(content);
 */
/**
 * http://0.0.0.0:5678/choice.js/html/index.html
 */
export default function produceRender<P extends object = any>(parentFile: string, permaData: P = {} as P) {
  return function <D extends object = any>(file: string, data?: D) {
    try {
      const filePath = path.resolve(path.dirname(parentFile), file);

      const content = fs.readFileSync(filePath, "utf8");

      return template(content, {
        variable: "d",
        interpolate: /<%=([\s\S]+?)%>/g, // this somehow stops template from processing `${i}` which is what I want
        // to see exactly what is going on put debugger in file node_modules/lodash/template.js
        // in place: https://github.com/lodash/lodash/blob/4.18.1/dist/lodash.js#L14928
        // you will see before setting here interpolate: /<%=([\s\S]+?)%>/g,
        // value of sourceURL will be
        // /<%-([\s\S]+?)%>|<%=([\s\S]+?)%>|\$\{([^\\}]*(?:\\.[^\\}]*)*)\}|<%([\s\S]+?)%>|$/g
        // but when set:
        // /<%-([\s\S]+?)%>|<%=([\s\S]+?)%>|($^)|<%([\s\S]+?)%>|$/g
      })({
        ...permaData,
        ...data,
        template: {
          file: filePath,
          dir: path.dirname(filePath),
        },
        render: produceRender(filePath, permaData),
      });
    } catch (e) {
      console.error(`produceRender() error: in produceRender() for ${file}`, e);

      throw new Error(`produceRender() error: in produceRender() for ${file}`);
    }
  };
}
