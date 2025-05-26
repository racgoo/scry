import * as babel from "@babel/core";
import ScryAst from "@babel/scry.ast";
import ScryChecker from "@babel/scry.check";
import { TRACE_MARKER } from "@babel/scry.constant";

function scryBabelPlugin({ types: t }: { types: typeof babel.types }) {
  return {
    visitor: {
      Program: {
        enter(state: babel.PluginPass) {
          if (ScryChecker.isNodeModule(state)) return;
        },
      },

      CallExpression: {
        exit(
          path: babel.NodePath<babel.types.CallExpression>,
          state: babel.PluginPass
        ) {
          try {
            if (
              !ScryChecker.isDevelopmentMode() ||
              ScryChecker.isDuplicateFunction(path) ||
              ScryChecker.isJSX(path)
            ) {
              return;
            }

            //Check chained function
            const chained = ScryChecker.isChainedFunction(path);
            //Extract function name
            const fnName = ScryAst.getFunctionName(path);

            //Generate new node (with marker comment)
            const newNode = t.callExpression(
              //Arrow function expression("this" must not be reset)
              t.arrowFunctionExpression(
                [],
                t.blockStatement([
                  //Create marker variable
                  ScryAst.createMarkerVariable(),
                  //Create traceId
                  ScryAst.createTraceId(),
                  //Update global currentTraceId
                  ScryAst.setCurrentTraceIdAsGlobalCurrentTraceId(),
                  //Get parent traceId (default to null)
                  ScryAst.getParentTraceId(),
                  //Generate 'enter' event
                  t.expressionStatement(
                    ScryAst.createEmitTraceEvent(
                      ScryAst.getEventDetail(path, state, {
                        type: "enter",
                        fnName,
                        chained,
                      })
                    )
                  ),

                  //Set current traceId as parent traceId
                  ScryAst.setCurrentTraceIdAsGlobalParentTraceId(),
                  //Execute original function (current traceId is set as parent traceId to inner function)
                  ScryAst.createReturnValueWithOriginExecution(path),
                  //Restore parent traceId
                  ScryAst.setParentTraceIdAsGlobalParentTraceId(),
                  //Generate 'exit' event
                  t.expressionStatement(
                    ScryAst.createEmitTraceEvent(
                      ScryAst.getEventDetail(path, state, {
                        type: "exit",
                        fnName,
                        chained,
                      })
                    )
                  ),
                  //Return origin function result
                  t.returnStatement(t.identifier("returnValue")),
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
