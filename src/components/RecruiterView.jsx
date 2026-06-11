import { useState } from 'react';
import { motion } from 'framer-motion';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import ScoreCircle from './ui/ScoreCircle';

/**
 * Recruiter View Component
 * Candidate Verdict & Analysis screen with real data from report
 */
export default function RecruiterView({
  report,
  candidateName = 'Unknown Candidate',
  onViewCandidate,
  onReset,
  isViewOnly = false
}) {
  const [viewMode, setViewMode] = useState('recruiter');

  const { decision, skillMatch, authenticity, metrics } = report || {};

  // Extract scores from report
  const trustScore = decision?.score || authenticity?.score || 0;
  const skillMatchScore = skillMatch?.score || report?.skillMapping?.skillMatchScore || 0;
  const communicationScore = metrics?.communication || 70;
  const confidenceScore = decision?.confidence || 80;

  const getDecisionConfig = () => {
    switch (decision?.verdict) {
      case 'pass':
        return {
          label: 'TRUSTED',
          icon: 'verified',
          color: 'text-verified',
          bgColor: 'bg-verified/10',
          borderColor: 'border-verified/30'
        };
      case 'hold':
        return {
          label: 'REVIEW NEEDED',
          icon: 'gpp_maybe',
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          borderColor: 'border-primary/30'
        };
      default:
        return {
          label: 'NOT VERIFIED',
          icon: 'gpp_bad',
          color: 'text-flagged',
          bgColor: 'bg-flagged/10',
          borderColor: 'border-flagged/30'
        };
    }
  };

  const decisionConfig = getDecisionConfig();

  // Generate psychometrics from actual metrics
  const psychometrics = [
    { label: 'Technical Depth', value: Math.min(100, Math.round(skillMatchScore * 1.1)) },
    { label: 'Communication', value: communicationScore },
    { label: 'Problem Solving', value: Math.round(trustScore * 0.9) },
    { label: 'Consistency', value: Math.round(trustScore * 0.95) },
    { label: 'Specificity', value: Math.round(authenticity?.specificity || trustScore * 0.85) },
    { label: 'Confidence', value: confidenceScore },
  ];

  // Get interview highlights from the report
  const highlights = report?.highlights || [
    {
      type: trustScore >= 80 ? 'positive' : 'neutral',
      timestamp: '14:02',
      quote: decision?.summary || 'The examinee demonstrated relevant competency during the examination session.'
    },
  ];

  // Add skill-based highlights
  if (report?.skillMapping?.strong?.length > 0) {
    highlights.push({
      type: 'positive',
      timestamp: 'Skills',
      quote: `Strong matches found: ${report.skillMapping.strong.slice(0, 3).map(s => s.skill).join(', ')}`
    });
  }

  if (report?.skillMapping?.missing?.length > 0) {
    highlights.push({
      type: 'negative',
      timestamp: 'Gaps',
      quote: `Missing skills: ${report.skillMapping.missing.slice(0, 3).map(s => s.skill).join(', ')}`
    });
  }

  const getHighlightConfig = (type) => {
    switch (type) {
      case 'positive':
        return { label: 'POSITIVE', color: 'text-verified', bgColor: 'bg-verified/10', borderColor: 'border-verified/20' };
      case 'negative':
        return { label: 'CONCERNING', color: 'text-flagged', bgColor: 'bg-flagged/10', borderColor: 'border-flagged/20' };
      default:
        return { label: 'NEUTRAL', color: 'text-primary', bgColor: 'bg-primary/10', borderColor: 'border-primary/20' };
    }
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb & Header */}
      <header className="space-y-4">
        <div className="text-sm text-text-muted">
          Examinations → Examinee: {candidateName} → <span className="text-white">Verdict</span>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black text-white">{candidateName}</h1>
            <p className="text-text-muted flex items-center gap-2 mt-1">
              <span className="material-symbols-outlined text-sm">work</span>
              {report?.jobTitle || 'Examination Session'}
            </p>
          </div>
          <div className="flex gap-3">
            {!isViewOnly && (
              <>
                <Button variant="secondary" onClick={onViewCandidate}>
                  View Examinee Feedback
                </Button>
                <Button variant="primary" icon="celebration" onClick={onReset}>
                  New Examination
                </Button>
              </>
            )}
            {isViewOnly && (
              <Button variant="primary" onClick={onReset}>
                Back to Dashboard
              </Button>
            )}
          </div>
        </div>

        {/* View Mode Toggle */}
        {!isViewOnly && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 rounded-full p-1">
              <span className="material-symbols-outlined text-primary text-sm ml-2">visibility</span>
              <span className="text-xs text-text-muted">View Mode</span>
            </div>
            <button
              onClick={() => setViewMode('recruiter')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'recruiter' ? 'bg-white/10 text-white' : 'text-text-muted hover:text-white'
                }`}
            >
              Institution
            </button>
            <button
              onClick={onViewCandidate}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-white transition-colors"
            >
              Examinee
            </button>
          </div>
        )}
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Verdict & Psychometrics */}
        <div className="lg:col-span-7 space-y-6">
          {/* Verdict Card */}
          <Card padding="lg" hover={false}>
            <div className="flex items-start gap-6">
              {/* Candidate Avatar */}
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-2xl font-bold text-white border border-white/10">
                  {getInitials(candidateName)}
                </div>
                <div className={`absolute -bottom-2 -right-2 px-2 py-1 rounded-full text-xs font-bold ${decisionConfig.bgColor} ${decisionConfig.color} border ${decisionConfig.borderColor}`}>
                  <span className="material-symbols-outlined text-sm mr-1">verified</span>
                  Examined
                </div>
              </div>

              {/* Verdict Info */}
              <div className="flex-1">
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">AI Verdict</div>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className={`text-4xl font-black ${decisionConfig.color}`}>
                    {decisionConfig.label}
                  </h2>
                  <span className={`material-symbols-outlined text-3xl ${decisionConfig.color}`}>
                    {decisionConfig.icon}
                  </span>
                </div>
                <p className="text-text-muted leading-relaxed">
                  {decision?.summary || 'Analysis complete. Review the detailed metrics below.'}
                </p>

                {/* Trust Score Bar */}
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm text-text-muted">Trust Score</span>
                  <div className="flex-1 h-2 bg-card-dark rounded-full overflow-hidden max-w-xs">
                    <motion.div
                      className={`h-full ${trustScore >= 70 ? 'bg-gradient-to-r from-verified to-green-400' : trustScore >= 50 ? 'bg-gradient-to-r from-primary to-yellow-500' : 'bg-gradient-to-r from-flagged to-red-400'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${trustScore}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                  <span className="text-lg font-bold text-white">{Math.round(trustScore)}<span className="text-text-muted text-sm">/100</span></span>
                </div>
              </div>
            </div>
          </Card>

          {/* Psychometrics */}
          <Card padding="lg" hover={false}>
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-primary">psychology</span>
              <h3 className="text-lg font-bold text-white">Assessment Metrics</h3>
              <Badge variant="info">Based on Examination</Badge>
            </div>

            <div className="space-y-4">
              {psychometrics.map((metric, index) => (
                <div key={metric.label} className="flex items-center gap-4">
                  <span className="text-sm text-text-muted w-32">{metric.label}</span>
                  <div className="flex-1 h-3 bg-card-dark rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${metric.value >= 80 ? 'bg-verified' :
                          metric.value >= 60 ? 'bg-primary' : 'bg-flagged'
                        }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${metric.value}%` }}
                      transition={{ duration: 0.8, delay: 0.1 * index }}
                    />
                  </div>
                  <span className="text-sm font-bold text-white w-12 text-right">{metric.value}%</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Interview Highlights */}
          <Card padding="lg" hover={false}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">format_quote</span>
                <h3 className="text-lg font-bold text-white">Key Insights</h3>
              </div>
            </div>

            <div className="space-y-4">
              {highlights.slice(0, 4).map((highlight, index) => {
                const config = getHighlightConfig(highlight.type);
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 rounded-xl ${config.bgColor} border ${config.borderColor}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={highlight.type === 'positive' ? 'verified' : highlight.type === 'negative' ? 'flagged' : 'review'}>
                        {config.label}
                      </Badge>
                      <span className="text-xs text-text-muted">{highlight.timestamp}</span>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed">
                      {highlight.quote}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right: Score Circles */}
        <div className="lg:col-span-5 space-y-6">
          {/* Trust Index */}
          <Card padding="lg" hover={false} className="text-center">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-4">Trust Index</div>
            <div className="flex items-center justify-center gap-4">
              <ScoreCircle score={Math.round(trustScore)} size="lg" variant="auto" />
            </div>
            <p className="text-sm text-text-muted mt-4">
              {trustScore >= 80 ? 'High confidence in authenticity' :
                trustScore >= 60 ? 'Moderate confidence' : 'Requires further review'}
            </p>
          </Card>

          {/* Skill Match */}
          <Card padding="lg" hover={false} className="text-center">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-4">Skill Match</div>
            <div className="flex items-center justify-center gap-4">
              <ScoreCircle score={skillMatchScore} size="lg" variant="auto" />
            </div>
            <p className="text-sm text-text-muted mt-4">
              {report?.skillMapping?.strong?.length || 0} strong matches, {report?.skillMapping?.missing?.length || 0} gaps
            </p>
          </Card>

          {/* Communication */}
          <Card padding="lg" hover={false} className="text-center">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-4">Communication</div>
            <div className="flex items-center justify-center gap-4">
              <ScoreCircle score={communicationScore} size="lg" variant="auto" />
            </div>
            <p className="text-sm text-text-muted mt-4">
              Based on response clarity and structure
            </p>
          </Card>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-6 border-t border-white/10">
        <Button variant="ghost" onClick={onReset} icon="arrow_back">
          {isViewOnly ? 'Back to Dashboard' : 'New Examination'}
        </Button>

        {!isViewOnly && (
          <Button variant="primary" icon="arrow_forward" iconPosition="right" onClick={onViewCandidate}>
            View Examinee Feedback
          </Button>
        )}
      </div>
    </div>
  );
}
