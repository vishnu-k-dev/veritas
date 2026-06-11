import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// v2: Firebase Auth + Landing
import useAuth from './hooks/useAuth.jsx';
import Landing from './pages/Landing';
import AuthForm from './components/AuthForm';
import Onboarding from './components/Onboarding';
import StudentDashboard from './pages/StudentDashboard';
import InstituteDashboard from './pages/InstituteDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import AuthCallback from './pages/AuthCallback';
import Replay from './pages/Replay';
import Audit from './pages/Audit';
import Verify from './pages/Verify';

// Role Selection & Auth
import RoleSelector from './components/RoleSelector';
import RecruiterAuth from './components/RecruiterAuth';
import CodeEntry from './components/CodeEntry';

// Recruiter Components
import RecruiterDashboard from './components/RecruiterDashboard';
import CodeGenerator from './components/CodeGenerator';

// Applicant/Shared Components
import ResumeInput from './components/ResumeInput';
import InterviewChat from './components/InterviewChat';
import RecruiterView from './components/RecruiterView';
import CandidateFeedbackView from './components/CandidateFeedbackView';

// VERITAS 2.0 Components
import GitHubInput from './components/GitHubInput';
import RepoInterviewChat from './components/RepoInterviewChat';
import CompetencyPassport from './components/CompetencyPassport';
import VivaExamination from './pages/VivaExamination';
import ExamFlow from './pages/ExamFlow';
import VerifyReport from './pages/VerifyReport';
import GitHubRepoPicker from './components/GitHubRepoPicker';
import RepoGist from './components/RepoGist';
import QuestionGeneratingSkeleton from './components/QuestionGeneratingSkeleton';
import BackButton from './components/BackButton';

// CodeScope
import { generateRepoGist, pickCodeBlock } from './services/repoIntel';

// Engine imports
import { mapSkillsToRequirements, identifyFocusSkills } from './engine/SkillMapper';
import { generateInterviewQuestions, generateOpeningQuestion, generateClosingQuestion } from './engine/QuestionGenerator';
import { calculateOverallAuthenticity, generateAuthenticityReport } from './engine/AuthenticityScorer';
import { calculateEvaluationMetrics, makeDecision, generateRecruiterReport, generateCandidateFeedback, generateHireSignal, detectRedFlags, buildRecommendationBlock } from './engine/DecisionEngine';
import { scoreCandidateSophistication, analyzeCommitPatterns } from './engine/ProjectIntelligence.js';
import FeedbackForm from './components/FeedbackForm';

// VERITAS 2.0 Engine imports
import { buildQuestionPrompt, generateFallbackQuestions, deduplicateQuestions, parseLLMQuestions, computeRepoComplexity } from './engine/RepoQuestionGenerator';
import { buildPromptContext, buildRepoSummary } from './engine/RepoContextBuilder';
import { calculateAILiteracy } from './engine/AILiteracyScorer';
import { getDemoRepo, getDemoQuestions, DEMO_SCENARIOS } from './engine/DemoEngine';

// API
import { startApplicantScreening, updateScreening, fetchScreening, checkUsageLimits, recordUsageAction, saveInterviewResult, apiRequest } from './services/api';

// Upgrade Modal
import UpgradeModal from './components/UpgradeModal';
import LinkedInGateModal from './components/LinkedInGateModal';

// AI Service
import { isAIAvailable, parseResumeWithAI, generateAIReport, generateRepoQuestions, generateAIResumeQuestions } from './services/aiService';

import './index.css';

// ============================================
// App Phases
// ============================================
const PHASES = {
  LOADING: 'loading',
  // v2: New flow
  LANDING: 'landing',
  ROLE_SELECT: 'role_select',
  AUTH: 'auth',
  ONBOARDING: 'onboarding',
  STUDENT_DASHBOARD: 'student_dashboard',
  INSTITUTE_DASHBOARD: 'institute_dashboard',
  ADMIN_DASHBOARD: 'admin_dashboard',
  // Recruiter phases
  RECRUITER_AUTH: 'recruiter_auth',
  RECRUITER_DASHBOARD: 'recruiter_dashboard',
  RECRUITER_CREATE: 'recruiter_create',
  RECRUITER_VIEW_RESULT: 'recruiter_view_result',
  // Applicant phases (resume-based)
  APPLICANT_CODE: 'applicant_code',
  APPLICANT_RESUME: 'applicant_resume',
  APPLICANT_INTERVIEW: 'applicant_interview',
  APPLICANT_PROCESSING: 'applicant_processing',
  APPLICANT_RESULTS: 'applicant_results',
  // VERITAS 2.0 — GitHub interview phases
  APPLICANT_GITHUB: 'applicant_github',
  APPLICANT_GITHUB_URL: 'applicant_github_url',
  APPLICANT_GITHUB_PICK: 'applicant_github_pick',
  APPLICANT_GITHUB_ANALYZING: 'applicant_github_analyzing',
  APPLICANT_REPO_GIST: 'applicant_repo_gist',
  APPLICANT_REPO_INTERVIEW: 'applicant_repo_interview',
  APPLICANT_REPO_PROCESSING: 'applicant_repo_processing',
  APPLICANT_PASSPORT: 'applicant_passport',
  APPLICANT_FEEDBACK: 'applicant_feedback',
  PRACTICE_INTERVIEW: 'practice_interview',
};

// Maps internal passportData shape → CompetencyPassport `report` prop shape
function toCompetencyReport(p) {
  const al = p.aiLiteracy || {};
  const dims = al.dimensions || {};
  const score = p.trustScore ?? al.overallScore ?? 0;
  const authenticity = al.consistency ?? Math.round(score * 0.9);
  const ownership = al.confidence ?? Math.round(score * 0.85);
  const competency = score;

  const verdict = competency >= 65 ? 'VERIFIED' : competency >= 40 ? 'REVIEW' : 'FLAGGED';

  const skills = dims.avgTechnicalDepth != null ? [
    { name: 'Technical Depth',   score: dims.avgTechnicalDepth,   evidence: [] },
    { name: 'Specificity',       score: dims.avgSpecificity,       evidence: [] },
    { name: 'Decision Clarity',  score: dims.avgDecisionClarity,  evidence: [] },
    { name: 'Problem Awareness', score: dims.avgProblemAwareness, evidence: [] },
  ] : (p.techStack || []).map(t => ({ name: t, score: competency, evidence: [] }));

  return {
    candidateName: p.candidateName || 'Candidate',
    candidateRole: p.projectName,
    date: p.issuedAt || new Date().toISOString(),
    verificationId: p.verificationId || `VRT-${Date.now().toString(36).toUpperCase()}`,
    authenticity,
    ownership,
    competency,
    verdict,
    skills,
    summary: al.summary || '',
  };
}

// ============================================
// App Component
// ============================================
export default function App() {
  // Supabase auth — `role` comes from the JWT (custom_access_token_hook),
  // so routing decisions never wait on a profile fetch.
  const { user, profile, role, loading: authLoading, logout, needsOnboarding, githubAccessToken } = useAuth();

  // Phase management
  const [phase, setPhase] = useState(PHASES.LOADING);
  const [userRole, setUserRole] = useState(null);
  const [recruiter, setRecruiter] = useState(null);

  // Applicant state
  const [applicantData, setApplicantData] = useState(null);
  const [screeningId, setScreeningId] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [skillMapping, setSkillMapping] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [recruiterReport, setRecruiterReport] = useState(null);
  const [candidateFeedback, setCandidateFeedback] = useState(null);
  const [aiResumeData, setAiResumeData] = useState(null);

  // For viewing past results
  const [viewingSubmission, setViewingSubmission] = useState(null);

  // VERITAS 2.0 state
  const [repoContext, setRepoContext] = useState(null);
  const [repoSummary, setRepoSummaryState] = useState(null);
  const [repoQuestions, setRepoQuestions] = useState([]);
  const [passportData, setPassportData] = useState(null);
  const [interviewMode, setInterviewMode] = useState(null);
  const [gistData, setGistData] = useState(null);
  const [codeScopeBlock, setCodeScopeBlock] = useState(null);
  const [gistLoading, setGistLoading] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  // Pre-generation: kick off question gen during repo analysis so the gist
  // reading time (~20-30s) hides the AI latency entirely.
  const preGenRef = useRef(null);
  const [resumeInterviewData, setResumeInterviewData] = useState(null);

  // Feedback gate (shown before SkillPassport)
  const [feedbackInterviewId, setFeedbackInterviewId] = useState(null);

  // Peer percentile (fetched async after interview completes)
  const [passportPercentile, setPassportPercentile] = useState(null);

  // Usage tracking (freemium)
  const [usageData, setUsageData] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Detect /judge-demo — no-login viva walkthrough for hackathon judges
  const isJudgeDemoRoute = window.location.pathname === '/judge-demo';

  // Detect /exam — real no-login examination flow
  const isExamRoute = window.location.pathname === '/exam';

  // Detect /admin route — serves a dedicated admin login page
  const isAdminRoute = window.location.pathname === '/admin';
  // Detect /auth/callback — serves a dedicated OAuth landing page that lets
  // the SDK exchange the ?code= and then bounces back to "/".
  const isAuthCallbackRoute = window.location.pathname === '/auth/callback';

  // Public / standalone routes (no auth phase system)
  const replayMatch = window.location.pathname.match(/^\/assessment\/([^/]+)\/replay$/);
  const auditMatch = window.location.pathname.match(/^\/assessment\/([^/]+)\/audit$/);
  const verifyMatch = window.location.pathname.match(/^\/verify\/([^/]+)$/);

  // LinkedIn gate — for college-linked students
  const [showLinkedInGate, setShowLinkedInGate] = useState(false);
  const [pendingPassportData, setPendingPassportData] = useState(null);

  // ============================================
  // Lifecycle Effects
  // ============================================

  // OAuth callback handler — handles both popup and main-window redirect
  // ONLY intercepts ?code= if our repo OAuth flow set the pending flag
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Check if this is OUR repo OAuth flow (not Firebase GitHub sign-in)
    const isRepoOAuth = sessionStorage.getItem('VERITAS_repo_oauth_pending');
    if (!isRepoOAuth) return; // Let Firebase handle its own ?code= redirect

    // Clear the flag and clean up the URL
    sessionStorage.removeItem('VERITAS_repo_oauth_pending');
    window.history.replaceState({}, document.title, window.location.pathname);

    // Case 1: We are inside a popup — relay code to the opener
    if (window.opener && window.opener !== window) {
      window.opener.postMessage({ type: 'github-oauth-callback', code }, window.location.origin);
      window.close();
      return;
    }

    // Case 2: Main window redirect (popup was blocked or user navigated directly)
    // Exchange the code for a GitHub access token, then jump to repo picker
    const API_BASE = import.meta.env.VITE_API_URL || '';
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/github/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (data.access_token) {
          // Store token so GitHubRepoPicker can use it
          sessionStorage.setItem('VERITAS_github_token', data.access_token);
          setPhase(PHASES.APPLICANT_GITHUB_PICK);
        }
      } catch (err) {
        console.error('GitHub OAuth exchange failed:', err);
      }
    })();
  }, []);

  // Warmup ping — wake Render backend on first load
  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    if (API_BASE) {
      fetch(`${API_BASE}/api/ping`).catch(() => {});
    }
  }, []);

  // Check usage limits when user signs in
  useEffect(() => {
    if (user) {
      checkUsageLimits()
        .then(data => setUsageData(data))
        .catch(() => {/* not critical — proceed without limits */});
    }
  }, [user]);

  // Helper: check usage before starting an interview/test
  const checkCanStartAction = async (actionType) => {
    try {
      const usage = await checkUsageLimits();
      setUsageData(usage);
      const limit = usage[actionType];
      if (limit && limit.exceeded) {
        setShowUpgradeModal(true);
        return false;
      }
      return true;
    } catch {
      return true; // Allow if server unreachable
    }
  };

  // Record usage after completing an interview/test
  const recordAction = async (actionType) => {
    try {
      await recordUsageAction(actionType);
      const updated = await checkUsageLimits();
      setUsageData(updated);
    } catch {/* non-critical */}
  };

  // Save completed interview to Supabase — single source of truth
  // Saves interview to backend and returns { interviewId, verificationId }.
  // interviewId is the UUID needed for the feedback route.
  const saveInterviewToFirestore = async (interviewData) => {
    if (!user) return null;
    const verificationId = interviewData.verificationId || `VERITAS-${Date.now().toString(36).toUpperCase()}`;
    const candidateName = interviewData.candidateName || user?.displayName || 'Candidate';
    try {
      const result = await saveInterviewResult({
        candidateName,
        projectName: interviewData.projectName || 'Interview',
        repoUrl: interviewData.repoUrl || '',
        trustScore: interviewData.trustScore || 0,
        verdict: interviewData.verdict || 'pending',
        techStack: interviewData.techStack || [],
        verificationId,
        type: interviewData.type || 'github',
        breakdown: interviewData.breakdown || [],
        aiLiteracy: interviewData.aiLiteracy || null,
        skillMatchScore: interviewData.skillMatchScore || null,
        authenticityScore: interviewData.authenticityScore || null,
        communicationScore: interviewData.communicationScore || null,
        githubScore: interviewData.githubScore || null,
        skillMapping: interviewData.skillMapping || null,
        recruiterReport: interviewData.recruiterReport || null,
        candidateFeedback: interviewData.candidateFeedback || null,
        qaPairs: interviewData.qaPairs || null,
      });
      // Backend returns { interviewId: UUID, verificationId: 'VERITAS-...' }
      return result || null;
    } catch (err) {
      console.error('Interview save failed:', err.message);
      return null;
    }
  };

  // Firebase auth state drives the phase routing
  useEffect(() => {
    if (authLoading) {
      setPhase(PHASES.LOADING);
      return;
    }

    // Not logged in — /admin stays as LOADING (AdminLogin rendered separately)
    if (!user) {
      if (!isAdminRoute && phase !== PHASES.AUTH && phase !== PHASES.ROLE_SELECT) {
        setPhase(PHASES.LANDING);
      }
      return;
    }

    // Logged in but no profile yet
    if (needsOnboarding) {
      if (phase !== PHASES.ONBOARDING) {
        setPhase(PHASES.ONBOARDING);
      }
      return;
    }

    // Fully authenticated + onboarded — route on initial load or after auth.
    // `role` comes from the JWT (custom_access_token_hook), so this fires the
    // moment the session is hydrated, with no profile-fetch round-trip.
    const isInitialPhase = [PHASES.LOADING, PHASES.LANDING, PHASES.AUTH, PHASES.ONBOARDING].includes(phase);
    if (isInitialPhase) {
      // ── GitHub OAuth redirect return ──────────────────────────────────────
      // When the popup was blocked, the main tab did the GitHub OAuth redirect.
      // After returning and re-establishing auth, jump straight back to the
      // GitHub repo picker so the user doesn't have to navigate again.
      const githubOAuthReturn = localStorage.getItem('VERITAS_github_oauth_return');
      if (githubOAuthReturn) {
        localStorage.removeItem('VERITAS_github_oauth_return');
        setPhase(PHASES.APPLICANT_GITHUB);
        return;
      }

      if (role === 'admin') {
        setPhase(PHASES.ADMIN_DASHBOARD);
      } else if (role === 'recruiter') {
        setUserRole('recruiter');
        setPhase(PHASES.RECRUITER_DASHBOARD);
      } else if (role === 'student') {
        setUserRole('student');
        setPhase(PHASES.STUDENT_DASHBOARD);
      } else if (role === 'institute') {
        setUserRole('institute');
        setPhase(PHASES.INSTITUTE_DASHBOARD);
      } else {
        setPhase(PHASES.ROLE_SELECT);
      }
    }
  }, [authLoading, user, role, needsOnboarding]);

  // ============================================
  // Navigation Handlers
  // ============================================

  // Role selection — now requires auth
  const handleSelectRole = (role) => {
    setUserRole(role);
    if (!user) {
      setPhase(PHASES.AUTH);
      return;
    }
    if (needsOnboarding) {
      setPhase(PHASES.ONBOARDING);
      return;
    }
    routeToRoleFlow(role);
  };

  const routeToRoleFlow = (role) => {
    if (role === 'recruiter') {
      setPhase(PHASES.RECRUITER_DASHBOARD);
    } else if (role === 'institute') {
      setPhase(PHASES.INSTITUTE_DASHBOARD);
    } else if (role === 'github' || role === 'student') {
      setUserRole('student');
      setPhase(PHASES.STUDENT_DASHBOARD);
    } else {
      setInterviewMode('resume');
      setPhase(PHASES.APPLICANT_CODE);
    }
  };

  // Auth success — route immediately if role is already in the JWT
  const handleAuthSuccess = (selectedRole) => {
    const r = role || selectedRole || userRole;
    if (r) routeToRoleFlow(r);
    // Otherwise the routing useEffect handles it once role hydrates
  };

  // Onboarding complete — saveProfile already refreshed the JWT, so `role` is
  // now populated. Route directly.
  const handleOnboardingComplete = () => {
    routeToRoleFlow(userRole || role);
  };

  // Recruiter auth success (legacy — kept for CodeEntry flow)
  const handleRecruiterAuth = (recruiterData) => {
    setRecruiter(recruiterData);
    setPhase(PHASES.RECRUITER_DASHBOARD);
  };

  // Recruiter logout — Firebase sign out
  const handleRecruiterLogout = async () => {
    setRecruiter(null);
    setUserRole(null);
    await logout();
    setPhase(PHASES.LANDING);
  };

  // Recruiter views a submission
  const handleViewSubmission = async (submission) => {
    try {
      const fullData = await fetchScreening(submission.id);
      setViewingSubmission(fullData);
      setRecruiterReport(fullData.recruiter_report);
      setCandidateFeedback(fullData.candidate_feedback);
      setPhase(PHASES.RECRUITER_VIEW_RESULT);
    } catch (error) {
      console.error('Failed to load submission:', error);
    }
  };

  // ============================================
  // Applicant Handlers (Resume Flow)
  // ============================================

  const handleCodeValidated = (data) => {
    setApplicantData(data);
    setCandidateName(data.name);
    setPhase(PHASES.APPLICANT_RESUME);
  };

  const handleResumeSubmit = async (resume, extractedName) => {
    setResumeText(resume);
    setCandidateName(extractedName || applicantData.name);

    const jobDescription = {
      title: applicantData.screening.roleTitle,
      experienceLevel: applicantData.screening.experienceLevel,
      requiredSkills: applicantData.screening.requiredSkills || [],
      preferredSkills: applicantData.screening.preferredSkills || [],
      description: applicantData.screening.jobDescription || '',
    };

    try {
      const result = await startApplicantScreening(
        applicantData.code,
        applicantData.email,
        extractedName || applicantData.name,
        resume
      );
      setScreeningId(result.screeningId);
    } catch (error) {
      console.error('Failed to start screening:', error);
    }

    const mapping = mapSkillsToRequirements(resume, jobDescription);
    setSkillMapping(mapping);

    if (isAIAvailable()) {
      parseResumeWithAI(resume, jobDescription).then(aiResult => {
        if (aiResult?.success) {
          setAiResumeData(aiResult.data);
        }
      }).catch(err => console.log('AI parsing skipped:', err.message));
    }

    const focusSkills = identifyFocusSkills(mapping);

    // Try AI-personalized questions first (so every student gets different questions
    // based on their actual resume). Fall back to deterministic templates if AI fails.
    let finalQuestions;
    if (isAIAvailable()) {
      const aiQuestions = await generateAIResumeQuestions(resume, jobDescription).catch(() => null);
      if (aiQuestions && aiQuestions.length >= 3) {
        // Wrap AI questions in the same shape InterviewChat expects
        finalQuestions = aiQuestions.map(q => ({
          text: q.text,
          skill: q.skill || 'general',
          type: q.type || 'technical',
          difficulty: q.difficulty || 'medium',
        }));
      }
    }

    if (!finalQuestions) {
      // Fallback: deterministic template questions
      const opening = generateOpeningQuestion(jobDescription);
      const mainQuestions = generateInterviewQuestions(mapping, focusSkills, 2, resume);
      const closing = generateClosingQuestion();
      finalQuestions = [opening, ...mainQuestions, closing];
    }

    setQuestions(finalQuestions);
    setPhase(PHASES.APPLICANT_INTERVIEW);
  };

  const handleInterviewComplete = async (qaPairs) => {
    setPhase(PHASES.APPLICANT_PROCESSING);
    await new Promise(resolve => setTimeout(resolve, 300)); // just enough to register the phase change

    const jobDescription = {
      title: applicantData.screening.roleTitle,
      experienceLevel: applicantData.screening.experienceLevel,
      requiredSkills: applicantData.screening.requiredSkills || [],
    };

    const overallAuth = calculateOverallAuthenticity(qaPairs);
    const authReport = generateAuthenticityReport(overallAuth, qaPairs);
    const metrics = calculateEvaluationMetrics(skillMapping, authReport, qaPairs);
    const decision = makeDecision(metrics, skillMapping, authReport, [], qaPairs);
    const recReport = generateRecruiterReport(decision, skillMapping, authReport, jobDescription);
    const candFeedback = generateCandidateFeedback(decision, skillMapping, jobDescription);

    recReport.candidateName = candidateName;
    recReport.jobTitle = jobDescription.title;
    candFeedback.candidateName = candidateName;
    candFeedback.jobTitle = jobDescription.title;

    if (isAIAvailable()) {
      try {
        const aiReport = await generateAIReport(
          { questions, answers: qaPairs.map(qa => qa.answer) },
          aiResumeData,
          jobDescription
        );
        if (aiReport?.success) {
          recReport.aiInsights = aiReport.data;
          candFeedback.aiInsights = aiReport.data;
        }
      } catch (err) {
        console.log('AI report skipped:', err.message);
      }
    }

    if (applicantData?.screening?.includeGitHub) {
      setResumeInterviewData({ decision, metrics, authReport, recReport, candFeedback, qaPairs });
      setPhase(PHASES.APPLICANT_GITHUB_PICK);
    } else {
      setRecruiterReport(recReport);
      setCandidateFeedback(candFeedback);

      if (screeningId) {
        try {
          const verdictMap = { 'PASS': 'pass', 'HOLD': 'hold', 'REJECT': 'fail' };
          const verdict = verdictMap[decision.decision] || 'pending';
          await updateScreening(screeningId, {
            candidateName,
            trustScore: decision.overallScore || 0,
            skillMatchScore: skillMapping?.skillMatchScore || 0,
            authenticityScore: authReport?.summary?.score || authReport?.score || 0,
            communicationScore: metrics?.communication || 0,
            verdict,
            verdictSummary: decision.reasons?.join('. ') || '',
            skillMapping,
            authenticityReport: authReport,
            qaPairs,
            recruiterReport: recReport,
            candidateFeedback: candFeedback,
          });
        } catch (error) {
          console.error('Failed to save results:', error);
        }
      }

      // Save to backend first so we get the real interview UUID for feedback.
      const savedResume = await saveInterviewToFirestore({
        projectName: applicantData?.screening?.roleTitle || 'Screening Interview',
        trustScore: decision.overallScore || 0,
        verdict: decision.decision?.toLowerCase() || 'pending',
        techStack: skillMapping?.matchedSkills?.map(s => s.skill) || [],
        type: 'resume',
        skillMatchScore: skillMapping?.skillMatchScore || 0,
        authenticityScore: authReport?.summary?.score || 0,
        communicationScore: metrics?.communication || 0,
        skillMapping,
        recruiterReport: recReport,
        candidateFeedback: candFeedback,
        qaPairs,
      });

      // Show feedback form — use the UUID returned by the backend
      setFeedbackInterviewId(savedResume?.interviewId || null);
      setPhase(PHASES.APPLICANT_FEEDBACK);
    }

    // Record usage after interview completion
    await recordAction('interview');
  };

  // ============================================
  // VERITAS 2.0: GitHub Interview Handlers
  // ============================================

  const handleRepoAnalysisComplete = async (analysisResult) => {
    const { repoContext: ctx } = analysisResult;
    setRepoContext(ctx);

    const summary = buildRepoSummary(ctx);
    setRepoSummaryState(summary);

    // Generate gist (sync — uses context data)
    setGistLoading(true);
    const gist = generateRepoGist(ctx);
    setGistData(gist);

    // AWAIT code block pick — must complete before user can start interview
    try {
      const block = await pickCodeBlock(ctx);
      if (block) setCodeScopeBlock(block);
    } catch (err) {
      console.warn('CodeScope block pick skipped:', err.message);
    }

    setGistLoading(false);
    setPhase(PHASES.APPLICANT_REPO_GIST);
  };

  // Called when user confirms the gist and starts the interview
  const handleGistConfirm = async () => {
    const ctx = repoContext;
    const complexity = computeRepoComplexity(ctx);

    // v3: Compute sophistication for logging/downstream use
    const commitIntel     = analyzeCommitPatterns(ctx);
    const sophistication  = scoreCandidateSophistication(ctx, commitIntel);
    console.log(`Repo complexity: ${complexity.label} (${complexity.score}/100) → ${complexity.questionCount} questions | Sophistication: ${sophistication.level} (${sophistication.sophisticationScore})`);

    let generatedQuestions = [];

    // ── Consume pre-generated questions ───────────────────────────────────
    // If pre-generation (kicked off during repo analysis) is already done →
    // this resolves instantly. If it's still running → skeleton shows briefly.
    // Either way: no duplicate Anthropic call.
    if (preGenRef.current) {
      try {
        setIsGeneratingQuestions(true);
        const result = await preGenRef.current;
        preGenRef.current = null;
        if (result?.success && result.data.length > 0) {
          generatedQuestions = result.data;
          console.log(`Pre-generated questions consumed (${generatedQuestions.length} questions, 0 extra API call)`);
        }
      } catch (err) {
        console.log('Pre-gen promise failed, will use fallback:', err.message);
      }
    } else if (isAIAvailable()) {
      // Fallback: generate fresh (pre-gen wasn't available)
      try {
        setIsGeneratingQuestions(true);
        const promptContext = buildPromptContext(ctx);
        const prompt = buildQuestionPrompt(promptContext, ctx);
        const result = await generateRepoQuestions(prompt);
        if (result?.success && result.data.length > 0) {
          generatedQuestions = result.data;
        }
      } catch (err) {
        console.log('AI question generation failed, using fallback:', err.message);
      }
    }

    if (generatedQuestions.length === 0) {
      generatedQuestions = generateFallbackQuestions(ctx);
    }

    // Deduplicate — deduplicateQuestions preserves pressure Q as last
    const deduped = deduplicateQuestions(generatedQuestions, ctx);

    // Separate pressure question before slicing
    const pressureQs  = deduped.filter(q => q.isPressureQuestion);
    const regularQs   = deduped.filter(q => !q.isPressureQuestion);

    // Limit to complexity-appropriate count (pressure Q does not count toward limit)
    let finalQuestions = regularQs.slice(0, complexity.questionCount);

    // Inject CodeScope question at Q3 (index 2) if we have a code block
    if (codeScopeBlock?.question && finalQuestions.length >= 3) {
      const csQ = {
        ...codeScopeBlock.question,
        type: 'code_scope',
        codeBlock: codeScopeBlock,
      };
      finalQuestions = [
        ...finalQuestions.slice(0, 2),
        csQ,
        ...finalQuestions.slice(2),
      ];
    }

    // Pressure question always last
    finalQuestions = [...finalQuestions, ...pressureQs];

    setRepoQuestions(finalQuestions);
    setIsGeneratingQuestions(false);
    setPhase(PHASES.APPLICANT_REPO_INTERVIEW);
  };

  const handleRepoInterviewComplete = async (qaPairs) => {
    setPhase(PHASES.APPLICANT_REPO_PROCESSING);
    await new Promise(resolve => setTimeout(resolve, 2500));

    const aiLiteracy = calculateAILiteracy(qaPairs);
    const githubScore = aiLiteracy.overallScore;

    if (resumeInterviewData) {
      const resumeScore = resumeInterviewData.decision.overallScore || 0;
      const combinedScore = Math.round(resumeScore * 0.4 + githubScore * 0.6);

      let combinedVerdict;
      if (combinedScore >= 65) combinedVerdict = 'pass';
      else if (combinedScore >= 45) combinedVerdict = 'hold';
      else combinedVerdict = 'fail';

      const mergedReport = {
        ...resumeInterviewData.recReport,
        githubScore,
        githubClassification: aiLiteracy.classification,
        githubSummary: aiLiteracy.summary,
        combinedScore,
        combinedVerdict,
        scoringWeights: { resume: 0.4, github: 0.6 },
      };

      const mergedFeedback = {
        ...resumeInterviewData.candFeedback,
        githubScore,
        githubClassification: aiLiteracy.classification,
        combinedScore,
      };

      setRecruiterReport(mergedReport);
      setCandidateFeedback(mergedFeedback);

      if (screeningId) {
        try {
          await updateScreening(screeningId, {
            candidateName,
            trustScore: combinedScore,
            skillMatchScore: skillMapping?.skillMatchScore || 0,
            authenticityScore: resumeInterviewData.authReport?.summary?.score || 0,
            communicationScore: resumeInterviewData.metrics?.communication || 0,
            githubScore,
            repoUrl: repoContext?.repoUrl || '',
            githubReport: { aiLiteracy, breakdown: aiLiteracy.breakdown },
            verdict: combinedVerdict,
            verdictSummary: `Combined: ${combinedScore}/100 (Resume: ${resumeScore}, GitHub: ${githubScore})`,
            skillMapping,
            authenticityReport: resumeInterviewData.authReport,
            qaPairs: [...(resumeInterviewData.qaPairs || []), ...qaPairs],
            recruiterReport: mergedReport,
            candidateFeedback: mergedFeedback,
          });
        } catch (error) {
          console.error('Failed to save combined results:', error);
        }
      }

      setPhase(PHASES.APPLICANT_RESULTS);

      // Save combined result to Firestore + Supabase
      await saveInterviewToFirestore({
        projectName: repoContext?.projectName || applicantData?.screening?.roleTitle || 'Combined Interview',
        repoUrl: repoContext?.repoUrl || '',
        trustScore: combinedScore,
        verdict: combinedVerdict,
        techStack: repoContext?.techStack?.frameworks?.map(f => f.name) || [],
        type: 'combined',
        githubScore,
        skillMatchScore: skillMapping?.skillMatchScore || 0,
        authenticityScore: resumeInterviewData?.authReport?.summary?.score || 0,
        communicationScore: resumeInterviewData?.metrics?.communication || 0,
        aiLiteracy,
        breakdown: aiLiteracy.breakdown,
        skillMapping,
        recruiterReport: mergedReport,
        candidateFeedback: mergedFeedback,
        qaPairs: [...(resumeInterviewData?.qaPairs || []), ...qaPairs],
      });
    } else {
      // Standalone GitHub flow
      const passport = {
        candidateName: candidateName || user?.displayName || 'Candidate',
        projectName: repoContext?.projectName || 'Unknown Project',
        repoUrl: repoContext?.repoUrl || '',
        aiLiteracy,
        trustScore: aiLiteracy.overallScore,
        techStack: repoContext?.techStack?.frameworks?.map(f => f.name) || [],
        verificationId: `VERITAS-${Date.now().toString(36).toUpperCase()}`,
        issuedAt: new Date().toISOString(),
        breakdown: aiLiteracy.breakdown,
      };

      setPassportData(passport);
      setPassportPercentile(null); // reset from prior interview

      // Fetch peer percentile async — never block the flow
      apiRequest('/api/interview/percentile', {
        method: 'POST',
        body: JSON.stringify({
          trustScore: aiLiteracy.overallScore,
          month: new Date().toISOString().slice(0, 7),
        }),
      }).then(d => setPassportPercentile(d?.percentile ?? null)).catch(() => {});

      // Save to backend first so we get the real interview UUID for the
      // feedback route. feedbackInterviewId must be interviews.id (UUID),
      // not the human-readable verificationId string.
      const saved = await saveInterviewToFirestore({
        candidateName: passport.candidateName,
        projectName: repoContext?.projectName || 'GitHub Project',
        repoUrl: repoContext?.repoUrl || '',
        trustScore: aiLiteracy.overallScore,
        verdict: aiLiteracy.overallScore >= 65 ? 'pass' : aiLiteracy.overallScore >= 45 ? 'hold' : 'fail',
        techStack: repoContext?.techStack?.frameworks?.map(f => f.name) || [],
        verificationId: passport.verificationId,
        issuedAt: passport.issuedAt,
        breakdown: passport.breakdown,
        aiLiteracy: passport.aiLiteracy,
        githubScore: aiLiteracy.overallScore,
        type: 'github',
        qaPairs,
      });

      // Show feedback form — use the UUID returned by the backend
      setFeedbackInterviewId(saved?.interviewId || null);
      setPhase(PHASES.APPLICANT_FEEDBACK);
    }

    // Record usage after repo interview completion
    await recordAction('interview');
  };

  const handleRepoSelected = async (repoData) => {
    setPhase(PHASES.APPLICANT_GITHUB_ANALYZING);

    const repoUrl = repoData.html_url;

    try {
      const { analyzeRepository } = await import('./services/githubService');
      const { parseRepository } = await import('./engine/RepoParser');
      const { buildRepoContext: brc, buildRepoSummary: brs } = await import('./engine/RepoContextBuilder');

      const rawData = await analyzeRepository(repoUrl, repoData.githubToken);
      const parsed = parseRepository(rawData);
      const ctx = brc(parsed);
      ctx.repoUrl = repoUrl;
      ctx.defaultBranch = repoData.default_branch || 'main';
      setRepoContext(ctx);

      const summary = brs(ctx);
      setRepoSummaryState(summary);

      // Generate gist (sync)
      setGistLoading(true);
      const gist = generateRepoGist(ctx);
      setGistData(gist);

      // ── Pre-generate questions in background ──────────────────────────────
      // The student will spend 15–30s reading the gist before clicking Start.
      // We use that dead time to run AI question generation so the wait is 0
      // when they actually click. preGenRef stores the promise; handleGistConfirm
      // awaits it (instant if done, brief skeleton if still running).
      if (isAIAvailable()) {
        const promptCtx = buildPromptContext(ctx);
        const qPrompt   = buildQuestionPrompt(promptCtx, ctx);
        preGenRef.current = generateRepoQuestions(qPrompt).catch(() => null);
      } else {
        preGenRef.current = null;
      }

      // AWAIT code block pick — must complete before user can click Start Interview
      try {
        const block = await pickCodeBlock(ctx);
        if (block) setCodeScopeBlock(block);
      } catch (err) {
        console.warn('CodeScope block pick skipped:', err.message);
      }

      setGistLoading(false);
      setPhase(PHASES.APPLICANT_REPO_GIST);
    } catch (error) {
      console.error('Repo analysis failed:', error);
      alert(`Failed to analyze repository: ${error.message}. Please try again.`);
      setPhase(PHASES.APPLICANT_GITHUB);
    }
  };

  // ============================================
  // Reset / Navigation
  // ============================================

  const handleReset = () => {
    setApplicantData(null);
    setScreeningId(null);
    setResumeText('');
    setCandidateName('');
    setSkillMapping(null);
    setQuestions([]);
    setRecruiterReport(null);
    setCandidateFeedback(null);
    setViewingSubmission(null);
    setRepoContext(null);
    setRepoSummaryState(null);
    setRepoQuestions([]);
    setPassportData(null);
    setPassportPercentile(null);
    setInterviewMode(null);
    setGistData(null);
    setCodeScopeBlock(null);
    setGistLoading(false);
    setAiResumeData(null);
    setResumeInterviewData(null);

    if (userRole === 'recruiter') {
      setPhase(PHASES.RECRUITER_DASHBOARD);
    } else if (userRole === 'student') {
      setPhase(PHASES.STUDENT_DASHBOARD);
    } else {
      setPhase(PHASES.ROLE_SELECT);
    }
  };

  const handleBackToRoleSelect = () => {
    setInterviewMode(null);
    // If logged in, go back to role dashboard, not role select
    if (user && role) {
      if (role === 'student') return setPhase(PHASES.STUDENT_DASHBOARD);
      if (role === 'recruiter') return setPhase(PHASES.RECRUITER_DASHBOARD);
      if (role === 'institute') return setPhase(PHASES.INSTITUTE_DASHBOARD);
    }
    setUserRole(null);
    setPhase(PHASES.ROLE_SELECT);
  };

  const handleBackToLanding = () => {
    setUserRole(null);
    setInterviewMode(null);
    setPhase(PHASES.LANDING);
  };

  const handleTryDemo = () => {
    const scenarioId = 'scenario_1_distributed';
    const scenario = DEMO_SCENARIOS[scenarioId];
    const demoRepo = getDemoRepo(scenarioId);
    const demoQuestions = getDemoQuestions(scenarioId);

    setCandidateName('Demo Examinee');
    setRepoContext({ ...demoRepo, repoUrl: 'https://github.com/demo/url-shortener', projectName: demoRepo.projectName || scenario.name });
    setRepoSummaryState({
      title: scenario.name,
      description: scenario.description,
      techStack: demoRepo.techStack?.keyDependencies || [],
    });
    setRepoQuestions(demoQuestions);
    setInterviewMode('demo');
    setPhase(PHASES.APPLICANT_REPO_INTERVIEW);
  };

  // ============================================
  // Render
  // ============================================
  // ── /exam: real no-login examination flow ──
  if (isExamRoute) {
    return <ExamFlow />;
  }

  // ── /verify/:id: public shareable certificate ──
  if (window.location.pathname.startsWith('/verify/')) {
    return <VerifyReport />;
  }

  // ── /judge-demo: no-login viva demo for judges ──
  if (isJudgeDemoRoute) {
    return (
      <VivaExamination
        onViewReport={() => window.location.href = '/'}
        onBack={() => window.location.href = '/'}
      />
    );
  }

  // ── /auth/callback: dedicated OAuth landing, never falls through ──
  if (isAuthCallbackRoute) {
    return <AuthCallback />;
  }

  // ── Assessment Replay ──
  if (replayMatch) {
    return <Replay assessmentId={replayMatch[1]} />;
  }

  // ── Examiner Audit ──
  if (auditMatch) {
    return <Audit assessmentId={auditMatch[1]} />;
  }

  // ── Public Verification Portal ──
  if (verifyMatch) {
    return <Verify verificationId={verifyMatch[1]} />;
  }

  // ── /admin route: completely self-contained, never falls through to role routing ──
  if (isAdminRoute) {
    // Still loading Firebase auth — show spinner
    if (authLoading) {
      return (
        <div className="min-h-screen bg-[#080b14] flex items-center justify-center">
          <div className="size-10 border-4 border-white/10 border-t-primary rounded-full animate-spin" />
        </div>
      );
    }
    // Not signed in → show admin login
    if (!user) return <AdminLogin />;
    // Signed in but not admin → access denied (trust only the JWT role claim)
    if (role !== 'admin') {
      return (
        <div className="min-h-screen bg-[#080b14] flex items-center justify-center p-6 text-center">
          <div>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-red-400">block</span>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-text-muted mb-6 text-sm">{user.email} is not authorised as an admin.</p>
            <a href="/" className="text-primary hover:underline text-sm">← Go to VERITAS</a>
          </div>
        </div>
      );
    }
    // Confirmed admin — render dashboard directly, no phase system involved
    return <AdminDashboard user={user} onBack={() => { window.location.href = '/'; }} onLogout={handleRecruiterLogout} />;
  }

  return (
    <div className="min-h-screen w-full bg-mesh">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {/* Loading */}
          {phase === PHASES.LOADING && (
            <motion.div
              key="loading"
              className="min-h-screen flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center">
                <div className="size-12 mx-auto mb-4 border-4 border-card-dark border-t-primary rounded-full animate-spin" />
                <p className="text-text-muted">Loading...</p>
              </div>
            </motion.div>
          )}

          {/* v2: Landing Page */}
          {phase === PHASES.LANDING && (
            <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Landing onGetStarted={() => setPhase(PHASES.ROLE_SELECT)} onTryDemo={handleTryDemo} />
            </motion.div>
          )}

          {/* Role Selection */}
          {phase === PHASES.ROLE_SELECT && (
            <motion.div key="role" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RoleSelector onSelectRole={handleSelectRole} onBack={handleBackToLanding} />
            </motion.div>
          )}

          {/* v2: Auth Form */}
          {phase === PHASES.AUTH && (
            <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AuthForm
                selectedRole={userRole}
                onBack={() => setPhase(PHASES.ROLE_SELECT)}
                onSuccess={handleAuthSuccess}
              />
            </motion.div>
          )}

          {/* v2: Onboarding Form */}
          {phase === PHASES.ONBOARDING && (
            <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Onboarding
                role={userRole || 'student'}
                onComplete={handleOnboardingComplete}
                onBack={async () => { await logout(); setPhase(PHASES.LANDING); }}
              />
            </motion.div>
          )}

          {/* Student Dashboard */}
          {phase === PHASES.STUDENT_DASHBOARD && (
            <motion.div key="student-dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StudentDashboard
                refreshUsage={() => checkUsageLimits().then(data => setUsageData(data)).catch(() => {})}
                onStartInterview={async () => {
                  const canStart = await checkCanStartAction('interview');
                  if (!canStart) return; // UpgradeModal will show
                  setInterviewMode('github');
                  setPhase(PHASES.APPLICANT_GITHUB);
                }}
                onEnterCode={async () => {
                  const canStart = await checkCanStartAction('interview');
                  if (!canStart) return;
                  setInterviewMode('resume');
                  setPhase(PHASES.APPLICANT_CODE);
                }}
                onLogout={handleRecruiterLogout}
                usageData={usageData}
                onPractice={async () => {
                    const practiceQuestions = [
                      { text: 'Tell me about a project you built recently. What problem did it solve and how did you approach it?', category: 'experience', skill: 'general' },
                      { text: 'Walk me through a technical challenge you faced. What was the issue and how did you debug it?', category: 'depth', skill: 'general' },
                      { text: 'What technology choices did you make and why? What were the trade-offs?', category: 'depth', skill: 'general' },
                      { text: 'If you had to rebuild this from scratch, what would you do differently?', category: 'growth', skill: 'general' },
                    ];
                    setRepoQuestions(practiceQuestions);
                    setRepoSummaryState({ title: 'Practice Interview', description: 'Sharpen your answers before the real thing.' });
                    setCandidateName(user?.displayName || 'Candidate');
                    setPhase(PHASES.PRACTICE_INTERVIEW);
                  }}
                onViewPassport={(firestoreDoc) => {
                  // Map Firestore document to SkillPassport's expected shape
                  const mapped = {
                    candidateName: firestoreDoc.candidateName || user?.displayName || 'Candidate',
                    projectName: firestoreDoc.projectName || 'Project',
                    repoUrl: firestoreDoc.repoUrl || '',
                    trustScore: firestoreDoc.trustScore || 0,
                    techStack: firestoreDoc.techStack || [],
                    verificationId: firestoreDoc.verificationId || firestoreDoc.id || 'N/A',
                    issuedAt: firestoreDoc.issuedAt || (firestoreDoc.completedAt?.toDate?.()?.toISOString()) || new Date().toISOString(),
                    breakdown: firestoreDoc.breakdown || [],
                    aiLiteracy: firestoreDoc.aiLiteracy || null,
                  };
                  setPassportData(mapped);
                  setPhase(PHASES.APPLICANT_PASSPORT);
                }}
              />
            </motion.div>
          )}

          {/* Admin Dashboard */}
          {phase === PHASES.ADMIN_DASHBOARD && (
            <motion.div key="admin-dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AdminDashboard user={user} onBack={handleBackToLanding} onLogout={handleRecruiterLogout} />
            </motion.div>
          )}

          {/* Institute Dashboard */}
          {phase === PHASES.INSTITUTE_DASHBOARD && (
            <motion.div key="institute-dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <InstituteDashboard onBack={handleBackToRoleSelect} onLogout={handleRecruiterLogout} />
            </motion.div>
          )}

          {/* Recruiter Auth (legacy — kept for backward compat) */}
          {phase === PHASES.RECRUITER_AUTH && (
            <motion.div key="recruiter-auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RecruiterAuth onSuccess={handleRecruiterAuth} onBack={handleBackToRoleSelect} />
            </motion.div>
          )}

          {/* Recruiter Dashboard */}
          {phase === PHASES.RECRUITER_DASHBOARD && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="max-w-7xl mx-auto p-8">
                <RecruiterDashboard
                  recruiter={{ name: profile?.name || user?.displayName || 'Recruiter', email: user?.email, company: profile?.company }}
                  onCreateNew={() => setPhase(PHASES.RECRUITER_CREATE)}
                  onLogout={handleRecruiterLogout}
                  onViewSubmission={handleViewSubmission}
                />
              </div>
            </motion.div>
          )}

          {/* Recruiter Create Test */}
          {phase === PHASES.RECRUITER_CREATE && (
            <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="max-w-7xl mx-auto p-8">
                <CodeGenerator
                  onComplete={() => setPhase(PHASES.RECRUITER_DASHBOARD)}
                  onBack={() => setPhase(PHASES.RECRUITER_DASHBOARD)}
                />
              </div>
            </motion.div>
          )}

          {/* Recruiter View Result */}
          {phase === PHASES.RECRUITER_VIEW_RESULT && recruiterReport && (
            <motion.div key="view-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="max-w-7xl mx-auto p-8">
                <RecruiterView
                  report={recruiterReport}
                  candidateName={viewingSubmission?.candidate_name}
                  onViewCandidate={() => setPhase(PHASES.APPLICANT_RESULTS)}
                  onReset={handleReset}
                  isViewOnly={true}
                />
              </div>
            </motion.div>
          )}

          {/* Applicant Code Entry */}
          {phase === PHASES.APPLICANT_CODE && (
            <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CodeEntry onSuccess={handleCodeValidated} onBack={() => user ? setPhase(PHASES.STUDENT_DASHBOARD) : handleBackToRoleSelect()} />
            </motion.div>
          )}

          {/* Applicant Resume */}
          {phase === PHASES.APPLICANT_RESUME && (
            <motion.div key="resume" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="max-w-7xl mx-auto p-8">
                <ResumeInput
                  onSubmit={handleResumeSubmit}
                  onBack={() => setPhase(PHASES.APPLICANT_CODE)}
                  jobDescription={{
                    title: applicantData?.screening?.roleTitle,
                    requiredSkills: applicantData?.screening?.requiredSkills || [],
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* Applicant Interview */}
          {phase === PHASES.APPLICANT_INTERVIEW && (
            <motion.div key="interview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="max-w-7xl mx-auto p-8 h-screen">
                <InterviewChat
                  questions={questions}
                  onComplete={handleInterviewComplete}
                  skillMapping={skillMapping}
                  jobDescription={{ title: applicantData?.screening?.roleTitle }}
                  candidateName={candidateName}
                  aiSuggestedQuestions={aiResumeData?.suggestedQuestions || []}
                />
              </div>
            </motion.div>
          )}

          {/* Applicant Processing */}
          {phase === PHASES.APPLICANT_PROCESSING && (
            <motion.div
              key="processing"
              className="min-h-screen flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center">
                <div className="relative inline-block mb-8">
                  <div className="w-20 h-20 border-4 border-card-dark border-t-primary rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-3xl">psychology</span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Analyzing Your Responses...</h2>
                <p className="text-text-muted">Calculating scores and generating feedback</p>
              </div>
            </motion.div>
          )}

          {/* Applicant Results */}
          {phase === PHASES.APPLICANT_RESULTS && candidateFeedback && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="max-w-7xl mx-auto p-8">
                <CandidateFeedbackView
                  feedback={candidateFeedback}
                  candidateName={candidateName}
                  onBack={handleReset}
                  onReset={handleReset}
                />
              </div>
            </motion.div>
          )}

          {/* ============================================ */}
          {/* VERITAS 2.0: GitHub Interview Phases */}
          {/* ============================================ */}

          {/* GitHub OAuth Repo Picker (standalone) */}
          {phase === PHASES.APPLICANT_GITHUB && (
            <motion.div key="github" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="max-w-7xl mx-auto p-8">
                <BackButton onClick={() => user ? setPhase(PHASES.STUDENT_DASHBOARD) : handleBackToRoleSelect()} label="Back to Dashboard" />
                <GitHubRepoPicker
                  onSelect={handleRepoSelected}
                  onSkip={() => setPhase(PHASES.APPLICANT_GITHUB_URL)}
                  githubToken={githubAccessToken}
                />
              </div>
            </motion.div>
          )}

          {/* GitHub URL Input (fallback) */}
          {phase === PHASES.APPLICANT_GITHUB_URL && (
            <motion.div key="github-url" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <GitHubInput
                onAnalysisComplete={handleRepoAnalysisComplete}
                onBack={() => setPhase(PHASES.APPLICANT_GITHUB)}
                candidateName={candidateName}
              />
            </motion.div>
          )}

          {/* GitHub Repo Picker (combined flow — after resume) */}
          {phase === PHASES.APPLICANT_GITHUB_PICK && (
            <motion.div key="github-pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="max-w-7xl mx-auto p-8">
                <div className="text-center mb-8">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
                    Round 2 of 2 — Project Examination
                  </span>
                  <h2 className="text-2xl font-bold text-white">Great job on the first examination!</h2>
                  <p className="text-text-muted mt-2">Now let's examine your project. Sign in with GitHub and pick a project you've built.</p>
                </div>
                <GitHubRepoPicker
                  onSelect={handleRepoSelected}
                  onSkip={() => {
                    if (resumeInterviewData) {
                      setRecruiterReport(resumeInterviewData.recReport);
                      setCandidateFeedback(resumeInterviewData.candFeedback);
                    }
                    setPhase(PHASES.APPLICANT_RESULTS);
                  }}
                  githubToken={githubAccessToken}
                />
              </div>
            </motion.div>
          )}

          {/* GitHub Analyzing */}
          {phase === PHASES.APPLICANT_GITHUB_ANALYZING && (
            <motion.div
              key="github-analyzing"
              className="min-h-screen flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center">
                <div className="relative inline-block mb-8">
                  <div className="w-20 h-20 border-4 border-card-dark border-t-emerald-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-400 text-3xl">code</span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Analyzing Your Repository...</h2>
                <p className="text-text-muted">Scanning files, commits, and dependencies</p>
              </div>
            </motion.div>
          )}

          {/* Repo Gist — Pre-interview summary */}
          {phase === PHASES.APPLICANT_REPO_GIST && (
            <motion.div key="repo-gist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="max-w-7xl mx-auto p-8">
                {!isGeneratingQuestions && (
                  <BackButton onClick={() => setPhase(PHASES.APPLICANT_GITHUB)} label="Back to Repo Selection" />
                )}
                {isGeneratingQuestions ? (
                  <QuestionGeneratingSkeleton
                    projectName={gistData?.projectName}
                  />
                ) : (
                  <RepoGist
                    gist={gistData}
                    loading={gistLoading}
                    isGenerating={isGeneratingQuestions}
                    onConfirm={handleGistConfirm}
                  />
                )}
              </div>
            </motion.div>
          )}

          {/* Repo Interview Chat */}
          {(phase === PHASES.APPLICANT_REPO_INTERVIEW || phase === PHASES.PRACTICE_INTERVIEW) && (
            <motion.div key="repo-interview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="max-w-7xl mx-auto p-8 h-screen">
                <RepoInterviewChat
                  questions={repoQuestions}
                  repoSummary={repoSummary}
                  onComplete={phase === PHASES.PRACTICE_INTERVIEW ? () => {
                    // Practice mode: no saves, no usage recorded — just reset to dashboard
                    handleReset();
                  } : handleRepoInterviewComplete}
                  candidateName={candidateName || user?.displayName || 'Candidate'}
                  isPractice={phase === PHASES.PRACTICE_INTERVIEW}
                />
              </div>
            </motion.div>
          )}

          {/* Repo Processing */}
          {phase === PHASES.APPLICANT_REPO_PROCESSING && (
            <motion.div
              key="repo-processing"
              className="min-h-screen flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center">
                <div className="relative inline-block mb-8">
                  <div className="w-20 h-20 border-4 border-card-dark border-t-emerald-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-400 text-3xl">verified</span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Generating Your Skill Passport...</h2>
                <p className="text-text-muted">Analyzing AI-literacy, scoring authenticity, building credentials</p>
              </div>
            </motion.div>
          )}

          {/* Feedback gate — shown before SkillPassport */}
          {phase === PHASES.APPLICANT_FEEDBACK && (
            <FeedbackForm
              interviewId={feedbackInterviewId}
              onComplete={() => {
                if (passportData) {
                  // GitHub/repo interview — check LinkedIn gate then go to passport
                  if (profile?.college_id && !passportData.linkedinPosted) {
                    setPendingPassportData(passportData);
                    setShowLinkedInGate(true);
                  } else {
                    setPhase(PHASES.APPLICANT_PASSPORT);
                  }
                } else {
                  // Resume interview — go straight to results
                  setPhase(PHASES.APPLICANT_RESULTS);
                }
              }}
            />
          )}

          {/* Competency Passport */}
          {phase === PHASES.APPLICANT_PASSPORT && passportData && (
            <motion.div key="passport" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="max-w-7xl mx-auto p-8">
                <BackButton onClick={handleReset} label="Start Over" />
                <CompetencyPassport
                  report={toCompetencyReport(passportData)}
                  onViewReplay={() => {
                    if (passportData.verificationId) {
                      window.location.href = `/assessment/${passportData.verificationId}/replay`;
                    }
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Usage Limit Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        usageData={usageData}
      />

      {/* LinkedIn Gate Modal — college-linked students only */}
      <LinkedInGateModal
        isOpen={showLinkedInGate}
        candidateName={pendingPassportData?.candidateName || user?.displayName || 'Candidate'}
        trustScore={pendingPassportData?.trustScore || 0}
        verdict={pendingPassportData?.verdict || 'hold'}
        verificationId={pendingPassportData?.verificationId || ''}
        onComplete={(linkedinUrl) => {
          setShowLinkedInGate(false);
          setPhase(PHASES.APPLICANT_PASSPORT);
        }}
        onSkip={() => {
          setShowLinkedInGate(false);
          setPhase(PHASES.APPLICANT_PASSPORT);
        }}
      />
    </div>
  );
}

