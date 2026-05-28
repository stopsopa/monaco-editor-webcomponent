import path from "node:path";

import cacheTemplate, { setProduceData, th } from "./cacheTemplate.ts";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const cacheEnabled = typeof process.env.DISABLE_CACHE_TEMPLATE === "undefined";

console.log(`template.ts: cache enabled: ${cacheEnabled}`);

export const web = path.resolve(__dirname, "..", "templates");

setProduceData((data: any) => {
  data.renderCond = (template: string) => {
    if (typeof template !== "string") {
      throw th(`renderCond: template must be string. Received: ${template}, typeof >${typeof template}<`);
    }

    if (template.endsWith(".html") && !template.includes("\n")) {
      return data.render(template, data);
    } else {
      return template;
    }
  };
  return data;
});

export const cachePool = cacheTemplate(cacheEnabled);

export const template = cachePool(path.join(web, "_noop_.html"));
