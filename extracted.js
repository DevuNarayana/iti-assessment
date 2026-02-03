            wordFilterBatch.disabled = false;
            filteredBatches.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.batchId;
                opt.textContent = b.batchId;
                wordFilterBatch.appendChild(opt);
            });
        } else {
            wordFilterBatch.innerHTML = '<option value="">No Batches Found</option>';
            wordFilterBatch.disabled = true;
        }
    }

    function handleWordBatchChange() {
        const selectedBatchId = wordFilterBatch.value;
        if (!selectedBatchId) {
            wordPreviewContainer.innerHTML = '<p>Select a Batch to generate the Evidence Report.</p>';
            return;
        }

        // Show Ready State with both Word and PDF options
        wordPreviewContainer.innerHTML = `
            <div style="text-align: center;">
                <svg width="64" height="64" fill="#2563eb" viewBox="0 0 24 24" style="margin-bottom: 1rem;">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0"/>
                </svg>
                <h3>Ready to Generate</h3>
                <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Report for Batch: <strong>${selectedBatchId}</strong></p>
                <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                    <button id="regen-word-btn" class="action-btn primary" style="background: #2563eb; padding: 0.75rem 2rem; display: flex; align-items: center; gap: 0.5rem;">
                         <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0V4c0-1.1-.9-2-2-2zm-2 16H8v-2h4v2zm3-4H8v-2h7v2zm0-4H8V8h7v2z"/></svg>
                        Download Word
                    </button>
                    <button id="regen-pdf-btn" class="action-btn" style="background: #e11d48; color: white; padding: 0.75rem 2rem; display: flex; align-items: center; gap: 0.5rem;">
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
                        Download PDF
                    </button>
                </div>
            </div>
        `;
        document.getElementById('regen-word-btn').addEventListener('click', () => generateWordDoc(false));
        document.getElementById('regen-pdf-btn').addEventListener('click', () => generateWordDoc(true));
    }

    async function generateWordDoc(isPdf = false) {
        const selectedBatchId = wordFilterBatch.value;
        if (!selectedBatchId) return;

        const allBatches = batches;
        const batch = allBatches.find(b => b.batchId === selectedBatchId);

        if (!batch) { alert('Batch data not found.'); return; }

        // Fetch Evidence Photos from Firestore
        const evidencePhotos = [];
        try {
            const q = query(collection(db, "assessments"), where("batchId", "==", selectedBatchId));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.photos && Array.isArray(data.photos)) {
                    evidencePhotos.push(...data.photos);
                }
            });
        } catch (err) {
            console.error("Error fetching photos for Word report:", err);
            alert("Error fetching photos from cloud.");
            return;
        }

        if (evidencePhotos.length === 0) {
            alert('No photos found for this batch!');
            return;
        }

        // Limit to 6 photos for the grid (or take first 6)
        const photosToUse = evidencePhotos.slice(0, 6);

        // Generate HTML for Word
        // MSO Header/Footer Implementation
        try {
            console.log('Generating Word Doc...');

            // Check Photos
            if (!evidencePhotos || evidencePhotos.length === 0) {
                alert('No evidence photos found to generate the report!');
                return;
            }

            const htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>Evidence Report</title>
                <style>
                    /* Page Setup - Zero Tolerance A4 */
                    @page Section1 {
                        size: A4;
                        margin: 0.3in; 
                        mso-header-margin: 0.1in; 
                        mso-footer-margin: 0.1in;
                        mso-page-orientation: portrait;
                    }
                    div.Section1 { 
                        page: Section1;
                        mso-element:header;
                    }
                    
                    body { 
                        font-family: 'Calibri', 'Arial', sans-serif; 
                        margin: 0;
                        padding: 0;
                        mso-line-height-rule: exactly;
                    }

                    .header-content {
                        text-align: center;
                        margin-bottom: 0pt; /* ZERO margin */
                        font-weight: bold;
                        font-size: 14pt;
                        line-height: 1.0;
                    }

                    .main-table {
                        border-collapse: collapse;
                        table-layout: fixed;
                        margin-bottom: -100pt; /* ZERO TOLERANCE PULL-UP */
                    }
                </style>
            </head>
            <body>
                <div class="Section1">
                    <!-- Tight 9.8in height to guarantee single page with 2.82in photos -->
                    <table class="main-table" width="100%" height="9.8in" cellspacing="0" cellpadding="0" style="height: 9.8in; mso-padding-alt: 0 0 0 0;">
                        <tr>
                            <td height="9.8in" style="border: 6pt solid black; padding: 2pt; vertical-align: top; text-align: center; height: 9.8in;">
                                
                                <div class="header-content">
                                    <p style="margin: 0; padding: 0;">Name of the Skill Hub: ${batch.skillHub || 'NAC-Bhimavaram'}</p>
                                    <p style="margin: 0; padding: 0;">Batch ID: ${batch.batchId}</p>
                                    <p style="margin: 0; padding: 0;">Job Role: ${batch.jobRole}</p>
                                </div>

                                <table width="100%" cellspacing="2" cellpadding="0" style="margin: 0 auto; table-layout: fixed;">
                                    ${generateGridRows(photosToUse)}
                                </table>

                            </td>
                        </tr>
                    </table>
                    <!-- Hidden Trailing Paragraph - Maximum Deletion -->
                    <p style="font-size: 1pt; line-height: 1pt; margin: 0; padding: 0; display: none; mso-hide: all; height: 0; overflow: hidden; mso-element:header;">&nbsp;</p>
                </div>
            </body>
            </html>
            `;

            if (isPdf) {
                // PDF Generation - Version 52.0 (Fixing Double Border & 2-Page Spill)
                const element = document.createElement('div');
                element.style.width = '8.27in';
                element.style.background = 'white';

                // Construct a CLEAN HTML snippet specifically for PDF
                element.innerHTML = `
                    <div style="width: 8.27in; padding: 0.3in; background: white; color: black; font-family: Calibri, Arial, sans-serif;">
                        <div style="width: 100%; border: 7.5pt solid black; min-height: 10.6in; padding: 10pt; box-sizing: border-box;">
                            <div style="text-align: center; margin-bottom: 20pt; font-weight: bold; font-size: 14pt; color: black !important;">
                                <p style="margin: 0; padding: 1pt;">Name of the Skill Hub: ${batch.skillHub || 'NAC-Bhimavaram'}</p>
                                <p style="margin: 0; padding: 1pt;">Batch ID: ${batch.batchId}</p>
                                <p style="margin: 0; padding: 1pt;">Job Role: ${batch.jobRole}</p>
                            </div>
                            <table width="100%" cellspacing="5" cellpadding="0" style="table-layout: fixed; margin: 0 auto;">
                                ${generateGridRows(photosToUse)}
                            </table>
                        </div>
                    </div>
                `;

                // Set EXACT image dimensions for PDF - REMOVED REPEAT BORDER
                const imgs = element.querySelectorAll('img');
                imgs.forEach(img => {
                    img.style.width = '3.33in';
                    img.style.height = '2.82in';
                    img.style.display = 'block';
                    img.style.margin = '0 auto';
                    // NO EXTRA BORDER HERE - It's already in generateGridRows
                });

                const opt = {
                    margin: 0,
                    filename: `Evidence_Report_${batch.batchId}.pdf`,
                    image: { type: 'jpeg', quality: 1.0 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        logging: false
                    },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
                };

                html2pdf().set(opt).from(element).save();
                return;
            }

            const blob = new Blob(['\ufeff', htmlContent], {
                type: 'application/msword'
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Evidence_Report_${selectedBatchId}.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Success Feedback
            console.log('Download triggered');
        } catch (err) {
            console.error(err);
            alert('Error generating report: ' + err.message);
        }
    }

    function generateGridRows(photos) {
        let rows = '';
        for (let i = 0; i < photos.length; i += 2) {
            const p1 = photos[i];
            const p2 = photos[i + 1];

            rows += '<tr>';

            // Version 40.0 - EXACT dimensions: 3.33in x 2.82in
            rows += '<td align="center" style="padding: 1pt;">';
            rows += '<table cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 4.5pt solid black; margin: 0 auto;">';
            rows += '<tr><td style="padding: 0; margin: 0; line-height: 0; mso-line-height-rule: exactly;">';
            rows += `<img src="${p1}" width="320" height="270" style="width:3.33in; height:2.82in; display:block;">`;
            rows += '</td></tr></table>';
            rows += '</td>';

            if (p2) {
                // Version 40.0 - EXACT dimensions: 3.33in x 2.82in
                rows += '<td align="center" style="padding: 1pt;">';
                rows += '<table cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 4.5pt solid black; margin: 0 auto;">';
                rows += '<tr><td style="padding: 0; margin: 0; line-height: 0; mso-line-height-rule: exactly;">';
                rows += `<img src="${p2}" width="320" height="270" style="width:3.33in; height:2.82in; display:block;">`;
                rows += '</td></tr></table>';
                rows += '</td>';
