class Format {
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
            <h2>${node.name}</h2>
            <div class="args">
              <strong>Arguments:</strong>
              <pre>${JSON.stringify(node.args, null, 2)}</pre>
            </div>
            <div class="return">
              <strong>Return Value:</strong>
              <pre>${JSON.stringify(node.returnValue, null, 2)}</pre>
            </div>
            <div class="source">
              <strong>Source:</strong> ${node.source}
            </div>
            ${node.duration ? `<div>Duration: ${node.duration}ms</div>` : ""}
          </div>
        </body>
      </html>
    `;
  }
}

export default Format;
