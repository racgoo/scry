// IDE-style code block with syntax highlighting (prism-react-renderer).
//
// Used for Function Definition / Class Definition / Arguments / Return
// Value sections of the trace detail modal — they used to render as plain
// monospace text, which made multi-line function bodies look cramped and
// unstructured, the same complaint engineers have when they see a paste
// in plain Slack instead of GitHub.
import { Highlight, themes, type Language } from "prism-react-renderer";

interface Props {
  code: string;
  language?: Language;
  /** Show line numbers in a left gutter (defaults to true for >1 line). */
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language = "tsx",
  showLineNumbers,
}: Props) {
  const text = code ?? "";
  const lines = text.split("\n");
  const showGutter = showLineNumbers ?? lines.length > 1;

  return (
    <Highlight code={text} language={language} theme={themes.vsDark}>
      {({ className, tokens, getLineProps, getTokenProps }) => (
        <pre className={`code-block ${className}`}>
          {tokens.map((line, i) => {
            const lineProps = getLineProps({ line, key: i });
            return (
              <div {...lineProps} key={i} className={`code-line ${lineProps.className ?? ""}`}>
                {showGutter && (
                  <span className="code-gutter">{i + 1}</span>
                )}
                <span className="code-content">
                  {line.map((token, key) => {
                    const tokenProps = getTokenProps({ token, key });
                    return <span {...tokenProps} key={key} />;
                  })}
                </span>
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}
