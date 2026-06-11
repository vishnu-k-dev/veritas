import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Github, Code2, FolderTree, Loader2, ShieldAlert, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { scoreAnswer } from '../engine/AILiteracyScorer';
import useAntiCheat from '../hooks/useAntiCheat';
import AntiCheatWarning from './AntiCheatWarning';
import CodeScopeQuestion from './CodeScopeQuestion';
import VoiceViva from './VoiceViva';

/**
 * RepoInterviewChat — Chat-based interview UI for GitHub project interviews
 * Features: repo context sidebar, anti-paste detection, typing speed analysis
 */
export default function RepoInterviewChat({ questions, repoSummary, onComplete, candidateName, isPractice = false }) {
    const [currentQ, setCurrentQ] = useState(0);
    const [answer, setAnswer] = useState('');
    const [answers, setAnswers] = useState([]);
    const [chatHistory, setChatHistory] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [pasteCount, setPasteCount] = useState(0);
    const [pasteWarning, setPasteWarning] = useState(false);
    const [typingStats, setTypingStats] = useState({ keystrokes: 0, startTime: null });
    const [showSidebar, setShowSidebar] = useState(() =>
        typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches
    );
    const [codeScopeMetrics, setCodeScopeMetrics] = useState({ keystrokes: 0, pasteCount: 0, startTime: null });

    const chatEndRef = useRef(null);
    const inputRef = useRef(null);
    const completedRef = useRef(false); // Guard against double-fire of onComplete
    const submittingRef = useRef(false); // Guard against rapid double-click on submit

    // Wrap onComplete so it can only fire once for this interview
    const safeComplete = useCallback((qaPairs, meta) => {
        if (completedRef.current) return;
        completedRef.current = true;
        onComplete(qaPairs, meta);
    }, [onComplete]);

    // Anti-cheat system (3-strike rule)
    const handleAntiCheatTerminate = useCallback((data) => {
        const terminatedAnswers = answers.length > 0 ? answers : [{ question: 'N/A', answer: 'Examination terminated due to integrity violation.', pasteCount: 0, keystrokes: 0, wpm: 0, score: { totalScore: 0, classification: 'terminated' } }];
        safeComplete(terminatedAnswers, { terminated: true, violations: data.violations, reason: data.reason });
    }, [answers, onComplete]);

    const antiCheat = useAntiCheat({
        enabled: currentQ < questions.length,
        maxStrikes: 3,
        onTerminate: handleAntiCheatTerminate,
    });

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    // Show first question with delay (guarded against React Strict Mode double-mount)
    const initRef = useRef(false);
    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        const greeting = {
            type: 'bot',
            text: `Hi${candidateName ? ` ${candidateName}` : ''}! I've analysed your evidence — **${repoSummary?.title || 'your repository'}**. Your examination begins now: ${questions.length} questions that only the actual builder can answer. Take your time — specific, detailed answers score highest.`,
        };

        setChatHistory([greeting]);

        const timer = setTimeout(() => {
            if (questions[0]) {
                setChatHistory(prev => [...prev, {
                    type: 'bot',
                    text: questions[0].text,
                    category: questions[0].category,
                    questionIndex: 0,
                }]);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    // Anti-paste detection
    const handlePaste = (e) => {
        const newCount = pasteCount + 1;
        setPasteCount(newCount);
        setPasteWarning(true);
        setTimeout(() => setPasteWarning(false), 4000);

        // Allow paste but track it
        if (newCount >= 3) {
            setChatHistory(prev => [...prev, {
                type: 'system',
                text: '⚠️ Multiple paste events detected. Pasting answers may affect your AI-Literacy score.',
            }]);
        }
    };

    // Typing tracking
    const handleKeyDown = () => {
        setTypingStats(prev => ({
            keystrokes: prev.keystrokes + 1,
            startTime: prev.startTime || Date.now(),
        }));
    };

    const handleSubmitAnswer = () => {
        if (!answer.trim() || currentQ >= questions.length) return;
        if (submittingRef.current) return; // Guard against rapid double-click
        submittingRef.current = true;
        setTimeout(() => { submittingRef.current = false; }, 1300); // Clear after typing delay

        const typingDuration = typingStats.startTime
            ? (Date.now() - typingStats.startTime) / 1000
            : 0;

        // Score this answer for AI-literacy
        const answerScore = scoreAnswer(answer.trim(), questions[currentQ]);

        const answerData = {
            question: questions[currentQ],
            answer: answer.trim(),
            pasteCount,
            typingDuration,
            keystrokes: typingStats.keystrokes,
            wpm: typingStats.keystrokes > 0 && typingDuration > 0
                ? Math.round((answer.trim().split(/\s+/).length / typingDuration) * 60)
                : 0,
            score: answerScore,
        };

        // Add answer to chat with genuineness indicator
        setChatHistory(prev => [...prev, {
            type: 'user',
            text: answer.trim(),
            genuineness: answerScore.classification,
            score: answerScore.totalScore,
        }]);
        setAnswers(prev => [...prev, answerData]);
        setAnswer('');
        setPasteCount(0);
        setTypingStats({ keystrokes: 0, startTime: null });

        const nextQ = currentQ + 1;

        // In practice mode: inject an immediate score feedback message
        if (isPractice) {
            const s = answerData.score?.totalScore || 0;
            const tip = s >= 70
                ? '✅ Strong answer — good specifics and structure.'
                : s >= 50
                ? '⚠️ Decent — try adding a concrete outcome or metric next time.'
                : '❌ Needs more depth — use STAR: Situation, Task, Action, Result.';
            setChatHistory(prev => [...prev, {
                type: 'bot',
                text: `[Practice Feedback] Score: ${s}/100 — ${tip}`,
                isPracticeFeedback: true,
            }]);
        }

        if (nextQ < questions.length) {
            // Show typing indicator then next question
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setChatHistory(prev => [...prev, {
                    type: 'bot',
                    text: questions[nextQ].text,
                    category: questions[nextQ].category,
                    questionIndex: nextQ,
                }]);
                setCurrentQ(nextQ);
            }, 1200);
        } else {
            // All questions answered
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setChatHistory(prev => [...prev, {
                    type: 'bot',
                    text: "Thank you for completing your examination. I'm now analysing your answers to generate your VERITAS Examination Report. This will take a moment...",
                }]);

                setTimeout(() => {
                    safeComplete([...answers, answerData]);
                }, 1500);
            }, 1000);
        }
    };

    const progress = questions.length > 0 ? ((currentQ + (answers.length > currentQ ? 1 : 0)) / questions.length) * 100 : 0;

    // True when the current question is a code review — CodeScopeQuestion replaces the entire chat body
    const isCodeScopeActive = currentQ < questions.length && questions[currentQ]?.type === 'code_scope';

    const handleCodeScopeKey = () => setCodeScopeMetrics(m => ({
        ...m,
        keystrokes: m.keystrokes + 1,
        startTime: m.startTime || Date.now(),
    }));

    const handleCodeScopePaste = () => setCodeScopeMetrics(m => ({ ...m, pasteCount: m.pasteCount + 1 }));

    const handleCodeScopeSubmit = (codeScopeAnswer) => {
        const typingDuration = codeScopeMetrics.startTime
            ? (Date.now() - codeScopeMetrics.startTime) / 1000
            : 0;
        const answerScore = scoreAnswer(codeScopeAnswer, questions[currentQ]);
        const answerData = {
            question: questions[currentQ],
            answer: codeScopeAnswer,
            pasteCount: codeScopeMetrics.pasteCount,
            typingDuration,
            keystrokes: codeScopeMetrics.keystrokes,
            wpm: codeScopeMetrics.keystrokes > 0 && typingDuration > 0
                ? Math.round((codeScopeAnswer.split(/\s+/).length / typingDuration) * 60)
                : 0,
            score: answerScore,
        };
        setChatHistory(prev => [...prev, {
            type: 'user',
            text: codeScopeAnswer,
            genuineness: answerScore.classification,
            score: answerScore.totalScore,
        }]);
        setAnswers(prev => [...prev, answerData]);
        setCodeScopeMetrics({ keystrokes: 0, pasteCount: 0, startTime: null });

        const nextQ = currentQ + 1;
        if (nextQ < questions.length) {
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setChatHistory(prev => [...prev, {
                    type: 'bot',
                    text: questions[nextQ].text,
                    category: questions[nextQ].category,
                    questionIndex: nextQ,
                }]);
                setCurrentQ(nextQ);
            }, 1200);
        } else {
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setChatHistory(prev => [...prev, {
                    type: 'bot',
                    text: "Thank you! Generating your VERITAS Examination Report...",
                }]);
                setTimeout(() => safeComplete([...answers, answerData]), 1500);
            }, 1000);
        }
    };

    return (
        <>
        {/* Anti-Cheat Warning Overlay */}
        <AntiCheatWarning
            showWarning={antiCheat.showWarning}
            currentWarning={antiCheat.currentWarning}
            strikes={antiCheat.strikes}
            maxStrikes={antiCheat.maxStrikes}
            terminated={antiCheat.terminated}
            dismissWarning={antiCheat.dismissWarning}
            onExit={() => safeComplete(answers, { terminated: true, reason: 'Exited after termination.' })}
        />
        {isPractice && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-3">
                <span className="text-xl">🎯</span>
                <div>
                    <p className="text-blue-300 font-semibold text-sm">Practice Mode</p>
                    <p className="text-blue-400/70 text-xs">Your answers won't be saved or counted toward usage. You'll get instant feedback after each response.</p>
                </div>
            </div>
        )}
        <div className="flex h-full gap-4 relative">
            {/* Mobile drawer backdrop */}
            <AnimatePresence>
                {showSidebar && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSidebar(false)}
                        className="lg:hidden fixed inset-0 bg-black/60 z-30"
                    />
                )}
            </AnimatePresence>
            {/* Sidebar — Repo Context (drawer on mobile, static on desktop) */}
            <AnimatePresence>
                {showSidebar && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="bg-card-dark/95 lg:bg-card-dark/50 backdrop-blur-md border border-white/[0.06] rounded-r-2xl lg:rounded-2xl p-5 overflow-y-auto fixed lg:static top-0 left-0 z-40 lg:z-auto h-full w-[min(320px,85vw)] lg:w-[280px] lg:flex-shrink-0"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Github className="w-5 h-5 text-emerald-400" />
                            <h3 className="font-semibold text-white text-sm">Project Context</h3>
                        </div>

                        {repoSummary && (
                            <div className="space-y-4 text-xs">
                                <div>
                                    <div className="text-text-muted mb-1 uppercase tracking-wider font-medium">Project</div>
                                    <div className="text-white font-medium">{repoSummary.title}</div>
                                </div>

                                <div>
                                    <div className="text-text-muted mb-1.5 uppercase tracking-wider font-medium">Tech Stack</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {repoSummary.frameworks.split(', ').filter(f => f !== 'None detected').map(fw => (
                                            <span key={fw} className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                                {fw}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-text-muted mb-1 uppercase tracking-wider font-medium">Languages</div>
                                    <div className="text-white">{repoSummary.languages}</div>
                                </div>

                                <div>
                                    <div className="text-text-muted mb-1 uppercase tracking-wider font-medium">Architecture</div>
                                    <div className="text-white capitalize">{repoSummary.architecture}</div>
                                </div>

                                {repoSummary.layers.length > 0 && (
                                    <div>
                                        <div className="text-text-muted mb-1 uppercase tracking-wider font-medium">Layers</div>
                                        <div className="text-white">{repoSummary.layers.join(', ')}</div>
                                    </div>
                                )}

                                <div className="pt-3 border-t border-white/[0.06]">
                                    <div className="flex items-center gap-2 text-text-muted">
                                        <FolderTree className="w-3.5 h-3.5" />
                                        <span>{repoSummary.totalFiles} files</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-text-muted mt-1">
                                        <Code2 className="w-3.5 h-3.5" />
                                        <span>{repoSummary.commits} commits analyzed</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-card-dark/30 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-4 border-b border-white/[0.06] bg-card-dark/60">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                                <Github className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-white">VERITAS Examination Session</h2>
                                <p className="text-xs text-text-muted">Question {Math.min(currentQ + 1, questions.length)} of {questions.length}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSidebar(!showSidebar)}
                                className={`p-2 rounded-lg transition-colors ${showSidebar ? 'bg-emerald-500/10 text-emerald-400' : 'text-text-muted hover:text-white'}`}
                            >
                                <FolderTree className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>

                {/* CodeScopeQuestion — fills entire body when active (replaces chat + input) */}
                {isCodeScopeActive && (
                    <div className="flex-1 min-h-0">
                        <CodeScopeQuestion
                            key={currentQ}
                            codeBlock={questions[currentQ].codeBlock}
                            questionNum={currentQ + 1}
                            totalQ={questions.length}
                            onKeyDown={handleCodeScopeKey}
                            onPaste={handleCodeScopePaste}
                            onSubmit={handleCodeScopeSubmit}
                        />
                    </div>
                )}

                {/* Chat Messages — hidden during code_scope */}
                {!isCodeScopeActive && <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {chatHistory.map((msg, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.type === 'system' ? (
                                <div className="w-full text-center">
                                    <span className="inline-block px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                                        {msg.text}
                                    </span>
                                </div>
                            ) : (
                                <div className={`max-w-[75%] ${msg.type === 'user' ? 'order-1' : ''}`}>
                                    {msg.category && (
                                        <div className="text-[10px] uppercase tracking-wider text-emerald-500/60 mb-1 px-1 font-medium">
                                            {msg.category.replace(/_/g, ' ')}
                                        </div>
                                    )}
                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.type === 'user'
                                        ? 'bg-emerald-600/20 border border-emerald-500/20 text-white rounded-br-md'
                                        : msg.isPracticeFeedback
                                        ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-bl-md font-medium'
                                        : 'bg-white/[0.04] border border-white/[0.06] text-text-cream rounded-bl-md'
                                        }`}>
                                        {msg.text}
                                    </div>
                                    {/* Genuineness scoring happens internally — no user-facing label */}
                                </div>
                            )}
                        </motion.div>
                    ))}

                    {/* Typing indicator */}
                    {isTyping && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2 text-text-muted text-sm"
                        >
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-xs">VERITAS is thinking...</span>
                        </motion.div>
                    )}

                    <div ref={chatEndRef} />
                </div>}

                {/* Input Area — hidden during code_scope (CodeScopeQuestion has its own submit) */}
                {!isCodeScopeActive && <div className="flex-shrink-0 px-6 py-4 border-t border-white/[0.06] bg-card-dark/60">
                    {/* Paste warning */}
                    <AnimatePresence>
                        {pasteWarning && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs"
                            >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Paste detected — typing your own answers scores higher
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {currentQ < questions.length ? (
                        <div className="flex flex-col gap-2">
                            <VoiceViva onTranscript={(text) => setAnswer(prev => prev ? prev + ' ' + text : text)} />
                            <div className="flex gap-3">
                                <textarea
                                    ref={inputRef}
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    onPaste={handlePaste}
                                    onKeyDown={(e) => {
                                        handleKeyDown();
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmitAnswer();
                                        }
                                    }}
                                    placeholder="Type your answer or use voice... (Shift+Enter for new line)"
                                    rows={2}
                                    className="flex-1 resize-none px-4 py-3 bg-background-dark/60 border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                                />
                                <button
                                    onClick={handleSubmitAnswer}
                                    disabled={!answer.trim()}
                                    className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-cyan-600 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:from-emerald-500 hover:to-cyan-500 transition-all self-end"
                                >
                                    <Send className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing your responses...
                        </div>
                    )}
                </div>}
            </div>
        </div>
        </>
    );
}

