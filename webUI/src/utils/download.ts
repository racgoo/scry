// Save the currently rendered single-file report to disk.  Inlines the live
// document HTML so users can keep / share a snapshot of the trace report.
export function downloadCurrentPage() {
  const html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "scry-trace.html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
