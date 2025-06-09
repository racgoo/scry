import * as babel from "@babel/core";

import {
  ScryAstVariable,
  TRACE_MARKER,
  TRACE_EVENT_NAME,
  ANONYMOUS_FUNCTION_NAME,
  UNKNOWN_LOCATION,
  TRACE_ZONE,
  ACTIVE_TRACE_ID_SET,
  PARENT_TRACE_ID_MARKER,
  // ACTIVE_TRACE_ID_SET,
} from "./scry.constant.js";
import ScryChecker from "./scry.check.js";

//AST generators for scry babel plugin
class ScryAst {
  private t: typeof babel.types;
  constructor(t: typeof babel.types) {
    this.t = t;
  }

  // public findParentTraceIdIdentifier(path: babel.NodePath) {
  //   // 1. 상위 함수나 프로그램 찾기
  //   const fnOrProgram:  = path.findParent((p) =>
  //     p.isFunction()
  //   ) as babel.NodePath<babel.types.BlockParent>;

  //   if (!fnOrProgram || !fnOrProgram?.node) return null;

  //   // 2. 함수 내부 블록에서 VariableDeclaration 찾기
  //   for (const stmt of fnOrProgram.node.) {
  //     if (this.t.isVariableDeclaration(stmt)) {
  //       const leadingComments = stmt.leadingComments || [];
  //       const hasMark = leadingComments.some((c) =>
  //         c.value.includes("__PARENT_TRACE_ID_MARK__")
  //       );
  //       if (hasMark) {
  //         const firstDecl = stmt.declarations[0];
  //         if (firstDecl && this.t.isIdentifier(firstDecl.id)) {
  //           return firstDecl.id;
  //         }
  //       }
  //     }
  //   }

  //   return null;
  // }

  public createParentTraceIdOptionalUpdater(
    path: babel.NodePath<babel.types.Node>
  ) {
    const parentTraceIdIdentifier = (() => {
      const fnPath = path.findParent(
        (p) =>
          p.isFunctionDeclaration() ||
          p.isFunctionExpression() ||
          p.isArrowFunctionExpression() ||
          p.isClassMethod() ||
          p.isObjectMethod()
      );
      if (!fnPath) {
        return null;
      }
      const fnNode = fnPath.node;
      const body = (
        (fnNode as { body: babel.types.BlockStatement })
          .body as babel.types.BlockStatement
      ).body;
      if (!body) return null;
      const targetNode = body.find((stmt: babel.types.Node) => {
        return (
          this.t.isVariableDeclaration(stmt) &&
          this.t.isStringLiteral(stmt.declarations[0].init) &&
          stmt.declarations[0].init.value === PARENT_TRACE_ID_MARKER
        );
      });
      if (targetNode) {
        return (targetNode as babel.types.VariableDeclaration).declarations[0]
          .id;
      } else {
        return null;
      }
    })();

    if (!parentTraceIdIdentifier) return this.t.emptyStatement();
    return this.t.ifStatement(
      this.t.binaryExpression(
        "===",
        parentTraceIdIdentifier as babel.types.Expression,
        this.t.stringLiteral(PARENT_TRACE_ID_MARKER)
      ),
      this.t.blockStatement([
        this.t.expressionStatement(
          this.t.assignmentExpression(
            "=",
            parentTraceIdIdentifier,
            this.t.memberExpression(
              this.t.memberExpression(
                this.t.identifier("Zone"),
                this.t.identifier("current")
              ),
              this.t.identifier("name")
            )
          )
        ),
      ])
    );
  }

  public createParentTraceDeclare(
    path: babel.NodePath<
      | babel.types.Program
      | babel.types.FunctionDeclaration
      | babel.types.FunctionExpression
      | babel.types.ArrowFunctionExpression
      | babel.types.ObjectMethod
      | babel.types.ClassMethod
    >
  ) {
    const parentDecl = this.t.variableDeclaration("let", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.parentTraceId),
        this.t.stringLiteral(PARENT_TRACE_ID_MARKER)
      ),
    ]);

    if (path.isProgram()) {
      //For Program level(Top level global variable)
      (path.node.body as babel.types.Statement[]).unshift(parentDecl);
      return;
    } else {
      //For other level(Function, Class, etc.)
      const body = path.node.body as babel.types.BlockStatement;
      if (!this.t.isBlockStatement(body)) {
        path.node.body = this.t.blockStatement([this.t.returnStatement(body)]);
      }
      (path.node.body as babel.types.BlockStatement).body.unshift(parentDecl);
    }
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

  public preProcess(
    path: babel.NodePath<
      babel.types.FunctionDeclaration | babel.types.ClassDeclaration
    >,
    scryAst: ScryAst,
    scryChecker: ScryChecker,
    code: string
  ) {
    //Check development mode
    const developmentMode = ScryChecker.isDevelopmentMode();
    //Check if the function is a trace zone initialization
    const traceZoneInitialization = scryChecker.isTraceZoneInitialization(
      path.node
    );
    //All check is passed
    if (!developmentMode || traceZoneInitialization) {
      path.skip();
      return;
    }
    scryAst.createOriginCodeComment(path, code);
  }

  public createOriginCodeComment(
    path: babel.NodePath<
      babel.types.FunctionDeclaration | babel.types.ClassDeclaration
    >,
    code: string
  ) {
    const originalSource = code.slice(path.node.start!, path.node.end!);
    const commentNode = this.t.emptyStatement();
    commentNode.leadingComments = [
      {
        type: "CommentBlock",
        value: `\n__ORIGINAL__\n${originalSource}\n`,
      },
    ];
    if (path.isClassDeclaration()) {
      path.insertAfter(commentNode);
    }
    if (path.isFunctionDeclaration()) {
      path.node.body.body.unshift(commentNode);
    }
  }

  // Add Zone.root initialization code if not initialized(on Program level)
  public createZoneRootInitialization(
    path: babel.NodePath<babel.types.Program>
  ) {
    path.node.body.unshift(
      this.t.addComment(
        this.t.ifStatement(
          this.t.unaryExpression(
            "!",
            this.t.memberExpression(
              this.t.memberExpression(
                this.t.identifier("Zone"),
                this.t.identifier("root")
              ),
              this.t.stringLiteral(ACTIVE_TRACE_ID_SET),
              true // computed: Zone.root["activeTraceIdSet"]
            )
          ),
          this.t.blockStatement([
            this.t.expressionStatement(
              this.t.assignmentExpression(
                "=",
                this.t.memberExpression(
                  this.t.memberExpression(
                    this.t.identifier("Zone"),
                    this.t.identifier("root")
                  ),
                  this.t.stringLiteral(ACTIVE_TRACE_ID_SET),
                  true
                ),
                this.t.newExpression(this.t.identifier("Set"), [])
              )
            ),
          ])
        ),
        "leading",
        TRACE_MARKER
      )
    );
  }

  //Create initial trace zone(on Program level)
  public createInitailTraceZone(path: babel.NodePath<babel.types.Program>) {
    path.node.body.unshift(
      this.t.addComment(
        this.t.variableDeclaration("const", [
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
                    this.t.identifier("name"),
                    this.t.stringLiteral(TRACE_ZONE)
                  ),
                  this.t.objectProperty(
                    this.t.identifier("properties"),
                    this.t.objectExpression([
                      this.t.objectProperty(
                        this.t.identifier(ScryAstVariable.parentTraceId),
                        this.t.nullLiteral()
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
  }

  //Add Zone.js import or require statement(on Program level)
  public createDeclareZoneJS(
    path: babel.NodePath<babel.types.Program>,
    esm: boolean
  ) {
    if (esm) {
      //For esm target
      path.node.body.unshift(
        this.t.importDeclaration([], this.t.stringLiteral("zone.js"))
      );
    } else {
      //For commonjs target
      path.node.body.unshift(
        this.t.expressionStatement(
          this.t.callExpression(this.t.identifier("require"), [
            this.t.stringLiteral("zone.js/mix"),
          ])
        )
      );
    }
  }

  //Add Extractor import or require statement from @racgoo/scry(on Program level)
  public createDeclareExtractor(
    path: babel.NodePath<babel.types.Program>,
    esm: boolean
  ) {
    if (esm) {
      //For esm target
      path.node.body.unshift(
        this.t.importDeclaration(
          [
            this.t.importSpecifier(
              this.t.identifier("Extractor"),
              this.t.identifier("Extractor")
            ),
          ],
          this.t.stringLiteral("@racgoo/scry")
        )
      );
    } else {
      //For commonjs target
      path.node.body.unshift(
        this.t.variableDeclaration("const", [
          this.t.variableDeclarator(
            this.t.objectPattern([
              this.t.objectProperty(
                this.t.identifier("Extractor"),
                this.t.identifier("Extractor"),
                false,
                true
              ),
            ]),
            this.t.callExpression(this.t.identifier("require"), [
              this.t.stringLiteral("@racgoo/scry"),
            ])
          ),
        ])
      );
    }
  }

  //For next feature
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

  //For debug(only dev)
  public createConsoleLog(identifier: string, flag: string) {
    return this.t.expressionStatement(
      this.t.callExpression(
        this.t.memberExpression(
          this.t.identifier("console"),
          this.t.identifier("log")
        ),
        [this.t.stringLiteral(flag), this.t.identifier(identifier)]
      )
    );
  }

  //Add trace id to active trace id set(Zone root)
  public createActiveTraceIdAdder() {
    return this.t.expressionStatement(
      this.t.callExpression(
        this.t.memberExpression(
          this.t.memberExpression(
            this.t.memberExpression(
              this.t.identifier("Zone"),
              this.t.identifier("root")
            ),
            this.t.identifier(ACTIVE_TRACE_ID_SET)
          ),
          this.t.identifier("add")
        ),
        [this.t.identifier(ScryAstVariable.traceId)]
      )
    );
  }

  //Add trace id to active trace id set(Zone root)
  public createActiveTraceIdRemover() {
    return this.t.expressionStatement(
      this.t.callExpression(
        this.t.memberExpression(
          this.t.memberExpression(
            this.t.memberExpression(
              this.t.identifier("Zone"),
              this.t.identifier("root")
            ),
            this.t.identifier(ACTIVE_TRACE_ID_SET)
          ),
          this.t.identifier("delete")
        ),
        [this.t.identifier(ScryAstVariable.traceId)]
      )
    );
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

  public createDeclareTraceZoneWithTraceId() {
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(TRACE_ZONE),
        this.t.memberExpression(
          this.t.identifier("Zone"),
          this.t.identifier(ScryAstVariable.traceId),
          true
        )
      ),
    ]);
  }

  //Get parent trace id from current zone(with zone.js scope)
  public craeteGlobalParentTraceIdSetterWithTraceId() {
    return this.t.expressionStatement(
      this.t.assignmentExpression(
        "=",
        this.t.memberExpression(
          this.t.identifier("Zone"),
          this.t.identifier(ScryAstVariable.traceId),
          true
        ),
        this.t.callExpression(
          this.t.memberExpression(
            this.t.logicalExpression(
              "||",
              this.t.memberExpression(
                this.t.identifier("Zone"),
                this.t.identifier(ScryAstVariable.parentTraceId),
                true // Zone["test"]
              ),
              this.t.memberExpression(
                this.t.identifier("Zone"),
                this.t.identifier("root")
              )
            ),
            this.t.identifier("fork")
          ),
          [
            this.t.objectExpression([
              this.t.objectProperty(
                this.t.identifier("name"),
                this.t.identifier(ScryAstVariable.traceId)
              ),
              this.t.objectProperty(
                this.t.identifier("properties"),
                this.t.objectExpression([
                  this.t.objectProperty(
                    this.t.identifier(ScryAstVariable.parentTraceId),
                    this.t.identifier(ScryAstVariable.traceId)
                  ),
                ])
              ),
              this.t.objectProperty(
                this.t.identifier("onInvoke"),
                this.t.functionExpression(
                  null,
                  [
                    this.t.identifier("parentZoneDelegate"),
                    this.t.identifier("currentZone"),
                    this.t.identifier("targetZone"),
                    this.t.identifier("delegate"),
                    this.t.identifier("applyThis"),
                    this.t.identifier("args"),
                    this.t.identifier("source"),
                  ],
                  this.t.blockStatement([
                    // this.t.expressionStatement(
                    //   this.t.callExpression(
                    //     this.t.memberExpression(
                    //       this.t.memberExpression(
                    //         this.t.memberExpression(
                    //           this.t.identifier("Zone"),
                    //           this.t.identifier("root")
                    //         ),
                    //         this.t.stringLiteral(ACTIVE_TRACE_ID_SET),
                    //         true
                    //       ),
                    //       this.t.identifier("add")
                    //     ),
                    //     [this.t.identifier(ScryAstVariable.traceId)]
                    //   )
                    // ),
                    this.t.expressionStatement(
                      this.t.callExpression(
                        this.t.identifier("queueMicrotask"),
                        [
                          this.t.functionExpression(
                            null,
                            [],
                            this.t.blockStatement([
                              this.t.expressionStatement(
                                this.t.stringLiteral(
                                  "this is only onHasTaskQueue Trigger"
                                )
                              ),
                            ])
                          ),
                        ]
                      )
                    ),
                    this.t.returnStatement(
                      this.t.callExpression(
                        this.t.memberExpression(
                          this.t.identifier("parentZoneDelegate"),
                          this.t.identifier("invoke")
                        ),
                        [
                          this.t.identifier("targetZone"),
                          this.t.identifier("delegate"),
                          this.t.identifier("applyThis"),
                          this.t.identifier("args"),
                          this.t.identifier("source"),
                        ]
                      )
                    ),
                  ])
                )
              ),
              this.t.objectProperty(
                this.t.identifier("onHasTask"),
                this.t.functionExpression(
                  null,
                  [
                    this.t.identifier("delegate"),
                    this.t.identifier("current"),
                    this.t.identifier("target"),
                    this.t.identifier("hasTaskState"),
                  ],
                  this.t.blockStatement([
                    this.t.expressionStatement(
                      this.t.callExpression(
                        this.t.memberExpression(
                          this.t.identifier("delegate"),
                          this.t.identifier("hasTask")
                        ),
                        [
                          this.t.identifier("target"),
                          this.t.identifier("hasTaskState"),
                        ]
                      )
                    ),
                    this.t.variableDeclaration("const", [
                      this.t.variableDeclarator(
                        this.t.identifier("allDone"),
                        this.t.logicalExpression(
                          "&&",
                          this.t.unaryExpression(
                            "!",
                            this.t.memberExpression(
                              this.t.identifier("hasTaskState"),
                              this.t.identifier("microTask")
                            )
                          ),
                          this.t.logicalExpression(
                            "&&",
                            this.t.unaryExpression(
                              "!",
                              this.t.memberExpression(
                                this.t.identifier("hasTaskState"),
                                this.t.identifier("macroTask")
                              )
                            ),
                            this.t.unaryExpression(
                              "!",
                              this.t.memberExpression(
                                this.t.identifier("hasTaskState"),
                                this.t.identifier("eventTask")
                              )
                            )
                          )
                        )
                      ),
                    ]),
                    this.t.ifStatement(
                      this.t.identifier("allDone"),
                      this.t.blockStatement([
                        this.t.ifStatement(
                          this.t.callExpression(
                            this.t.memberExpression(
                              this.t.memberExpression(
                                this.t.memberExpression(
                                  this.t.identifier("Zone"),
                                  this.t.identifier("root")
                                ),
                                this.t.stringLiteral(ACTIVE_TRACE_ID_SET),
                                true
                              ),
                              this.t.identifier("has")
                            ),
                            [this.t.identifier(ScryAstVariable.traceId)]
                          ),
                          this.t.blockStatement([
                            // this.t.expressionStatement(
                            //   this.t.callExpression(
                            //     this.t.memberExpression(
                            //       this.t.memberExpression(
                            //         this.t.memberExpression(
                            //           this.t.identifier("Zone"),
                            //           this.t.identifier("root")
                            //         ),
                            //         this.t.stringLiteral(ACTIVE_TRACE_ID_SET),
                            //         true
                            //       ),
                            //       this.t.identifier("delete")
                            //     ),
                            //     [this.t.identifier(ScryAstVariable.traceId)]
                            //   )
                            // ),
                          ])
                        ),
                      ])
                    ),
                  ])
                )
              ),
            ]),
          ]
        )
      )
    );

    // this.t.memberExpression(
    //   this.t.memberExpression(
    //     this.t.identifier("Zone"),
    //     this.t.identifier("current")
    //   ),
    //   this.t.identifier("fork")
    // ),

    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(TRACE_ZONE),
        this.t.callExpression(
          this.t.memberExpression(
            this.t.memberExpression(
              this.t.identifier("Zone"),
              this.t.identifier(ScryAstVariable.parentTraceId), // <-- ["test"]
              true // <-- computed: true → makes it Zone["test"]
            ),
            this.t.identifier("fork") // .fork
          ),
          [
            this.t.objectExpression([
              this.t.objectProperty(
                this.t.identifier("name"),
                this.t.stringLiteral(TRACE_ZONE)
              ),
              this.t.objectProperty(
                this.t.identifier("properties"),
                this.t.objectExpression([
                  this.t.objectProperty(
                    this.t.identifier(ScryAstVariable.parentTraceId),
                    this.t.identifier(ScryAstVariable.traceId)
                  ),
                ])
              ),
              this.t.objectProperty(
                this.t.identifier("onInvoke"),
                this.t.functionExpression(
                  null,
                  [
                    this.t.identifier("parentZoneDelegate"),
                    this.t.identifier("currentZone"),
                    this.t.identifier("targetZone"),
                    this.t.identifier("delegate"),
                    this.t.identifier("applyThis"),
                    this.t.identifier("args"),
                    this.t.identifier("source"),
                  ],
                  this.t.blockStatement([
                    this.t.expressionStatement(
                      this.t.callExpression(
                        this.t.memberExpression(
                          this.t.memberExpression(
                            this.t.memberExpression(
                              this.t.identifier("Zone"),
                              this.t.identifier("root")
                            ),
                            this.t.stringLiteral(ACTIVE_TRACE_ID_SET),
                            true
                          ),
                          this.t.identifier("add")
                        ),
                        [this.t.identifier(ScryAstVariable.traceId)]
                      )
                    ),
                    this.t.expressionStatement(
                      this.t.callExpression(
                        this.t.identifier("queueMicrotask"),
                        [
                          this.t.functionExpression(
                            null,
                            [],
                            this.t.blockStatement([
                              this.t.expressionStatement(
                                this.t.stringLiteral(
                                  "this is only onHasTaskQueue Trigger"
                                )
                              ),
                            ])
                          ),
                        ]
                      )
                    ),
                    // this.t.ifStatement(
                    //   this.t.logicalExpression(
                    //     "&&",
                    //     this.t.identifier("delegate"),
                    //     this.t.callExpression(
                    //       this.t.memberExpression(
                    //         this.t.callExpression(
                    //           this.t.memberExpression(
                    //             this.t.identifier("delegate"),
                    //             this.t.identifier("toString")
                    //           ),
                    //           []
                    //         ),
                    //         this.t.identifier("includes")
                    //       ),
                    //       [this.t.stringLiteral("async")]
                    //     )
                    //   ),
                    //   this.t.blockStatement([
                    //     this.t.expressionStatement(
                    //       this.t.assignmentExpression(
                    //         "=",
                    //         this.t.memberExpression(
                    //           this.t.memberExpression(
                    //             this.t.identifier("currentZone"),
                    //             this.t.identifier("_properties")
                    //           ),
                    //           this.t.stringLiteral("parentTraceId"),
                    //           true
                    //         ),
                    //         this.t.identifier("traceId")
                    //       )
                    //     ),
                    //   ])
                    // ),
                    this.t.returnStatement(
                      this.t.callExpression(
                        this.t.memberExpression(
                          this.t.identifier("parentZoneDelegate"),
                          this.t.identifier("invoke")
                        ),
                        [
                          this.t.identifier("targetZone"),
                          this.t.identifier("delegate"),
                          this.t.identifier("applyThis"),
                          this.t.identifier("args"),
                          this.t.identifier("source"),
                        ]
                      )
                    ),
                  ])
                )
              ),
              // this.t.objectProperty(
              //   this.t.identifier("zoneSpec"),
              //   this.t.objectExpression([
              //     this.t.objectMethod(
              //       "method",
              //       this.t.identifier("onFork"),
              //       [
              //         this.t.identifier("parentZoneDelegate"),
              //         this.t.identifier("currentZone"),
              //         this.t.identifier("targetZone"),
              //         this.t.identifier("zoneSpec"),
              //       ],
              //       this.t.blockStatement([
              //         // zoneSpec.properties = { ...zoneSpec.properties, parentTraceId: currentZone.get('parentTraceId') };
              //         this.t.expressionStatement(
              //           this.t.assignmentExpression(
              //             "=",
              //             this.t.memberExpression(
              //               this.t.identifier("zoneSpec"),
              //               this.t.identifier("properties")
              //             ),
              //             this.t.objectExpression([
              //               this.t.spreadElement(
              //                 this.t.memberExpression(
              //                   this.t.identifier("zoneSpec"),
              //                   this.t.identifier("properties")
              //                 )
              //               ),
              //               this.t.objectProperty(
              //                 this.t.identifier("parentTraceId"),
              //                 this.t.callExpression(
              //                   this.t.memberExpression(
              //                     this.t.identifier("currentZone"),
              //                     this.t.identifier("get")
              //                   ),
              //                   [this.t.stringLiteral("parentTraceId")]
              //                 )
              //               ),
              //             ])
              //           )
              //         ),
              //         // return parentZoneDelegate.fork(targetZone, zoneSpec);
              //         this.t.returnStatement(
              //           this.t.callExpression(
              //             this.t.memberExpression(
              //               this.t.identifier("parentZoneDelegate"),
              //               this.t.identifier("fork")
              //             ),
              //             [
              //               this.t.identifier("targetZone"),
              //               this.t.identifier("zoneSpec"),
              //             ]
              //           )
              //         ),
              //       ])
              //     ),
              //   ])
              // ),
              this.t.objectProperty(
                this.t.identifier("onHasTask"),
                this.t.functionExpression(
                  null,
                  [
                    this.t.identifier("delegate"),
                    this.t.identifier("current"),
                    this.t.identifier("target"),
                    this.t.identifier("hasTaskState"),
                  ],
                  this.t.blockStatement([
                    this.t.expressionStatement(
                      this.t.callExpression(
                        this.t.memberExpression(
                          this.t.identifier("delegate"),
                          this.t.identifier("hasTask")
                        ),
                        [
                          this.t.identifier("target"),
                          this.t.identifier("hasTaskState"),
                        ]
                      )
                    ),
                    this.t.variableDeclaration("const", [
                      this.t.variableDeclarator(
                        this.t.identifier("allDone"),
                        this.t.logicalExpression(
                          "&&",
                          this.t.unaryExpression(
                            "!",
                            this.t.memberExpression(
                              this.t.identifier("hasTaskState"),
                              this.t.identifier("microTask")
                            )
                          ),
                          this.t.logicalExpression(
                            "&&",
                            this.t.unaryExpression(
                              "!",
                              this.t.memberExpression(
                                this.t.identifier("hasTaskState"),
                                this.t.identifier("macroTask")
                              )
                            ),
                            this.t.unaryExpression(
                              "!",
                              this.t.memberExpression(
                                this.t.identifier("hasTaskState"),
                                this.t.identifier("eventTask")
                              )
                            )
                          )
                        )
                      ),
                    ]),
                    this.t.ifStatement(
                      this.t.identifier("allDone"),
                      this.t.blockStatement([
                        this.t.ifStatement(
                          this.t.callExpression(
                            this.t.memberExpression(
                              this.t.memberExpression(
                                this.t.memberExpression(
                                  this.t.identifier("Zone"),
                                  this.t.identifier("root")
                                ),
                                this.t.stringLiteral(ACTIVE_TRACE_ID_SET),
                                true
                              ),
                              this.t.identifier("has")
                            ),
                            [this.t.identifier(ScryAstVariable.traceId)]
                          ),
                          this.t.blockStatement([
                            this.t.expressionStatement(
                              this.t.callExpression(
                                this.t.memberExpression(
                                  this.t.memberExpression(
                                    this.t.memberExpression(
                                      this.t.identifier("Zone"),
                                      this.t.identifier("root")
                                    ),
                                    this.t.stringLiteral(ACTIVE_TRACE_ID_SET),
                                    true
                                  ),
                                  this.t.identifier("delete")
                                ),
                                [this.t.identifier(ScryAstVariable.traceId)]
                              )
                            ),
                          ])
                        ),
                      ])
                    ),
                  ])
                )
              ),
            ]),
          ]
        )
      ),
    ]);
  }

  //Get ast parentTraceId variable from current zone(with zone.js scope)
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

  //Create ast returnValue(Just binding returnValue variable)
  public createReturnValue() {
    return this.t.variableDeclaration("let", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.returnValue),
        this.t.nullLiteral()
      ),
    ]);
  }

  //Update returnValue with origin execution(with zone.js new forked scope)
  public craeteReturnValueUpdaterWithOriginExecution(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    //Get original call expression
    const originalCall = path.node;
    let resultAst: babel.types.ExpressionStatement = this.t.expressionStatement(
      this.t.nullLiteral()
    );
    try {
      //Create ast returnValue with origin execution
      resultAst = this.t.expressionStatement(
        this.t.assignmentExpression(
          "=",
          this.t.identifier(ScryAstVariable.returnValue),
          this.t.callExpression(
            this.t.memberExpression(
              this.t.identifier(TRACE_ZONE),
              this.t.identifier("run")
            ),
            [
              this.t.arrowFunctionExpression(
                [],
                this.t.blockStatement([
                  this.t.variableDeclaration("const", [
                    this.t.variableDeclarator(
                      this.t.identifier("originalCallReturnValue"),
                      originalCall
                    ),
                  ]),

                  this.t.ifStatement(
                    this.t.logicalExpression(
                      "&&",
                      this.t.identifier("originalCallReturnValue"),
                      this.t.memberExpression(
                        this.t.identifier("originalCallReturnValue"),
                        this.t.identifier("then")
                      )
                    ),
                    this.t.blockStatement([
                      this.t.expressionStatement(
                        this.t.callExpression(
                          this.t.memberExpression(
                            this.t.identifier("originalCallReturnValue"),
                            this.t.identifier("then")
                          ),
                          [
                            this.t.arrowFunctionExpression(
                              [],
                              this.t.blockStatement([
                                this.t.expressionStatement(
                                  this.t.callExpression(
                                    this.t.memberExpression(
                                      this.t.memberExpression(
                                        this.t.memberExpression(
                                          this.t.identifier("Zone"),
                                          this.t.identifier("root")
                                        ),
                                        this.t.stringLiteral(
                                          ACTIVE_TRACE_ID_SET
                                        ),
                                        true
                                      ),
                                      this.t.identifier("delete")
                                    ),
                                    [this.t.identifier(ScryAstVariable.traceId)]
                                  )
                                ),
                              ])
                            ),
                          ]
                        )
                      ),
                    ]),
                    this.t.blockStatement([
                      this.t.expressionStatement(
                        this.t.callExpression(
                          this.t.memberExpression(
                            this.t.memberExpression(
                              this.t.memberExpression(
                                this.t.identifier("Zone"),
                                this.t.identifier("root")
                              ),
                              this.t.stringLiteral(ACTIVE_TRACE_ID_SET),
                              true
                            ),
                            this.t.identifier("delete")
                          ),
                          [this.t.identifier(ScryAstVariable.traceId)]
                        )
                      ),
                    ])
                  ),
                  // this.t.expressionStatement(
                  //   this.t.callExpression(
                  //     this.t.memberExpression(
                  //       this.t.identifier("originalCallReturnValue"),
                  //       this.t.identifier("then")
                  //     ),
                  //     [
                  //       this.t.arrowFunctionExpression(
                  //         [],
                  //         this.t.blockStatement([
                  //           this.t.expressionStatement(
                  //             this.t.stringLiteral("trigger!!")
                  //           ),
                  //         ])
                  //       ),
                  //     ]
                  //   )
                  // ),

                  this.t.returnStatement(
                    this.t.identifier("originalCallReturnValue")
                  ),
                ])
              ),
              // this.t.arrowFunctionExpression(
              //   [],
              //   this.t.blockStatement([this.t.returnStatement(originalCall)])
              // ),
            ]
          )
        )
      );
    } catch (error) {
      console.error(
        "craeteReturnValueUpdaterWithOriginExecution error:",
        error
      );
    }

    //Create try block
    const tryBlock = this.t.blockStatement([resultAst]);
    //Create catch clause
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
        this.t.identifier(ScryAstVariable.parentTraceId) // 존재할 경우
          ? this.t.identifier(ScryAstVariable.parentTraceId)
          : this.t.identifier("undefined")
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
        //String literal
        else if (this.t.isStringLiteral(arg)) {
          return this.t.stringLiteral(arg.value);
        }
        //Numeric literal
        else if (this.t.isNumericLiteral(arg)) {
          return this.t.numericLiteral(Number(arg.value));
        }
        //Identifier (variable)
        else if (this.t.isIdentifier(arg)) {
          return this.t.identifier(arg.name);
        }
        //Object expression
        else if (this.t.isObjectExpression(arg)) {
          return arg;
        }
        //Other types
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
}

export default ScryAst;
