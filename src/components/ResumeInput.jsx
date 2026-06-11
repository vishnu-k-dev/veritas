import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';
import ProgressStepper from './ui/ProgressStepper';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import ScoreCircle from './ui/ScoreCircle';

// Set up PDF.js worker - use a reliable CDN with version matching
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

/**
 * Resume Input Component
 * Resume Analysis & Verification screen
 */
export default function ResumeInput({
  onSubmit,
  onBack,
  jobDescription,
  currentStep: _currentStep = 2,
  steps: _steps = []
}) {
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Mock analysis data
  const [analysisData, setAnalysisData] = useState({
    overallMatch: 0,
    credibility: {
      education: 'pending',
      experience: 'pending',
      identity: 'pending',
    },
    extractedSkills: [],
    flags: [],
  });

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file) => {
    setFileName(file.name);
    setIsAnalyzing(true);

    try {
      let text = '';

      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + '\n';
        }
      } else {
        text = await file.text();
      }

      setResumeText(text);

      // Simulate analysis
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Extract skills from resume text
      const skillKeywords = ['react', 'python', 'javascript', 'node.js', 'sql', 'aws', 'docker', 'kubernetes', 'typescript', 'graphql', 'mongodb', 'postgresql'];
      const foundSkills = skillKeywords.filter(skill =>
        text.toLowerCase().includes(skill.toLowerCase())
      );

      // Calculate match score
      const requiredMatches = jobDescription?.requiredSkills?.filter(skill =>
        text.toLowerCase().includes(skill.toLowerCase())
      ) || [];
      const matchScore = jobDescription?.requiredSkills?.length > 0
        ? Math.round((requiredMatches.length / jobDescription.requiredSkills.length) * 100)
        : 75;

      setAnalysisData({
        overallMatch: Math.min(matchScore + 15, 100),
        credibility: {
          education: 'verified',
          experience: requiredMatches.length > 0 ? 'verified' : 'inconsistencies',
          identity: 'passed',
        },
        extractedSkills: [...new Set([...foundSkills, ...requiredMatches])],
        flags: matchScore < 50 ? [
          { type: 'warning', message: 'Employment Gap Detected', details: 'Between Feb 2018 - Aug 2018 (6 months)' }
        ] : [],
      });

      setAnalysisComplete(true);
    } catch (error) {
      console.error('Error parsing file:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Extract candidate name from resume text
  const extractCandidateName = (text) => {
    const lines = text.split('\n').filter(l => l.trim()).slice(0, 5);
    for (const line of lines) {
      const trimmed = line.trim();
      // Check if it looks like a name (2-4 capitalized words, no special chars)
      if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/.test(trimmed) && trimmed.length < 40) {
        return trimmed;
      }
    }
    // Try to find "Name:" pattern
    const nameMatch = text.match(/name[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
    if (nameMatch) return nameMatch[1];
    return null;
  };

  const handleSubmit = () => {
    if (resumeText) {
      // Pass null if no name extracted - App.jsx will use the name from CodeEntry
      const extractedName = extractCandidateName(resumeText);
      onSubmit(resumeText, extractedName);
    }
  };

  const getCredibilityStatus = (status) => {
    switch (status) {
      case 'verified': return { label: 'Verified via Source', color: 'text-verified' };
      case 'passed': return { label: 'Passed KYC', color: 'text-verified' };
      case 'inconsistencies': return { label: 'Inconsistencies', color: 'text-primary' };
      case 'pending': return { label: 'Pending', color: 'text-text-muted' };
      default: return { label: status, color: 'text-text-muted' };
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-text-muted text-sm mb-2">
              Examinees → {jobDescription?.title || 'Software Engineering'} → <span className="text-white">Evidence Analysis</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Resume Analysis</h2>
            <p className="text-text-muted mt-1">
              AI is analyzing document integrity, verifying claims, and calculating skill fit probability.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onBack}>
              <span className="material-symbols-outlined text-sm mr-1">refresh</span>
              Reprocess
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!analysisComplete}
              icon="arrow_forward"
              iconPosition="right"
            >
              Proceed to Verification
            </Button>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-primary font-bold">STEP 2 OF 5: ANALYSIS</span>
          <div className="flex-1 h-1 bg-card-dark rounded-full overflow-hidden max-w-xs">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-yellow-500"
              initial={{ width: 0 }}
              animate={{ width: analysisComplete ? '40%' : '20%' }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-text-muted">{analysisComplete ? '40%' : '20%'} COMPLETE</span>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Document Preview / Upload */}
        <div className="lg:col-span-7">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-white/50">description</span>
            <span className="text-sm font-medium text-white">Document Preview</span>
          </div>

          {!resumeText ? (
            // Upload Zone
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                glass-panel rounded-2xl p-12 text-center cursor-pointer transition-all duration-300
                border-2 border-dashed
                ${dragActive ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-primary/50'}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleFileInput}
                className="hidden"
              />

              <div className={`
                w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center
                ${dragActive ? 'bg-primary/20' : 'bg-white/5'}
                transition-colors
              `}>
                <span className={`material-symbols-outlined text-4xl ${dragActive ? 'text-primary' : 'text-white/40'}`}>
                  upload_file
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                {dragActive ? 'Drop your resume here' : 'Upload Resume'}
              </h3>
              <p className="text-text-muted mb-4">
                Drag and drop a PDF or text file, or click to browse
              </p>
              <p className="text-xs text-white/30">
                Supported formats: PDF, TXT, DOC, DOCX
              </p>
            </div>
          ) : (
            // Resume Preview
            <Card padding="none" hover={false} className="overflow-hidden">
              {isAnalyzing ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 border-4 border-card-dark border-t-primary rounded-full animate-spin" />
                  <p className="text-white font-medium">Analyzing resume...</p>
                  <p className="text-text-muted text-sm mt-1">{fileName}</p>
                </div>
              ) : (
                <div className="p-6">
                  {/* Actual resume text preview */}
                  <div className="bg-white rounded-lg p-6 text-black max-h-[500px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-gray-500">description</span>
                        <span className="font-medium text-gray-700">{fileName}</span>
                      </div>
                      <Badge variant="verified">
                        <span className="material-symbols-outlined text-[12px]">check</span>
                        Parsed
                      </Badge>
                    </div>

                    {/* Resume text content */}
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                        {resumeText.slice(0, 2000)}{resumeText.length > 2000 ? '...' : ''}
                      </pre>
                    </div>

                    {resumeText.length > 2000 && (
                      <p className="text-xs text-gray-400 mt-4 text-center">
                        Showing first 2000 characters...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right: Analysis Panel */}
        <div className="lg:col-span-5 space-y-6">
          {/* Overall Match */}
          <Card padding="md" hover={false}>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <ScoreCircle
                  score={analysisData.overallMatch || 0}
                  size="lg"
                  variant="auto"
                />
                <p className="text-sm font-bold text-white mt-2">
                  {analysisData.overallMatch >= 70 ? 'STRONG' : analysisData.overallMatch >= 50 ? 'MODERATE' : 'WEAK'}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {analysisComplete ? `Matches highly with ${jobDescription?.title || 'role'} requirements` : 'Upload resume to analyze'}
                </p>
              </div>

              {/* Credibility Checklist */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-white/40 uppercase">Credibility</div>
                {Object.entries(analysisData.credibility).map(([key, status]) => {
                  const { label, color } = getCredibilityStatus(status);
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className={`material-symbols-outlined text-lg ${color}`}>
                        {status === 'verified' || status === 'passed' ? 'check_circle' :
                          status === 'inconsistencies' ? 'warning' : 'pending'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white capitalize">{key}</p>
                        <p className={`text-xs ${color}`}>{label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Skill Extraction */}
          <Card padding="md" hover={false}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white">Skill Extraction</h4>
              <span className="text-xs text-text-muted">{analysisData.extractedSkills.length} Detected</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysisData.extractedSkills.length > 0 ? (
                analysisData.extractedSkills.map((skill) => (
                  <span key={skill} className="skill-chip">
                    {skill}
                    <span className="material-symbols-outlined text-xs text-verified">check</span>
                  </span>
                ))
              ) : (
                <span className="text-sm text-text-muted italic">Upload resume to extract skills</span>
              )}
            </div>
          </Card>

          {/* Analysis Flags */}
          <Card padding="md" hover={false}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-flagged">flag</span>
                Analysis Flags
              </h4>
              {analysisData.flags.length > 0 && (
                <Badge variant="flagged">{analysisData.flags.length} High Priority</Badge>
              )}
            </div>

            {analysisData.flags.length > 0 ? (
              <div className="space-y-3">
                {analysisData.flags.map((flag, index) => (
                  <div key={index} className="bg-flagged/5 border border-flagged/20 rounded-lg p-3">
                    <p className="text-sm font-medium text-flagged">{flag.message}</p>
                    <p className="text-xs text-text-muted mt-1">{flag.details}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                {analysisComplete ? 'No issues detected' : 'Flags will appear here after analysis'}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
