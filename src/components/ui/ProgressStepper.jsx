import { motion } from 'framer-motion';

/**
 * Progress Stepper Component
 * Multi-step indicator with active/completed/upcoming states
 */
export default function ProgressStepper({ steps, currentStep, className = '' }) {
    return (
        <div className={`w-full max-w-4xl ${className}`}>
            <div className="flex items-center w-full relative">
                {/* Connecting line */}
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/10 -z-10" />

                {steps.map((step, index) => {
                    const stepNumber = index + 1;
                    const isActive = stepNumber === currentStep;
                    const isCompleted = stepNumber < currentStep;
                    const isUpcoming = stepNumber > currentStep;

                    return (
                        <div
                            key={step.id || index}
                            className={`
                flex-1 flex flex-col items-center gap-2
                ${isUpcoming ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
              `}
                        >
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: isActive ? 1.1 : 1 }}
                                className={`
                  ${isCompleted ? 'step-completed' : isActive ? 'step-active' : 'step-inactive'}
                `}
                            >
                                {isCompleted ? (
                                    <span className="material-symbols-outlined text-[18px]">check</span>
                                ) : (
                                    stepNumber
                                )}
                                {isActive && (
                                    <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse" />
                                )}
                            </motion.div>
                            <span className={`
                text-sm font-medium
                ${isActive ? 'text-primary font-bold glow-text' : 'text-white'}
              `}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
