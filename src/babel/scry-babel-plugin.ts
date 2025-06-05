import * as babel from "@babel/core";
import ScryAst from "./scry.ast.js";
import ScryChecker from "./scry.check.js";
import { ScryAstVariable, TRACE_MARKER, TRACE_ZONE } from "./scry.constant.js";

function scryBabelPlugin({ types: t }: { types: typeof babel.types }) {
  return {
    visitor: {
      Program: {
        enter(
          path: babel.NodePath<babel.types.Program>,
          state: babel.PluginPass
        ) {
          if (ScryChecker.isNodeModule(state)) return;

          // Zone.js import 구문 추가
          path.node.body.unshift(
            t.importDeclaration([], t.stringLiteral("zone.js"))
          );

          // Extractor import 구문 추가
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

          // Zone 초기화 코드 추가
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
        },
      },

      NewExpression: {
        exit(
          path: babel.NodePath<babel.types.NewExpression>,
          state: babel.PluginPass
        ) {
          try {
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
            if (
              //Check if the function is an arrow function
              t.isArrowFunctionExpression(callee) ||
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
            //Extract origin function code
            const { classCode, originCode } = scryAst.getOriginCode(path);
            //Extract origin code key(not used. but it's for future use. need archive origin code map)
            // const originCodeKey = scryAst.getOriginCodeKey(path);

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

                  scryAst.createCodeExtractor(path),

                  scryAst.createParentTraceIdFromGlobalParentTraceId(),

                  //Extract parent traceId (default to null)
                  // scryAst.createParentTraceIdExtractor(path),
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

                  //Set current traceId as parent traceId
                  // scryAst.craeteCurrentTraceIdSetterAsGlobalParentTraceId(),
                  //Create returnValue
                  scryAst.createReturnValue(),
                  //Update returnValue with origin execution
                  // scryAst.createParentTraceIdInjector(path),

                  scryAst.craeteGlobalParentTraceIdSetterWithTraceId(),

                  scryAst.craeteReturnValueUpdaterWithOriginExecution(path),

                  // scryAst.craeteGlobalParentTraceIdSetterWithParentTraceId(),
                  //Restore parent traceId
                  // scryAst.createParentTraceIdSetterAsGlobalParentTraceId(),
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
            //Extract origin function code
            const { classCode, originCode } = scryAst.getOriginCode(path);
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

                  scryAst.createCodeExtractor(path),
                  //Extract parent traceId (default to null)
                  // scryAst.createParentTraceIdExtractor(path),
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
                  //Set current traceId as parent traceId
                  // scryAst.craeteCurrentTraceIdSetterAsGlobalParentTraceId(),
                  //Create returnValue
                  scryAst.createReturnValue(),
                  //Inject parent traceId to method or function
                  // scryAst.createParentTraceIdInjector(path),
                  scryAst.craeteGlobalParentTraceIdSetterWithTraceId(),
                  //Update returnValue with origin execution
                  scryAst.craeteReturnValueUpdaterWithOriginExecution(path),

                  // scryAst.craeteGlobalParentTraceIdSetterWithParentTraceId(),
                  //Restore parent traceId
                  // scryAst.createParentTraceIdSetterAsGlobalParentTraceId(),
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
          } catch (error) {
            console.error("Babel plugin error:", error);
          }
        },
      },
    },
  };
}

export default scryBabelPlugin;
