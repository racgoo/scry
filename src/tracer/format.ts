import dayjs from "dayjs";

//data formatter for trace result(Made by claude:))
class Format {
  //Generate html root for trace result(zip all trace result)
  static generateHtmlRoot(
    traceNodes: TraceNode[],
    startTime: dayjs.Dayjs,
    duration: number
  ): string {
    // items 배열을 평탄화하여 모든 노드를 포함하도록 수정
    const flattenNodes = (nodes: TraceNode[]): TraceNode[] => {
      let result: TraceNode[] = [];
      nodes.forEach((node) => {
        result.push(node);
        if (node.children.length > 0) {
          result = result.concat(flattenNodes(node.children));
        }
      });
      return result;
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Scry Trace Results</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
          <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
          <style>
            :root {
              --primary-rgb: 59, 130, 246;
              --primary-color: rgb(var(--primary-rgb));
              --primary-glow: rgba(var(--primary-rgb), 0.5);
              --primary-light: #60a5fa;
              --primary-dark: #2563eb;
              --accent-rgb: 139, 92, 246;
              --accent-color: rgb(var(--accent-rgb));
              --bg-gradient-1: #0f172a;
              --bg-gradient-2: #1e1b4b;
              --card-bg: rgba(30, 41, 59, 0.4);
              --text-primary: #f8fafc;
              --text-secondary: #94a3b8;
              --border-color: rgba(148, 163, 184, 0.1);
              --success-light: #86efac;
              --success-dark: #22c55e;
              --error-light: #fca5a5;
              --error-dark: #ef4444;
            }
            
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              overscroll-behavior: none;
            }

            ::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }

            ::-webkit-scrollbar-track {
              background: rgba(255, 255, 255, 0.05);
              border-radius: 4px;
            }

            ::-webkit-scrollbar-thumb {
              background: linear-gradient(var(--primary-dark), var(--primary-color));
              border-radius: 4px;
              border: 2px solid rgba(255, 255, 255, 0.05);
            }

            ::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(var(--primary-color), var(--primary-light));
            }
            
            body { 
              font-family: 'Inter', -apple-system, sans-serif;
              padding: 1.5rem;
              background: linear-gradient(45deg, var(--bg-gradient-1), var(--bg-gradient-2));
              color: var(--text-primary);
              line-height: 1.6;
              min-height: 100vh;
              overscroll-behavior: none;
            }

            .container {
              max-width: 1200px;
              margin: 0 auto;
              position: relative;
            }

            .header-box {
              background: linear-gradient(135deg, var(--card-bg), rgba(30, 41, 59, 0.8));
              border-radius: 16px;
              padding: 1.5rem;
              margin-bottom: 1rem;
              border: 1px solid rgba(255, 255, 255, 0.1);
              box-shadow: 
                0 8px 32px rgba(0, 0, 0, 0.2),
                0 0 32px var(--primary-glow);
            }

            .header-box h1 {
              font-size: 2rem;
              font-weight: 600;
              color: var(--text-primary);
              display: flex;
              align-items: center;
              gap: 1rem;
              background: linear-gradient(to right, var(--text-primary), var(--primary-light));
              -webkit-background-clip: text;
              background-clip: text;
              color: transparent;
              text-shadow: 0 0 30px var(--primary-glow);
            }

            .header-box .subtitle {
              font-size: 1rem;
              color: var(--text-secondary);
              margin-top: 0.75rem;
              font-weight: 500;
              letter-spacing: 0.5px;
            }

            .header-links {
              display: flex;
              gap: 1rem;
              margin-top: 1.25rem;
            }

            .header-link {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              color: var(--text-primary);
              text-decoration: none;
              padding: 0.5rem 1rem;
              border-radius: 8px;
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid var(--border-color);
              transition: all 0.3s ease;
            }

            .header-link:hover {
              background: rgba(255, 255, 255, 0.1);
              border-color: var(--primary-color);
              transform: translateY(-2px);
              box-shadow: 0 0 15px var(--primary-glow);
            }

            .trace-list {
              display: flex;
              flex-direction: column;
              gap: 0px;
              padding: 1rem;
              margin-bottom: 1rem;
            }

            .trace-list:last-child {
              margin-bottom: 0;
            }

            .trace-list > .trace-item,
            .trace-list > .chain-group {
              margin-bottom: 0;
            }

            .trace-item {
              display: flex;
              align-items: center;
              padding: 0.75rem 1rem;
              background: var(--card-bg);
              border-radius: 8px;
              border: 1px solid var(--border-color);
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .children {
              padding-left: 2rem;
              position: relative;
            }

            .children::before {
              content: '';
              position: absolute;
              left: 0.9rem;
              top: 0;
              bottom: 0.5rem;
              width: 2px;
              background: var(--border-color);
              opacity: 0.5;
            }

            .children.hidden {
              display: none;
            }

            .item-content {
              display: flex;
              align-items: center;
              gap: 0.75rem;
              flex: 1;
              cursor: pointer;
            }

            .trace-item:hover {
              transform: translateX(4px);
              border-color: var(--primary-color);
              box-shadow: 0 0 20px var(--primary-glow);
            }

            .trace-item .trace-icon svg {
              width: 16px;
              height: 16px;
              stroke-linecap: round;
              stroke-linejoin: round;
            }

            .trace-item .trace-icon {
              background: linear-gradient(135deg, var(--primary-dark), var(--accent-color));
              box-shadow: 
                0 0 15px var(--primary-glow),
                inset 0 0 8px rgba(255, 255, 255, 0.2);
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }

            .trace-name {
              font-family: 'Fira Code', monospace;
              font-size: 0.875rem;
              color: var(--text-primary);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              flex: 1;
            }

            .modal {
              display: none;
              position: fixed;
              inset: 0;
              background: rgba(15, 23, 42, 0.9);
              backdrop-filter: blur(8px);
              z-index: 1000;
            }

            .modal.visible {
              display: flex;
              animation: fadeIn 0.3s ease;
            }

            .modal-content {
              margin: auto;
              width: 90%;
              max-width: 1000px;
              max-height: 90vh;
              background: var(--bg-gradient-2);
              border-radius: 16px;
              padding: 2rem;
              position: relative;
              overflow-y: auto;
              border: 1px solid var(--border-color);
              box-shadow: 0 0 30px var(--primary-glow);
            }

            .close-btn {
              position: absolute;
              top: 1rem;
              right: 1rem;
              background: none;
              border: none;
              color: var(--text-primary);
              cursor: pointer;
              padding: 0.5rem;
              border-radius: 50%;
              transition: all 0.2s ease;
            }

            .close-btn:hover {
              background: rgba(255, 255, 255, 0.1);
            }

            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }

            .trace-info {
              color: var(--text-primary);
            }

            .section {
              margin-bottom: 2rem;
              animation: slideUp 0.3s ease forwards;
              opacity: 0;
              transform: translateY(10px);
            }

            .section-title {
              font-size: 1.25rem;
              font-weight: 600;
              margin-bottom: 1rem;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            }

            pre {
              background: rgba(0, 0, 0, 0.2);
              border-radius: 8px;
              padding: 1rem;
              margin: 0;
              overflow-x: auto;
            }

            @keyframes slideUp {
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            .detail-header {
              background: linear-gradient(135deg, var(--card-bg), rgba(30, 41, 59, 0.8));
              border-radius: 12px;
              padding: 1.5rem;
              margin-bottom: 2rem;
              border: 1px solid rgba(255, 255, 255, 0.1);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            }

            .detail-title h1 {
              font-size: 2rem;
              font-weight: 600;
              margin-bottom: 1rem;
              background: linear-gradient(to right, var(--text-primary), var(--primary-light));
              -webkit-background-clip: text;
              background-clip: text;
              color: transparent;
            }

            .meta-badges {
              display: flex;
              gap: 0.75rem;
              align-items: center;
            }

            .badge {
              display: flex;
              align-items: center;
              gap: 0.375rem;
              padding: 0.375rem 0.75rem;
              border-radius: 6px;
              font-size: 0.75rem;
              font-weight: 500;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              transition: all 0.3s ease;
            }

            .call-type {
              background: rgba(var(--primary-rgb), 0.1);
              color: var(--primary-light);
              border: 1px solid rgba(var(--primary-rgb), 0.2);
            }

            .call-type:hover {
              background: rgba(var(--primary-rgb), 0.15);
              border-color: rgba(var(--primary-rgb), 0.3);
            }

            .status-badge {
              border: 1px solid transparent;
            }

            .status-badge.success {
              background: rgba(34, 197, 94, 0.1);
              color: var(--success-light);
              border-color: rgba(34, 197, 94, 0.2);
            }

            .status-badge.error {
              background: rgba(239, 68, 68, 0.1);
              color: var(--error-light);
              border-color: rgba(239, 68, 68, 0.2);
            }

            .status-badge.success:hover {
              background: rgba(34, 197, 94, 0.15);
              border-color: rgba(34, 197, 94, 0.3);
            }

            .status-badge.error:hover {
              background: rgba(239, 68, 68, 0.15);
              border-color: rgba(239, 68, 68, 0.3);
            }

            .badge svg {
              flex-shrink: 0;
            }

            .time-info {
              display: flex;
              gap: 2rem;
              margin-top: 1rem;
              padding-top: 1rem;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
            }

            .time-item {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              color: var(--text-secondary);
              font-size: 0.875rem;
              font-weight: 500;
            }

            .time-item svg {
              color: var(--primary-light);
              flex-shrink: 0;
            }

            .trace-controls {
              min-width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              margin-right: 8px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 4px;
              padding: 2px;
            }

            .collapse-btn {
              width: 24px;
              height: 24px;
              background: none;
              border: none;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--text-primary);
              padding: 0;
              opacity: 0.7;
              transition: all 0.2s ease;
            }

            .collapse-btn:hover {
              opacity: 1;
              transform: scale(1.1);
            }

            .collapse-btn svg {
              width: 16px;
              height: 16px;
              transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              transform: rotate(0);
            }

            .collapse-btn.collapsed svg {
              transform: rotate(-90deg);
            }

            .chain-group {
              background: var(--card-bg);
              border: 1px solid var(--primary-color);
              border-radius: 12px;
              padding: 0px;
              margin-bottom: 0rem;
              box-shadow: 0 0 15px var(--primary-glow);
              position: relative;
              z-index: 1;
            }

            .chain-group .trace-item:last-child {
              margin-bottom: 0;
            }

            /* 체인 그룹 내의 children도 패딩 조정 */
            .chain-group .children {
              padding-left: 1.5rem;
            }

            /* 체인 그룹이 숨겨졌을 때의 스타일 */
            .chain-group.hidden {
              display: none !important;
              height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              opacity: 0;
              pointer-events: none;
              border: none;
              overflow: hidden;
            }

            /* 부모가 숨겨졌을 때 체인 그룹도 숨김 */
            .trace-item.hidden ~ .chain-group {
              display: none !important;
              height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              opacity: 0;
              pointer-events: none;
              border: none;
              overflow: hidden;
            }

            /* Chained 라벨 추가 */
            .chain-group::before {
              content: 'Chained🔗';
              position: absolute;
              top: -0.5rem;
              left: 0px;
              background: linear-gradient(135deg, var(--primary-dark), var(--accent-color));
              padding: 4px 0px 0px 0px;
              border-radius: 6px;
              font-size: 0.5rem;
              font-weight: 500;
              color: var(--text-primary);
              letter-spacing: 0.5px;
              text-transform: uppercase;
              box-shadow: 
                0 2px 4px rgba(0, 0, 0, 0.1),
                0 0 10px var(--primary-glow);
              border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .chain-group .trace-item {
              background: rgba(255, 255, 255, 0.05);
              position: relative;
              z-index: 2;
            }

            .chain-group .trace-item.nested {
              margin-left: calc(var(--depth, 0) * 20px);
              background: rgba(255, 255, 255, 0.03);
            }

            /* 체인 그룹 내부 아이템 간격 조정 */
            .chain-group .trace-item + .trace-item {
              margin-top: 0rem;
            }

            .chain-group .trace-item:hover {
              transform: translateX(4px);
              background: rgba(255, 255, 255, 0.1);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header-box">
              <h1>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Scry Trace Results
              </h1>
              <div class="subtitle">Visualize your code's execution journey with precision and elegance</div>
              <div class="subtitle">The following output is displayed in a directory-like structure, representing the execution order of functions and the execution context at the scope level.</div>
              <div class="time-info">
                <div class="time-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12,6 12,12 16,14"/>
                  </svg>
                  <span>Started: ${startTime.format(
                    "YYYY-MM-DD HH:mm:ss"
                  )}(system time)</span>
                </div>
                <div class="time-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  <span>Duration: ${
                    duration < 1000
                      ? `${duration}ms`
                      : `${(duration / 1000).toFixed(2)}s`
                  }</span>
                </div>
              </div>
              <div class="header-links">
                <a href="https://github.com/racgoo/scry" target="_blank" class="header-link">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                  </svg>
                  GitHub
                </a>
                <a href="https://www.npmjs.com/package/@racgoo/scry" target="_blank" class="header-link">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2.5 2.5h19v19h-19z"/>
                    <path d="M7.5 7.5v9h4.5v-9"/>
                    <path d="M16.5 7.5v9"/>
                  </svg>
                  NPM
                </a>

                <button class="header-link" onclick="downloadHtml()">                
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <path d="M7 10l5 5 5-5"/>
                    <path d="M12 15V3"/>
                  </svg>
                  Download HTML
                </button>
              </div>
            </div>
            <div>
              ${this.generateTraceList(traceNodes)}
            </div>
          </div>

          <div id="modal" class="modal" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
              <button class="close-btn" onclick="closeModal(event)">
                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
              <div id="modal-content"></div>
            </div>
          </div>

          <script>
            const items = ${JSON.stringify(
              flattenNodes(traceNodes),
              (key, value) => {
                if (key === "parent") return undefined;
                if (key === "children") return []; // 순환 참조 방지
                return value;
              }
            )};
            
            function downloadHtml() {
              const html = document.documentElement.outerHTML;
              const blob = new Blob([html], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "scry-trace.html";
              a.click();
              URL.revokeObjectURL(url);
            }

            function generateHtmlContent(node) {
              const callType = node.classCode ? "method" : "function";
              return \`
                <div class="trace-info">
                  <div class="detail-header">
                    <div class="detail-title">
                      <h1 class="function-name">\${node.name}</h1>
                      <div class="function-meta">
                        <div class="meta-badges">
                          <span class="badge call-type">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M20 12V8H6a2 2 0 100 4h14v-4M20 12v4H6a2 2 0 110-4h14v4" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            \${callType}
                          </span>
                          <span class="badge status-badge \${node.errored ? "error" : "success"}">
                            \${node.errored 
                              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke-width="2"/></svg>'
                              : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke-width="2"/><path d="M8 12l2 2 4-4" stroke-width="2"/></svg>'
                            }
                            \${node.errored ? "Failed" : "Success"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="content">
                    <div class="section" style="--animation-order: 1">
                      <div class="section-header">
                        <div class="section-title">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 3H7a2 2 0 00-2 2v5a2 2 0 01-2 2 2 2 0 012 2v5c0 1.1.9 2 2 2h1M16 3h1a2 2 0 012 2v5a2 2 0 002 2 2 2 0 00-2 2v5a2 2 0 01-2 2h-1" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          \${callType === "method" ? "Method Definition" : "Function Definition"}
                        </div>
                      </div>
                      <div class="section-content">
                        <pre><code class="language-javascript">\${node.classCode ? node.methodCode : (node.functionCode || "Source code not available")}</code></pre>
                      </div>
                    </div>
                    
                    \${node.classCode ? \`
                      <div class="section" style="--animation-order: 2">
                        <div class="section-header">
                          <div class="section-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Class Definition
                          </div>
                        </div>
                        <div class="section-content">
                          <pre><code class="language-javascript">\${node.classCode}</code></pre>
                        </div>
                      </div>
                    \` : ""}
                    
                    <div class="section" style="--animation-order: 3">
                      <div class="section-header">
                        <div class="section-title">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="12" cy="10" r="3" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Arguments
                        </div>
                      </div>
                      <div class="section-content">
                        <pre><code class="language-json">\${JSON.stringify(node.args, null, 2)}</code></pre>
                      </div>
                    </div>
                    
                    <div class="section" style="--animation-order: 4">
                      <div class="section-header">
                        <div class="section-title">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Return Value
                        </div>
                      </div>
                      <div class="section-content">
                        <pre><code class="language-javascript">\${JSON.stringify(node.returnValue, null, 2)}</code></pre>
                      </div>
                    </div>
                    
                    <div class="section" style="--animation-order: 5">
                      <div class="section-header">
                        <div class="section-title">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="12" cy="10" r="3" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Source Location
                        </div>
                      </div>
                      <div class="section-content source-content">
                        <span class="source-badge">\${node.source}</span>
                      </div>
                    </div>
                  </div>
                </div>
              \`;
            }
            
            function showModal(index) {
              const modal = document.getElementById('modal');
              const modalContent = document.getElementById('modal-content');
              if (items[index]) {
                modalContent.innerHTML = generateHtmlContent(items[index]);
              modal.classList.add('visible');
              hljs.highlightAll();
              }
            }

            function closeModal(event) {
              event.preventDefault();
              const modal = document.getElementById('modal');
              modal.classList.remove('visible');
            }

            document.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                closeModal(e);
              }
            });

            hljs.highlightAll();

            function collapseTrace(event, traceId) {
              event.preventDefault();
              event.stopPropagation();
              
              const button = event.currentTarget;
              const childrenContainer = document.querySelector('[data-parent="' + traceId + '"]');
              
              if (childrenContainer) {
              button.classList.toggle('collapsed');
                childrenContainer.classList.toggle('hidden');
              }
            }
          </script>
        </body>
      </html>
    `;
  }

  static generateTraceList(traceNodes: TraceNode[]): string {
    let globalIndex = 0;

    // 체인 그룹을 추적하기 위한 맵
    const chainGroups = new Map<number, TraceNode[]>();

    // 먼저 체인 그룹을 구성
    const buildChainGroups = (nodes: TraceNode[]) => {
      nodes.forEach((node) => {
        if (node.chainInfo?.startTraceId) {
          const groupId = node.chainInfo.startTraceId;
          if (!chainGroups.has(groupId)) {
            chainGroups.set(groupId, []);
          }
          chainGroups.get(groupId)!.push(node);
        }
        if (node.children.length > 0) {
          buildChainGroups(node.children);
        }
      });
    };

    buildChainGroups(traceNodes);

    const renderNode = (node: TraceNode): string => {
      let html = "";
      const currentIndex = globalIndex++;

      // 체인 그룹 시작
      if (node.chainInfo?.startTraceId) {
        const groupId = node.chainInfo.startTraceId;
        const group = chainGroups.get(groupId)!;

        // 그룹의 첫 번째 노드일 때만 chain-group div 시작
        if (group[0] === node) {
          html += '<div class="chain-group">';
        }
      }

      // 현재 노드 렌더링
      html += `
        <div class="trace-item" data-trace-id="${node.traceId}">
          <div class="trace-controls">
            ${
              node.children.length > 0
                ? `
              <button class="collapse-btn" onclick="collapseTrace(event, '${node.traceId}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
            `
                : ""
            }
          </div>
          <div class="item-content" onclick="showModal(${currentIndex})">
            <div class="trace-icon">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <span class="trace-name">${node.name}</span>
          </div>
        </div>
      `;

      // 자식 노드들 렌더링
      if (node.children.length > 0) {
        html += `<div class="children" data-parent="${node.traceId}">`;
        node.children.forEach((child) => {
          html += renderNode(child);
        });
        html += "</div>";
      }

      // 체인 그룹 종료
      if (node.chainInfo?.startTraceId) {
        const groupId = node.chainInfo.startTraceId;
        const group = chainGroups.get(groupId)!;

        // 그룹의 마지막 노드일 때만 chain-group div 종료
        if (group[group.length - 1] === node) {
          html += "</div>";
        }
      }

      return html;
    };

    return `<div class="trace-list">${traceNodes
      .filter((node) => !node.parent)
      .map((node) => renderNode(node))
      .join("")}</div>`;
  }

  //Generate execution detail html
  static generateHtmlContent(node: TraceNode): string {
    const callType = node.classCode ? "method" : "function";
    return `
      <div class="trace-info">
        <div class="detail-header">
          <div class="detail-title">
            <h1 class="function-name">${node.name}</h1>
            <div class="function-meta">
              <div class="meta-badges">
                <span class="badge call-type">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 12V8H6a2 2 0 100 4h14v-4M20 12v4H6a2 2 0 110-4h14v4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  ${callType}
                </span>
                <span class="badge status-badge ${
                  node.errored ? "error" : "success"
                }">
                  ${
                    node.errored
                      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke-width="2"/></svg>'
                      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke-width="2"/><path d="M8 12l2 2 4-4" stroke-width="2"/></svg>'
                  }
                  ${node.errored ? "Failed" : "Success"}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="content">
          <div class="section" style="--animation-order: 1">
            <div class="section-header">
              <div class="section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8 3H7a2 2 0 00-2 2v5a2 2 0 01-2 2 2 2 0 012 2v5c0 1.1.9 2 2 2h1M16 3h1a2 2 0 012 2v5a2 2 0 002 2 2 2 0 00-2 2v5a2 2 0 01-2 2h-1" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${
                  callType === "method"
                    ? "Method Definition"
                    : "Function Definition"
                }
              </div>
            </div>
            <div class="section-content">
              <pre><code class="language-javascript">${
                node.classCode
                  ? node.methodCode
                  : node.functionCode || "Source code not available"
              }</code></pre>
            </div>
          </div>
          
          ${
            node.classCode
              ? `
            <div class="section" style="--animation-order: 2">
              <div class="section-header">
                <div class="section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Class Definition
                </div>
              </div>
              <div class="section-content">
                <pre><code class="language-javascript">${node.classCode}</code></pre>
              </div>
            </div>
          `
              : ""
          }
          
          <div class="section" style="--animation-order: 3">
            <div class="section-header">
              <div class="section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="10" r="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Arguments
              </div>
            </div>
            <div class="section-content">
              <pre><code class="language-json">${Format.parseJson(
                node.args
              )}</code></pre>
            </div>
          </div>
          
          <div class="section" style="--animation-order: 4">
            <div class="section-header">
              <div class="section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Return Value
              </div>
            </div>
            <div class="section-content">
              <pre><code class="language-javascript">${Format.parseReturnValue(
                node.returnValue
              )}</code></pre>
            </div>
          </div>
          
          <div class="section" style="--animation-order: 5">
            <div class="section-header">
              <div class="section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="10" r="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Source Location
              </div>
            </div>
            <div class="section-content source-content">
              <span class="source-badge">${node.source}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private static parseJson(value: unknown): string {
    const seen = new WeakSet();
    return JSON.stringify(value, (key, value) => {
      if (key === "parent") return undefined;
      if (!value || typeof value !== "object") return value;
      if (seen.has(value))
        return `[Circular ${value.constructor?.name || "Object"}]`;
      seen.add(value);

      if (
        value.constructor?.name === "Timeout" ||
        value.constructor?.name === "TimersList" ||
        key === "_idleNext" ||
        key === "_idlePrev"
      ) {
        return "[Timer Object]";
      }

      if (
        value.constructor?.name?.includes("Zone") ||
        key.includes("zone") ||
        key.includes("Zone")
      ) {
        return "[Zone Object]";
      }

      if (!Array.isArray(value) && "name" in value && "traceId" in value) {
        (value as any).html = Format.generateHtmlContent(value as TraceNode);
      }

      return value;
    });
  }

  private static parseReturnValue(value: unknown): string {
    if (value instanceof Error) {
      return value.stack || value.message;
    }

    if (value instanceof Promise) {
      return "[Promise]";
    }

    try {
      const seen = new WeakSet();
      return JSON.stringify(value, (key, value) => {
        if (!value) return value;

        if (typeof value === "object") {
          // Zone 객체 처리
          if (
            value.constructor?.name?.includes("Zone") ||
            key.includes("zone") ||
            key.includes("Zone")
          ) {
            return "[Zone Object]";
          }

          // Timer 객체 처리
          if (
            value.constructor?.name === "Timeout" ||
            value.constructor?.name === "TimersList" ||
            key === "_idleNext" ||
            key === "_idlePrev"
          ) {
            return "[Timer Object]";
          }

          // 순환 참조 처리
          if (seen.has(value)) {
            return `[Circular ${value.constructor?.name || "Object"}]`;
          }
          seen.add(value);
        }

        return value;
      });
    } catch (e) {
      return `[Unstringifiable ${value?.constructor?.name || typeof value}]`;
    }
  }
}

export default Format;
