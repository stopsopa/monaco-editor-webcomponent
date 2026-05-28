import path from "node:path";
import fs from "node:fs";
import libTemplate from "lodash/template.js";
import type { TemplateOptions, TemplateExecutor } from "lodash";

const defaultOptions: TemplateOptions = {
  interpolate: /<%=([\s\S]+?)%>/g, // this somehow stops template from processing `${i}` which is what I want
  // to see exactly what is going on put debugger in file node_modules/lodash/template.js
  // in place: https://github.com/lodash/lodash/blob/4.18.1/dist/lodash.js#L14928
  // you will see before setting here interpolate: /<%=([\s\S]+?)%>/g,
  // value of sourceURL will be
  // /<%-([\s\S]+?)%>|<%=([\s\S]+?)%>|\$\{([^\\}]*(?:\\.[^\\}]*)*)\}|<%([\s\S]+?)%>|$/g
  // but when set:
  // /<%-([\s\S]+?)%>|<%=([\s\S]+?)%>|($^)|<%([\s\S]+?)%>|$/g

  escape: /<%-([\s\S]+?)%>/g,
  evaluate: /<%([\s\S]+?)%>/g,
  variable: "d",
};

let produceData: Function;

export function setProduceData(producer: Function) {
  produceData = producer;
}

export const th = (msg: string) => new Error(`cacheTemplate error: ${msg}`);

export default function createCachePool(cacheEnabled = true, options?: TemplateOptions) {
  const cache = new Map<string, TemplateExecutor>();
  const activeOptions = options == undefined ? defaultOptions : options;

  /**
   * @param parentFileAbsolute , WARNING: parent file absolute path - for initial call we have to set path like /dir/dir1/_file_
   * to allow library to extract directory
   * @param permaData permanent data for templates
   */
  const produceRender = function produceRender(parentFileAbsolute: string, permaData = {}) {
    if (!parentFileAbsolute) {
      throw th("parentFile is required");
    }

    if (!path.isAbsolute(parentFileAbsolute)) {
      throw th(`parentFileAbsolute must be absolute path. Received: ${parentFileAbsolute}`);
    }

    function render(template: string): TemplateExecutor;
    function render(template: string, data: object): string;
    function render(template: string, data?: object): TemplateExecutor | string {
      try {
        if (typeof template !== "string") {
          throw th(`template must be string. Received: ${template}`);
        }
        const templateFilePath = path.resolve(path.dirname(parentFileAbsolute), template);

        let executor: TemplateExecutor;

        if (cacheEnabled && cache.has(templateFilePath)) {
          executor = cache.get(templateFilePath)!;
        } else {
          const content = fs.readFileSync(templateFilePath, "utf8");

          executor = (function () {
            try {
              const render = libTemplate(content, activeOptions);

              return (data: object) => {
                let newData = {
                  template: {
                    file: templateFilePath,
                    dir: path.dirname(templateFilePath),
                  },
                  ...permaData,
                  ...data,
                  // Each template gets a render bound to its own path so relative imports
                  // inside sub-templates resolve relative to that sub-template's location.
                  render: produceRender(templateFilePath, permaData),
                };

                if (typeof produceData === "function") {
                  newData = produceData(newData);
                }

                return render(newData);
              };
            } catch (e: any) {
              if (e && e?.message && !e?.__template) {
                e.message = `produceRender('${parentFileAbsolute}').render('${template}') error:\n${e.message}`;
                e.__template = true;
              }
              throw e;
            }
          })() as TemplateExecutor;

          if (cacheEnabled) {
            cache.set(templateFilePath, executor);
          }
        }

        if (data === undefined) {
          return executor;
        }

        return executor(data);
      } catch (e: any) {
        if (e && e?.message && !e?.__template) {
          e.message = `produceRender('${parentFileAbsolute}').render('${template}') error:\n${e.message}`;
          e.__template = true;
        }
        throw e;
      }
    }

    return render;
  };

  produceRender.getCache = () => cache;
  produceRender.resetCache = () => cache.clear();

  return produceRender;
}
