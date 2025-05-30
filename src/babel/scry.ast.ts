import * as babel from "@babel/core";

import {
  ScryAstVariable,
  TRACE_MARKER,
  TRACE_EVENT_NAME,
  ANONYMOUS_FUNCTION_NAME,
  UNKNOWN_LOCATION,
} from "@babel/scry.constant";

//AST generators for scry babel plugin
class ScryAst {
  private t: typeof babel.types;
  constructor(t: typeof babel.types) {
    this.t = t;
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
  public getOriginCode(path: babel.NodePath<babel.types.CallExpression>): {
    classCode: string;
    originCode: string;
  } {
    const callee = path.node.callee;
    let classCode = "";
    let originCode = "";
    // 메서드 호출 (this.method())
    if (
      this.t.isMemberExpression(callee) &&
      this.t.isThisExpression(callee.object) &&
      this.t.isIdentifier(callee.property)
    ) {
      // 현재 클래스의 메서드를 찾기
      const classPath = path.findParent((p) => p.isClassDeclaration());
      if (classPath) {
        const classBody = (classPath.node as babel.types.ClassDeclaration).body;
        const method = classBody.body.find(
          (m): m is babel.types.ClassMethod =>
            this.t.isClassMethod(m) &&
            this.t.isIdentifier(m.key) &&
            this.t.isIdentifier(callee.property) &&
            m.key.name === callee.property.name
        );

        if (classPath?.node.loc) {
          // 클래스 전체 코드 반환
          classCode = this.extractCodeFromLoc(
            path.hub.getCode() || "",
            classPath.node.loc
          );
        }

        if (method?.loc) {
          originCode = this.extractCodeFromLoc(
            path.hub.getCode() || "",
            method.loc
          );
        }
      }
    }

    // Identifier: function call
    if (this.t.isIdentifier(callee)) {
      const binding = path.scope.getBinding(callee.name);
      if (binding?.path.node.loc) {
        originCode = this.extractCodeFromLoc(
          path.hub.getCode() || "",
          binding.path.node.loc
        );
      }
    }

    // MemberExpression: method call
    if (
      this.t.isMemberExpression(callee) &&
      this.t.isIdentifier(callee.property)
    ) {
      const objectName = this.getObjectName(callee.object);
      const methodName = callee.property.name;

      const objectBinding = path.scope.getBinding(objectName);
      if (objectBinding?.path.isVariableDeclarator()) {
        const init = objectBinding.path.node.init;

        // 클래스 인스턴스인 경우
        if (this.t.isNewExpression(init) && this.t.isIdentifier(init.callee)) {
          const classBinding = path.scope.getBinding(init.callee.name);
          if (classBinding?.path.isClassDeclaration()) {
            // 클래스 전체 코드 저장
            if (classBinding.path.node.loc) {
              classCode = this.extractCodeFromLoc(
                path.hub.getCode() || "",
                classBinding.path.node.loc
              );
            }

            // 메서드 코드 찾기
            const method = classBinding.path.node.body.body.find(
              (m) =>
                this.t.isClassMethod(m) &&
                this.t.isIdentifier(m.key, { name: methodName })
            ) as babel.types.ClassMethod;

            if (method?.loc) {
              originCode = this.extractCodeFromLoc(
                path.hub.getCode() || "",
                method.loc
              );
            }
          }
        }
        // 객체 리터럴 내부 메서드
        if (this.t.isObjectExpression(init)) {
          const prop = init.properties.find(
            (p) =>
              this.t.isObjectProperty(p) &&
              this.t.isIdentifier(p.key, { name: methodName })
          ) as babel.types.ObjectProperty;

          if (
            prop?.value &&
            this.t.isFunctionExpression(prop.value) &&
            prop.value.loc
          ) {
            originCode = this.extractCodeFromLoc(
              path.hub.getCode() || "",
              prop.value.loc
            );
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
        this.t.identifier("parentTraceId"),
        this.t.logicalExpression(
          "??",
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.globalThis),
            this.t.identifier(ScryAstVariable.globalParentTraceId)
          ),
          this.t.nullLiteral()
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
    path: babel.NodePath<babel.types.CallExpression>
  ) {
    const originalCall = path.node;
    // Create try-catch block
    const tryBlock = this.t.blockStatement([
      this.t.expressionStatement(
        this.t.assignmentExpression(
          "=",
          this.t.identifier(ScryAstVariable.returnValue),
          originalCall
        )
      ),
    ]);

    // Create catch clause
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
    path: babel.NodePath<babel.types.CallExpression>,
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
        this.t.identifier(ScryAstVariable.originCode),
        this.t.stringLiteral(info.originCode)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.classCode),
        this.t.stringLiteral(info.classCode)
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
  public getFunctionName(path: babel.NodePath<babel.types.CallExpression>) {
    const callee = path.node.callee;
    let fnName = ANONYMOUS_FUNCTION_NAME;
    if (this.t.isIdentifier(callee)) {
      fnName = callee.name;
    } else if (
      this.t.isMemberExpression(callee) &&
      this.t.isIdentifier(callee.property)
    ) {
      fnName = callee.property.name;
    }
    return fnName;
  }

  //Create args ast object
  private getArgs(
    path: babel.NodePath<babel.types.CallExpression>,
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
    path: babel.NodePath<babel.types.CallExpression>,
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
