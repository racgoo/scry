import * as babel from "@babel/core";
import { Environment } from "../utils/enviroment.js";
import Extractor from "../utils/extractor.js";
import { ACTIVE_TRACE_ID_SET, DEVELOPMENT_MODE, TRACE_MARKER, TRACE_ZONE } from "./scry.constant.js";

//Checkers for scry babel plugin
class ScryChecker {
  private t: typeof babel.types;
  constructor(t: typeof babel.types) {
    this.t = t;
  }

  //Check if the file is excluded
  public isExcluded(state: babel.PluginPass, excludedLibs: string[]) {
    const filePath = state?.filename || "";
    return excludedLibs.some((lib) => filePath.includes(lib));
  }

  //Check if the function is imported without variable declaration(ex, import "@racgoo/scry")
  public isImportedWithoutVariableDeclaration(
    path: babel.NodePath<babel.types.Program>,
    source: string,
    esm: boolean
  ) {
    if (esm) {
      if (
        path.node.body.some(
          (node) =>
            node.type === "ImportDeclaration" &&
            node.source.value === source &&
            node.specifiers.length === 0
        )
      ) {
        return true;
      }
    } else {
      if (
        path.node.body.some(
          (node) =>
            node.type === "ExpressionStatement" &&
            node.expression.type === "CallExpression" &&
            node.expression.callee.type === "Identifier" &&
            node.expression.callee.name === "require" &&
            node.expression.arguments.length > 0 &&
            node.expression.arguments[0].type === "StringLiteral" &&
            node.expression.arguments[0].value === source
        )
      ) {
        return true;
      }
    }
    return false;
  }

  //Check if the function is imported
  public isImported(
    path: babel.NodePath<babel.types.Program>,
    name: string,
    source: string,
    esm: boolean
  ) {
    let imported;
    if (esm) {
      //Check is imported
      imported = path.node.body.some(
        (node) =>
          node.type === "ImportDeclaration" &&
          node.source.value === source &&
          node.specifiers.some(
            (spec) =>
              spec.type === "ImportSpecifier" &&
              spec.imported.type === "Identifier" &&
              spec.imported.name === name
          )
      );
    } else {
      //Check is required
      imported = path.node.body.some(
        (node) =>
          node.type === "VariableDeclaration" &&
          node.declarations.some((decl) => {
            if (
              decl.init &&
              decl.init.type === "CallExpression" &&
              decl.init.callee.type === "Identifier" &&
              decl.init.callee.name === "require" &&
              decl.init.arguments.length > 0 &&
              decl.init.arguments[0].type === "StringLiteral" &&
              decl.init.arguments[0].value === source
            ) {
              // 구조분해 할당인지 확인
              if (
                decl.id.type === "ObjectPattern" &&
                decl.id.properties.some(
                  (prop) =>
                    prop.type === "ObjectProperty" &&
                    prop.key.type === "Identifier" &&
                    prop.key.name === name
                )
              ) {
                return true;
              }
              // Identifier case: `const Tracer = require("@racgoo/scry")`
              // The binding name must match `name` — the previous code returned
              // true for ANY identifier binding regardless of what name was used,
              // causing false-positive "already imported" results.
              if (
                decl.id.type === "Identifier" &&
                decl.id.name === name
              ) {
                return true;
              }
            }
            return false;
          })
      );
    }
    return imported;
  }

  //Check if the file is imported
  // public isImported(
  //   path: babel.NodePath<babel.types.Program>,
  //   name: string,
  //   source: string
  // ) {
  //   return path.node.body.some(
  //     (node) =>
  //       node.type === "ImportDeclaration" &&
  //       node.source.value === source &&
  //       node.specifiers.some(
  //         (spec) =>
  //           (spec.type === "ImportSpecifier" ||
  //             spec.type === "ImportDefaultSpecifier") &&
  //           spec.local.name === name
  //       )
  //   );
  // }
  //Check if the file is a ESM file(Deprecated, because, babel plugin can't clearly detect ESM file)
  static isESM(state: babel.PluginPass): boolean {
    const sourceType = state.file?.opts.parserOpts?.sourceType;
    if (sourceType === "script") {
      //CJS
      return false;
    }
    if (sourceType === "module") {
      //ESM
      return true;
    }
    //OTHERWISE by resolve with package.json
    const filePath = state?.filename || "";
    const pkgJson = Extractor.extractNearestPackageJSON(filePath);
    if (!pkgJson) return false;
    return pkgJson?.type === "module";
  }

  //Check if the function is a ReactDOM call
  public isReactDOMCall(
    node: babel.types.CallExpression | babel.types.NewExpression
  ): boolean {
    const callee = node.callee;
    if (!this.t.isMemberExpression(callee)) return false;
    return (
      this.t.isIdentifier(callee.object) &&
      (callee.object.name === "ReactDOM" ||
        callee.object.name === "ReactDOMClient") &&
      this.t.isIdentifier(callee.property) &&
      callee.property.name === "createRoot"
    );
  }

  //Check if the function is a Tracer method
  public isTracerMethod(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const callee = path.node.callee;
    return (
      this.t.isMemberExpression(callee) &&
      this.t.isIdentifier(callee.object) &&
      callee.object.name === "Tracer" &&
      (this.t.isIdentifier(callee.property, { name: "start" }) ||
        this.t.isIdentifier(callee.property, { name: "end" }))
    );
  }

  public isExtractorMethod(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const callee = path.node.callee;
    return (
      this.t.isMemberExpression(callee) &&
      this.t.isIdentifier(callee.object) &&
      callee.object.name === "Extractor" &&
      this.t.isIdentifier(callee.property, { name: "extractCode" })
    );
  }

  //Check if the function is a Zone.root[ACTIVE_TRACE_ID_SET] = new Set() initialization
  public isZoneRootActiveTraceSetInit(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    if (this.t.isNewExpression(path.node)) {
      const parent = path.parentPath;
      if (
        parent &&
        this.t.isAssignmentExpression(parent.node) &&
        parent.node.operator === "=" &&
        this.t.isMemberExpression(parent.node.left) &&
        this.t.isMemberExpression(parent.node.left.object) &&
        this.t.isIdentifier(parent.node.left.object.object, { name: "Zone" }) &&
        this.t.isIdentifier(parent.node.left.object.property, {
          name: "root",
        }) &&
        // Re-enabled: narrowed to ACTIVE_TRACE_ID_SET only.
        // Any Zone.root[x] = new X() was previously skipped; now only the
        // exact scry-generated initialisation is skipped.
        this.t.isStringLiteral(parent.node.left.property, {
          value: ACTIVE_TRACE_ID_SET,
        }) &&
        parent.node.left.computed
      ) {
        parent.skip();
        return true;
      }
    }
    return false;
  }

  //Check if the function is a default TraceZone initialization on top level of file
  //'DefaultTraceZone' works when TraceZone is not initialized in function scope
  public isDefaultTraceZoneInitialization(node: babel.types.Node): boolean {
    if (!this.t.isCallExpression(node)) return false;
    const callee = node.callee;
    if (!this.t.isMemberExpression(callee)) return false;
    //Check if the function is a Zone.current.fork() pattern
    if (
      this.t.isMemberExpression(callee.object) &&
      this.t.isIdentifier(callee.object.object) &&
      callee.object.object.name === "Zone" &&
      this.t.isIdentifier(callee.object.property) &&
      callee.object.property.name === "current" &&
      this.t.isIdentifier(callee.property) &&
      callee.property.name === "fork"
    ) {
      //Check if the function is a TRACE_ZONE initialization code
      const args = node.arguments[0];
      if (
        this.t.isObjectExpression(args) &&
        args.properties.some(
          (prop) =>
            this.t.isObjectProperty(prop) &&
            this.t.isIdentifier(prop.key) &&
            prop.key.name === "name" &&
            this.t.isStringLiteral(prop.value) &&
            prop.value.value === TRACE_ZONE
        )
      ) {
        return true;
      }
    }
    return false;
  }

  //Check if the file is in node_modules
  static isNodeModule(state: babel.PluginPass) {
    const filePath = state?.filename || "";
    if (filePath.includes("node_modules")) {
      return true;
    } else {
      return false;
    }
  }

  //Check if the environment is development. Called at Babel transform time (always Node.js context).
  //The isNodeJS() guard was removed because bundlers like Vite can expose a window object in their
  //build context, causing the check to incorrectly return false for browser-targeted builds.
  static isDevelopmentMode() {
    if (typeof process !== "undefined" && process.env) {
      return process.env.NODE_ENV === DEVELOPMENT_MODE;
    }
    return false;
  }

  //Check if the function is a chained function
  public isChainedFunction(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const callee = path.node.callee;
    return (
      this.t.isMemberExpression(callee) &&
      this.t.isCallExpression(callee.object)
    );
  }

  //Check if the function is a pre-processed function
  public isDuplicateFunction(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    // const callee = path.node.callee;
    return (
      // this.t.isArrowFunctionExpression(callee) ||
      path.node.leadingComments?.some((comment) =>
        comment.value.includes(TRACE_MARKER)
      )
    );
  }

  // Skip instrumentation only for process.on / process.emit which directly
  // interact with the Node.js event loop and can cause infinite recursion when
  // wrapped in a Zone-forking IIFE. Other process.* calls (e.g. process.cwd(),
  // process.exit()) are safe to trace and were unintentionally excluded by the
  // previous overly-broad second OR branch.
  public isNodejsProcessMethod(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    return (
      this.t.isMemberExpression(path.node.callee) &&
      this.t.isIdentifier(path.node.callee.object) &&
      path.node.callee.object.name === "process" &&
      this.t.isIdentifier(path.node.callee.property) &&
      ["on", "emit", "nextTick", "addListener", "removeListener"].includes(
        path.node.callee.property.name
      )
    );
  }
  //Check if the function is a JSX function
  public isJSX(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const callee = path.node.callee;
    return (
      (this.t.isIdentifier(callee) && callee.name.startsWith("_jsx")) ||
      (this.t.isMemberExpression(callee) &&
        this.t.isIdentifier(callee.object) &&
        callee.object.name === "React")
    );
  }

  /**
   * Returns true for any call whose callee is rooted at the `Zone` global,
   * e.g. Zone.current.fork(), Zone[traceId].run(), Zone.root.xxx().
   *
   * These are ALL generated by the scry plugin itself. Re-instrumenting them
   * would cause infinite nesting and "Duplicate declaration 'traceContext'"
   * because the generated IIFE is re-queued for traversal after replaceWith()
   * and its internal Zone method calls are visited again by CallExpression.exit.
   */
  public isZoneInternalCall(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ): boolean {
    const callee = path.node.callee;
    if (!this.t.isMemberExpression(callee)) return false;
    // Walk up the member expression chain to find the root object.
    // Handles: Zone.current.fork(), Zone[id].run(), Zone.root.addChild(), etc.
    let obj: babel.types.Expression = callee;
    while (this.t.isMemberExpression(obj)) {
      obj = (obj as babel.types.MemberExpression).object;
    }
    return this.t.isIdentifier(obj) && obj.name === "Zone";
  }

  /**
   * Returns true when the current CallExpression / NewExpression is a
   * descendant of a plugin-generated IIFE (identified by TRACE_MARKER in its
   * leadingComments).
   *
   * This is the primary guard that prevents plugin-generated code from being
   * re-instrumented during Babel's re-traversal that follows path.replaceWith().
   * It catches all cases that more specific checks might miss, e.g.:
   *  - the original call embedded verbatim in createMaxDepthGuard's return
   *  - globalThis.dispatchEvent() / window.dispatchEvent() in error paths
   *  - any other generated CallExpression outside the TRACE_ZONE.run() block
   */
  public isInsideGeneratedIIFE(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ): boolean {
    let current = path.parentPath;
    while (current) {
      if (
        (current.isCallExpression() || current.isNewExpression()) &&
        (
          current.node as babel.types.CallExpression | babel.types.NewExpression
        ).leadingComments?.some((c) => c.value.includes(TRACE_MARKER))
      ) {
        return true;
      }
      current = current.parentPath;
    }
    return false;
  }
}

export default ScryChecker;
