import { TraceNode } from "@/tracer/node/type.js";
import {
  ExporterStrategyInterface,
  RuntimeStrategyInterface,
} from "../interface.js";
import webui from "./webui.html.js";
import { Transformer } from "../../../utils/transformer.js";

class WebUIStrategy implements ExporterStrategyInterface {
  private runtimeStrategy: RuntimeStrategyInterface;
  constructor(runtimeStrategy: RuntimeStrategyInterface) {
    this.runtimeStrategy = runtimeStrategy;
  }

  exportHtml(html: string) {
    const filePath = this.runtimeStrategy.saveHtmlAndReturnFilePath(html);
    this.runtimeStrategy.openBrowser(filePath);
  }

  export(data: TraceNode[]) {
    // 1. 삽입할 스크립트 생성
    const injectionScript = `<script>window.__INJECTION_DATA__ = "${Transformer.serialize(
      data
    )}";</script>`;

    // 2. <header> 바로 뒤에 스크립트 삽입 (없으면 <body> 앞, 둘 다 없으면 맨 앞)
    let injectedHTML: string;
    if (webui.includes("<head>")) {
      injectedHTML = webui.replace(/<head>/i, `<head>${injectionScript}`);
    } else if (webui.includes("<body>")) {
      injectedHTML = webui.replace(/<body>/i, `<body>${injectionScript}`);
    } else {
      // fallback: 맨 앞에 삽입
      injectedHTML = injectionScript + webui;
    }

    // 3. 결과 사용
    const filePath =
      this.runtimeStrategy.saveHtmlAndReturnFilePath(injectedHTML);
    this.runtimeStrategy.openBrowser(filePath);
  }
}

export { WebUIStrategy };
