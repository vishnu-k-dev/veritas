/**
 * passportGenerator — Generates Skill Passport PDF using jsPDF
 * Professional layout with VERITAS 2.0 branding
 */
import jsPDF from 'jspdf';

/**
 * Generate and download the Skill Passport PDF
 */
export async function generatePassportPDF(passportData) {
    const {
        candidateName = 'Candidate',
        projectName = 'Project',
        repoUrl = '',
        aiLiteracy = {},
        trustScore = 0,
        techStack = [],
        verificationId = 'VERITAS-DEMO',
        issuedAt = new Date().toISOString(),
        breakdown = [],
    } = passportData;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Colors
    const emerald = [16, 185, 129];
    const dark = [15, 20, 25];
    const white = [255, 255, 255];
    const muted = [140, 150, 165];
    const cardBg = [25, 32, 40];

    // Background
    doc.setFillColor(...dark);
    doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');

    // Header gradient bar
    doc.setFillColor(...emerald);
    doc.rect(0, 0, pageWidth, 4, 'F');

    // Title
    y = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...emerald);
    doc.text('VERITAS 2.0', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text('SKILL PASSPORT', 47, y);

    // Shield icon area
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`ID: ${verificationId}`, pageWidth - 20, y, { align: 'right' });

    // Divider
    y += 6;
    doc.setDrawColor(50, 60, 70);
    doc.line(20, y, pageWidth - 20, y);

    // Candidate Name
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text('ISSUED TO', 20, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...white);
    doc.text(candidateName, 20, y);

    // Project name
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(`Project: ${projectName}`, 20, y);
    if (repoUrl) {
        y += 5;
        doc.setTextColor(...emerald);
        doc.text(repoUrl, 20, y);
    }

    // Trust Score Box
    y += 15;
    doc.setFillColor(...cardBg);
    doc.roundedRect(20, y, pageWidth - 40, 30, 3, 3, 'F');

    // Trust Score value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    doc.setTextColor(...emerald);
    doc.text(`${trustScore}`, 35, y + 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text('TRUST SCORE', 35, y + 27);

    // Classification 
    const classText = aiLiteracy.classification || 'Pending';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    if (classText === 'Genuine Builder') doc.setTextColor(...emerald);
    else if (classText === 'AI-Assisted Builder') doc.setTextColor(245, 158, 11);
    else doc.setTextColor(239, 68, 68);
    doc.text(classText, pageWidth / 2 + 10, y + 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text('AI-LITERACY CLASSIFICATION', pageWidth / 2 + 10, y + 20);
    if (aiLiteracy.confidence) {
        doc.text(`Confidence: ${aiLiteracy.confidence}%`, pageWidth / 2 + 10, y + 25);
    }

    y += 38;

    // Score Dimensions
    if (aiLiteracy.dimensions) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...white);
        doc.text('SCORE DIMENSIONS', 20, y);
        y += 8;

        const dims = [
            { label: 'Specificity', value: aiLiteracy.dimensions.avgSpecificity },
            { label: 'Decision Clarity', value: aiLiteracy.dimensions.avgDecisionClarity },
            { label: 'Problem Awareness', value: aiLiteracy.dimensions.avgProblemAwareness },
        ];

        const dimWidth = (pageWidth - 50) / 3;
        dims.forEach((dim, i) => {
            const x = 20 + i * (dimWidth + 5);
            doc.setFillColor(...cardBg);
            doc.roundedRect(x, y, dimWidth, 18, 2, 2, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(...emerald);
            doc.text(`${dim.value}%`, x + 5, y + 11);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(...muted);
            doc.text(dim.label, x + 5, y + 15);
        });

        y += 26;
    }

    // Tech Stack
    if (techStack.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...white);
        doc.text('VERIFIED TECH STACK', 20, y);
        y += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...emerald);
        doc.text(techStack.join('  •  '), 20, y);
        y += 10;
    }

    // Question Performance
    if (breakdown.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...white);
        doc.text('QUESTION PERFORMANCE', 20, y);
        y += 7;

        breakdown.forEach((item, i) => {
            if (y > 260) return; // Don't overflow page
            doc.setFillColor(...cardBg);
            doc.roundedRect(20, y, pageWidth - 40, 10, 1, 1, 'F');

            // Score
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            if (item.totalScore >= 65) doc.setTextColor(...emerald);
            else if (item.totalScore >= 35) doc.setTextColor(245, 158, 11);
            else doc.setTextColor(239, 68, 68);
            doc.text(`${item.totalScore}`, 25, y + 7);

            // Question
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...muted);
            const qText = (item.question || `Question ${i + 1}`).slice(0, 80);
            doc.text(qText, 38, y + 5);
            doc.text(item.classification || '', 38, y + 9);

            y += 12;
        });

        y += 3;
    }

    // Summary
    if (aiLiteracy.summary) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...white);
        doc.text('SUMMARY', 20, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...muted);
        const summaryLines = doc.splitTextToSize(aiLiteracy.summary, pageWidth - 40);
        doc.text(summaryLines, 20, y);
        y += summaryLines.length * 4 + 5;
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setDrawColor(50, 60, 70);
    doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...muted);
    doc.text(`Issued: ${new Date(issuedAt).toLocaleDateString()}`, 20, footerY);
    doc.text(`Verify: ${window.location.origin}/verify/${verificationId}`, 20, footerY + 4);
    doc.text('Powered by VERITAS 2.0 — Evidence-Backed Competency Assessment', pageWidth - 20, footerY, { align: 'right' });

    // Download
    doc.save(`VERITAS_Passport_${candidateName.replace(/\s+/g, '_')}.pdf`);
}

export default { generatePassportPDF };


