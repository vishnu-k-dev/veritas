import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import Card from './ui/Card';
import Button from './ui/Button';
import ScoreCircle from './ui/ScoreCircle';

/**
 * Candidate Feedback View Component
 * Shows ACTUAL interview results and feedback to candidates
 */
export default function CandidateFeedbackView({ feedback, onBack, onReset }) {
    const [activeTab, setActiveTab] = useState('performance');
    const [shareMessage, setShareMessage] = useState('');
    const [roadmap, setRoadmap] = useState(null);
    const [roadmapLoading, setRoadmapLoading] = useState(false);

    // Extract actual data from feedback prop
    const candidateName = feedback?.candidateName || 'Candidate';
    const role = feedback?.jobTitle || 'Position';
    const date = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    const matchScore = feedback?.overallScore || 0;
    const verdict = feedback?.verdict || 'pending';
    const summary = feedback?.summary || '';

    // Get strengths from feedback
    const strengths = feedback?.strengths || [];
    const improvements = feedback?.improvements || [];
    const skillsAssessed = feedback?.skillsAssessed || [];

    // Generate summary based on verdict
    const getSummaryText = () => {
        const name = candidateName.split(' ')[0];
        if (verdict === 'pass') {
            return `${name} demonstrated strong performance across the examination. Answers showed genuine evidence with specific examples and personal insights.`;
        } else if (verdict === 'hold') {
            return `${name} showed potential with some strong answers. Consider follow-up on areas that lacked specific examples or depth.`;
        } else {
            return `${name}'s responses would benefit from more specific evidence and depth. Consider additional preparation.`;
        }
    };

    // Professional PDF generation
    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        let yPos = 20;

        // Helper function to add text with word wrap
        const addWrappedText = (text, x, y, maxWidth, lineHeight = 6) => {
            const lines = doc.splitTextToSize(text, maxWidth);
            doc.text(lines, x, y);
            return y + (lines.length * lineHeight);
        };

        // Header
        doc.setFillColor(17, 24, 39); // Dark background color
        doc.rect(0, 0, pageWidth, 45, 'F');

        doc.setTextColor(79, 70, 229); // Indigo/Primary color
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('VERITAS', 20, 25);

        doc.setTextColor(156, 163, 175); // Gray
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('AI-Powered Assessment Report', 20, 33);

        // Date on right
        doc.setTextColor(255, 255, 255);
        doc.text(date, pageWidth - 20, 25, { align: 'right' });

        yPos = 55;

        // Candidate Info Section
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('VERITAS Examination Report', 20, yPos);
        yPos += 12;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        doc.text(`Examinee: ${candidateName}`, 20, yPos);
        yPos += 7;
        doc.text(`Position: ${role}`, 20, yPos);
        yPos += 7;
        doc.text(`Date: ${date}`, 20, yPos);
        yPos += 15;

        // Score Box
        const verdictColors = {
            pass: [16, 185, 129], // Green
            hold: [245, 158, 11], // Yellow/Orange
            fail: [239, 68, 68]  // Red
        };
        const verdictLabels = {
            pass: 'RECOMMENDED',
            hold: 'NEEDS REVIEW',
            fail: 'NOT RECOMMENDED'
        };
        const [r, g, b] = verdictColors[verdict] || [156, 163, 175];

        doc.setFillColor(r, g, b);
        doc.roundedRect(20, yPos, pageWidth - 40, 35, 3, 3, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.text(`${matchScore}%`, 35, yPos + 23);

        doc.setFontSize(12);
        doc.text('Overall Score', 70, yPos + 15);
        doc.setFontSize(14);
        doc.text(verdictLabels[verdict] || 'PENDING', 70, yPos + 25);

        yPos += 45;

        // Summary
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', 20, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        yPos = addWrappedText(getSummaryText(), 20, yPos, pageWidth - 40);
        yPos += 10;

        // Strengths Section
        if (strengths.length > 0) {
            doc.setTextColor(16, 185, 129);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('✓ Strengths', 20, yPos);
            yPos += 8;

            doc.setTextColor(55, 65, 81);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            strengths.forEach((s, i) => {
                if (yPos > 260) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.setFont('helvetica', 'bold');
                doc.text(`${i + 1}. ${s.title}`, 25, yPos);
                yPos += 5;
                doc.setFont('helvetica', 'normal');
                yPos = addWrappedText(s.description, 25, yPos, pageWidth - 50);
                yPos += 5;
            });
            yPos += 5;
        }

        // Improvements Section
        if (improvements.length > 0) {
            if (yPos > 230) {
                doc.addPage();
                yPos = 20;
            }

            doc.setTextColor(245, 158, 11);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('↗ Areas for Improvement', 20, yPos);
            yPos += 8;

            doc.setTextColor(55, 65, 81);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            improvements.forEach((s, i) => {
                if (yPos > 260) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.setFont('helvetica', 'bold');
                doc.text(`${i + 1}. ${s.title}`, 25, yPos);
                yPos += 5;
                doc.setFont('helvetica', 'normal');
                yPos = addWrappedText(s.description, 25, yPos, pageWidth - 50);
                yPos += 5;
            });
            yPos += 5;
        }

        // Skills Breakdown
        if (skillsAssessed.length > 0) {
            if (yPos > 200) {
                doc.addPage();
                yPos = 20;
            }

            doc.setTextColor(17, 24, 39);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Skills Assessment', 20, yPos);
            yPos += 10;

            skillsAssessed.forEach((skill) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(55, 65, 81);
                doc.text(skill.skill, 25, yPos);
                doc.text(`${skill.score}%`, pageWidth - 35, yPos);

                // Progress bar background
                doc.setFillColor(229, 231, 235);
                doc.roundedRect(80, yPos - 4, 80, 5, 1, 1, 'F');

                // Progress bar fill
                const barColor = skill.score >= 70 ? [16, 185, 129] :
                    skill.score >= 50 ? [245, 158, 11] : [239, 68, 68];
                doc.setFillColor(...barColor);
                doc.roundedRect(80, yPos - 4, (skill.score / 100) * 80, 5, 1, 1, 'F');

                yPos += 12;
            });
        }

        // AI Insights Section (if available)
        const aiInsights = feedback?.aiInsights;
        if (aiInsights) {
            if (yPos > 150) {
                doc.addPage();
                yPos = 20;
            }

            // AI Section Header
            doc.setFillColor(147, 51, 234); // Purple accent
            doc.roundedRect(20, yPos, pageWidth - 40, 25, 3, 3, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('🤖 AI-Powered Analysis', 30, yPos + 16);
            yPos += 35;

            // STAR Analysis
            if (aiInsights.starAnalysis) {
                doc.setTextColor(17, 24, 39);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('STAR Method Assessment', 20, yPos);
                yPos += 10;

                const starItems = [
                    { label: 'Situation Detail', value: aiInsights.starAnalysis.situationDetail },
                    { label: 'Task Clarity', value: aiInsights.starAnalysis.taskClarity },
                    { label: 'Action Specificity', value: aiInsights.starAnalysis.actionSpecificity },
                    { label: 'Results Measurable', value: aiInsights.starAnalysis.resultsMeasurable },
                ];

                const getStarColor = (value) => {
                    if (value === 'strong') return [16, 185, 129];
                    if (value === 'moderate') return [245, 158, 11];
                    return [239, 68, 68];
                };

                starItems.forEach((item, idx) => {
                    const x = 25 + (idx % 2) * 80;
                    const y = yPos + Math.floor(idx / 2) * 15;

                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(75, 85, 99);
                    doc.text(item.label, x, y);

                    const [r, g, b] = getStarColor(item.value);
                    doc.setFillColor(r, g, b);
                    doc.circle(x + 55, y - 2, 3, 'F');

                    doc.setTextColor(r, g, b);
                    doc.setFont('helvetica', 'bold');
                    doc.text((item.value || 'N/A').toUpperCase(), x + 62, y);
                });
                yPos += 35;
            }

            // AI Summary
            if (aiInsights.summary) {
                doc.setTextColor(17, 24, 39);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text('AI Summary', 20, yPos);
                yPos += 7;

                doc.setFont('helvetica', 'italic');
                doc.setFontSize(10);
                doc.setTextColor(75, 85, 99);
                yPos = addWrappedText(`"${aiInsights.summary}"`, 20, yPos, pageWidth - 40);
                yPos += 10;
            }

            // AI-Detected Strengths
            if (aiInsights.strengths && aiInsights.strengths.length > 0) {
                doc.setTextColor(16, 185, 129);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text('AI-Detected Strengths', 20, yPos);
                yPos += 7;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(55, 65, 81);

                aiInsights.strengths.slice(0, 3).forEach((s) => {
                    if (yPos > 260) { doc.addPage(); yPos = 20; }
                    doc.setFont('helvetica', 'bold');
                    doc.text(`• ${s.title}`, 25, yPos);
                    yPos += 5;
                    if (s.evidence) {
                        doc.setFont('helvetica', 'normal');
                        yPos = addWrappedText(s.evidence, 30, yPos, pageWidth - 55);
                    }
                    yPos += 3;
                });
                yPos += 5;
            }

            // AI-Detected Concerns
            if (aiInsights.concerns && aiInsights.concerns.length > 0) {
                if (yPos > 240) { doc.addPage(); yPos = 20; }

                doc.setTextColor(239, 68, 68);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text('AI-Detected Concerns', 20, yPos);
                yPos += 7;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(55, 65, 81);

                aiInsights.concerns.slice(0, 3).forEach((c) => {
                    if (yPos > 260) { doc.addPage(); yPos = 20; }
                    doc.setFont('helvetica', 'bold');
                    doc.text(`• ${c.title}`, 25, yPos);
                    yPos += 5;
                    if (c.reason) {
                        doc.setFont('helvetica', 'normal');
                        yPos = addWrappedText(c.reason, 30, yPos, pageWidth - 55);
                    }
                    yPos += 3;
                });
                yPos += 5;
            }

            // AI Recommendation
            if (aiInsights.recommendation) {
                if (yPos > 230) { doc.addPage(); yPos = 20; }

                doc.setFillColor(245, 197, 24); // Gold
                doc.roundedRect(20, yPos, pageWidth - 40, 8, 2, 2, 'F');
                yPos += 12;

                doc.setTextColor(17, 24, 39);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text('AI Recommendation', 20, yPos);
                yPos += 7;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(55, 65, 81);
                yPos = addWrappedText(aiInsights.recommendation, 20, yPos, pageWidth - 40);
                yPos += 10;
            }
        }

        // Footer
        const footerY = doc.internal.pageSize.getHeight() - 15;
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text('Generated by VERITAS • Evidence-Backed AI Examination System', pageWidth / 2, footerY, { align: 'center' });
        doc.text(new Date().toISOString(), pageWidth / 2, footerY + 5, { align: 'center' });

        // Save the PDF
        doc.save(`veritas-assessment-${candidateName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    };

    // Share functionality
    const handleShare = async () => {
        const shareData = {
            title: `VERITAS Competency Assessment - ${candidateName}`,
            text: `I just completed my ${role} competency assessment on VERITAS and scored ${matchScore}%!`,
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                // User cancelled or error
                copyToClipboard();
            }
        } else {
            copyToClipboard();
        }
    };

    const copyToClipboard = () => {
        const text = `I completed my ${role} competency assessment on VERITAS and scored ${matchScore}%! 🎯`;
        navigator.clipboard.writeText(text);
        setShareMessage('Copied to clipboard!');
        setTimeout(() => setShareMessage(''), 2000);
    };

    const getVerdictStyle = () => {
        switch (verdict) {
            case 'pass': return { label: 'STRONG PERFORMANCE', color: 'text-verified', bg: 'bg-verified/10' };
            case 'hold': return { label: 'SHOWS POTENTIAL', color: 'text-primary', bg: 'bg-primary/10' };
            default: return { label: 'NEEDS IMPROVEMENT', color: 'text-flagged', bg: 'bg-flagged/10' };
        }
    };

    const verdictStyle = getVerdictStyle();

    // Fetch roadmap when user clicks the tab (lazy — avoids unnecessary AI calls)
    const fetchRoadmap = async () => {
        if (roadmap || roadmapLoading) return;
        setRoadmapLoading(true);
        try {
            const { getAuthToken } = await import('../lib/supabase');
            const token = await getAuthToken();
            const API_BASE = import.meta.env.VITE_API_URL || '';
            const skills = (feedback?.skillsAssessed || []).map(s => s.skill);
            const scores = {};
            (feedback?.skillsAssessed || []).forEach(s => { scores[s.skill] = s.score; });
            scores.overall = feedback?.overallScore || 0;
            const res = await fetch(`${API_BASE}/api/interview/roadmap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ skills, scores, verdict: feedback?.verdict }),
            });
            if (res.ok) {
                const data = await res.json();
                setRoadmap(data.roadmap);
            }
        } catch {/* non-critical */} finally {
            setRoadmapLoading(false);
        }
    };

    const tabs = [
        { id: 'performance', label: 'Performance' },
        { id: 'skills', label: 'Skills Breakdown' },
        { id: 'breakdown', label: 'How It\'s Scored' },
        { id: 'roadmap', label: '90-Day Roadmap' },
        { id: 'next', label: 'Next Steps' },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <header className="space-y-4">
                <div className="text-sm text-text-muted">
                    Assessment → Results
                </div>

                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-black text-white">Your Assessment Results</h1>
                        <p className="text-text-muted flex items-center gap-4 mt-2">
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">person</span>
                                {candidateName}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">work</span>
                                {role}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">calendar_today</span>
                                {date}
                            </span>
                        </p>
                    </div>
                    <div className="flex gap-3 items-center">
                        {shareMessage && (
                            <span className="text-sm text-verified">{shareMessage}</span>
                        )}
                        <Button variant="secondary" icon="share" onClick={handleShare}>
                            Share
                        </Button>
                        <Button variant="primary" icon="download" onClick={handleDownloadPDF}>
                            Download Report
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Main Content */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Score Summary Card */}
                    <Card padding="lg" hover={false}>
                        <div className="flex items-start gap-6">
                            {/* Match Score Circle */}
                            <div className="text-center">
                                <ScoreCircle score={matchScore} size="lg" variant="auto" />
                                <p className="text-sm font-bold text-text-muted mt-2 uppercase">Overall</p>
                            </div>

                            {/* Summary */}
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${verdictStyle.bg} ${verdictStyle.color}`}>
                                        {verdictStyle.label}
                                    </span>
                                </div>
                                <p className="text-text-muted leading-relaxed">
                                    {getSummaryText()}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-white/10">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-3 text-sm font-medium transition-colors relative ${activeTab === tab.id ? 'text-white' : 'text-text-muted hover:text-white'
                                    }`}
                            >
                                {tab.label}
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                    />
                                )}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'performance' && (
                        <>
                            {/* Strengths */}
                            <Card padding="lg" hover={false}>
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="material-symbols-outlined text-verified">thumb_up</span>
                                    <h3 className="text-lg font-bold text-white">What You Did Well</h3>
                                </div>

                                {strengths.length > 0 ? (
                                    <div className="space-y-4">
                                        {strengths.map((strength, index) => (
                                            <motion.div
                                                key={index}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                className="flex gap-4 p-4 rounded-xl bg-verified/5 border border-verified/10"
                                            >
                                                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-verified/10 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-verified">check_circle</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white mb-1">{strength.title}</h4>
                                                    <p className="text-sm text-text-muted leading-relaxed">{strength.description}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-text-muted">No specific strengths recorded.</p>
                                )}
                            </Card>

                            {/* Improvements */}
                            <Card padding="lg" hover={false}>
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="material-symbols-outlined text-primary">trending_up</span>
                                    <h3 className="text-lg font-bold text-white">Areas for Improvement</h3>
                                </div>

                                {improvements.length > 0 ? (
                                    <div className="space-y-4">
                                        {improvements.map((item, index) => (
                                            <motion.div
                                                key={index}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
                                            >
                                                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-primary">lightbulb</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white mb-1">{item.title}</h4>
                                                    <p className="text-sm text-text-muted leading-relaxed">{item.description}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-text-muted">No specific improvements noted.</p>
                                )}
                            </Card>
                        </>
                    )}

                    {activeTab === 'skills' && (
                        <Card padding="lg" hover={false}>
                            <div className="flex items-center gap-2 mb-6">
                                <span className="material-symbols-outlined text-primary">analytics</span>
                                <h3 className="text-lg font-bold text-white">Skills Assessment</h3>
                            </div>

                            {skillsAssessed.length > 0 ? (
                                <div className="space-y-4">
                                    {skillsAssessed.map((skill, index) => (
                                        <div key={index} className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-white font-medium">{skill.skill}</span>
                                                <span className="text-text-muted">{skill.score}%</span>
                                            </div>
                                            <div className="h-2 bg-card-dark rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${skill.score}%` }}
                                                    transition={{ delay: index * 0.1, duration: 0.5 }}
                                                    className={`h-full ${skill.score >= 70 ? 'bg-verified' :
                                                        skill.score >= 50 ? 'bg-primary' : 'bg-flagged'
                                                        }`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-text-muted">No skills data available.</p>
                            )}
                        </Card>
                    )}

                    {activeTab === 'roadmap' && (() => {
                        // Trigger fetch on first render of this tab
                        if (!roadmap && !roadmapLoading) fetchRoadmap();
                        return (
                        <Card padding="lg" hover={false}>
                            <div className="flex items-center gap-2 mb-6">
                                <span className="material-symbols-outlined text-primary">rocket_launch</span>
                                <h3 className="text-lg font-bold text-white">Your 90-Day Skill Roadmap</h3>
                            </div>

                            {roadmapLoading && (
                                <div className="text-center py-10">
                                    <div className="size-8 mx-auto border-4 border-card-dark border-t-primary rounded-full animate-spin mb-3" />
                                    <p className="text-text-muted text-sm">Generating personalised roadmap...</p>
                                </div>
                            )}

                            {!roadmapLoading && !roadmap && (
                                <div className="text-center py-10">
                                    <p className="text-text-muted text-sm">Could not generate roadmap. Please check your connection and try again.</p>
                                    <button onClick={fetchRoadmap} className="mt-3 text-primary text-sm underline">Retry</button>
                                </div>
                            )}

                            {roadmap?.summary && (
                                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 mb-6">
                                    <p className="text-text text-sm leading-relaxed">{roadmap.summary}</p>
                                </div>
                            )}

                            {roadmap?.roadmap?.length > 0 && (
                                <div className="space-y-5">
                                    {roadmap.roadmap.map((item, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.08 }}
                                            className="p-5 rounded-xl bg-white/5 border border-white/10"
                                        >
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div>
                                                    <h4 className="text-white font-bold">{item.skill}</h4>
                                                    <p className="text-text-muted text-xs capitalize">{item.currentLevel} · priority: {item.priority}</p>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                                                    item.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                                    item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-blue-500/20 text-blue-400'
                                                }`}>{item.priority}</span>
                                            </div>
                                            <p className="text-sm text-text-muted mb-3">
                                                <span className="text-white font-medium">Weekly goal:</span> {item.weeklyGoal}
                                            </p>
                                            {item.projectIdea && (
                                                <p className="text-sm text-text-muted mb-3">
                                                    <span className="text-white font-medium">Build:</span> {item.projectIdea}
                                                </p>
                                            )}
                                            {item.resources?.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {item.resources.slice(0, 3).map((r, ri) => (
                                                        <span key={ri} className="px-2.5 py-1 rounded-lg bg-card-dark border border-card-border text-text-muted text-xs">
                                                            {r.type === 'course' ? '🎓' : r.type === 'video' ? '▶' : r.type === 'project' ? '🛠' : '📖'} {r.title}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </Card>
                        );
                    })()}

                    {activeTab === 'breakdown' && (
                        <Card padding="lg" hover={false}>
                            <div className="flex items-center gap-2 mb-6">
                                <span className="material-symbols-outlined text-primary">calculate</span>
                                <h3 className="text-lg font-bold text-white">How Your Score Was Calculated</h3>
                            </div>

                            {/* Weighted score table */}
                            <div className="space-y-4 mb-8">
                                {[
                                    { label: 'Skill Match',    key: 'skillMatch',    weight: 30, desc: 'How well your experience aligned with the required skills' },
                                    { label: 'Authenticity',   key: 'authenticity',  weight: 25, desc: 'Whether answers reflected genuine personal experience' },
                                    { label: 'Depth',          key: 'depth',         weight: 20, desc: 'Technical depth, specifics, and reasoning in responses' },
                                    { label: 'Consistency',    key: 'consistency',   weight: 15, desc: 'Quality stayed consistent across all questions' },
                                    { label: 'Communication',  key: 'communication', weight: 10, desc: 'Structure, clarity, and flow of your answers' },
                                ].map(({ label, key, weight, desc }) => {
                                    const raw = feedback?.metrics?.[key] ?? 0;
                                    const contribution = Math.round(raw * weight / 100);
                                    const pct = Math.min(100, raw);
                                    return (
                                        <div key={key}>
                                            <div className="flex justify-between items-baseline mb-1">
                                                <div>
                                                    <span className="text-white font-semibold text-sm">{label}</span>
                                                    <span className="text-text-muted text-xs ml-2">({weight}% weight)</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`font-bold text-sm ${pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        {raw}/100
                                                    </span>
                                                    <span className="text-text-muted text-xs ml-2">→ +{contribution} pts</span>
                                                </div>
                                            </div>
                                            <div className="h-2 bg-card-dark rounded-full overflow-hidden mb-1">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 0.6 }}
                                                    className={`h-full rounded-full ${pct >= 70 ? 'bg-green-400' : pct >= 50 ? 'bg-primary' : 'bg-red-400'}`}
                                                />
                                            </div>
                                            <p className="text-text-muted text-xs">{desc}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Total */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10 border border-primary/20">
                                <span className="text-white font-bold">Overall Score</span>
                                <span className="text-primary text-2xl font-black">{matchScore}/100</span>
                            </div>

                            {/* Score legend */}
                            <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs">
                                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                    <p className="text-green-400 font-bold">60+</p>
                                    <p className="text-text-muted">PASS</p>
                                </div>
                                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                    <p className="text-yellow-400 font-bold">40–59</p>
                                    <p className="text-text-muted">HOLD</p>
                                </div>
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <p className="text-red-400 font-bold">&lt;40</p>
                                    <p className="text-text-muted">FAIL</p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'next' && (
                        <Card padding="lg" hover={false}>
                            <div className="flex items-center gap-2 mb-6">
                                <span className="material-symbols-outlined text-primary">rocket_launch</span>
                                <h3 className="text-lg font-bold text-white">What's Next?</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <h4 className="font-bold text-white mb-2">📧 Check Your Email</h4>
                                    <p className="text-sm text-text-muted">
                                        The institution will review your Examination Report and may reach out for next steps.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <h4 className="font-bold text-white mb-2">📥 Download Your Report</h4>
                                    <p className="text-sm text-text-muted">
                                        Keep a copy of your assessment for your records using the Download button above.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <h4 className="font-bold text-white mb-2">🎯 Keep Practicing</h4>
                                    <p className="text-sm text-text-muted">
                                        Review the improvement areas and work on providing more specific evidence in future examinations.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Right: Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Quick Stats */}
                    <Card padding="md" hover={false}>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Quick Stats</h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-text-muted">Questions Answered</span>
                                <span className="text-white font-bold">{feedback?.questionsCount || 4}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-text-muted">Overall Score</span>
                                <span className="text-white font-bold">{matchScore}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-text-muted">Assessment Date</span>
                                <span className="text-white font-bold">{date}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-text-muted">Status</span>
                                <span className={`font-bold ${verdictStyle.color}`}>
                                    {verdict.charAt(0).toUpperCase() + verdict.slice(1)}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Feedback */}
                    <Card padding="md" hover={false}>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-text-muted">feedback</span>
                            <h3 className="text-sm font-bold text-white">How was your experience?</h3>
                        </div>

                        <div className="flex gap-3">
                            <button className="flex-1 p-3 rounded-lg bg-verified/10 hover:bg-verified/20 text-verified transition-colors flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">thumb_up</span>
                                Good
                            </button>
                            <button className="flex-1 p-3 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-colors flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">thumb_down</span>
                                Bad
                            </button>
                        </div>
                    </Card>

                    {/* Help */}
                    <Card padding="md" hover={false} className="border border-primary/20">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-primary">help</span>
                            <h3 className="text-sm font-bold text-white">Need Help?</h3>
                        </div>
                        <p className="text-sm text-text-muted mb-3">
                            Have questions about your Examination Report? Contact the institution that issued this examination.
                        </p>
                    </Card>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-center pt-6 border-t border-white/10">
                <Button variant="primary" onClick={onReset} icon="home">
                    Return to Start
                </Button>
            </div>
        </div>
    );
}
