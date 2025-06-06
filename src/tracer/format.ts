import dayjs from "dayjs";

//data formatter for trace result
class Format {
  //Generate html root for trace result(zip all trace result)
  static generateHtmlRoot(
    items: DisplayDetailResult[],
    startTime: dayjs.Dayjs,
    duration: number
  ): string {
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
              margin-bottom: 2rem;
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
              gap: 0.75rem;
              padding: 1rem;
            }

            .trace-item {
              display: flex;
              align-items: center;
              padding: 0.75rem 1rem;
              height: auto;
              min-height: 3rem;
              background: var(--card-bg);
              border-radius: 8px;
              border: 1px solid var(--border-color);
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              margin-left: calc(var(--depth, 0) * 20px);
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

            .trace-item.nested.hidden {
              display: none !important;
              height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              opacity: 0;
              pointer-events: none;
              border: none;
              overflow: hidden;
            }

            /* 추가: 연속된 hidden 아이템들 사이의 gap 제거 */
            .trace-item.nested.hidden + .trace-item.nested.hidden {
              margin-top: -0.5rem;
            }

            .chain-group {
              background: var(--card-bg);
              border: 1px solid var(--primary-color);
              border-radius: 12px;
              padding: 1rem 0.75rem 0.75rem;
              margin-bottom: 0;
              box-shadow: 0 0 15px var(--primary-glow);
              position: relative;
              z-index: 1;
            }

            /* Chained 라벨 추가 */
            .chain-group::before {
              content: 'Chained';
              position: absolute;
              top: -0.75rem;
              left: 1rem;
              background: linear-gradient(135deg, var(--primary-dark), var(--accent-color));
              padding: 0.25rem 0.75rem;
              border-radius: 6px;
              font-size: 0.75rem;
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
              margin-top: 1.0rem;
            }

            /* 체인 그룹 내부 마지막 아이템 마진 제거 */
            .chain-group .trace-item:last-child {
              margin-bottom: 0;
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
                  NPM Package
                </a>
              </div>
            </div>

            <div class="trace-list">
              ${this.generateTraceList(items)}
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
            const items = ${this.parseJson(items)};
            
            function showModal(index) {
              const modal = document.getElementById('modal');
              const modalContent = document.getElementById('modal-content');
              modalContent.innerHTML = items[index].html;
              modal.classList.add('visible');
              hljs.highlightAll();
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

            function collapseTrace(event, level) {
              event.preventDefault();
              event.stopPropagation();
              
              const button = event.currentTarget;
              const isCollapsing = !button.classList.contains('collapsed');
              button.classList.toggle('collapsed');
              
              const currentItem = button.closest('.trace-item');
              let next = currentItem.nextElementSibling;
              
              while (next) {
                const nextLevel = parseInt(next.dataset.level);
                if (nextLevel <= level) break;
                
                if (isCollapsing) {
                  // 닫을 때: 현재 레벨보다 깊은 모든 항목을 숨김
                  next.classList.add('hidden');
                } else {
                  // 열 때: 직계 자식만 보이게 하고, 나머지는 부모의 상태를 따라감
                  if (nextLevel === level + 1) {
                    next.classList.remove('hidden');
                  } else {
                    // 직계 자식이 아닌 경우, 모든 부모의 상태를 확인
                    let parent = next.previousElementSibling;
                    let shouldShow = true;
                    
                    while (parent && parseInt(parent.dataset.level) > level) {
                      const parentButton = parent.querySelector('.collapse-btn');
                      if (parentButton?.classList.contains('collapsed')) {
                        shouldShow = false;
                        break;
                      }
                      parent = parent.previousElementSibling;
                    }
                    
                    if (shouldShow) {
                      next.classList.remove('hidden');
                    }
                  }
                }
                next = next.nextElementSibling;
              }
            }
          </script>
        </body>
      </html>
    `;
  }

  static generateTraceList(items: DisplayDetailResult[]): string {
    if (!items || items.length === 0) return "";

    // 트레이스 아이템 렌더링 함수
    const renderTraceItem = (item: DisplayDetailResult, index: number) =>
      '<div class="trace-item ' +
      (item.depth > 0 ? "nested" : "") +
      '" ' +
      'data-level="' +
      item.depth +
      '" ' +
      'style="--depth: ' +
      item.depth +
      '">' +
      '<div class="trace-controls">' +
      '<button class="collapse-btn" onclick="collapseTrace(event, ' +
      item.depth +
      ')">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" pointer-events="none">' +
      '<path d="M19 9l-7 7-7-7" pointer-events="none"/>' +
      "</svg>" +
      "</button>" +
      "</div>" +
      '<div class="item-content" onclick="showModal(' +
      index +
      ')">' +
      '<div class="trace-icon">' +
      '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M13 10V3L4 14h7v7l9-11h-7z"/>' +
      "</svg>" +
      "</div>" +
      '<span class="trace-name">' +
      item.title +
      "</span>" +
      "</div>" +
      "</div>";

    const processItems = (
      startIndex: number,
      parentDepth: number
    ): [string, number] => {
      let html = "";
      let i = startIndex;

      while (i < items.length) {
        const item = items[i];

        // 현재 아이템이 없거나 부모 뎁스보다 얕은 경우 처리 중단
        if (!item || item.depth <= parentDepth) {
          break;
        }

        // 체인의 시작을 만났을 때
        if (item.chainInfo?.startTraceId) {
          const chainId = item.chainInfo.startTraceId;
          html += '<div class="chain-group">';

          // 현재 아이템 렌더링
          html += renderTraceItem(item, i);
          i++;

          // 다음 아이템들 처리
          while (i < items.length) {
            const nextItem = items[i];
            if (
              !nextItem ||
              nextItem.depth <= parentDepth ||
              (nextItem.chainInfo?.startTraceId &&
                nextItem.chainInfo.startTraceId !== chainId &&
                nextItem.depth === item.depth)
            ) {
              break;
            }

            // 새로운 체인 그룹 시작
            if (
              nextItem.chainInfo?.startTraceId &&
              nextItem.chainInfo.startTraceId !== chainId
            ) {
              const [subHtml, newIndex] = processItems(i, item.depth);
              html += subHtml;
              i = newIndex;
            } else {
              html += renderTraceItem(nextItem, i);
              i++;
            }
          }

          html += "</div>";
        } else {
          // 일반 아이템 렌더링
          html += renderTraceItem(item, i);
          i++;
        }
      }

      return [html, i];
    };

    const [finalHtml] = processItems(0, -1); // startIndex를 0으로 변경
    return finalHtml;
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
              <pre><code class="language-json">${this.parseJson(
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
              <pre><code class="language-javascript">${this.parseReturnValue(
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

  //Parse return value to string(error stack or message)
  private static parseReturnValue(returnValue: unknown): string {
    if (returnValue instanceof Error) {
      return returnValue.stack || returnValue.message;
    } else if (returnValue instanceof Promise) {
      return "[Promise]"; // Promise는 단순히 '[Promise]'로 표시
    } else {
      return JSON.stringify(returnValue, (key, value) => {
        if (
          value &&
          typeof value === "object" &&
          (value.constructor?.name?.includes("Zone") ||
            key.includes("zone") ||
            key.includes("Zone"))
        ) {
          return "[Zone Object]";
        }
        return value;
      });
    }
  }

  public static parseJson(value: unknown): string {
    return JSON.stringify(value, (key, value) => {
      // Zone 관련 객체인지 확인
      if (
        value &&
        typeof value === "object" &&
        (value.constructor?.name?.includes("Zone") ||
          key.includes("zone") ||
          key.includes("Zone"))
      ) {
        return "[Zone Object]";
      }
      return value;
    });
  }
}

export default Format;
