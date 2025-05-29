//data formatter for trace result
class Format {
  //generate html root for trace result(zip all trace result)
  static generateHtmlRoot(items: DisplayResult[]): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Scry Trace Results</title>
          <style>
            body { 
              font-family: monospace; 
              padding: 20px;
              background: #f5f5f5;
            }
            .trace-list {
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            .trace-item {
              border: 1px solid #ccc;
              padding: 15px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              cursor: pointer;
              transition: all 0.2s;
            }
            .trace-item:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            .trace-name {
              font-weight: bold;
              color: #333;
            }
            .modal {
              display: none;
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.5);
            }
            .modal-content {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 90%;
              height: 90%;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .modal iframe {
              width: 100%;
              height: 100%;
              border: none;
              border-radius: 8px;
            }
            .close-btn {
              position: absolute;
              right: 10px;
              top: 10px;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <h1>[@racgoo/scry] Trace Results</h1>
          <div class="trace-list">
            ${items
              .map(
                (item) => `
              <div class="trace-item" onclick="showModal('${item.url}')" >
                <span>${item.title}</span>
              </div>
            `
              )
              .join("")}
          </div>

          <div id="modal" class="modal" onclick="hideModal(event)">
            <div class="modal-content">
              <iframe id="modal-iframe"></iframe>
            </div>
          </div>

          <script>
            function showModal(url) {
              document.getElementById('modal-iframe').src = url;
              document.getElementById('modal').style.display = 'block';
            }

            function hideModal(event) {
              if (event.target.className === 'modal') {
                document.getElementById('modal').style.display = 'none';
                document.getElementById('modal-iframe').src = '';
              }
            }

            document.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                document.getElementById('modal').style.display = 'none';
                document.getElementById('modal-iframe').src = '';
              }
            });
          </script>
        </body>
      </html>
    `;
  }

  //generate html content for trace result
  static generateHtmlContent(node: TraceNode): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Trace Result - ${node.name}</title>
          <style>
            body { 
              font-family: monospace; 
              padding: 20px;
              background: #f5f5f5;
            }
            .trace-info { 
              border: 1px solid #ccc; 
              padding: 20px;
              margin: 20px 0;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              display: flex;
              align-items: start;
              gap: 15px;
            }
            .error-indicator {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: ${node.errored ? "#ff0000" : "transparent"};
              margin-top: 5px;
              ${node.errored ? "animation: blink 1s infinite;" : ""}
            }
            @keyframes blink {
              0% { opacity: 1; }
              50% { opacity: 0.3; }
              100% { opacity: 1; }
            }
            .content {
              flex: 1;
            }
            .args { 
              color: #666;
              margin: 10px 0;
            }
            .return { 
              color: #0066cc;
              margin: 10px 0;
            }
            .source { 
              color: #888;
              margin: 10px 0;
              font-size: 0.9em;
            }
            pre {
              background: #f8f8f8;
              padding: 10px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="trace-info">
            <div class="error-indicator"></div>
            <div class="content">
              <h2>${node.name}</h2>
              <div class="args">
                <strong>Arguments:</strong>
                <pre>${JSON.stringify(node.args)}</pre>
              </div>
              <div class="return">
                <strong>Return Value:</strong>
                <pre>${node.errored ? "Error" : "Success"}</pre>
                <pre>${this.parseReturnValue(node.returnValue)}</pre>
              </div>
              <div class="source">
                <strong>Source:</strong> ${node.source}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  //Parse return value to string(error stack or message)
  private static parseReturnValue(returnValue: unknown): string {
    if (returnValue instanceof Error) {
      return returnValue.stack || returnValue.message;
    }
    return JSON.stringify(returnValue);
  }
}

export default Format;
