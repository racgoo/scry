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
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("FunctionDeclaration error:", error);
      }
    },
    FunctionExpression: (
      path: babel.NodePath<babel.types.FunctionExpression>
    ) => {
      try {
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("FunctionExpression error:", error);
      }
    },
    ArrowFunctionExpression: (
      path: babel.NodePath<babel.types.ArrowFunctionExpression>
    ) => {
      try {
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("ArrowFunctionExpression error:", error);
      }
    },
    ClassMethod: (path: babel.NodePath<babel.types.ClassMethod>) => {
      try {
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("ClassMethod error:", error);
      }
    },
    ObjectMethod: (path: babel.NodePath<babel.types.ObjectMethod>) => {
      try {
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("ObjectMethod error:", error);
      }
    },
    NewExpression: {
      exit(
        path: babel.NodePath<babel.types.NewExpression>,
        state: babel.PluginPass
      ) {
        try {
          const filename = state.filename ?? "";
          if (!isFileIncluded(filename, options)) return;
          transformCall(path, state, t, scryAst, scryChecker, maxDepth);
        } catch (error) {
          console.error("NewExpression.exit error:", error);
        }
      },
    },
    CallExpression: {
      exit(
        path: babel.NodePath<babel.types.CallExpression>,
        state: babel.PluginPass
      ) {
        try {
          const filename = state.filename ?? "";
          if (!isFileIncluded(filename, options)) return;
          transformCall(path, state, t, scryAst, scryChecker, maxDepth);
        } catch (error) {
          console.error("CallExpression.exit error:", error);
        }
      },
    },
  };

  const post = function (this: babel.PluginPass) {
    try {
      if (this.file && this.file.path) {
        this.file.path.node.body.unshift(
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

  const skips = [
    !developmentMode,
    zoneRootInitialization,
    traceZoneInitialization,
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

  const newNode = t.callExpression(
    t.arrowFunctionExpression(
      [],
      t.blockStatement([
        scryAst.createMarkerVariable(),
        scryAst.createTraceId(),
        scryAst.createTraceContextOptionalUpdater(),
        scryAst.createCodeExtractor(path, chained),
        scryAst.createReturnValueDeclaration(),
        // Skip Zone instrumentation when nesting depth exceeds maxDepth.
        // The original call is still executed – only tracing overhead is bypassed.
        scryAst.createMaxDepthGuard(maxDepth, path.node),
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
        t.expressionStatement(
          scryAst.emitTraceEvent(
            scryAst.getEventDetail(path, state, {
              type: "exit",
              fnName,
              chained,
            })
          )
        ),
        t.returnStatement(t.identifier(ScryAstVariable.returnValue)),
      ]),
      awaitExpression
    ),
    []
  );
  newNode.leadingComments = [
    { type: "CommentBlock", value: ` ${TRACE_MARKER} ` },
  ];

  path.replaceWith(newNode);
  path.skip();
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
