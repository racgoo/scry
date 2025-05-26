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

            //Check if this generation is valid
            if (!developmentMode || duplicated || jsx) {
              return;
            }

            const callee = path.node.callee;
            if (
              // 람다 함수 검사
              t.isArrowFunctionExpression(callee) ||
              // 특수 마커 주석 있는지 확인
              path.node.leadingComments?.some((comment) =>
                comment.value.includes(TRACE_MARKER)
              ) ||
              // 이벤트 리스너 등록 함수 호출인지 체크
              (t.isMemberExpression(callee) &&
                t.isIdentifier(callee.object) &&
                callee.object.name === "process" &&
                t.isIdentifier(callee.property) &&
                ["on", "emit"].includes(callee.property.name)) ||
              // 또는 더 일반적으로 process 관련 호출은 모두 제외
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
                  //Update global currentTraceId
                  scryAst.setCurrentTraceIdAsGlobalCurrentTraceId(),
                  //Get parent traceId (default to null)
                  scryAst.getParentTraceId(),
                  //Generate 'enter' event
                  t.expressionStatement(
                    scryAst.createEmitTraceEvent(
                      scryAst.getEventDetail(path, state, {
                        type: "enter",
                        fnName,
                        chained,
                      })
                    )
                  ),

                  //Set current traceId as parent traceId
                  scryAst.setCurrentTraceIdAsGlobalParentTraceId(),
                  //Execute original function (current traceId is set as parent traceId to inner function)
                  scryAst.createReturnValueWithOriginExecution(path),
                  //Restore parent traceId
                  scryAst.setParentTraceIdAsGlobalParentTraceId(),
                  //Generate 'exit' event
                  t.expressionStatement(
                    scryAst.createEmitTraceEvent(
                      scryAst.getEventDetail(path, state, {
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
