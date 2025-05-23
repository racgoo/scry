import * as babel from "@babel/core";

const processedNodes = new WeakSet();
const ENV_MODE = process.env.NODE_ENV;

function scryBabelPlugin({ types: t }: { types: typeof babel.types }) {
  // 특수 마커 - 변환 유무 확인용
  const TRACE_MARKER = "___SCRY_TRACED___";

  // 이벤트 발생 함수 생성
  const createEmitTraceEvent = (detail: any) => {
    return t.conditionalExpression(
      t.binaryExpression(
        "===",
        t.unaryExpression("typeof", t.identifier("window")),
        t.stringLiteral("undefined")
      ),
      // Node.js
      t.callExpression(
        t.memberExpression(t.identifier("process"), t.identifier("emit")),
        [t.stringLiteral("scry:trace"), detail]
      ),
      // Browser
      t.callExpression(
        t.memberExpression(
          t.identifier("globalThis"),
          t.identifier("dispatchEvent")
        ),
        [
          t.newExpression(t.identifier("CustomEvent"), [
            t.stringLiteral("scry:trace"),
            t.objectExpression([
              t.objectProperty(t.identifier("detail"), detail),
            ]),
          ]),
        ]
      )
    );
  };

  return {
    visitor: {
      Program: {
        enter(
          path: babel.NodePath<babel.types.Program>,
          state: babel.PluginPass
        ) {
          const filePath = state?.filename || "";
          if (
            processedNodes.has(path.node) ||
            filePath.includes("node_modules")
          ) {
            return;
          }
        },
      },

      CallExpression: {
        exit(
          path: babel.NodePath<babel.types.CallExpression>,
          state: babel.PluginPass
        ) {
          console.log("babel is running");
          try {
            if (ENV_MODE !== "development") {
              return;
            }

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

            // 체이닝 관계 확인
            let parentTraceId = null;
            let chained = false;

            if (
              t.isMemberExpression(callee) &&
              t.isCallExpression(callee.object)
            ) {
              chained = true;

              // 중요: 부모 함수 호출의 traceId 변수명 결정
              // 이미 변환된 코드인지 확인
              const parentCallExp = callee.object;
              if (t.isArrowFunctionExpression(parentCallExp.callee)) {
                // 이미 변환된 코드에서 부모의 traceId 변수명 찾기
                const parentBody = parentCallExp.callee.body;
                if (
                  t.isBlockStatement(parentBody) &&
                  parentBody.body.length > 0
                ) {
                  // 첫 번째 문장이 일반적으로 traceId 선언임
                  const firstStmt = parentBody.body[0];
                  if (
                    t.isVariableDeclaration(firstStmt) &&
                    firstStmt.declarations.length > 0 &&
                    t.isIdentifier(firstStmt.declarations[0].id)
                  ) {
                    parentTraceId = firstStmt.declarations[0].id.name;
                  }
                }
              }
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

            // generate new node (add marker comment)
            const newNode = t.callExpression(
              t.arrowFunctionExpression(
                [],
                t.blockStatement([
                  // traceId 생성
                  t.variableDeclaration("const", [
                    t.variableDeclarator(
                      t.identifier("traceId"),
                      t.conditionalExpression(
                        t.binaryExpression(
                          "===",
                          t.unaryExpression(
                            "typeof",
                            t.memberExpression(
                              t.identifier("globalThis"),
                              t.identifier("__scryCalledCount")
                            )
                          ),
                          t.stringLiteral("undefined")
                        ),
                        t.assignmentExpression(
                          "=",
                          t.memberExpression(
                            t.identifier("globalThis"),
                            t.identifier("__scryCalledCount")
                          ),
                          t.numericLiteral(0)
                        ),
                        t.updateExpression(
                          "++",
                          t.memberExpression(
                            t.identifier("globalThis"),
                            t.identifier("__scryCalledCount")
                          ),
                          false
                        )
                      )
                    ),
                  ]),

                  // parentTraceId 속성을 전역 객체에 추가
                  t.expressionStatement(
                    t.assignmentExpression(
                      "=",
                      t.memberExpression(
                        t.identifier("globalThis"),
                        t.identifier("__currentTraceId")
                      ),
                      t.identifier("traceId")
                    )
                  ),

                  // generate 'enter' event
                  t.expressionStatement(
                    createEmitTraceEvent(
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
                          t.identifier("returnValue"),
                          t.nullLiteral()
                        ),
                        t.objectProperty(
                          t.identifier("traceId"),
                          t.identifier("traceId")
                        ),
                        t.objectProperty(
                          t.identifier("source"),
                          t.stringLiteral(
                            `${state?.filename || ""}:${
                              path.node.loc
                                ? `${path.node.loc.start.line}:${path.node.loc.start.column}`
                                : "unknown"
                            }`
                          )
                        ),
                        t.objectProperty(
                          t.identifier("chained"),
                          t.booleanLiteral(chained)
                        ),
                        t.objectProperty(
                          t.identifier("parentTraceId"),
                          parentTraceId
                            ? t.identifier(parentTraceId)
                            : t.nullLiteral()
                        ),
                        t.objectProperty(
                          t.identifier("args"),
                          t.arrayExpression(
                            path.node.arguments.map((arg) => {
                              // 함수인 경우
                              if (
                                t.isArrowFunctionExpression(arg) ||
                                t.isFunctionExpression(arg)
                              ) {
                                const location = arg.loc
                                  ? `${arg.loc.start.line}:${arg.loc.start.column}`
                                  : "unknown";

                                const name =
                                  t.isFunctionExpression(arg) && arg.id
                                    ? arg.id.name
                                    : "anonymous";

                                const params = arg.params
                                  ? `(${arg.params.length} params)`
                                  : "";

                                const filePath =
                                  state?.filename
                                    ?.split("/")
                                    .slice(-2)
                                    .join("/") || "";

                                return t.stringLiteral(
                                  `[Function: ${name}${params} at ${filePath}:${location}]`
                                );
                              }
                              // 문자열 리터럴
                              else if (t.isStringLiteral(arg)) {
                                return t.stringLiteral(arg.value);
                              }
                              // 숫자 리터럴
                              else if (t.isNumericLiteral(arg)) {
                                return t.numericLiteral(Number(arg.value));
                              }
                              // 식별자 (변수)
                              else if (t.isIdentifier(arg)) {
                                return t.identifier(arg.name);
                              }
                              // 객체 표현식
                              else if (t.isObjectExpression(arg)) {
                                return arg;
                              }
                              // 기타 타입
                              else {
                                return t.stringLiteral(`[${arg.type}]`);
                              }
                            })
                          )
                        ),
                      ])
                    )
                  ),

                  // 부모 ID 가져오기 (null로 기본값 설정)
                  t.variableDeclaration("const", [
                    t.variableDeclarator(
                      t.identifier("parentTraceId"),
                      t.logicalExpression(
                        "??", // nullish coalescing
                        t.memberExpression(
                          t.identifier("globalThis"),
                          t.identifier("__parentTraceId")
                        ),
                        t.nullLiteral()
                      )
                    ),
                  ]),

                  // 현재 함수를 부모로 설정
                  t.expressionStatement(
                    t.assignmentExpression(
                      "=",
                      t.memberExpression(
                        t.identifier("globalThis"),
                        t.identifier("__parentTraceId")
                      ),
                      t.identifier("traceId")
                    )
                  ),

                  // 함수 실행
                  t.variableDeclaration("const", [
                    t.variableDeclarator(
                      t.identifier("returnValue"),
                      t.callExpression(callee, path.node.arguments)
                    ),
                  ]),

                  // 부모 ID 복원
                  t.expressionStatement(
                    t.assignmentExpression(
                      "=",
                      t.memberExpression(
                        t.identifier("globalThis"),
                        t.identifier("__parentTraceId")
                      ),
                      t.identifier("parentTraceId")
                    )
                  ),

                  // generate 'exit' event
                  t.expressionStatement(
                    createEmitTraceEvent(
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
                          t.identifier("traceId"),
                          t.identifier("traceId")
                        ),
                        t.objectProperty(
                          t.identifier("source"),
                          t.stringLiteral(
                            `${state?.filename || ""}:${
                              path.node.loc
                                ? `${path.node.loc.start.line}:${path.node.loc.start.column}`
                                : "unknown"
                            }`
                          )
                        ),
                        t.objectProperty(
                          t.identifier("returnValue"),
                          t.identifier("returnValue")
                        ),
                        t.objectProperty(
                          t.identifier("chained"),
                          t.booleanLiteral(chained)
                        ),
                        t.objectProperty(
                          t.identifier("parentTraceId"),
                          parentTraceId
                            ? t.identifier(parentTraceId)
                            : t.nullLiteral()
                        ),
                        t.objectProperty(
                          t.identifier("args"),
                          t.arrayExpression(
                            path.node.arguments.map((arg) => {
                              // 함수인 경우
                              if (
                                t.isArrowFunctionExpression(arg) ||
                                t.isFunctionExpression(arg)
                              ) {
                                const location = arg.loc
                                  ? `${arg.loc.start.line}:${arg.loc.start.column}`
                                  : "unknown";

                                const name =
                                  t.isFunctionExpression(arg) && arg.id
                                    ? arg.id.name
                                    : "anonymous";

                                const params = arg.params
                                  ? `(${arg.params.length} params)`
                                  : "";

                                const filePath =
                                  state?.filename
                                    ?.split("/")
                                    .slice(-2)
                                    .join("/") || "";

                                return t.stringLiteral(
                                  `[Function: ${name}${params} at ${filePath}:${location}]`
                                );
                              }
                              // 문자열 리터럴
                              else if (t.isStringLiteral(arg)) {
                                return t.stringLiteral(arg.value);
                              }
                              // 숫자 리터럴
                              else if (t.isNumericLiteral(arg)) {
                                return t.numericLiteral(Number(arg.value));
                              }
                              // 식별자 (변수)
                              else if (t.isIdentifier(arg)) {
                                return t.identifier(arg.name);
                              }
                              // 객체 표현식
                              else if (t.isObjectExpression(arg)) {
                                return arg;
                              }
                              // 기타 타입
                              else {
                                return t.stringLiteral(`[${arg.type}]`);
                              }
                            })
                          )
                        ),
                      ])
                    )
                  ),

                  // return returnValue
                  t.returnStatement(t.identifier("returnValue")),
                ])
              ),
              []
            );

            // add marker comment
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
