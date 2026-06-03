import { useCallback, useMemo } from "react";
import { mergeURLSearchParams } from "./toolsURLSearchParams.js";
// ─── Factory ─────────────────────────────────────────────────────────────────
export default function modURLSearchParams(config, keyFn) {
    function separateIndexedSearchParams(search, ctx) {
        const allowedKeys = Object.values(config).map((def) => {
            const getParam = def.getParam;
            return keyFn ? keyFn(getParam, ctx) : getParam;
        });
        const normalized = typeof search === "string" ? new URLSearchParams(search) : search;
        return mergeURLSearchParams(new URLSearchParams(), allowedKeys, normalized);
    }
    function useQueryParams(search, navigate, ctx) {
        const applyKey = useCallback((baseKey) => {
            return keyFn ? keyFn(baseKey, ctx) : baseKey;
        }, [ctx]);
        // Derive the current URLSearchParams from the search prop, filtered by allowed keys
        const currentParams = useMemo(() => {
            return separateIndexedSearchParams(search, ctx);
        }, [search, ctx]);
        // Compute the parsed params whenever the URLSearchParams change
        const params = useMemo(() => {
            const result = {};
            for (const [key, def] of Object.entries(config)) {
                const d = def;
                const raw = currentParams.get(applyKey(d.getParam));
                result[key] = raw !== null ? d.decode(raw) : d.default;
            }
            return result;
        }, [currentParams, applyKey]);
        // ── setParam: update a single key ────────────────────────────────────────
        // If the new value equals the default, the key is removed from the URL
        // instead of being set — keeping the URL clean. The value will still
        // appear in `params` as the default.
        const setParam = useCallback((key, value) => {
            if (!navigate)
                return;
            const def = config[key];
            const finalKey = applyKey(def.getParam);
            const currentSearchParams = new URLSearchParams(window.location.search);
            const next = new URLSearchParams(currentSearchParams);
            if (JSON.stringify(value) === JSON.stringify(def.default)) {
                next.delete(finalKey);
            }
            else {
                next.set(finalKey, def.encode(value));
            }
            if (next.toString() !== currentSearchParams.toString()) {
                navigate({ search: next.toString() }, { replace: true });
            }
        }, [navigate, applyKey]);
        // ── setParams: update multiple keys at once ──────────────────────────────
        // Same default-elision logic applied per key.
        const setParams = useCallback((updates) => {
            if (!navigate)
                return;
            const currentSearchParams = new URLSearchParams(window.location.search);
            const next = new URLSearchParams(currentSearchParams);
            for (const [key, value] of Object.entries(updates)) {
                const def = config[key];
                if (def && value !== undefined) {
                    const finalKey = applyKey(def.getParam);
                    if (JSON.stringify(value) === JSON.stringify(def.default)) {
                        next.delete(finalKey);
                    }
                    else {
                        next.set(finalKey, def.encode(value));
                    }
                }
            }
            if (next.toString() !== currentSearchParams.toString()) {
                navigate({ search: next.toString() }, { replace: true });
            }
        }, [navigate, applyKey]);
        return {
            params, // decoded + typed values, defaults filled in
            updatedURLSearchParams: currentParams, // the live URLSearchParams object
            setParam,
            setParams,
        };
    }
    return {
        useQueryParams,
        separateIndexedSearchParams,
    };
}
