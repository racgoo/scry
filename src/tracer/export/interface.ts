interface ExporterStrategyInterface {
  openBrowser(filePath: string): Promise<void>;
  saveHtmlAndReturnFilePath(html: string): string;
}

interface ExporterInterface {
  exportHtml(html: string): void;
}

export { ExporterInterface, ExporterStrategyInterface };
