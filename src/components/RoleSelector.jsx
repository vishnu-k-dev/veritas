import { motion } from 'framer-motion';
import { GraduationCap, Briefcase, Building2, ArrowRight, ArrowLeft, Shield } from 'lucide-react';

const roles = [
  {
    id: 'student',
    emoji: '🎓',
    icon: GraduationCap,
    title: 'Examinee',
    subtitle: 'Demonstrate your competency',
    description: 'Submit your GitHub project or portfolio, undergo a personalised AI examination, and earn a verified VERITAS Examination Report.',
    features: ['Repository-aware examination', 'Shareable Examination Report', 'Evidence-backed competency scores'],
    cta: 'Start Examination',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
  },
  {
    id: 'institute',
    emoji: '🏛️',
    icon: Building2,
    title: 'Institution',
    subtitle: 'Examine your cohort',
    description: 'Run AI examinations across entire cohorts. Generate objective Examination Reports for placements, accreditation, and outcome-based education.',
    features: ['Batch cohort examinations', 'Institution Review Console', 'Accreditation evidence'],
    cta: 'Get Started',
    gradient: 'from-primary/20 to-primary/5',
    border: 'border-primary/20 hover:border-primary/40',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    highlight: true,
  },
  {
    id: 'recruiter',
    emoji: '💼',
    icon: Briefcase,
    title: 'Organization',
    subtitle: 'Assess competency objectively',
    description: 'Create role-specific examination codes, share them with examinees, and receive evidence-backed Examination Reports.',
    features: ['Role-specific examination codes', 'Shareable assessment codes', 'Evidence-backed competency data'],
    cta: 'Get Started',
    gradient: 'from-blue-500/20 to-blue-500/5',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
];

export default function RoleSelector({ onSelectRole, onBack }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
            <Shield className="w-3.5 h-3.5" />
            Choose Your Path
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">How will you use VERITAS?</h1>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            Select your role to begin.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {roles.map((role, i) => (
            <motion.button
              key={role.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => onSelectRole(role.id)}
              className={`group relative text-left rounded-2xl p-8 border transition-all duration-300 ${role.border} bg-gradient-to-b ${role.gradient} hover:shadow-lg cursor-pointer`}
            >
              {role.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-primary text-black text-xs font-bold">
                    Most Impact
                  </span>
                </div>
              )}

              <div className={`w-14 h-14 rounded-xl ${role.iconBg} flex items-center justify-center mb-5`}>
                <span className="text-3xl">{role.emoji}</span>
              </div>

              <h3 className="text-xl font-bold text-white mb-1">{role.title}</h3>
              <p className={`text-sm font-medium ${role.iconColor} mb-3`}>{role.subtitle}</p>
              <p className="text-text-muted text-sm leading-relaxed mb-6">{role.description}</p>

              <ul className="space-y-2 mb-8">
                {role.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-text-muted">
                    <svg className={`w-4 h-4 ${role.iconColor} flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <div className={`inline-flex items-center gap-2 text-sm font-semibold ${role.iconColor} group-hover:gap-3 transition-all`}>
                {role.cta}
                <ArrowRight className="w-4 h-4" />
              </div>
            </motion.button>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-10"
        >
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-text-muted hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </button>
        </motion.div>
      </div>
    </div>
  );
}
