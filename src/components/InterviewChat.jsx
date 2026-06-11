import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { analyzeNeedForFollowUp, generateFollowUpQuestion, getMaxFollowUps, resetTemplateTracking } from '../engine/FollowUpEngine';
import { scoreAnswerAuthenticity } from '../engine/AuthenticityScorer';
import ProjectConfirmPopup from './ProjectConfirmPopup';
import useAntiCheat from '../hooks/useAntiCheat';
import AntiCheatWarning from './AntiCheatWarning';

/**
 * Interview Chat Component
 * AI-powered interview chat interface with VERITAS styling
 */
export default function InterviewChat({
  questions,
  onComplete,
  skillMapping,
  jobDescription,
  timePerAnswer = 180,
  aiSuggestedQuestions = [],
  projectSummary = null,
  onProjectDescriptionConfirmed = null
}) {
  const [messages, setMessages] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(timePerAnswer);
  const [trustScore, setTrustScore] = useState(92);
  const [qaPairs, setQaPairs] = useState([]);
  const [followUpCount, setFollowUpCount] = useState({});
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [usedAISuggestions, setUsedAISuggestions] = useState(new Set());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pasteWarning, setPasteWarning] = useState(false);
  const [showProjectConfirm, setShowProjectConfirm] = useState(!!projectSummary);
  const [confirmedDescription, setConfirmedDescription] = useState(null);

  // Anti-cheat system (3-strike rule)
  const qaPairsRef = useRef([]); // Always-current ref to avoid stale closure in termination handler
  const handleAntiCheatTerminate = useCallback((data) => {
    // Auto-complete interview with cheating flag
    const terminatedPairs = qaPairsRef.current.length > 0
      ? qaPairsRef.current
      : [{ question: 'N/A', answer: 'Interview terminated due to malpractice.' }];
    onComplete(terminatedPairs, { terminated: true, violations: data.violations, reason: data.reason });
  }, [onComplete]);

  const antiCheat = useAntiCheat({
    enabled: !interviewComplete && !showProjectConfirm,
    maxStrikes: 3,
    onTerminate: handleAntiCheatTerminate,
  });

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const messageIdCounter = useRef(0);
  const isInitialized = useRef(false); // Prevent double initialization
  const isProcessingRef = useRef(false); // Guard against concurrent processAnswer calls

  // Copy/Paste Detection State
  const pasteAnalytics = useRef({
    pasteCount: 0,
    pasteEvents: [],
    totalPastedChars: 0,
    typedChars: 0,
    keystrokeTimings: [],
    lastKeystrokeTime: null,
    suspiciousPatterns: [],
  });

  // Generate unique message ID
  const getUniqueId = () => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  };

  // Initialize with first question - only once (waits for popup confirm when projectSummary is present)
  useEffect(() => {
    if (questions.length > 0 && !isInitialized.current && !showProjectConfirm) {
      isInitialized.current = true;
      resetTemplateTracking(); // Reset follow-up templates for fresh interview session

      // Add date separator immediately
      setMessages([{
        id: getUniqueId(),
        type: 'system',
        text: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(),
      }]);

      // Add intro message after short delay
      setTimeout(() => {
        addAIMessage(
          `Hello! I'm VERITAS AI conducting your ${jobDescription?.title || 'technical'} assessment. Let's begin.`,
          'intro'
        );

        // Add first question quickly
        setTimeout(() => {
          addQuestionMessage(questions[0]);
        }, 600);
      }, 300);
    }
  }, [questions.length, showProjectConfirm]); // Also depend on popup confirm state


  // Timer effect
  useEffect(() => {
    if (interviewComplete || isTyping || showProjectConfirm) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleTimeUp();
          return timePerAnswer;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestionIndex, interviewComplete, isTyping]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const _addSystemMessage = (text) => {
    setMessages(prev => [...prev, {
      id: getUniqueId(),
      type: 'system',
      text,
      timestamp: new Date(),
    }]);
  };

  const addAIMessage = (text, subtype = 'info') => {
    setMessages(prev => [...prev, {
      id: getUniqueId(),
      type: 'ai',
      subtype,
      text,
      timestamp: new Date(),
    }]);
  };

  const addQuestionMessage = (question) => {
    setMessages(prev => [...prev, {
      id: getUniqueId(),
      type: 'ai',
      subtype: 'question',
      text: question.text,
      question,
      timestamp: new Date(),
    }]);
    setTimeRemaining(timePerAnswer);
  };

  const addUserMessage = (text) => {
    setMessages(prev => [...prev, {
      id: getUniqueId(),
      type: 'user',
      text,
      timestamp: new Date(),
    }]);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Reset paste analytics for new question
  const resetPasteAnalytics = () => {
    pasteAnalytics.current = {
      pasteCount: 0,
      pasteEvents: [],
      totalPastedChars: 0,
      typedChars: 0,
      keystrokeTimings: [],
      lastKeystrokeTime: null,
      suspiciousPatterns: [],
    };
    setPasteWarning(false);
  };

  // Handle paste events - detect and log suspicious copy/paste
  const handlePaste = (e) => {
    const pastedText = e.clipboardData?.getData('text') || '';
    const pastedLength = pastedText.length;

    if (pastedLength === 0) return;

    // Record paste event
    const pasteEvent = {
      timestamp: Date.now(),
      length: pastedLength,
      preview: pastedText.slice(0, 50) + (pastedLength > 50 ? '...' : ''),
      isLargePaste: pastedLength > 100,
      hasCodeFormatting: /```|`{3}|function\s*\(|const\s+\w+\s*=/.test(pastedText),
      hasBulletPoints: /^[\s]*[-•*]\s|\n[-•*]\s/m.test(pastedText),
      hasNumberedList: /^\d+\.\s|\n\d+\.\s/m.test(pastedText),
    };

    // Detect ChatGPT/AI-style patterns
    const aiPatterns = [
      /^(Sure|Certainly|Of course|Here'?s|Let me|I would)[\s,!]/i,
      /^(As|In|When) (a|an|the) /i,
      /\b(firstly|secondly|thirdly|furthermore|moreover|additionally)\b/i,
      /^Step \d+:/m,
    ];

    pasteEvent.hasAIPatterns = aiPatterns.some(p => p.test(pastedText));

    // Calculate suspicion level
    let suspicionLevel = 0;
    if (pasteEvent.isLargePaste) suspicionLevel += 30;
    if (pasteEvent.hasCodeFormatting) suspicionLevel += 15;
    if (pasteEvent.hasBulletPoints) suspicionLevel += 10;
    if (pasteEvent.hasNumberedList) suspicionLevel += 10;
    if (pasteEvent.hasAIPatterns) suspicionLevel += 40;

    pasteEvent.suspicionLevel = Math.min(suspicionLevel, 100);

    // Update analytics
    pasteAnalytics.current.pasteCount += 1;
    pasteAnalytics.current.pasteEvents.push(pasteEvent);
    pasteAnalytics.current.totalPastedChars += pastedLength;

    if (pasteEvent.suspicionLevel > 0) {
      pasteAnalytics.current.suspiciousPatterns.push({
        type: pasteEvent.hasAIPatterns ? 'ai_pattern' : 'large_paste',
        level: pasteEvent.suspicionLevel,
      });
    }

    // Show warning if suspicious
    if (pasteEvent.suspicionLevel >= 30) {
      setPasteWarning(true);
      // Auto-dismiss after 3 seconds
      setTimeout(() => setPasteWarning(false), 3000);

      // Penalize trust score
      setTrustScore(prev => Math.max(prev - 5, 0));
    }

    console.log('Paste detected:', pasteEvent);
  };

  // Get paste suspicion summary for qaPair
  const getPasteAnalyticsSummary = () => {
    const analytics = pasteAnalytics.current;
    const totalChars = analytics.typedChars + analytics.totalPastedChars;
    const pasteRatio = totalChars > 0 ? analytics.totalPastedChars / totalChars : 0;

    // Calculate average typing speed (chars per second)
    let avgTypingSpeed = 0;
    if (analytics.keystrokeTimings.length > 3) {
      const avgInterval = analytics.keystrokeTimings.reduce((a, b) => a + b, 0) / analytics.keystrokeTimings.length;
      avgTypingSpeed = avgInterval > 0 ? 1000 / avgInterval : 0;
    }

    // Detect suspicious patterns
    const suspicionScore = Math.min(
      (pasteRatio * 50) +
      (analytics.pasteCount * 10) +
      (analytics.suspiciousPatterns.reduce((sum, p) => sum + p.level, 0) / 3),
      100
    );

    return {
      pasteCount: analytics.pasteCount,
      pasteRatio: Math.round(pasteRatio * 100),
      totalPastedChars: analytics.totalPastedChars,
      typedChars: analytics.typedChars,
      avgTypingSpeed: Math.round(avgTypingSpeed * 10) / 10,
      suspicionScore: Math.round(suspicionScore),
      pasteEvents: analytics.pasteEvents,
      suspiciousPatterns: analytics.suspiciousPatterns,
    };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping || interviewComplete) return;

    const answer = inputValue.trim();
    setInputValue('');
    addUserMessage(answer);
    processAnswer(answer);
  };

  const processAnswer = async (answer) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsTyping(true);

    try {
      const currentQuestion = questions[currentQuestionIndex];

      if (!currentQuestion) {
        console.error('No current question found at index:', currentQuestionIndex);
        return;
      }

      // Score authenticity
      const authScore = scoreAnswerAuthenticity(answer, currentQuestion);

      // Update trust score
      const newTrustScore = Math.round((trustScore * 0.7) + (authScore.score * 0.3));
      setTrustScore(Math.max(0, Math.min(100, newTrustScore)));

      // Store Q&A pair with paste analytics
      const qaPair = {
        question: currentQuestion,
        answer,
        authenticity: authScore,
        timeSpent: timePerAnswer - timeRemaining,
        pasteAnalytics: getPasteAnalyticsSummary(),
      };

      // Reset paste tracking for next question
      resetPasteAnalytics();
      qaPairsRef.current = [...qaPairsRef.current, qaPair];
      setQaPairs(qaPairsRef.current);

      // Brief AI thinking delay (fast response)
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check for follow-up need
      const questionId = currentQuestion.id;
      const currentFollowUps = followUpCount[questionId] || 0;
      const maxFollowUps = getMaxFollowUps(currentQuestion);

      const followUpAnalysis = analyzeNeedForFollowUp(answer, currentQuestion);

      if (followUpAnalysis.needsFollowUp && currentFollowUps < maxFollowUps) {
        // Generate follow-up
        const followUp = generateFollowUpQuestion(followUpAnalysis, currentQuestion, answer);
        setFollowUpCount(prev => ({ ...prev, [questionId]: currentFollowUps + 1 }));

        addAIMessage(followUp.text, 'followup');
        return;
      }

      // Move to next question
      const nextIndex = currentQuestionIndex + 1;

      if (nextIndex >= questions.length) {
        // Interview complete
        addAIMessage(
          "Thank you! Assessment complete. Analyzing your results...",
          'closing'
        );
        setInterviewComplete(true);

        // Pass the updated qaPairs including current answer
        setTimeout(() => {
          onComplete(qaPairsRef.current);
        }, 1000);
      } else {
        // Quick transition to next question
        setCurrentQuestionIndex(nextIndex);
        addQuestionMessage(questions[nextIndex]);
      }
    } catch (error) {
      console.error('Error processing answer:', error);
      // Try to continue to next question on error
      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < questions.length) {
        setCurrentQuestionIndex(nextIndex);
        addQuestionMessage(questions[nextIndex]);
      }
    } finally {
      isProcessingRef.current = false;
      setIsTyping(false);
    }
  };

  const handleTimeUp = () => {
    if (inputValue.trim()) {
      addUserMessage(inputValue.trim());
      processAnswer(inputValue.trim());
      setInputValue('');
    } else {
      addUserMessage('[No response provided]');
      processAnswer('[No response provided]');
    }
  };

  const handleEndInterview = () => {
    setInterviewComplete(true);
    onComplete(qaPairs);
  };

  const totalQuestions = questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  // Handle project confirm popup
  const handleProjectConfirm = (description) => {
    setConfirmedDescription(description);
    setShowProjectConfirm(false);
    if (onProjectDescriptionConfirmed) {
      onProjectDescriptionConfirmed(description);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px] -mx-4 md:-mx-8 lg:-mx-12 -mt-4 md:-mt-8 lg:-mt-12">
      {/* Project Confirm Popup — shown before interview starts */}
      {showProjectConfirm && projectSummary && (
        <ProjectConfirmPopup
          projectSummary={projectSummary}
          onConfirm={handleProjectConfirm}
          onClose={() => setShowProjectConfirm(false)}
        />
      )}

      {/* Anti-Cheat Warning Overlay */}
      <AntiCheatWarning
        showWarning={antiCheat.showWarning}
        currentWarning={antiCheat.currentWarning}
        strikes={antiCheat.strikes}
        maxStrikes={antiCheat.maxStrikes}
        terminated={antiCheat.terminated}
        dismissWarning={antiCheat.dismissWarning}
        onExit={handleEndInterview}
      />

      {/* Header */}
      <header className="flex-shrink-0 min-h-20 px-3 sm:px-6 lg:px-10 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-background-dark/80 backdrop-blur-md z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <span className="text-primary text-sm font-bold tracking-wider uppercase">
              Step {currentQuestionIndex + 1} of {totalQuestions}
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-600" />
            <span className="text-text-muted text-sm">Technical Assessment</span>
          </div>
          <div className="w-64 h-1.5 bg-card-dark rounded-full mt-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-yellow-600 rounded-full"
              style={{ boxShadow: '0 0 10px rgba(234,179,8,0.5)' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 sm:gap-4 md:gap-6">
          {/* Trust Score Widget */}
          <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full glass-panel border-primary/20 shadow-glow-primary">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">verified_user</span>
              <span className="text-xs text-text-muted uppercase tracking-wide">Trust Score</span>
            </div>
            <div className="w-px h-4 bg-gray-700" />
            <span className="text-white font-bold text-lg">{trustScore}%</span>
            <span className={`flex h-2 w-2 rounded-full ${trustScore >= 70 ? 'bg-verified' : trustScore >= 50 ? 'bg-primary' : 'bg-flagged'} animate-pulse`}
              style={{ boxShadow: `0 0 8px ${trustScore >= 70 ? 'rgba(34,197,94,0.6)' : trustScore >= 50 ? 'rgba(234,179,8,0.6)' : 'rgba(239,68,68,0.6)'}` }}
            />
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${timeRemaining <= 30 ? 'bg-flagged/10 border border-flagged/20' : 'bg-white/5 border border-white/10'}`}>
            <span className={`material-symbols-outlined text-[20px] ${timeRemaining <= 30 ? 'text-flagged' : 'text-text-muted'}`}>timer</span>
            <span className={`font-mono font-bold ${timeRemaining <= 30 ? 'text-flagged' : 'text-white'}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>

          {/* Anti-Cheat Status Badge */}
          <div className={`anticheat-badge ${antiCheat.strikes === 0 ? 'safe' : antiCheat.strikes < antiCheat.maxStrikes ? 'warned' : 'danger'}`}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>shield</span>
            {antiCheat.strikes === 0 ? 'Proctored' : `${antiCheat.strikes}/${antiCheat.maxStrikes} Strikes`}
          </div>

          <Button variant="danger" size="sm" onClick={handleEndInterview}>
            End Interview
          </Button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-20 py-4 sm:py-8 space-y-6 scrollbar-thin">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {message.type === 'system' && (
                <div className="flex justify-center">
                  <span className="text-xs font-medium text-gray-600 bg-obsidian-light px-3 py-1 rounded-full border border-white/5">
                    {message.text}
                  </span>
                </div>
              )}

              {message.type === 'ai' && (
                <div className="flex gap-4 max-w-4xl">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-obsidian-light to-black border border-primary/40 flex items-center justify-center shadow-lg relative">
                      <span className="material-symbols-outlined text-primary">smart_toy</span>
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-verified border-2 border-background-dark rounded-full" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-primary">VERITAS AI</span>
                      <span className="text-xs text-gray-500">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="chat-bubble-ai">
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </div>
                    {message.subtype === 'question' && (
                      <div className="flex items-center gap-2 mt-1 ml-1 animate-pulse">
                        <span className="material-symbols-outlined text-primary text-[16px]">hourglass_top</span>
                        <span className="text-xs text-primary font-mono font-medium">
                          {formatTime(timeRemaining)} remaining for this question
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {message.type === 'user' && (
                <div className="flex gap-4 flex-row-reverse max-w-4xl ml-auto">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold text-white border border-gray-600 shadow-lg">
                      You
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-500">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-sm font-bold text-white">You</span>
                    </div>
                    <div className="chat-bubble-user">
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 max-w-4xl"
          >
            <div className="flex-shrink-0 mt-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-obsidian-light to-black border border-primary/40 flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-primary">smart_toy</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-primary">VERITAS AI</span>
              </div>
              <div className="glass-panel px-5 py-4 rounded-2xl rounded-tl-none border border-primary/10 w-fit">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-primary rounded-full typing-dot" />
                  <div className="w-2 h-2 bg-primary rounded-full typing-dot" />
                  <div className="w-2 h-2 bg-primary rounded-full typing-dot" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={chatEndRef} className="h-32" />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 w-full px-3 sm:px-6 lg:px-20 pt-4 bg-gradient-to-t from-background-dark via-background-dark to-transparent z-20" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        <div className="max-w-4xl mx-auto relative">
          {/* AI Suggested Questions Panel */}
          {aiSuggestedQuestions.length > 0 && !interviewComplete && (
            <div className="mb-4">
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="flex items-center gap-2 text-xs text-primary/80 hover:text-primary transition-colors mb-2"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {showSuggestions ? 'expand_less' : 'psychology'}
                </span>
                <span>
                  {showSuggestions ? 'Hide AI Probes' : `AI Probes Available (${aiSuggestedQuestions.filter(q => !usedAISuggestions.has(q)).length})`}
                </span>
              </button>

              <AnimatePresence>
                {showSuggestions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="glass-panel border border-primary/20 rounded-xl p-4 mb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-primary text-[18px]">auto_awesome</span>
                        <span className="text-xs font-semibold text-white/90">AI-Suggested Probing Questions</span>
                        <Badge variant="ai" className="text-[10px] py-0.5">BETA</Badge>
                      </div>
                      <p className="text-[11px] text-gray-400 mb-3">
                        These questions target weak areas identified in the candidate's resume. Click to use as your next response.
                      </p>
                      <div className="space-y-2">
                        {aiSuggestedQuestions
                          .filter(q => !usedAISuggestions.has(q))
                          .slice(0, 3)
                          .map((question, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setInputValue(question);
                                setUsedAISuggestions(prev => new Set([...prev, question]));
                                setShowSuggestions(false);
                                inputRef.current?.focus();
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-lg bg-obsidian-light/50 border border-gray-700/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                            >
                              <div className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-primary/60 text-[16px] mt-0.5 group-hover:text-primary">arrow_forward</span>
                                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{question}</span>
                              </div>
                            </button>
                          ))}
                      </div>
                      {aiSuggestedQuestions.filter(q => !usedAISuggestions.has(q)).length === 0 && (
                        <p className="text-xs text-gray-500 italic">All suggested probes have been used.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Anti-paste warning */}
          <div className="absolute -top-10 left-4 flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20 opacity-80">
            <span className="material-symbols-outlined text-[14px]">content_paste_off</span>
            Anti-paste protection active
          </div>

          {/* Paste Warning Banner */}
          <AnimatePresence>
            {pasteWarning && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute -top-20 left-0 right-0 flex items-center justify-center gap-2 text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/30 backdrop-blur-sm"
              >
                <span className="material-symbols-outlined text-[18px] animate-pulse">warning</span>
                <span className="font-medium">Paste detected</span>
                <span className="text-red-300/80">• Paste events are logged for integrity review</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit}>
            <div className="relative flex items-end gap-2 bg-obsidian-light border border-gray-700 rounded-2xl p-2 shadow-2xl transition-all duration-200 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">

              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  // Track character count (rough typing estimate)
                  const newLength = e.target.value.length;
                  const oldLength = inputValue.length;
                  if (newLength > oldLength && (newLength - oldLength) === 1) {
                    // Single character typed - track timing
                    const now = Date.now();
                    if (pasteAnalytics.current.lastKeystrokeTime) {
                      const timeDiff = now - pasteAnalytics.current.lastKeystrokeTime;
                      pasteAnalytics.current.keystrokeTimings.push(timeDiff);
                    }
                    pasteAnalytics.current.lastKeystrokeTime = now;
                    pasteAnalytics.current.typedChars += 1;
                  }
                  setInputValue(e.target.value);
                }}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Type your answer here..."
                rows={1}
                disabled={isTyping || interviewComplete}
                className="w-full bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 resize-none py-3 max-h-40 min-h-[56px] scrollbar-hide"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  e.target.style.height = '';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
              />

              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping || interviewComplete}
                className="p-3 bg-primary text-black rounded-xl hover:bg-yellow-500 transition-all flex-shrink-0 self-end mb-1 shadow-lg hover:shadow-yellow-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined font-bold">arrow_upward</span>
              </button>
            </div>
          </form>

          <div className="text-center mt-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest">
              Press Enter to send • Shift + Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

