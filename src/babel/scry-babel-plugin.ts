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

function scryBabelPlugin(
  { types: t }: { types: typeof babel.types },
  type: "cjs" | "esm" //Output type
) {
  // Pre process for origin code comment(but it must be done in visitor)
  const pre = function (this: babel.PluginPass) {
    if (
      this.filename &&
      EXCLUDED_LIBS.some((lib) => this.filename?.includes(lib))
    ) {
      return; //Skip if the file is excluded
    }

    try {
      if (this.file && this.file.path) {
        //Origin code
        const code = this.file.code;
        const scryAst = new ScryAst(t);
        const scryChecker = new ScryChecker(t);
        this.file.path.traverse({
          FunctionDeclaration(path) {
            //Pre process for origin code comment
            try {
              scryAst.preProcess(path, scryAst, scryChecker, code);
            } catch (error) {
              console.error("pre process FunctionDeclaration error:", error);
            }
          },
          ClassDeclaration(path) {
            //Pre process for origin code comment
            try {
              scryAst.preProcess(path, scryAst, scryChecker, code);
            } catch (error) {
              console.error("pre process ClassDeclaration error:", error);
            }
          },
          ClassMethod(path) {
            //Pre process for origin code as string
            try {
              scryAst.preProcess(path, scryAst, scryChecker, code);
            } catch (error) {
              console.error("pre process ClassMethod error:", error);
            }
          },
          ObjectMethod(path) {
            //Pre process for origin code as string
            try {
              scryAst.preProcess(path, scryAst, scryChecker, code);
            } catch (error) {
              console.error("pre process ObjectMethod error:", error);
            }
          },
          ArrowFunctionExpression(path) {
            //Pre process for origin code as string
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
      console.error("Babel plugin error:", error);
    }
  };

  //Visitor for inject trace code
  const visitor = {
    Program: {
      enter(
        path: babel.NodePath<babel.types.Program>,
        state: babel.PluginPass
      ) {
        try {
          //check if the file is excluded
          const scryChecker = new ScryChecker(t);
          if (scryChecker.isExcluded(state, EXCLUDED_LIBS)) {
            return;
          }

          const esm = type === "esm";
          const scryAst = new ScryAst(t);
          // Add Zone.root initialization code if not initialized
          scryAst.createZoneRootInitialization(path);
          //Create trace context declare
          scryAst.createTraceConextDeclare(path);
          //Add Extractor import statement
          scryAst.createExtractorDeclaration(path, esm);
          //Add Tracer import statement
          scryAst.createTracerDeclaration(path, esm);
          //Add Zone.js import statement
          scryAst.createZoneJSDeclaration(path, esm);
        } catch (error) {
          console.error("Babel plugin error:", error);
        }
      },
    },
    FunctionDeclaration: (
      path: babel.NodePath<babel.types.FunctionDeclaration>
    ) => {
      try {
        const scryAst = new ScryAst(t);
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("FunctionDeclaration error:", error);
      }
    },
    FunctionExpression: (
      path: babel.NodePath<babel.types.FunctionExpression>
    ) => {
      try {
        const scryAst = new ScryAst(t);
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("FunctionExpression error:", error);
      }
    },
    ArrowFunctionExpression: (
      path: babel.NodePath<babel.types.ArrowFunctionExpression>
    ) => {
      try {
        const scryAst = new ScryAst(t);
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("ArrowFunctionExpression error:", error);
      }
    },
    ClassMethod: (path: babel.NodePath<babel.types.ClassMethod>) => {
      try {
        const scryAst = new ScryAst(t);
        scryAst.createTraceConextDeclare(path);
      } catch (error) {
        console.error("ClassMethod error:", error);
      }
    },
    ObjectMethod: (path: babel.NodePath<babel.types.ObjectMethod>) => {
      try {
        const scryAst = new ScryAst(t);
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
          transformCall(path, state, t);
        } catch (error) {
          console.error("Babel plugin error:", error);
        }
      },
    },
    CallExpression: {
      exit(
        path: babel.NodePath<babel.types.CallExpression>,
        state: babel.PluginPass
      ) {
        try {
          //check if the file is excluded
          const scryChecker = new ScryChecker(t);
          if (scryChecker.isExcluded(state, EXCLUDED_LIBS)) {
            return;
          }
          //AST transform
          transformCall(path, state, t);
        } catch (error) {
          console.error("Babel plugin error:", error);
        }
      },
    },
  };

  //Transform call code with trace code(With zone.js scope)
  function transformCall(
    path: babel.NodePath<
      babel.types.CallExpression | babel.types.NewExpression
    >,
    state: babel.PluginPass,
    t: typeof babel.types
  ) {
    //Create checker and inject t (babel.types must be injected by transformFile function)
    const scryChecker = new ScryChecker(t);
    //Create ast generator
    const scryAst = new ScryAst(t);
    //Check development mode
    const developmentMode = ScryChecker.isDevelopmentMode();
    //Check if the function is a duplicate function
    const duplicated = scryChecker.isDuplicateFunction(path);
    //Check if the function is a JSX function
    const jsx = scryChecker.isJSX(path);
    //Check if the function is a react refresh registration
    const refreshReg = t.isIdentifier(path.node.callee, {
      name: "$RefreshReg$",
    });
    //Check if the function is a Zone.root[ACTIVE_TRACE_ID_SET] = new Set() initialization
    const zoneRootInitialization =
      scryChecker.isZoneRootActiveTraceSetInit(path);
    //Check if the function is a trace zone initialization
    const traceZoneInitialization =
      scryChecker.isDefaultTraceZoneInitialization(path.node);
    //Check if the function is a reactDOM call
    const reactDOMCall = scryChecker.isReactDOMCall(path.node);
    //Check if the function is a nodejs process function
    const nodejsProcessFunction = scryChecker.isNodejsProcessMethod(path);
    //Check if the function is a "require" call
    const requireCall = t.isIdentifier(path.node.callee, { name: "require" });
    //Check if the function is a tracer method(Tracer.start() or Tracer.end())
    const tracerMethod = scryChecker.isTracerMethod(path);
    //Check if the function is a extractor method(Extractor.extractCode())
    const extractorMethod = scryChecker.isExtractorMethod(path);

    //Skip conditions
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
    //Skip if any skip is true
    if (skips.some((skip) => skip)) {
      path.skip();
      return;
    }
    //Check if the function is an await expression
    const awaitExpression = path.findParent((p) => p.isAwaitExpression())
      ? true
      : false;
    //Extract isChained function
    const chained = scryChecker.isChainedFunction(path);
    //Extract function name
    const fnName = scryAst.getFunctionName(path);
    //Generate new node (with marker comment)
    const newNode = t.callExpression(
      //Arrow function expression("this" must not be reset)
      t.arrowFunctionExpression(
        [],
        t.blockStatement([
          //Create marker variable
          scryAst.createMarkerVariable(),
          //Create traceId
          scryAst.createTraceId(),
          //Create parent traceId optional updater(for async/await)
          scryAst.createTraceContextOptionalUpdater(),
          //Extract code from location
          scryAst.createCodeExtractor(path, chained),

          //Create returnValue
          scryAst.createReturnValueDeclaration(),
          //Create new trace-zone based on current trace-id forked with parent traceId
          scryAst.createNewZoneContextWithTraceId(),
          //Create Declare traceZone
          scryAst.createDeclareTraceZoneWithTraceId(),
          //Update returnValue with origin execution(With zone.js scope)
          scryAst.craeteOriginCallExecutor(path, state, chained),
          t.expressionStatement(
            t.assignmentExpression(
              "=",
              t.memberExpression(
                t.identifier("globalThis"),
                t.identifier(ScryAstVariable.prevReturnValue)
              ),
              t.identifier(ScryAstVariable.returnValue)
            )
          ),
          //Generate 'exit' event
          //hmm,, under code can be hidden in "craeteOriginCallExecutor"
          t.expressionStatement(
            scryAst.emitTraceEvent(
              scryAst.getEventDetail(path, state, {
                type: "exit",
                fnName,
                chained,
              })
            )
          ),
          //Return origin function result
          t.returnStatement(t.identifier(ScryAstVariable.returnValue)),
        ]),
        awaitExpression
      ),
      []
    );
    //Add marker comment
    newNode.leadingComments = [
      { type: "CommentBlock", value: ` ${TRACE_MARKER} ` },
    ];

    path.replaceWith(newNode);
    path.skip();
  }

  const post = function (this: babel.PluginPass) {
    //All files are processed(it is not necessary to check if the file is excluded, Tracer needs it)
    try {
      if (this.file && this.file.path) {
        const scryAst = new ScryAst(t);
        //Add plugin applied variable to the end of the file(it is hoisted)
        this.file.path.node.body.unshift(
          t.expressionStatement(scryAst.createPluginAppliedVariable())
        );
      }
    } catch (error) {
      console.error("Babel plugin error:", error);
    }
  };

  return { visitor, pre, post };
}

//For CJS output(CommonJS)
function scryBabelPluginForCJS({ types: t }: { types: typeof babel.types }) {
  return scryBabelPlugin({ types: t }, "cjs");
}
//For ESM output(ES Module)
function scryBabelPluginForESM({ types: t }: { types: typeof babel.types }) {
  return scryBabelPlugin({ types: t }, "esm");
}

export { scryBabelPluginForCJS, scryBabelPluginForESM };
