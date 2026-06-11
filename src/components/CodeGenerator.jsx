import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Card from './ui/Card';
import Button from './ui/Button';
import { createScreeningCode } from '../services/api';

const TEMPLATES_KEY = 'veritas_role_templates';

function loadTemplates() {
    try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); } catch { return []; }
}
function saveTemplates(templates) {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

/**
 * Code Generator Component
 * Recruiter creates a new screening and gets a code
 */
export default function CodeGenerator({ onComplete, onBack }) {
    const [step, setStep] = useState('form'); // 'form' | 'code'
    const [isLoading, setIsLoading] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [generatedExpiry, setGeneratedExpiry] = useState('');
    const [copied, setCopied] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);

    const [formData, setFormData] = useState({
        roleTitle: '',
        experienceLevel: 'mid',
        requiredSkills: [],
        preferredSkills: [],
        jobDescription: '',
        skillInput: '',
        includeGitHub: false,
        expiryDays: 7,
        maxCandidates: '',
    });

    useEffect(() => {
        setTemplates(loadTemplates());
    }, []);

    const experienceLevels = [
        { id: 'entry', label: 'Entry Level', desc: '0-2 years' },
        { id: 'mid', label: 'Mid Level', desc: '3-5 years' },
        { id: 'senior', label: 'Senior', desc: '5+ years' },
        { id: 'lead', label: 'Lead/Manager', desc: '8+ years' },
    ];

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSkillAdd = (type) => {
        if (!formData.skillInput.trim()) return;
        setFormData({
            ...formData,
            [type]: [...formData[type], formData.skillInput.trim()],
            skillInput: '',
        });
    };

    const handleSkillRemove = (type, index) => {
        setFormData({
            ...formData,
            [type]: formData[type].filter((_, i) => i !== index),
        });
    };

    const handleLoadTemplate = (tpl) => {
        setFormData(prev => ({
            ...prev,
            roleTitle: tpl.roleTitle,
            experienceLevel: tpl.experienceLevel,
            requiredSkills: tpl.requiredSkills || [],
            preferredSkills: tpl.preferredSkills || [],
            jobDescription: tpl.jobDescription || '',
            includeGitHub: tpl.includeGitHub || false,
        }));
        setShowTemplates(false);
    };

    const handleSaveTemplate = () => {
        if (!templateName.trim()) return;
        const tpl = {
            id: Date.now(),
            name: templateName.trim(),
            roleTitle: formData.roleTitle,
            experienceLevel: formData.experienceLevel,
            requiredSkills: formData.requiredSkills,
            preferredSkills: formData.preferredSkills,
            jobDescription: formData.jobDescription,
            includeGitHub: formData.includeGitHub,
        };
        const updated = [tpl, ...templates.filter(t => t.name !== tpl.name)].slice(0, 10);
        saveTemplates(updated);
        setTemplates(updated);
        setTemplateName('');
        setShowSaveTemplate(false);
    };

    const handleDeleteTemplate = (id) => {
        const updated = templates.filter(t => t.id !== id);
        saveTemplates(updated);
        setTemplates(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.roleTitle) return;

        setIsLoading(true);
        try {
            const result = await createScreeningCode({
                roleTitle: formData.roleTitle,
                experienceLevel: formData.experienceLevel,
                requiredSkills: formData.requiredSkills,
                preferredSkills: formData.preferredSkills,
                jobDescription: formData.jobDescription,
                includeGitHub: formData.includeGitHub,
                expiryDays: formData.expiryDays,
                maxCandidates: formData.maxCandidates || undefined,
            });

            setGeneratedCode(result.code);
            setGeneratedExpiry(result.expires_at);
            setStep('code');
        } catch (error) {
            console.error('Failed to create code:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const copyCode = () => {
        navigator.clipboard.writeText(generatedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatExpiry = (isoStr) => {
        if (!isoStr) return `${formData.expiryDays} days`;
        return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (step === 'code') {
        return (
            <div className="max-w-2xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <Card padding="lg" className="text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-verified/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-4xl text-verified">check_circle</span>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">Examination Code Generated!</h2>
                        <p className="text-text-muted mb-8">
                            Share this code with examinees for <strong className="text-white">{formData.roleTitle}</strong>
                        </p>

                        <div className="p-6 rounded-2xl bg-card-dark border border-primary/30 mb-6">
                            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Your Examination Code</p>
                            <p className="font-mono text-4xl font-black text-primary tracking-wider">{generatedCode}</p>
                            <div className="flex items-center justify-center gap-4 mt-3">
                                <p className="text-xs text-text-muted">
                                    Valid until <span className="text-white font-medium">{formatExpiry(generatedExpiry)}</span>
                                </p>
                                {formData.maxCandidates && (
                                    <>
                                        <span className="text-text-muted/40">•</span>
                                        <p className="text-xs text-text-muted">
                                            Max <span className="text-white font-medium">{formData.maxCandidates}</span> examinees
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        <Button
                            variant={copied ? 'secondary' : 'primary'}
                            icon={copied ? 'check' : 'content_copy'}
                            onClick={copyCode}
                            className="mb-8"
                        >
                            {copied ? 'Copied!' : 'Copy Code'}
                        </Button>

                        <div className="text-left p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
                            <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">info</span>
                                How it works
                            </h4>
                            <ol className="text-sm text-text-muted space-y-2">
                                <li className="flex gap-2">
                                    <span className="text-primary font-bold">1.</span>
                                    Share the code with the examinee via email or message
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-primary font-bold">2.</span>
                                    They'll enter the code and complete the AI examination
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-primary font-bold">3.</span>
                                    You'll see their results in your dashboard when they complete
                                </li>
                            </ol>
                        </div>

                        <Button variant="secondary" onClick={onComplete}>
                            Back to Dashboard
                        </Button>
                    </Card>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-text-muted hover:text-white mb-6 transition-colors"
            >
                <span className="material-symbols-outlined">arrow_back</span>
                <span>Back to Dashboard</span>
            </button>

            <Card padding="lg">
                <div className="flex items-start justify-between mb-2">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Create New Examination</h2>
                        <p className="text-text-muted mt-1">Define the examination requirements, then generate a code to share with examinees</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {templates.length > 0 && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowTemplates(!showTemplates)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-text-muted hover:text-white hover:border-white/30 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[16px]">folder_open</span>
                                    Templates
                                </button>
                                {showTemplates && (
                                    <div className="absolute right-0 top-full mt-1 w-64 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
                                        <p className="text-xs text-text-muted px-3 pt-3 pb-1 uppercase tracking-wider">Saved Templates</p>
                                        {templates.map(tpl => (
                                            <div key={tpl.id} className="flex items-center justify-between px-3 py-2 hover:bg-white/5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleLoadTemplate(tpl)}
                                                    className="flex-1 text-left text-sm text-white truncate"
                                                >
                                                    {tpl.name}
                                                    <span className="text-xs text-text-muted ml-1">({tpl.roleTitle})</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteTemplate(tpl.id)}
                                                    className="ml-2 text-text-muted hover:text-red-400 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-text-muted hover:text-white hover:border-white/30 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                            Save Template
                        </button>
                    </div>
                </div>

                {showSaveTemplate && (
                    <div className="flex gap-2 mb-6 p-3 rounded-xl bg-primary/5 border border-primary/20">
                        <input
                            type="text"
                            placeholder="Template name (e.g. Senior React)"
                            value={templateName}
                            onChange={e => setTemplateName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveTemplate(); } }}
                            className="flex-1 px-3 py-2 rounded-lg bg-card-dark border border-white/10 text-white placeholder-text-muted text-sm focus:border-primary outline-none"
                        />
                        <Button type="button" variant="primary" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                            Save
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                    {/* Role Title */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-2">Role Title *</label>
                        <input
                            type="text"
                            name="roleTitle"
                            value={formData.roleTitle}
                            onChange={handleChange}
                            placeholder="e.g., Senior Frontend Developer"
                            className="w-full px-4 py-3 rounded-xl bg-card-dark border border-white/10 text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                            required
                        />
                    </div>

                    {/* Experience Level */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-3">Experience Level</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {experienceLevels.map((level) => (
                                <button
                                    key={level.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, experienceLevel: level.id })}
                                    className={`p-4 rounded-xl border text-center transition-all ${formData.experienceLevel === level.id
                                        ? 'bg-primary/10 border-primary text-white'
                                        : 'bg-card-dark border-white/10 text-text-muted hover:border-white/30'
                                        }`}
                                >
                                    <p className="font-medium">{level.label}</p>
                                    <p className="text-xs opacity-70">{level.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Required Skills */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-2">Required Skills</label>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={formData.skillInput}
                                onChange={(e) => setFormData({ ...formData, skillInput: e.target.value })}
                                placeholder="Add a skill"
                                className="flex-1 px-4 py-2 rounded-lg bg-card-dark border border-white/10 text-white placeholder-text-muted focus:border-primary outline-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSkillAdd('requiredSkills');
                                    }
                                }}
                            />
                            <Button type="button" variant="secondary" onClick={() => handleSkillAdd('requiredSkills')}>Add</Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {formData.requiredSkills.map((skill, index) => (
                                <span
                                    key={index}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
                                >
                                    {skill}
                                    <button
                                        type="button"
                                        onClick={() => handleSkillRemove('requiredSkills', index)}
                                        className="hover:bg-white/10 rounded-full p-0.5"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </span>
                            ))}
                            {formData.requiredSkills.length === 0 && (
                                <span className="text-sm text-text-muted italic">No required skills added</span>
                            )}
                        </div>
                    </div>

                    {/* Job Description */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-2">Job Description (Optional)</label>
                        <textarea
                            name="jobDescription"
                            value={formData.jobDescription}
                            onChange={handleChange}
                            placeholder="Describe the role, responsibilities, and expectations..."
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl bg-card-dark border border-white/10 text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors resize-none"
                        />
                    </div>

                    {/* Expiry + Slot Limits */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-white mb-2">Code Expiry</label>
                            <select
                                name="expiryDays"
                                value={formData.expiryDays}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl bg-card-dark border border-white/10 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                            >
                                <option value={7}>7 days</option>
                                <option value={14}>14 days</option>
                                <option value={30}>30 days</option>
                                <option value={60}>60 days</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white mb-2">
                                Max Examinees
                                <span className="text-text-muted font-normal ml-1">(optional)</span>
                            </label>
                            <input
                                type="number"
                                name="maxCandidates"
                                value={formData.maxCandidates}
                                onChange={handleChange}
                                placeholder="Unlimited"
                                min={1}
                                max={10000}
                                className="w-full px-4 py-3 rounded-xl bg-card-dark border border-white/10 text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                            />
                        </div>
                    </div>

                    {/* GitHub Project Interview Toggle */}
                    <div className="p-4 rounded-xl bg-card-dark border border-white/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">code</span>
                                    Include GitHub Project Examination
                                </label>
                                <p className="text-xs text-text-muted mt-1">
                                    Examinees sign in with GitHub, pick a repo, and answer project-specific examination questions
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, includeGitHub: !formData.includeGitHub })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.includeGitHub ? 'bg-primary' : 'bg-white/20'}`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.includeGitHub ? 'translate-x-6' : 'translate-x-1'}`}
                                />
                            </button>
                        </div>
                        {formData.includeGitHub && (
                            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                                <strong>Test flow:</strong> Resume Interview (5 Qs) → GitHub Sign-in → Pick Repo → Project Interview (5 Qs) → Combined Score
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <Button type="button" variant="ghost" onClick={onBack}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="primary"
                            icon="qr_code_2"
                            disabled={isLoading || !formData.roleTitle}
                        >
                            {isLoading ? 'Generating...' : 'Generate Code'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
