// Babel plugin: replace `import.meta` with an empty object expression.
// Some ESM-only deps (e.g. zustand/esm/middleware.mjs) reference
// `import.meta.env` guarded by a ternary. On the Metro web target this emits
// a bare `import.meta` which is invalid outside a module and crashes the page.
// Replacing it with `({})` makes `import.meta.env` resolve to `undefined`
// (falsy) so the guarded fallback path is taken. Native is unaffected.
module.exports = function transformImportMeta({ types: t }) {
  return {
    name: "transform-import-meta-to-empty-object",
    visitor: {
      MetaProperty(path) {
        if (path.node.meta && path.node.meta.name === "import") {
          path.replaceWith(t.objectExpression([]));
        }
      },
    },
  };
};
