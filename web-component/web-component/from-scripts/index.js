import modURLSearchParams from "../../urlchange/urlchange.js";
import { syncURLSearchParams, buildUrlWithSearchParams } from "../../urlchange/toolsURLSearchParams.js";
import { isMonacoTheme, MonacoDiffElement } from "../../monaco-diff.js";
import { CenterAndHeightResizer } from "../../CenterAndHeightResizer.js";
await customElements.whenDefined(MonacoDiffElement.tagName);
await customElements.whenDefined(CenterAndHeightResizer.tagName);
const diffEl = document.querySelector(MonacoDiffElement.tagName);
if (!(diffEl instanceof MonacoDiffElement)) {
    throw new Error("Missing <monaco-diff> element");
}
await diffEl.whenReady();
function wireResizerUrlSync(resizer, index) {
    const config = {
        left: {
            default: resizer.getAttribute("left") ?? "100px",
            getParam: "l",
            encode: (value) => value,
            decode: (value) => value,
        },
        center: {
            default: resizer.getAttribute("center") ?? "1200px",
            getParam: "c",
            encode: (value) => value,
            decode: (value) => value,
        },
        height: {
            default: resizer.getAttribute("height") ?? "100px",
            getParam: "h",
            encode: (value) => value,
            decode: (value) => value,
        },
    };
    const { trackUrl } = modURLSearchParams(config, (key, i) => `${key}-${i}`);
    const { setParams } = trackUrl((params, updatedURLSearchParams, governedKeys) => {
        resizer.setAttribute("left", params.left);
        resizer.setAttribute("center", params.center);
        resizer.setAttribute("height", params.height);
        const current = new URLSearchParams(window.location.search);
        const next = syncURLSearchParams(current, governedKeys, updatedURLSearchParams);
        if (next.toString() !== current.toString()) {
            const url = buildUrlWithSearchParams(window.location.href, next);
            history.replaceState(history.state, "", url);
        }
    }, { ctx: index, fireOnMount: true });
    const syncToUrl = () => {
        setParams({
            left: resizer.getAttribute("left") ?? config.left.default,
            center: resizer.getAttribute("center") ?? config.center.default,
            height: resizer.getAttribute("height") ?? config.height.default,
        });
    };
    resizer.addEventListener("onLeft", syncToUrl);
    resizer.addEventListener("onCenter", syncToUrl);
    resizer.addEventListener("onHeight", syncToUrl);
}
function applyThemeAttribute(diffEl, theme) {
    if (theme) {
        diffEl.setAttribute("theme", theme);
    }
    else {
        diffEl.removeAttribute("theme");
    }
}
function applyLanguageAttribute(diffEl, language) {
    if (language) {
        diffEl.setAttribute("language", language);
    }
    else {
        diffEl.removeAttribute("language");
    }
}
document.querySelectorAll(CenterAndHeightResizer.tagName).forEach((el, index) => {
    wireResizerUrlSync(el, index);
});
const themeSelect = document.getElementById("theme-select");
if (!(themeSelect instanceof HTMLSelectElement)) {
    throw new Error("Missing #theme-select element");
}
const languageSelect = document.getElementById("language-select");
if (!(languageSelect instanceof HTMLSelectElement)) {
    throw new Error("Missing #language-select element");
}
const { trackUrl: trackUrlNoIndex } = modURLSearchParams({
    theme: {
        default: "",
        getParam: "theme",
        encode: (value) => value,
        decode: (value) => (isMonacoTheme(value) ? value : ""),
    },
    language: {
        default: "javascript",
        getParam: "lang",
        encode: (value) => value,
        decode: (value) => value,
    },
});
const { setParam } = trackUrlNoIndex((params, updatedURLSearchParams, governedKeys) => {
    themeSelect.value = params.theme;
    applyThemeAttribute(diffEl, params.theme);
    languageSelect.value = params.language;
    applyLanguageAttribute(diffEl, params.language);
    const current = new URLSearchParams(window.location.search);
    const next = syncURLSearchParams(current, governedKeys, updatedURLSearchParams);
    if (next.toString() !== current.toString()) {
        const url = buildUrlWithSearchParams(window.location.href, next);
        history.replaceState(history.state, "", url);
    }
}, { fireOnMount: true });
themeSelect.addEventListener("change", () => {
    setParam("theme", themeSelect.value);
});
languageSelect.addEventListener("change", () => {
    setParam("language", languageSelect.value);
});
