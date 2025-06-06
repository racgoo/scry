import * as babel from "@babel/core";

import {
  ScryAstVariable,
  TRACE_MARKER,
  TRACE_EVENT_NAME,
  ANONYMOUS_FUNCTION_NAME,
  UNKNOWN_LOCATION,
  TRACE_ZONE,
} from "./scry.constant.js";

//AST generators for scry babel plugin
class ScryAst {
  private t: typeof babel.types;
  constructor(t: typeof babel.types) {
    this.t = t;
  }

  public createCodeExtractor() {
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier("code"),
        this.t.objectExpression([
          this.t.objectProperty(
            this.t.identifier("classCode"),
            this.t.stringLiteral("")
          ),
          this.t.objectProperty(
            this.t.identifier("functionCode"),
            this.t.stringLiteral("")
          ),
          this.t.objectProperty(
            this.t.identifier("methodCode"),
            this.t.stringLiteral("")
          ),
        ])
      ),
    ]);
  }

  // public createCodeExtractor(
  //   path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  // ) {
  //   const callee = path.node.callee;
  //   if (this.t.isMemberExpression(callee)) {
  //     return this.t.variableDeclaration("const", [
  //       this.t.variableDeclarator(
  //         this.t.identifier("code"),
  //         this.t.callExpression(
  //           this.t.memberExpression(
  //             this.t.identifier("Extractor"),
  //             this.t.identifier("extractCode")
  //           ),
  //           [
  //             callee.object,
  //             this.t.stringLiteral(
  //               this.t.isIdentifier(callee.property) ? callee.property.name : ""
  //             ),
  //           ]
  //         )
  //       ),
  //     ]);
  //   } else {
  //     return this.t.variableDeclaration("const", [
  //       this.t.variableDeclarator(
  //         this.t.identifier("code"),
  //         this.t.callExpression(
  //           this.t.memberExpression(
  //             this.t.identifier("Extractor"),
  //             this.t.identifier("extractFunction")
  //           ),
  //           [callee as babel.types.Identifier]
  //         )
  //       ),
  //     ]);
  //   }
  // }

  public createConsoleLog() {
    return this.t.expressionStatement(
      this.t.callExpression(
        this.t.memberExpression(
          this.t.identifier("console"),
          this.t.identifier("log")
        ),
        [this.t.identifier("code")]
      )
    );
  }

  public createParentTraceIdExtractor(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const currentFunction = path.getFunctionParent();
    if (!currentFunction) {
      return this.t.variableDeclaration("const", [
        this.t.variableDeclarator(
          this.t.identifier(ScryAstVariable.parentTraceId),
          this.t.nullLiteral()
        ),
      ]);
    }

    // Promise executor나 setTimeout 콜백 등의 내부 함수인 경우
    const parentFunction = currentFunction.getFunctionParent();
    if (parentFunction) {
      return this.t.variableDeclaration("const", [
        this.t.variableDeclarator(
          this.t.identifier(ScryAstVariable.parentTraceId),
          this.t.identifier(ScryAstVariable.traceId)
        ),
      ]);
    }

    if (currentFunction.isClassMethod()) {
      const methodNode = currentFunction.node;
      if (this.t.isIdentifier(methodNode.key)) {
        if (methodNode.kind === "constructor") {
          // 생성자 메서드인 경우: ClassName.prototype.parentTraceId
          const classPath = path.findParent((p) => p.isClassDeclaration());
          const className =
            (classPath?.node as babel.types.ClassDeclaration | undefined)?.id
              ?.name || ANONYMOUS_FUNCTION_NAME;

          return this.t.variableDeclaration("const", [
            this.t.variableDeclarator(
              this.t.identifier(ScryAstVariable.parentTraceId),
              this.t.memberExpression(
                this.t.memberExpression(
                  this.t.identifier(className),
                  this.t.identifier("prototype")
                ),
                this.t.identifier(ScryAstVariable.parentTraceId)
              )
            ),
          ]);
        } else {
          // 일반 클래스 메서드인 경우: this.methodName.parentTraceId
          return this.t.variableDeclaration("const", [
            this.t.variableDeclarator(
              this.t.identifier(ScryAstVariable.parentTraceId),
              this.t.memberExpression(
                this.t.memberExpression(
                  this.t.thisExpression(),
                  this.t.identifier(methodNode.key.name)
                ),
                this.t.identifier(ScryAstVariable.parentTraceId)
              )
            ),
          ]);
        }
      }
    } else if (
      currentFunction.isFunctionDeclaration() &&
      currentFunction.node.id
    ) {
      // 일반 함수인 경우: functionName.parentTraceId
      return this.t.variableDeclaration("const", [
        this.t.variableDeclarator(
          this.t.identifier(ScryAstVariable.parentTraceId),
          this.t.memberExpression(
            this.t.identifier(currentFunction.node.id.name),
            this.t.identifier(ScryAstVariable.parentTraceId)
          )
        ),
      ]);
    }

    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.parentTraceId),
        this.t.nullLiteral()
      ),
    ]);
  }

  public createParentTraceIdInjector(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const originalCall = path.node;
    const callee = originalCall.callee;

    if (path.isNewExpression()) {
      if (!this.t.isIdentifier(callee)) {
        return this.t.blockStatement([]);
      }
      // Promise 생성자인 경우 특별 처리
      if (callee.name === "Promise") {
        const [executor] = originalCall.arguments;
        if (
          this.t.isArrowFunctionExpression(executor) ||
          this.t.isFunctionExpression(executor)
        ) {
          return this.t.blockStatement([
            this.t.expressionStatement(
              this.t.assignmentExpression(
                "=",
                this.t.memberExpression(
                  this.t.memberExpression(
                    this.t.identifier(callee.name),
                    this.t.identifier("prototype")
                  ),
                  this.t.identifier(ScryAstVariable.parentTraceId)
                ),
                this.t.identifier(ScryAstVariable.traceId)
              )
            ),
          ]);
        }
      }
      // 일반 생성자 처리
      return this.t.blockStatement([
        this.t.expressionStatement(
          this.t.assignmentExpression(
            "=",
            this.t.memberExpression(
              this.t.memberExpression(
                this.t.identifier(callee.name),
                this.t.identifier("prototype")
              ),
              this.t.identifier(ScryAstVariable.parentTraceId)
            ),
            this.t.identifier(ScryAstVariable.traceId)
          )
        ),
      ]);
    }
    // ReactDOM.createRoot 등 특수 케이스 처리
    if (this.t.isMemberExpression(callee)) {
      const memberCallee = callee as babel.types.MemberExpression;
      if (
        this.t.isIdentifier(memberCallee.object) &&
        this.t.isIdentifier(memberCallee.property) &&
        ((memberCallee.object.name === "ReactDOM" &&
          memberCallee.property.name === "createRoot") ||
          (memberCallee.object.name === "ReactDOMClient" &&
            memberCallee.property.name === "createRoot"))
      ) {
        return this.t.expressionStatement(this.t.nullLiteral());
      }
    }

    if (this.t.isMemberExpression(callee)) {
      // 기존 메서드 호출 처리 코드 유지
      if (
        this.t.isThisExpression(callee.object) &&
        this.t.isIdentifier(callee.property)
      ) {
        return this.t.blockStatement([
          this.t.expressionStatement(
            this.t.assignmentExpression(
              "=",
              this.t.memberExpression(
                this.t.memberExpression(
                  this.t.thisExpression(),
                  this.t.identifier(callee.property.name)
                ),
                this.t.identifier(ScryAstVariable.parentTraceId)
              ),
              this.t.identifier(ScryAstVariable.traceId)
            )
          ),
        ]);
      } else if (
        this.t.isIdentifier(callee.object) &&
        this.t.isIdentifier(callee.property)
      ) {
        return this.t.blockStatement([
          this.t.expressionStatement(
            this.t.assignmentExpression(
              "=",
              this.t.memberExpression(
                this.t.memberExpression(
                  this.t.identifier(callee.object.name),
                  this.t.identifier(callee.property.name)
                ),
                this.t.identifier(ScryAstVariable.parentTraceId)
              ),
              this.t.identifier(ScryAstVariable.traceId)
            )
          ),
        ]);
      }
    } else if (this.t.isIdentifier(callee)) {
      // 일반 함수 호출에 대한 처리 추가
      return this.t.blockStatement([
        this.t.expressionStatement(
          this.t.assignmentExpression(
            "=",
            this.t.memberExpression(
              this.t.identifier(callee.name),
              this.t.identifier(ScryAstVariable.parentTraceId)
            ),
            this.t.identifier(ScryAstVariable.traceId)
          )
        ),
      ]);
    }

    return this.t.blockStatement([]);
  }

  // public createParentTraceIdUpdater(
  //   path: babel.NodePath<babel.types.CallExpression>
  // ) {
  //   const originalCall = path.node;
  //   return this.t.expressionStatement(
  //     this.t.assignmentExpression(
  //       "=",
  //       this.t.memberExpression(
  //         this.t.memberExpression(
  //           this.t.identifier("Function"),
  //           this.t.identifier("prototype")
  //         ),
  //         this.t.identifier("parentTraceId")
  //       ),
  //       this.t.nullLiteral()
  //     )
  //   );
  // }

  public createParentTraceIdResolver() {
    const getParentTraceIdExpression = this.t.callExpression(
      this.t.arrowFunctionExpression(
        [],
        this.t.blockStatement([
          this.t.variableDeclaration("let", [
            this.t.variableDeclarator(
              this.t.identifier(ScryAstVariable.parentTraceId),
              null
            ),
          ]),
          this.t.tryStatement(
            this.t.blockStatement([
              this.t.expressionStatement(
                this.t.assignmentExpression(
                  "=",
                  this.t.identifier(ScryAstVariable.parentTraceId),
                  this.t.identifier(ScryAstVariable.traceId)
                )
              ),
            ]),
            this.t.catchClause(
              this.t.identifier("error"),
              this.t.blockStatement([
                this.t.expressionStatement(
                  this.t.assignmentExpression(
                    "=",
                    this.t.identifier(ScryAstVariable.parentTraceId),
                    this.t.nullLiteral()
                  )
                ),
              ])
            )
          ),
          this.t.returnStatement(
            this.t.identifier(ScryAstVariable.parentTraceId)
          ),
        ])
      ),
      []
    );
    return getParentTraceIdExpression;
  }

  //Get origin code unique key with path(Current not used. but it's for future use. need archive origin code map)
  public getOriginCodeKey(path: babel.NodePath<babel.types.CallExpression>) {
    const callee = path.node.callee;
    const loc = path.node.loc;
    //Function Call
    if (this.t.isIdentifier(callee)) {
      return `${callee.name}:${loc?.filename}:${loc?.start.line}:${loc?.start.column}`;
    }
    //Method Call
    if (
      this.t.isMemberExpression(callee) &&
      this.t.isIdentifier(callee.property)
    ) {
      const objectName = this.getObjectName(callee.object);
      return `${objectName}.${callee.property.name}:${loc?.filename}:${loc?.start.line}:${loc?.start.column}`;
    }
    //Etc ..
    return "";
  }

  //Get origin code from path
  public getOriginCode(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ): {
    classCode: string;
    originCode: string;
  } {
    const callee = path.node.callee;
    let classCode = "";
    let originCode = "";

    if (this.t.isMemberExpression(callee)) {
      let classPath: babel.NodePath | null = null;
      let className: string | undefined;

      // this.method() 케이스
      if (this.t.isThisExpression(callee.object)) {
        classPath = path.findParent((p) => p.isClassDeclaration());
        if (classPath?.isClassDeclaration() && classPath.node.id) {
          className = classPath.node.id.name;
        }
      }
      // instance.method() 케이스
      else if (this.t.isIdentifier(callee.object)) {
        const binding = path.scope.getBinding(callee.object.name);
        if (binding?.path.node.type === "VariableDeclarator") {
          const init = (binding.path.node as babel.types.VariableDeclarator)
            .init;
          if (
            this.t.isNewExpression(init) &&
            this.t.isIdentifier(init.callee)
          ) {
            // 클래스 이름을 찾음
            className = init.callee.name;
            // 클래스 정의를 찾기 위해 바인딩을 추적
            const classBinding = binding.scope.getBinding(className);
            if (classBinding) {
              // ImportDeclaration인 경우 해당 모듈에서 클래스를 찾아야 함
              if (
                classBinding.path.isImportSpecifier() ||
                classBinding.path.isImportDefaultSpecifier()
              ) {
                const importDecl = classBinding.path.parentPath;
                if (importDecl.isImportDeclaration()) {
                  const sourcePath = importDecl.node.source.value;
                  // 여기서 sourcePath를 사용하여 실제 클래스 정의 파일을 찾아야 함
                  // 이 부분은 babel plugin의 file resolver를 사용해야 할 것 같습니다
                  console.log("Need to resolve:", sourcePath);
                }
              } else if (classBinding.path.isClassDeclaration()) {
                classPath = classBinding.path;
              }
            }
          }
        }
      }

      if (className && classPath?.isClassDeclaration()) {
        const node = classPath.node;
        if (node.loc) {
          classCode = this.extractCodeFromLoc(
            classPath.hub.getCode() || "",
            node.loc
          );

          // 메서드 코드 추출
          if (this.t.isIdentifier(callee.property)) {
            const method = node.body.body.find(
              (m: babel.types.Node): m is babel.types.ClassMethod =>
                this.t.isClassMethod(m) &&
                this.t.isIdentifier(m.key) &&
                this.t.isIdentifier(callee.property) &&
                m.key.name === callee.property.name
            );

            if (method?.loc) {
              originCode = this.extractCodeFromLoc(
                classPath.hub.getCode() || "",
                method.loc
              );
            }
          }
        }
      }
    }

    return { classCode, originCode };
  }

  //Extract code from location
  private extractCodeFromLoc(code: string, loc: babel.types.SourceLocation) {
    const lines = code.split("\n");
    const start = loc.start.line - 1;
    const end = loc.end.line - 1;
    return lines.slice(start, end + 1).join("\n");
  }

  //Create ast marker variable
  public createMarkerVariable() {
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(TRACE_MARKER),
        this.t.booleanLiteral(true)
      ),
    ]);
  }

  //Create ast traceId variable with auto increment
  public createTraceId() {
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.traceId),
        this.t.conditionalExpression(
          this.t.binaryExpression(
            "===",
            this.t.unaryExpression(
              "typeof",
              this.t.memberExpression(
                this.t.identifier(ScryAstVariable.globalThis),
                this.t.identifier(ScryAstVariable.globalScryCalledCount)
              )
            ),
            this.t.stringLiteral("undefined")
          ),
          this.t.assignmentExpression(
            "=",
            this.t.memberExpression(
              this.t.identifier(ScryAstVariable.globalThis),
              this.t.identifier(ScryAstVariable.globalScryCalledCount)
            ),
            this.t.numericLiteral(0)
          ),
          this.t.updateExpression(
            "++",
            this.t.memberExpression(
              this.t.identifier(ScryAstVariable.globalThis),
              this.t.identifier(ScryAstVariable.globalScryCalledCount)
            ),
            false
          )
        )
      ),
    ]);
  }

  //Set ast currentTraceId to globalThis
  public createCurrentTraceIdSetterAsGlobalCurrentTraceId() {
    return this.t.expressionStatement(
      this.t.assignmentExpression(
        "=",
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.globalThis),
          this.t.identifier(ScryAstVariable.globalCurrentTraceId)
        ),
        this.t.identifier(ScryAstVariable.traceId)
      )
    );
  }

  //Set ast currentTraceId to globalThis
  public craeteGlobalParentTraceIdSetterWithTraceId() {
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(TRACE_ZONE),
        this.t.callExpression(
          this.t.memberExpression(
            this.t.memberExpression(
              this.t.identifier("Zone"),
              this.t.identifier("current")
            ),
            this.t.identifier("fork")
          ),
          [
            this.t.objectExpression([
              this.t.objectProperty(
                this.t.identifier("properties"),
                this.t.objectExpression([
                  this.t.objectProperty(
                    this.t.identifier(ScryAstVariable.parentTraceId),
                    this.t.identifier(ScryAstVariable.traceId)
                  ),
                ])
              ),
            ]),
          ]
        )
      ),
    ]);
  }

  //Set ast currentTraceId to globalThis
  public craeteGlobalParentTraceIdSetterWithParentTraceId() {
    return this.t.expressionStatement(
      this.t.assignmentExpression(
        "=",
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.globalThis),
          this.t.identifier(ScryAstVariable.globalParentTraceId)
        ),
        this.t.identifier(ScryAstVariable.traceId)
      )
    );
  }

  //Set ast currentTraceId to globalThis
  public craeteCurrentTraceIdSetterAsGlobalParentTraceId() {
    return this.t.expressionStatement(
      this.t.assignmentExpression(
        "=",
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.globalThis),
          this.t.identifier(ScryAstVariable.globalCurrentTraceId)
        ),
        this.t.identifier(ScryAstVariable.traceId)
      )
    );
  }

  //Set ast parentTraceId to globalThis
  public createParentTraceIdSetterAsGlobalParentTraceId() {
    return this.t.expressionStatement(
      this.t.assignmentExpression(
        "=",
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.globalThis),
          this.t.identifier(ScryAstVariable.globalParentTraceId)
        ),
        this.t.identifier("parentTraceId")
      )
    );
  }

  //Get ast parentTraceId variable from globalThis
  public createParentTraceIdFromGlobalParentTraceId() {
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.parentTraceId),
        this.t.callExpression(
          this.t.memberExpression(
            this.t.memberExpression(
              this.t.identifier("Zone"),
              this.t.identifier("current")
            ),
            this.t.identifier("get")
          ),
          [this.t.stringLiteral(ScryAstVariable.parentTraceId)]
        )
      ),
    ]);
  }

  //Create ast returnValue
  public createReturnValue() {
    return this.t.variableDeclaration("let", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.returnValue),
        this.t.nullLiteral()
      ),
    ]);
  }

  //Update returnValue with origin execution
  public craeteReturnValueUpdaterWithOriginExecution(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const originalCall = path.node;
    // const callee = originalCall.callee;

    // Promise 체이닝인 경우
    // if (
    //   this.t.isMemberExpression(callee) &&
    //   this.t.isIdentifier(callee.property) &&
    //   callee.property.name === "then"
    // ) {
    // const thenCallback = originalCall.arguments[0];

    // then 콜백이 실행되는 시점에 Zone을 생성하도록 수정
    // const wrappedCallback = this.t.functionExpression(
    //   null,
    //   [],
    //   this.t.blockStatement([
    //     // 현재 Zone의 traceId를 parentTraceId로 사용
    //     this.createTraceId(),
    //     this.t.returnStatement(
    //       this.t.callExpression(
    //         this.t.memberExpression(
    //           this.t.memberExpression(
    //             this.t.identifier("Zone"),
    //             this.t.identifier("current")
    //           ),
    //           this.t.identifier("fork")
    //         ),
    //         [
    //           this.t.objectExpression([
    //             this.t.objectProperty(
    //               this.t.identifier("properties"),
    //               this.t.objectExpression([
    //                 this.t.objectProperty(
    //                   this.t.identifier(ScryAstVariable.parentTraceId),
    //                   this.t.identifier(ScryAstVariable.traceId)
    //                 ),
    //               ])
    //             ),
    //           ]),
    //         ]
    //       )
    //     ),
    //     this.t.returnStatement(
    //       this.t.callExpression(
    //         this.t.memberExpression(
    //           this.t.identifier(TRACE_ZONE),
    //           this.t.identifier("run")
    //         ),
    //         [
    //           this.t.functionExpression(
    //             null,
    //             [],
    //             this.t.blockStatement([this.t.returnStatement(originalCall)])
    //           ),
    //         ]
    //       )
    //     ),
    //   ])
    // );

    //   return this.t.expressionStatement(
    //     this.t.assignmentExpression(
    //       "=",
    //       this.t.identifier(ScryAstVariable.returnValue),
    //       this.t.callExpression(
    //         this.t.memberExpression(callee.object, this.t.identifier("then")),
    //         [wrappedCallback]
    //       )
    //     )
    //   );
    // }

    // 일반적인 경우 (start22 등)
    const resultAst = this.t.expressionStatement(
      this.t.assignmentExpression(
        "=",
        this.t.identifier(ScryAstVariable.returnValue),
        this.t.callExpression(
          this.t.memberExpression(
            this.t.identifier(TRACE_ZONE),
            this.t.identifier("run")
          ),
          [
            this.t.functionExpression(
              null,
              [],
              this.t.blockStatement([this.t.returnStatement(originalCall)])
            ),
          ]
        )
      )
    );

    const tryBlock = this.t.blockStatement([resultAst]);
    const catchClause = this.t.catchClause(
      this.t.identifier("error"),
      this.t.blockStatement([
        this.t.expressionStatement(
          this.t.assignmentExpression(
            "=",
            this.t.identifier(ScryAstVariable.returnValue),
            this.t.identifier("error")
          )
        ),
      ])
    );

    return this.t.tryStatement(tryBlock, catchClause);
  }

  // Zone 관련 호출인지 확인하는 헬퍼 메서드 추가
  private isZoneRelatedCall(
    node: babel.types.CallExpression | babel.types.NewExpression
  ): boolean {
    if (!this.t.isCallExpression(node)) return false;

    const callee = node.callee;
    if (!this.t.isMemberExpression(callee)) return false;

    // Zone.current.fork() 패턴 확인
    if (
      this.t.isMemberExpression(callee.object) &&
      this.t.isIdentifier(callee.object.object) &&
      callee.object.object.name === "Zone" &&
      this.t.isIdentifier(callee.object.property) &&
      callee.object.property.name === "current" &&
      this.t.isIdentifier(callee.property) &&
      callee.property.name === "fork"
    ) {
      return true;
    }

    return false;
  }

  //Emit error if returnValue is error(origin execution is failed)
  public emitErrorIfReturnIsError() {
    return this.t.ifStatement(
      this.t.binaryExpression(
        "instanceof",
        this.t.identifier(ScryAstVariable.returnValue),
        this.t.identifier("Error")
      ),
      this.t.blockStatement([
        this.t.throwStatement(this.t.identifier(ScryAstVariable.returnValue)),
      ])
    );
  }

  //Create ast returnValue with origin execution
  public createReturnValueWithOriginExecution(
    path: babel.NodePath<babel.types.CallExpression>
  ) {
    const callee = path.node.callee;
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.returnValue),
        this.t.callExpression(callee, path.node.arguments)
      ),
    ]);
  }

  //Create emit trace event ast object
  public emitTraceEvent(detail: babel.types.ObjectExpression) {
    return this.t.conditionalExpression(
      this.t.binaryExpression(
        "===",
        this.t.unaryExpression("typeof", this.t.identifier("window")),
        this.t.stringLiteral("undefined")
      ),
      // Node.js
      this.t.callExpression(
        this.t.memberExpression(
          this.t.identifier("process"),
          this.t.identifier("emit")
        ),
        [this.t.stringLiteral(TRACE_EVENT_NAME), detail]
      ),
      // Browser
      this.t.callExpression(
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.globalThis),
          this.t.identifier("dispatchEvent")
        ),
        [
          this.t.newExpression(this.t.identifier("CustomEvent"), [
            this.t.stringLiteral(TRACE_EVENT_NAME),
            this.t.objectExpression([
              this.t.objectProperty(this.t.identifier("detail"), detail),
            ]),
          ]),
        ]
      )
    );
  }

  //Create event detail ast object
  public getEventDetail(
    path: babel.NodePath<
      babel.types.CallExpression | babel.types.NewExpression
    >,
    state: babel.PluginPass,
    info: {
      type: TraceEventType;
      fnName: string;
      chained: boolean;
      originCode: string;
      classCode: string;
    }
  ) {
    return this.t.objectExpression([
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.type),
        this.t.stringLiteral(info.type)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.name),
        this.t.stringLiteral(info.fnName)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.classCode),
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.code),
          this.t.identifier(ScryAstVariable.classCode)
        )
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.methodCode),
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.code),
          this.t.identifier(ScryAstVariable.methodCode)
        )
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.functionCode),
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.code),
          this.t.identifier(ScryAstVariable.functionCode)
        )
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.traceId),
        this.t.identifier(ScryAstVariable.traceId)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.source),
        this.getSource(path, state)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.returnValue),
        info.type === "enter"
          ? this.t.nullLiteral()
          : this.t.identifier(ScryAstVariable.returnValue)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.chained),
        this.t.booleanLiteral(info.chained)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.parentTraceId),
        this.t.identifier(ScryAstVariable.parentTraceId)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.args),
        this.getArgs(path, state)
      ),
    ]);
  }

  //Get function name as string
  public getFunctionName(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const callee = path.node.callee;
    let fnName = ANONYMOUS_FUNCTION_NAME;

    if (this.t.isIdentifier(callee)) {
      fnName = callee.name;
    } else if (
      this.t.isMemberExpression(callee) &&
      this.t.isIdentifier(callee.property)
    ) {
      if (path.isNewExpression()) {
        fnName = `new ${callee.property.name}`;
      } else {
        fnName = callee.property.name;
      }
    }

    return fnName;
  }

  //Create args ast object
  private getArgs(
    path: babel.NodePath<
      babel.types.CallExpression | babel.types.NewExpression
    >,
    state: babel.PluginPass
  ) {
    return this.t.arrayExpression(
      path.node.arguments.map((arg) => {
        //  execute by call expression
        //  function
        if (
          this.t.isArrowFunctionExpression(arg) ||
          this.t.isFunctionExpression(arg)
        ) {
          const location = arg.loc
            ? `${arg.loc.start.line}:${arg.loc.start.column}`
            : UNKNOWN_LOCATION;

          const name =
            this.t.isFunctionExpression(arg) && arg.id
              ? arg.id.name
              : ANONYMOUS_FUNCTION_NAME;

          const params = arg.params ? `(${arg.params.length} params)` : "";

          const filePath =
            state?.filename?.split("/").slice(-2).join("/") || "";

          return this.t.stringLiteral(
            `[Function: ${name}${params} at ${filePath}:${location}]`
          );
        }
        // string literal
        else if (this.t.isStringLiteral(arg)) {
          return this.t.stringLiteral(arg.value);
        }
        // numeric literal
        else if (this.t.isNumericLiteral(arg)) {
          return this.t.numericLiteral(Number(arg.value));
        }
        // identifier (variable)
        else if (this.t.isIdentifier(arg)) {
          return this.t.identifier(arg.name);
        }
        // object expression
        else if (this.t.isObjectExpression(arg)) {
          return arg;
        }
        // other types
        else {
          return this.t.stringLiteral(`[${arg.type}]`);
        }
      })
    );
  }

  //Create source ast object
  private getSource(
    path: babel.NodePath<
      babel.types.CallExpression | babel.types.NewExpression
    >,
    state: babel.PluginPass
  ) {
    return this.t.stringLiteral(
      `${state?.filename || ""}:${
        path.node.loc
          ? `${path.node.loc.start.line}:${path.node.loc.start.column}`
          : UNKNOWN_LOCATION
      }`
    );
  }

  //Get object name from object
  private getObjectName(
    object: babel.types.Expression | babel.types.Super
  ): string {
    if (this.t.isIdentifier(object)) {
      return object.name;
    }
    return "";
  }
}

export default ScryAst;
