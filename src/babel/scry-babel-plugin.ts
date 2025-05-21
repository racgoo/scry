import * as babel from "@babel/core";

const processedNodes = new WeakSet();

function scryBabelPlugin({ types: t }: { types: typeof babel.types }) {
  // 특수 마커 - 변환 유무 확인용
  const TRACE_MARKER = "___SCRY_TRACED___";

  return {
    visitor: {
      Program: {
        enter(
          path: babel.NodePath<babel.types.Program>,
          state: babel.PluginPass
        ) {
          const filePath = state.filename || "";
          if (
            processedNodes.has(path.node) ||
            filePath.includes("node_modules")
          ) {
            return;
          }

          // scry 임포트 확인 및 추가는 필요 없음 - 직접 람다식 사용
        },
      },

      CallExpression: {
        exit(path: babel.NodePath<babel.types.CallExpression>) {
          try {
            const callee = path.node.callee;

            // 이미 변환된 호출 식별 및 건너뛰기
            if (
              // 람다 함수 검사
              t.isArrowFunctionExpression(callee) ||
              // 특수 마커 주석 있는지 확인
              path.node.leadingComments?.some((comment) =>
                comment.value.includes(TRACE_MARKER)
              )
            ) {
              return;
            }

            // 일반 함수 호출만 처리 (JSX 관련 제외)
            if (
              (t.isIdentifier(callee) && callee.name.startsWith("_jsx")) ||
              (t.isMemberExpression(callee) &&
                t.isIdentifier(callee.object) &&
                callee.object.name === "React")
            ) {
              return;
            }

            // 함수 이름 추출
            let fnName = "anonymous";
            if (t.isIdentifier(callee)) {
              fnName = callee.name;
            } else if (
              t.isMemberExpression(callee) &&
              t.isIdentifier(callee.property)
            ) {
              fnName = callee.property.name;
            }

            // 새 노드 생성 (마커 주석 추가)
            const newNode = t.callExpression(
              t.arrowFunctionExpression(
                [],
                t.blockStatement([
                  // 'enter' 이벤트 발생 - 함수 실행 전
                  t.expressionStatement(
                    t.callExpression(
                      t.memberExpression(
                        t.identifier("globalThis"),
                        t.identifier("dispatchEvent")
                      ),
                      [
                        t.newExpression(t.identifier("CustomEvent"), [
                          t.stringLiteral("scry:trace"),
                          t.objectExpression([
                            t.objectProperty(
                              t.identifier("detail"),
                              t.objectExpression([
                                t.objectProperty(
                                  t.identifier("type"),
                                  t.stringLiteral("enter")
                                ),
                                t.objectProperty(
                                  t.identifier("name"),
                                  t.stringLiteral(fnName)
                                ),
                                t.objectProperty(
                                  t.identifier("args"),
                                  t.arrayExpression(
                                    path.node
                                      .arguments as babel.types.Expression[]
                                  )
                                ),
                              ])
                            ),
                          ]),
                        ]),
                      ]
                    )
                  ),

                  // const returnValue = fn(...args)
                  t.variableDeclaration("const", [
                    t.variableDeclarator(
                      t.identifier("returnValue"),
                      t.callExpression(callee, path.node.arguments)
                    ),
                  ]),

                  // 'exit' 이벤트 발생 - 함수 종료 후
                  t.expressionStatement(
                    t.callExpression(
                      t.memberExpression(
                        t.identifier("globalThis"),
                        t.identifier("dispatchEvent")
                      ),
                      [
                        t.newExpression(t.identifier("CustomEvent"), [
                          t.stringLiteral("scry:trace"),
                          t.objectExpression([
                            t.objectProperty(
                              t.identifier("detail"),
                              t.objectExpression([
                                t.objectProperty(
                                  t.identifier("type"),
                                  t.stringLiteral("exit")
                                ),
                                t.objectProperty(
                                  t.identifier("name"),
                                  t.stringLiteral(fnName)
                                ),
                                t.objectProperty(
                                  t.identifier("returnValue"),
                                  t.identifier("returnValue")
                                ),
                              ])
                            ),
                          ]),
                        ]),
                      ]
                    )
                  ),

                  // return returnValue
                  t.returnStatement(t.identifier("returnValue")),
                ])
              ),
              []
            );

            // 마커 주석 추가
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
