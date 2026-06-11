import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * UpgradeModal — shown when a user exceeds their 2 free interview/test limit.
 * Displays contact information for upgrading to unlimited access.
 */
export default function UpgradeModal({ isOpen, onClose, usageData }) {
    const [copied, setCopied] = useState(null);

    if (!isOpen) return null;

    const contactEmail = 'vishnuk2006@protonmail.com';
    const contactPhone = '+91 9611604661';

    const handleCopy = (text, type) => {
        navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <AnimatePresence>
            <motion.div
                className="upgrade-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="upgrade-modal"
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close button */}
                    <button className="upgrade-modal-close" onClick={onClose}>✕</button>

                    {/* Icon */}
                    <div className="upgrade-icon">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                            <circle cx="24" cy="24" r="24" fill="url(#grad)" opacity="0.15" />
                            <path d="M24 14L30 26H18L24 14Z" fill="url(#grad)" />
                            <path d="M18 28H30V32C30 33.1 29.1 34 28 34H20C18.9 34 18 33.1 18 32V28Z" fill="url(#grad)" />
                            <defs>
                                <linearGradient id="grad" x1="0" y1="0" x2="48" y2="48">
                                    <stop stopColor="#6366f1" />
                                    <stop offset="1" stopColor="#8b5cf6" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    {/* Title */}
                    <h2 className="upgrade-title">Free Tier Limit Reached</h2>

                    {/* Usage stats */}
                    <div className="upgrade-usage">
                        <div className="usage-bar-container">
                            <div className="usage-bar-label">
                                <span>Assessments Used</span>
                                <span>{usageData?.interview?.used || 0} / {usageData?.interview?.limit || 2}</span>
                            </div>
                            <div className="usage-bar-track">
                                <div
                                    className="usage-bar-fill"
                                    style={{ width: `${Math.min(100, ((usageData?.interview?.used || 0) / (usageData?.interview?.limit || 2)) * 100)}%` }}
                                />
                            </div>
                        </div>
                        <div className="usage-bar-container">
                            <div className="usage-bar-label">
                                <span>Organization Assessments</span>
                                <span>{usageData?.screening?.used || 0} / {usageData?.screening?.limit || 2}</span>
                            </div>
                            <div className="usage-bar-track">
                                <div
                                    className="usage-bar-fill screening"
                                    style={{ width: `${Math.min(100, ((usageData?.screening?.used || 0) / (usageData?.screening?.limit || 2)) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Message */}
                    <p className="upgrade-message">
                        You've used your <strong>2 free assessments</strong>. Upgrade to get <strong>unlimited access</strong> to all VERITAS features.
                    </p>

                    {/* Contact methods */}
                    <div className="upgrade-contacts">
                        <button
                            className="contact-method"
                            onClick={() => handleCopy(contactEmail, 'email')}
                        >
                            <span className="contact-icon">📧</span>
                            <div className="contact-info">
                                <span className="contact-label">Email Us</span>
                                <span className="contact-value">{contactEmail}</span>
                            </div>
                            <span className="contact-copy">
                                {copied === 'email' ? '✓ Copied' : 'Copy'}
                            </span>
                        </button>

                        <button
                            className="contact-method"
                            onClick={() => handleCopy(contactPhone, 'phone')}
                        >
                            <span className="contact-icon">📱</span>
                            <div className="contact-info">
                                <span className="contact-label">Call / WhatsApp</span>
                                <span className="contact-value">{contactPhone}</span>
                            </div>
                            <span className="contact-copy">
                                {copied === 'phone' ? '✓ Copied' : 'Copy'}
                            </span>
                        </button>
                    </div>

                    {/* mailto link */}
                    <a
                        href={`mailto:${contactEmail}?subject=VERITAS%20Upgrade%20Request&body=Hi%2C%20I%E2%80%99d%20like%20to%20upgrade%20my%20VERITAS%20account%20for%20unlimited%20access.`}
                        className="upgrade-cta"
                    >
                        Send Upgrade Request
                    </a>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
