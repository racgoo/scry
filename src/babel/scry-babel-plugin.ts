import * as babel from "@babel/core";
import ScryAst from "./scry.ast.js";
import ScryChecker from "./scry.check.js";
import { ScryAstVariable, TRACE_MARKER } from "./scry.constant.js";

const EXCLUDED_LIBS = [
  "node_modules/zone.js",
  "node_modules/@racgoo/scry",
  "node_modules/flatted",
  "node_modules/js-base64",
];

/**
 * Options accepted by all scryBabelPlugin variants.
 *
 * include  – Only transform files whose absolute path matches at least one of these
 *            glob-style patterns. Defaults to all files.
 * exclude  – Skip files whose absolute path matches any of these patterns.
 *            All node_modules are always excluded regardless of this option.
 * maxDepth – Maximum Zone nesting depth. Calls beyond this limit are still executed
 *            but not traced, preventing runaway memory growth in deeply recursive code.
 *            Defaults to 50.
 */
export interface ScryPluginOptions {
  include?: string[];
  exclude?: string[];
  maxDepth?: number;
}

/**
 * Converts a glob-like pattern to a RegExp and tests the file path.
 * Supports ** (any path segments) and * (any chars within one segment).
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*/g, "[^/\\\\]*")
    .replace(/__DOUBLE_STAR__/g, ".*");
  return new RegExp(escaped).test(filePath);
}

function isFileIncluded(
  filePath: string,
  options: ScryPluginOptions
): boolean {
  // Fast path: always exclude all node_modules. This is the single most impactful
  // performance guard – previously only 4 specific packages were excluded, causing
  // every third-party library in a bundle to be fully instrumented.
  if (filePath.includes("node_modules")) return false;

  // Belt-and-suspenders guard for known scry internals in non-standard install layouts.
  if (EXCLUDED_LIBS.some((lib) => filePath.includes(lib))) return false;

  // User-defined exclude patterns
  if (options.exclude?.some((p) => matchesPattern(filePath, p))) return false;

  // User-defined include patterns (absent = include everything)
  if (options.include && options.include.length > 0) {
    return options.include.some((p) => matchesPattern(filePath, p));
  }

  return true;
}

function scryBabelPlugin(
  { types: t }: { types: typeof babel.types },
  moduleType: "cjs" | "esm" | "auto",
  options: ScryPluginOptions = {}
) {
  // Create ScryAst and ScryChecker ONCE per plugin invocation rather than per visited node.
  // For a file with 1 000 CallExpressions the old code instantiated 2 000 objects.
  const scryAst = new ScryAst(t);
  const scryChecker = new ScryChecker(t);
  const maxDepth = options.maxDepth ?? 50;

  const pre = function (this: babel.PluginPass) {
    const filename = this.filename ?? "";
    if (!isFileIncluded(filename, options)) return;

    try {
      if (this.file && this.file.path) {
        const code = this.file.code;
        this.file.path.traverse({
          FunctionDeclaration(path) {
            try {
              scryAst.preProcess(path, scryAst, scryChecker, code);
            } catch (error) {
              console.error("pre process FunctionDeclaration error:", error);
            }
          },
          ClassDeclaration(path) {
            try {
              scryAst.preProcess(path, scryAst, scryChecker, code);
            } catch (error) {
              console.error("pre process ClassDeclaration error:", error);
            }
          },
          ClassMethod(path) {
            try {
              scryAst.preProcess(path, scryAst, scryChecker, code);
            } catch (error) {
              console.error("pre process ClassMethod error:", error);
            }
          },
          ObjectMethod(path) {
            try {
              scryAst.preProcess(path, scryAst, scryChecker, code);
            } catch (error) {
              console.error("pre process ObjectMethod error:", error);
            }
          },
          ArrowFunctionExpression(path) {
            try {
              scryAst.preProcess(path, scryAst, scryChecker, code);
            } catch (error) {
              console.error(
                "pre process ArrowFunctionExpression error:",
                error
              );
            }
          },
        });
      }
    } catch (error) {
      console.error("Babel plugin pre error:", error);
    }
  };

  const visitor = {
    Program: {
      enter(
        path: babel.NodePath<babel.types.Program>,
        state: babel.PluginPass
      ) {
        try {
          const filename = state.filename ?? "";
          if (!isFileIncluded(filename, options)) return;

          // "auto" mode: detect from Babel's sourceType and nearest package.json.
          // Previously users had to choose scryBabelPluginForESM vs scryBabelPluginForCJS.
          const esm =
            moduleType === "auto"
              ? ScryChecker.isESM(state)
              : moduleType === "esm";

          // Add the flag first (as the initial unshift); subsequent unshifts
          // will push the plugin imports in front of it, so the flag naturally
          // lands AFTER all plugin-added imports and BEFORE the original body.
          path.node.body.unshift(
            t.expressionStatement(scryAst.createPluginAppliedVariable())
          );

          scryAst.createZoneRootInitialization(path);
          scryAst.createTraceConextDeclare(path);
          scryAst.createExtractorDeclaration(path, esm);
          scryAst.createTracerDeclaration(path, esm);
          scryAst.createZoneJSDeclaration(path, esm);
        } catch (error) {
          console.error("Babel plugin Program.enter error:", error);
        }
      },
    },
    FunctionDeclaration: (
      path: babel.NodePath<babel.types.FunctionDeclaration>
    ) => {
      try {
        // Skip plugin-generated IIFE bodies — they already have the correct
        // structure and must not receive an extra var traceContext that would
        // shadow the outer function's traceContext closure variable.
        if (scryChecker.isInsideGeneratedIIFE(path)) return;
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("FunctionDeclaration error:", error);
      }
    },
    FunctionExpression: (
      path: babel.NodePath<babel.types.FunctionExpression>
    ) => {
      try {
        if (scryChecker.isInsideGeneratedIIFE(path)) return;
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("FunctionExpression error:", error);
      }
    },
    ArrowFunctionExpression: (
      path: babel.NodePath<babel.types.ArrowFunctionExpression>
    ) => {
      try {
        if (scryChecker.isInsideGeneratedIIFE(path)) return;
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("ArrowFunctionExpression error:", error);
      }
    },
    ClassMethod: (path: babel.NodePath<babel.types.ClassMethod>) => {
      try {
        if (scryChecker.isInsideGeneratedIIFE(path)) return;
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("ClassMethod error:", error);
      }
    },
    ObjectMethod: (path: babel.NodePath<babel.types.ObjectMethod>) => {
      try {
        if (scryChecker.isInsideGeneratedIIFE(path)) return;
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("ObjectMethod error:", error);
      }
    },
    NewExpression: {
      enter(path: babel.NodePath<babel.types.NewExpression>) {
        // Skip the IIFE's body immediately in the enter phase so Babel never
        // descends into its complex generated structure.  Without this guard,
        // every ancestor traversal re-enters the IIFE and adds ~20+ call-stack
        // frames per level, causing "Maximum call stack size exceeded" in files
        // with many call expressions.
        if (scryChecker.isGeneratedIIFE(path.node)) {
          path.skip();
        }
      },
      exit(
        path: babel.NodePath<babel.types.NewExpression>,
        state: babel.PluginPass
      ) {
        try {
          const filename = state.filename ?? "";
          if (!isFileIncluded(filename, options)) return;
          if (scryChecker.isGeneratedIIFE(path.node)) {
            return;
          }
          transformCall(path, state, t, scryAst, scryChecker, maxDepth);
        } catch (error) {
          console.error("NewExpression.exit error:", error);
        }
      },
    },
    CallExpression: {
      enter(path: babel.NodePath<babel.types.CallExpression>) {
        // Same guard as NewExpression.enter — prevent deep traversal into
        // plugin-generated IIFE bodies.
        if (scryChecker.isGeneratedIIFE(path.node)) {
          path.skip();
        }
      },
      exit(
        path: babel.NodePath<babel.types.CallExpression>,
        state: babel.PluginPass
      ) {
        try {
          const filename = state.filename ?? "";
          if (!isFileIncluded(filename, options)) return;
          if (scryChecker.isGeneratedIIFE(path.node)) {
            return;
          }
          transformCall(path, state, t, scryAst, scryChecker, maxDepth);
        } catch (error) {
          console.error("CallExpression.exit error:", error);
        }
      },
    },
  };

  const post = function (this: babel.PluginPass) {
    try {
      const body = this.file?.path?.node?.body;
      if (!body) return;

      // Program.enter already injected the flag for included files.
      // Only add it here for excluded files (e.g. node_modules that Babel still
      // processes) so that at least one module marks the plugin as applied.
      const alreadySet = body.some(
        (node) =>
          t.isExpressionStatement(node) &&
          t.isAssignmentExpression(
            (node as babel.types.ExpressionStatement).expression
          ) &&
          t.isMemberExpression(
            (
              (node as babel.types.ExpressionStatement)
                .expression as babel.types.AssignmentExpression
            ).left
          ) &&
          t.isIdentifier(
            (
              (
                (node as babel.types.ExpressionStatement)
                  .expression as babel.types.AssignmentExpression
              ).left as babel.types.MemberExpression
            ).property,
            { name: ScryAstVariable.pluginApplied }
          )
      );

      if (!alreadySet) {
        // Insert AFTER the last import declaration so the generated code is
        // valid ESM (some bundlers reject regular statements before imports).
        let insertIdx = 0;
        for (let i = 0; i < body.length; i++) {
          if (t.isImportDeclaration(body[i])) {
            insertIdx = i + 1;
          }
        }
        body.splice(
          insertIdx,
          0,
          t.expressionStatement(scryAst.createPluginAppliedVariable())
        );
      }
    } catch (error) {
      console.error("Babel plugin post error:", error);
    }
  };

  return { visitor, pre, post };
}

function transformCall(
  path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>,
  state: babel.PluginPass,
  t: typeof babel.types,
  scryAst: ScryAst,
  scryChecker: ScryChecker,
  maxDepth: number
) {
  const developmentMode = ScryChecker.isDevelopmentMode();
  const duplicated = scryChecker.isDuplicateFunction(path);
  const jsx = scryChecker.isJSX(path);
  const refreshReg = t.isIdentifier(path.node.callee, { name: "$RefreshReg$" });
  const zoneRootInitialization = scryChecker.isZoneRootActiveTraceSetInit(path);
  const traceZoneInitialization = scryChecker.isDefaultTraceZoneInitialization(
    path.node
  );
  const reactDOMCall = scryChecker.isReactDOMCall(path.node);
  const nodejsProcessFunction = scryChecker.isNodejsProcessMethod(path);
  const requireCall = t.isIdentifier(path.node.callee, { name: "require" });
  const tracerMethod = scryChecker.isTracerMethod(path);
  const extractorMethod = scryChecker.isExtractorMethod(path);
  // Skip Zone.*.run(), Zone[id].run(), Zone.current.fork(), etc.
  // These are all generated by the plugin itself and must never be re-wrapped.
  // Without this guard, the re-traversal that follows path.replaceWith() would
  // wrap TRACE_ZONE.run(callback) in another IIFE, causing infinite nesting and
  // "Duplicate declaration 'traceContext'" errors.
  const zoneInternalCall = scryChecker.isZoneInternalCall(path);
  // Skip any call that lives inside a plugin-generated IIFE (identified by
  // TRACE_MARKER in its leadingComments).  This is the comprehensive guard
  // against all forms of re-instrumentation during Babel's re-traversal:
  //  - the original call embedded in the max-depth guard's return statement
  //  - globalThis.dispatchEvent() / window.dispatchEvent() in error paths
  //  - any other generated CallExpression outside TRACE_ZONE.run()
  // Without this, deeply-nested or complex files throw
  // "Maximum call stack size exceeded" in vite:react-babel.
  const insideGeneratedIIFE = scryChecker.isInsideGeneratedIIFE(path);

  const skips = [
    !developmentMode,
    zoneRootInitialization,
    traceZoneInitialization,
    zoneInternalCall,
    insideGeneratedIIFE,
    reactDOMCall,
    requireCall,
    duplicated,
    jsx,
    nodejsProcessFunction,
    refreshReg,
    tracerMethod,
    extractorMethod,
  ];
  if (skips.some((skip) => skip)) {
    path.skip();
    return;
  }

  const awaitExpression = path.findParent((p) => p.isAwaitExpression())
    ? true
    : false;
  const chained = scryChecker.isChainedFunction(path);
  const fnName = scryAst.getFunctionName(path);

  // For chained calls (callee.object is itself a CallExpression, i.e., the
  // receiver is a previously-generated IIFE) we must NOT emit a maxDepthGuard.
  // The guard's fallback embeds the full callee chain, which is also referenced
  // by processedCall inside TRACE_ZONE.run.  Having the same IIFE node appear
  // at TWO places in the output causes @babel/generator to print it twice,
  // and since each level doubles the previous level's code, the total output
  // grows as O(2^N) for N chained calls — hitting Node's max string length.
  // Chained calls are sequential (not recursive) so depth limiting is
  // unnecessary for them anyway.
  const maxDepthGuardNode = chained
    ? null
    : scryAst.createMaxDepthGuard(maxDepth, path.node);

  const newNode = t.callExpression(
    t.arrowFunctionExpression(
      [],
      t.blockStatement(
        [
        scryAst.createMarkerVariable(),
        scryAst.createTraceId(),
        scryAst.createTraceContextOptionalUpdater(),
        scryAst.createCodeExtractor(path, chained),
        scryAst.createReturnValueDeclaration(),
        // Skip Zone instrumentation when nesting depth exceeds maxDepth.
        // The original call is still executed – only tracing overhead is bypassed.
        // null for chained calls (filtered below).
        maxDepthGuardNode,
        scryAst.createNewZoneContextWithTraceId(),
        scryAst.createDeclareTraceZoneWithTraceId(),
        scryAst.craeteOriginCallExecutor(path, state, chained),
        t.expressionStatement(
          t.assignmentExpression(
            "=",
            t.memberExpression(
              t.memberExpression(
                t.memberExpression(
                  t.identifier("Zone"),
                  t.identifier("current")
                ),
                t.identifier(ScryAstVariable._properties)
              ),
              t.identifier(ScryAstVariable.prevReturnValue)
            ),
            t.identifier(ScryAstVariable.returnValue)
          )
        ),
        // For async functions returnValue is the Promise at this point; the
        // real resolved/rejected value is emitted by the onFulfilled/onRejected
        // callbacks registered inside craeteOriginCallExecutor. Only emit the
        // synchronous exit event when the return value is NOT a Promise.
        t.ifStatement(
          t.unaryExpression(
            "!",
            t.logicalExpression(
              "&&",
              t.identifier(ScryAstVariable.returnValue),
              t.memberExpression(
                t.identifier(ScryAstVariable.returnValue),
                t.identifier("then")
              )
            )
          ),
          t.blockStatement([
            t.expressionStatement(
              scryAst.emitTraceEvent(
                scryAst.getEventDetail(path, state, {
                  type: "exit",
                  fnName,
                  chained,
                })
              )
            ),
          ])
        ),
        t.returnStatement(t.identifier(ScryAstVariable.returnValue)),
        ].filter(Boolean) as babel.types.Statement[]
      ),
      awaitExpression
    ),
    []
  );
  newNode.leadingComments = [
    { type: "CommentBlock", value: ` ${TRACE_MARKER} ` },
  ];

  // Register the IIFE node in the WeakSet BEFORE calling replaceWith so that
  // any re-traversal triggered by Babel immediately sees it as generated code.
  scryChecker.registerGeneratedIIFE(newNode);

  // Call path.skip() BEFORE path.replaceWith() so that the re-queued path
  // already has shouldSkip=true when Babel's traversal context processes it.
  // Calling skip() after replaceWith() has a race-condition: in some Babel
  // versions the re-queued entry is checked for shouldSkip before our handler
  // sets the flag, causing the generated IIFE to be re-traversed and
  // triggering cascading re-instrumentation ("Maximum call stack size exceeded").
  path.skip();
  path.replaceWith(newNode);
}

/** Auto-detects ESM vs CJS per file (recommended for most setups). */
function scryBabelPluginAutoDetect(
  api: { types: typeof babel.types },
  options: ScryPluginOptions = {}
) {
  return scryBabelPlugin(api, "auto", options);
}

/** Explicit CJS variant (use when auto-detection fails for your toolchain). */
function scryBabelPluginForCJS(
  api: { types: typeof babel.types },
  options: ScryPluginOptions = {}
) {
  return scryBabelPlugin(api, "cjs", options);
}

/** Explicit ESM variant (use when auto-detection fails for your toolchain). */
function scryBabelPluginForESM(
  api: { types: typeof babel.types },
  options: ScryPluginOptions = {}
) {
  return scryBabelPlugin(api, "esm", options);
}

export {
  scryBabelPluginForCJS,
  scryBabelPluginForESM,
  scryBabelPluginAutoDetect,
};
