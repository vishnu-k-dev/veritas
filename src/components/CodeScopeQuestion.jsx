import { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileCode, ArrowRight, ChevronRight, Copy, Check } from 'lucide-react';

/**
 * CodeScopeQuestion — Split-screen code interview question
 * Left panel (60%): actual code from the candidate's repo with line numbers + syntax highlighting
 * Right panel (40%): question + answer textarea + prominent Submit button
 * On narrow screens (< lg) the panels stack vertically.
 */
export default function CodeScopeQuestion({ codeBlock, questionNum, totalQ, onSubmit, onKeyDown, onPaste }) {
  const [answer, setAnswer] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const MIN_CHARS = 5;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  if (!codeBlock) return null;

  const {
    filePath,
    language = 'javascript',
    startLine = 1,
    endLine,
    code,
    functionName,
    focusLine,
    question,
  } = codeBlock;

  const codeLines = (code || '').split('\n');

  const wordCount = useMemo(() => (answer.trim() ? answer.trim().split(/\s+/).length : 0), [answer]);
  const canSubmit = answer.trim().length >= MIN_CHARS;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(answer.trim());
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      handleSubmit();
      return;
    }
    if (onKeyDown) onKeyDown(e);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-card-dark/80 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/25 to-yellow-600/20 border border-primary/30 flex items-center justify-center shadow-glow-primary">
            <FileCode className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              CodeScope
              <span className="text-[10px] font-normal text-text-muted">— Code Review</span>
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              Question {questionNum} of {totalQ}
            </div>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-primary/10 border border-primary/25 text-primary">
          {language}
        </span>
      </div>

      {/* Split view — horizontal on lg+, stacked on narrow */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* ─── Code Panel (60% on lg) ─── */}
        <div className="w-full lg:w-[60%] border-b lg:border-b-0 lg:border-r border-white/[0.06] flex flex-col bg-[#0d1117] min-h-0">
          {/* File path header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-white/[0.02] flex-shrink-0">
            <FileCode className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            <span className="text-xs font-mono text-text-muted truncate">{filePath}</span>
            {functionName && (
              <>
                <ChevronRight className="w-3 h-3 text-text-muted/40 flex-shrink-0" />
                <span className="text-xs font-mono text-cyan-400/80 flex-shrink-0 truncate">{functionName}</span>
              </>
            )}
            <div className="flex-1" />
            <button
              onClick={handleCopy}
              title="Copy code"
              aria-label="Copy code"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-text-muted hover:text-white border border-white/[0.06] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.05] transition-all flex-shrink-0"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Code content with line numbers + syntax highlight */}
          <div className="flex-1 overflow-auto">
            <pre className="text-xs leading-relaxed">
              <table className="w-full border-collapse">
                <tbody>
                  {codeLines.map((line, i) => {
                    const lineNum = startLine + i;
                    const isFocused = focusLine && lineNum === focusLine;
                    return (
                      <tr key={i} className={`transition-colors ${isFocused ? 'bg-primary/10' : 'hover:bg-white/[0.03]'}`}>
                        <td
                          className={`w-14 text-right pr-4 pl-3 py-[1px] font-mono text-[11px] select-none border-r align-top ${
                            isFocused ? 'text-primary/80 border-primary/40' : 'text-text-muted/40 border-white/[0.04]'
                          }`}
                          style={{ userSelect: 'none' }}
                        >
                          {lineNum}
                        </td>
                        <td className="pl-4 pr-4 py-[1px] font-mono text-[12px] text-text-cream/85 whitespace-pre overflow-x-auto">
                          {highlightLine(line, language) || '\u00A0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </pre>
          </div>

          {/* File info footer */}
          <div className="flex-shrink-0 px-4 py-1.5 border-t border-white/[0.04] bg-white/[0.01] text-[10px] text-text-muted/50 font-mono">
            Lines {startLine}–{endLine} · {codeBlock.totalLines || '?'} total · {language}
          </div>
        </div>

        {/* ─── Question + Answer Panel (40% on lg) ─── */}
        <div className="w-full lg:w-[40%] flex flex-col bg-background-dark/40 min-h-0">
          {/* Question */}
          <div className="p-5 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-yellow-600 flex items-center justify-center text-[11px] font-bold text-black">
                Q{questionNum}
              </div>
              <span className="text-[10px] text-primary uppercase tracking-wider font-semibold">Code Review</span>
            </div>
            <p className="text-base text-white leading-relaxed">
              {question?.text || `Walk me through what this code does and how it fits into your project.`}
            </p>
            {question?.probes && (
              <p className="text-[11px] text-text-muted/60 mt-3 italic leading-relaxed">
                💡 Reference specific variables, logic branches, and how this connects to other files.
              </p>
            )}
          </div>

          {/* Answer area */}
          <div className="flex-1 p-5 flex flex-col min-h-0">
            <textarea
              ref={inputRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={onPaste}
              placeholder="Explain what this code does, how you wrote it, and how it connects to the rest of your project..."
              className="flex-1 min-h-[120px] lg:min-h-[160px] resize-none px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-text-muted/40 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/25 transition-all leading-relaxed"
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-[11px] ${canSubmit ? 'text-primary/80' : 'text-text-muted/50'}`}>
                {answer.length} chars · {wordCount} word{wordCount === 1 ? '' : 's'}
                {!canSubmit && ` · type at least ${MIN_CHARS} to continue`}
              </span>
            </div>
          </div>

          {/* Sticky submit footer — solid background so textarea never shows through */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-white/[0.06] bg-card-dark relative z-10">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full py-3.5 rounded-xl font-semibold text-base text-black bg-gradient-to-r from-primary to-yellow-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 ${
                canSubmit ? 'hover:from-yellow-400 hover:to-primary cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              Submit Answer
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-center text-[10px] text-text-muted/50 mt-2 font-mono">
              Ctrl+Enter to submit
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Lightweight syntax highlighter ──────────────────────────────────────────
// Tokenizes a single line. Handles JS/TS/Python/Go: keywords, strings, comments, numbers.
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'new', 'class', 'extends', 'super', 'this',
  'import', 'export', 'from', 'as', 'default', 'async', 'await', 'try', 'catch', 'finally',
  'throw', 'typeof', 'instanceof', 'in', 'of', 'delete', 'void', 'null', 'undefined',
  'true', 'false', 'static', 'public', 'private', 'protected', 'interface', 'type', 'enum',
  // Python
  'def', 'lambda', 'pass', 'elif', 'and', 'or', 'not', 'is', 'None', 'True', 'False',
  'self', 'yield', 'raise', 'with', 'global', 'nonlocal', 'print',
  // Go
  'func', 'package', 'struct', 'interface', 'chan', 'go', 'defer', 'map', 'range', 'nil',
]);

function highlightLine(line, language) {
  if (!line) return '';
  // Line comment (// or #)
  const commentMatch = language === 'python' ? line.match(/^(\s*)(#.*)$/) : line.match(/^(\s*)(\/\/.*)$/);
  if (commentMatch) {
    return (
      <>
        {commentMatch[1]}
        <span className="text-text-muted/50 italic">{commentMatch[2]}</span>
      </>
    );
  }

  const tokens = [];
  // Tokenizer regex: strings, numbers, identifiers, everything else as-is
  const re = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|[A-Za-z_$][A-Za-z0-9_$]*|\s+|[^A-Za-z0-9_$"'`\s]+)/g;
  let match;
  let key = 0;
  while ((match = re.exec(line)) !== null) {
    const tok = match[0];
    if (/^["'`]/.test(tok)) {
      tokens.push(<span key={key++} className="text-emerald-300">{tok}</span>);
    } else if (/^\d/.test(tok)) {
      tokens.push(<span key={key++} className="text-amber-300">{tok}</span>);
    } else if (/^[A-Za-z_$]/.test(tok) && KEYWORDS.has(tok)) {
      tokens.push(<span key={key++} className="text-rose-400">{tok}</span>);
    } else {
      tokens.push(tok);
    }
  }
  return <>{tokens}</>;
}
