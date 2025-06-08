import * as babel from "@babel/core";
import ScryAst from "./scry.ast.js";
import ScryChecker from "./scry.check.js";
import { ScryAstVariable, TRACE_MARKER } from "./scry.constant.js";

function scryBabelPlugin(
  { types: t }: { types: typeof babel.types },
  type: "cjs" | "esm"
) {
  //Pre process for origin code comment
  const esm = type === "esm";
  const pre = function (this: babel.PluginPass) {
    if (ScryChecker.isNodeModule(this)) return;
    try {
      if (this.file && this.file.path) {
        //Origin code
        const code = this.file.code;
        const scryAst = new ScryAst(t);
        const scryChecker = new ScryChecker(t);
        this.file.path.traverse({
          FunctionDeclaration(path) {
            scryAst.preProcess(path, scryAst, scryChecker, code);
          },
          ClassDeclaration(path) {
            scryAst.preProcess(path, scryAst, scryChecker, code);
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
          if (ScryChecker.isNodeModule(state)) return;
          //Deprecated
          // const esm = ScryChecker.isESM(state);
          const esm = type === "esm";
          const scryAst = new ScryAst(t);
          //Under code, add to top, so order is reversed
          // Add Zone.root initialization code if not initialized
          scryAst.createZoneRootInitialization(path);
          //Add Zone.js initialization code
          scryAst.createInitailTraceZone(path);
          //Add Zone.js import statement
          scryAst.createDeclareZoneJS(path, esm);
          //Add Extractor import statement
          scryAst.createDeclareExtractor(path, esm);
        } catch (error) {
          console.error("Babel plugin error:", error);
        }
      },
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
    //Check if the function is a Zone.root[ACTIVE_TRACE_ID_SET] = new Set() initialization
    const zoneRootInitialization = scryChecker.isZoneRootInitialization(path);
    //Check if the function is a trace zone initialization
    const traceZoneInitialization = scryChecker.isTraceZoneInitialization(
      path.node
    );
    //Check if the function is a reactDOM call
    const reactDOMCall = scryChecker.isReactDOMCall(path.node);
    //Check if the function is a nodejs process function
    const nodejsProcessFunction = scryChecker.isNodejsProcessFunction(path);
    //Check if the function is a "require" call
    const requireCall = t.isIdentifier(path.node.callee, { name: "require" });

    //Skip conditions
    const skips = [
      zoneRootInitialization,
      traceZoneInitialization,
      reactDOMCall,
      requireCall,
      !developmentMode,
      duplicated,
      jsx,
      nodejsProcessFunction,
    ];
    //Skip if any skip is true
    if (skips.some((skip) => skip)) {
      path.skip();
      return;
    }

    //Extract isChained function
    const chained = scryChecker.isChainedFunction(path);
    //Extract function name
    const fnName = scryAst.getFunctionName(path);
    //Generate new node (with marker comment)
    const newNode = t.callExpression(
      //Arrow function expression("this" must not be reset)
      t.functionExpression(
        null,
        [],
        t.blockStatement([
          //Create marker variable
          scryAst.createMarkerVariable(),
          //Create traceId
          scryAst.createTraceId(),
          //Extract code from location
          scryAst.createCodeExtractor(),
          //Extract parent traceId (With zone.js scope)
          scryAst.createParentTraceIdFromGlobalParentTraceId(),
          //Generate 'enter' event
          t.expressionStatement(
            scryAst.emitTraceEvent(
              scryAst.getEventDetail(path, state, {
                type: "enter",
                fnName,
                chained,
              })
            )
          ),
          //Create returnValue
          scryAst.createReturnValue(),
          //Set current traceId as parent traceId(With zone.js scope)
          scryAst.craeteGlobalParentTraceIdSetterWithTraceId(),
          //Add active traceId to Zone.root[ACTIVE_TRACE_ID_SET]
          scryAst.createActiveTraceIdAdder(),
          //Update returnValue with origin execution(With zone.js scope)
          scryAst.craeteReturnValueUpdaterWithOriginExecution(path),
          //Generate 'exit' event
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
        ])
      ),
      []
    );
    //Add marker comment
    //(hmm. it's duplicated with variable marker, but it's mark checker. variable marker is just flag for annonimous function.)
    newNode.leadingComments = [
      { type: "CommentBlock", value: ` ${TRACE_MARKER} ` },
    ];
    path.replaceWith(newNode);
    path.skip();
  }
  return { visitor, pre };
}

function scryBabelPluginForCJS({ types: t }: { types: typeof babel.types }) {
  return scryBabelPlugin({ types: t }, "cjs");
}

function scryBabelPluginForESM({ types: t }: { types: typeof babel.types }) {
  return scryBabelPlugin({ types: t }, "esm");
}

export { scryBabelPluginForCJS, scryBabelPluginForESM };
