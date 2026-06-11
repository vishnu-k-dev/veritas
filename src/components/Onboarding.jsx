import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Building2, GraduationCap, MapPin, Briefcase, BookOpen, Loader2, ArrowLeft, Mail, Phone } from 'lucide-react';
import useAuth from '../hooks/useAuth.jsx';

/**
 * Onboarding — role-specific profile form after first sign-in
 * Handles: Student, Institute, Recruiter
 */
export default function Onboarding({ role, onComplete, onBack }) {
    const { saveProfile, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Shared
    const [name, setName] = useState(user?.displayName || '');

    // Student fields
    const [college, setCollege] = useState('');
    const [year, setYear] = useState('');
    const [branch, setBranch] = useState('');

    // Recruiter fields
    const [company, setCompany] = useState('');
    const [designation, setDesignation] = useState('');

    // Institute fields
    const [instituteName, setInstituteName] = useState('');
    const [instituteType, setInstituteType] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [contactEmail, setContactEmail] = useState(user?.email || '');
    const [contactPhone, setContactPhone] = useState('');
    const [city, setCity] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            let profileData = { name: name || user?.displayName || '' };

            if (role === 'student') {
                profileData = { ...profileData, college, year, branch };
            } else if (role === 'recruiter') {
                profileData = { ...profileData, company, designation };
            } else if (role === 'institute') {
                profileData = {
                    ...profileData,
                    instituteName,
                    instituteType,
                    contactPerson,
                    contactEmail,
                    contactPhone,
                    city,
                };
            }

            await saveProfile(role, profileData);
            onComplete?.();
        } catch (err) {
            setError(err.message || 'Failed to save profile.');
        }
        setLoading(false);
    };

    const roleConfig = {
        student: {
            icon: GraduationCap,
            title: 'Complete Your Student Profile',
            subtitle: 'Help us personalize your experience',
            color: 'emerald',
        },
        recruiter: {
            icon: Briefcase,
            title: 'Set Up Your Organization Profile',
            subtitle: 'Create evidence-backed examination assessments',
            color: 'blue',
        },
        institute: {
            icon: Building2,
            title: 'Register Your Institution',
            subtitle: 'Set up VERITAS for your examination cell',
            color: 'primary',
        },
    };

    const config = roleConfig[role] || roleConfig.student;
    const Icon = config.icon;

    // Dynamic color classes (Tailwind can't purge dynamic strings)
    const colorMap = {
        emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
        blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' },
        primary: { bg: 'bg-primary/10', border: 'border-primary/20', text: 'text-primary' },
    };
    const colors = colorMap[config.color] || colorMap.primary;

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 text-text-muted hover:text-white transition-colors mb-8 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back
                </button>

                <div className="glass-panel-subtle rounded-2xl p-8">
                    <div className="text-center mb-8">
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                            <Icon className={`w-8 h-8 ${colors.text}`} />
                        </div>
                        <h2 className="text-2xl font-bold text-white">{config.title}</h2>
                        <p className="text-text-muted text-sm mt-1">{config.subtitle}</p>
                        {user?.email && (
                            <p className="text-xs text-text-muted mt-2">Signed in as <span className="text-white">{user.email}</span></p>
                        )}
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name field — shared across all roles */}
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                            <input
                                type="text"
                                placeholder="Full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="input-field pl-11"
                                required
                            />
                        </div>

                        {/* ============ Student Fields ============ */}
                        {role === 'student' && (
                            <>
                                <div className="relative">
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                    <input
                                        type="text"
                                        placeholder="College / University"
                                        value={college}
                                        onChange={(e) => setCollege(e.target.value)}
                                        className="input-field pl-11"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                        <input
                                            type="text"
                                            placeholder="Branch (e.g. CSE)"
                                            value={branch}
                                            onChange={(e) => setBranch(e.target.value)}
                                            className="input-field pl-11"
                                            required
                                        />
                                    </div>
                                    <select
                                        value={year}
                                        onChange={(e) => setYear(e.target.value)}
                                        className="input-field appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="" disabled>Year</option>
                                        <option value="1st">1st Year</option>
                                        <option value="2nd">2nd Year</option>
                                        <option value="3rd">3rd Year</option>
                                        <option value="4th">4th Year</option>
                                        <option value="alumni">Alumni</option>
                                    </select>
                                </div>
                            </>
                        )}

                        {/* ============ Organization Fields ============ */}
                        {role === 'recruiter' && (
                            <>
                                <div className="relative">
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                    <input
                                        type="text"
                                        placeholder="Organization name"
                                        value={company}
                                        onChange={(e) => setCompany(e.target.value)}
                                        className="input-field pl-11"
                                        required
                                    />
                                </div>
                                <div className="relative">
                                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                    <input
                                        type="text"
                                        placeholder="Role (e.g. Assessment Lead)"
                                        value={designation}
                                        onChange={(e) => setDesignation(e.target.value)}
                                        className="input-field pl-11"
                                        required
                                    />
                                </div>
                            </>
                        )}

                        {/* ============ Institute Fields ============ */}
                        {role === 'institute' && (
                            <>
                                <div className="relative">
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                    <input
                                        type="text"
                                        placeholder="Institution name"
                                        value={instituteName}
                                        onChange={(e) => setInstituteName(e.target.value)}
                                        className="input-field pl-11"
                                        required
                                    />
                                </div>
                                <select
                                    value={instituteType}
                                    onChange={(e) => setInstituteType(e.target.value)}
                                    className="input-field appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="" disabled>Institution type</option>
                                    <option value="engineering">Engineering College</option>
                                    <option value="university">University</option>
                                    <option value="polytechnic">Polytechnic</option>
                                    <option value="arts_science">Arts & Science</option>
                                    <option value="management">Management / MBA</option>
                                    <option value="other">Other</option>
                                </select>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                    <input
                                        type="text"
                                        placeholder="Contact person name"
                                        value={contactPerson}
                                        onChange={(e) => setContactPerson(e.target.value)}
                                        className="input-field pl-11"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                        <input
                                            type="email"
                                            placeholder="Contact email"
                                            value={contactEmail}
                                            onChange={(e) => setContactEmail(e.target.value)}
                                            className="input-field pl-11"
                                            required
                                        />
                                    </div>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                        <input
                                            type="tel"
                                            placeholder="Phone number"
                                            value={contactPhone}
                                            onChange={(e) => setContactPhone(e.target.value)}
                                            className="input-field pl-11"
                                        />
                                    </div>
                                </div>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                    <input
                                        type="text"
                                        placeholder="City"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        className="input-field pl-11"
                                        required
                                    />
                                </div>
                            </>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}

