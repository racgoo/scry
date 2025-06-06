import * as babel from "@babel/core";
import ScryAst from "./scry.ast.js";
import ScryChecker from "./scry.check.js";
import { ScryAstVariable, TRACE_MARKER, TRACE_ZONE } from "./scry.constant.js";

function scryBabelPlugin({ types: t }: { types: typeof babel.types }) {
  const visitor = {
    Program: {
      enter(
        path: babel.NodePath<babel.types.Program>,
        state: babel.PluginPass
      ) {
        if (ScryChecker.isNodeModule(state)) return;
        const esm = ScryChecker.isESM(state.file.opts.filename ?? "");

        //Add Zone.js initialization code
        path.node.body.unshift(
          t.addComment(
            t.variableDeclaration("const", [
              t.variableDeclarator(
                t.identifier(TRACE_ZONE),
                t.callExpression(
                  t.memberExpression(
                    t.memberExpression(
                      t.identifier("Zone"),
                      t.identifier("current")
                    ),
                    t.identifier("fork")
                  ),
                  [
                    t.objectExpression([
                      t.objectProperty(
                        t.identifier("name"),
                        t.stringLiteral(TRACE_ZONE)
                      ),
                      t.objectProperty(
                        t.identifier("properties"),
                        t.objectExpression([
                          t.objectProperty(
                            t.identifier(ScryAstVariable.parentTraceId),
                            t.nullLiteral()
                          ),
                        ])
                      ),
                    ]),
                  ]
                )
              ),
            ]),
            "leading",
            TRACE_MARKER
          )
        );

        //Add Zone.js import statement
        if (esm) {
          //For esm target
          path.node.body.unshift(
            t.importDeclaration([], t.stringLiteral("zone.js"))
          );
        } else {
          //For commonjs target
          path.node.body.unshift(
            t.expressionStatement(
              t.callExpression(t.identifier("require"), [
                t.stringLiteral("zone.js/mix"),
              ])
            )
          );
        }

        //Add Extractor import statement
        if (esm) {
          //For esm target
          path.node.body.unshift(
            t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier("Extractor"),
                  t.identifier("Extractor")
                ),
              ],
              t.stringLiteral("@racgoo/scry")
            )
          );
        } else {
          //For commonjs target
          path.node.body.unshift(
            t.variableDeclaration("const", [
              t.variableDeclarator(
                t.objectPattern([
                  t.objectProperty(
                    t.identifier("Extractor"),
                    t.identifier("Extractor"),
                    false,
                    true
                  ),
                ]),
                t.callExpression(t.identifier("require"), [
                  t.stringLiteral("@racgoo/scry"),
                ])
              ),
            ])
          );
        }
      },
    },

    NewExpression: {
      exit(
        path: babel.NodePath<babel.types.NewExpression>,
        state: babel.PluginPass
      ) {
        try {
          injectTrace(path, state, t);
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
          injectTrace(path, state, t);
        } catch (error) {
          console.error("Babel plugin error:", error);
        }
      },
    },
  };

  //Inject trace code with origin call(With zone.js scope)
  function injectTrace(
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
    //Check if the function is a trace zone initialization
    if (
      scryChecker.isTraceZoneInitialization(path.node) ||
      scryChecker.isReactDOMCall(path.node)
    ) {
      path.skip();
      return;
    }
    //Check if this generation is valid
    if (!developmentMode || duplicated || jsx) {
      return;
    }
    const callee = path.node.callee;

    if (t.isIdentifier(callee, { name: "require" })) {
      //require blocking
      return;
    }

    if (
      //Check if the function is an arrow function
      // t.isArrowFunctionExpression(callee) ||
      //Check if the function has a TRACE_MARKER marker comment
      path.node.leadingComments?.some((comment) =>
        comment.value.includes(TRACE_MARKER)
      ) ||
      //Check if the function is a event function
      (t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object) &&
        callee.object.name === "process" &&
        t.isIdentifier(callee.property) &&
        ["on", "emit"].includes(callee.property.name)) ||
      //Check if the function is a process function
      (t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object) &&
        callee.object.name === "process")
    ) {
      return;
    }
    //Check chained function
    const chained = scryChecker.isChainedFunction(path);

    //Extract function name
    const fnName = scryAst.getFunctionName(path);
    //Extract origin function code(current not working.. need fix)
    const { classCode, originCode } = scryAst.getOriginCode(path);
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
                originCode,
                classCode,
                chained,
              })
            )
          ),
          //Create returnValue
          scryAst.createReturnValue(),
          //Set current traceId as parent traceId(With zone.js scope)
          scryAst.craeteGlobalParentTraceIdSetterWithTraceId(),
          //Update returnValue with origin execution(With zone.js scope)
          scryAst.craeteReturnValueUpdaterWithOriginExecution(path),
          //Generate 'exit' event
          t.expressionStatement(
            scryAst.emitTraceEvent(
              scryAst.getEventDetail(path, state, {
                type: "exit",
                fnName,
                originCode,
                classCode,
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

    //Add marker comment(hmm. it's duplicated with variable marker, but it's mark checker. variable marker is just flag for annonimous function.)
    newNode.leadingComments = [
      { type: "CommentBlock", value: ` ${TRACE_MARKER} ` },
    ];

    path.replaceWith(newNode);
    path.skip();
  }

  return { visitor };
}

export default scryBabelPlugin;
