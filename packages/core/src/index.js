export const nowIso = () => new Date().toISOString();
const prefixLabel = {
    p: "p",
    c: "c",
    s: "s"
};
export const generateId = (prefix) => {
    const base = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const compact = base.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
    return `${prefixLabel[prefix]}_${compact}`;
};
export const createProject = (input) => {
    const ts = nowIso();
    return {
        id: generateId("p"),
        createdAt: ts,
        updatedAt: ts,
        ...input
    };
};
export const createConversation = (input) => {
    const ts = nowIso();
    return {
        id: generateId("c"),
        createdAt: ts,
        updatedAt: ts,
        ...input
    };
};
export const createSession = (input) => {
    const ts = nowIso();
    return {
        id: generateId("s"),
        createdAt: ts,
        updatedAt: ts,
        ...input
    };
};
