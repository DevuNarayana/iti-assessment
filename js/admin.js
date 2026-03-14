import { db, collection, addDoc, getDocs, doc, deleteDoc, query, where, getDoc } from '../firebase-config.js';
import { state } from './state.js';
import { syncData } from './services.js';
import { openLightbox } from './camera.js'; // for reviewing evidence
import { showError } from './utils.js';

// Helper to populate global SSC dropdown
export function updateGlobalSscDropdown() {
    const globalBatchSscSelect = document.getElementById('global-batch-ssc');
    const globalBatchSectorSelect = document.getElementById('global-batch-sector');
    const sectorMgmtSscSelect = document.getElementById('sector-management-ssc');
    const batchSectorModalSelect = document.getElementById('batch-sector');
    const openCreateBatchBtn = document.getElementById('add-batch-btn');
    
    // Core populate function
    const populateSsc = (el) => {
        if (!el) return;
        const currentVal = el.value;
        el.innerHTML = '<option value="" disabled selected>Select Sector Skill Council</option>';
        state.sscs.forEach(ssc => {
            const option = document.createElement('option');
            option.value = ssc.name;
            option.textContent = ssc.name;
            option.style.color = 'black';
            el.appendChild(option);
        });
        if (currentVal) el.value = currentVal;
    };

    populateSsc(globalBatchSscSelect);
    populateSsc(sectorMgmtSscSelect);

    const populateSectors = (el, sectors) => {
        if (!el) return;
        const currentSelected = el.value;
        el.innerHTML = '<option value="" disabled selected>Select Sector</option>';
        sectors.forEach(s => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = s;
            el.appendChild(opt);
        });
        if (sectors.includes(currentSelected)) el.value = currentSelected;
        el.disabled = sectors.length === 0;
    };

    // Handle Batches Section logic
    if (globalBatchSscSelect) {
        const selectedSsc = globalBatchSscSelect.value;
        const sscObj = state.sscs.find(s => s.name === selectedSsc);
        const sectors = sscObj?.sectors || [];
        
        populateSectors(globalBatchSectorSelect, sectors);
        populateSectors(batchSectorModalSelect, sectors);

        if (openCreateBatchBtn) {
            if (selectedSsc && globalBatchSectorSelect && globalBatchSectorSelect.value) {
                openCreateBatchBtn.classList.remove('hidden');
            } else {
                openCreateBatchBtn.classList.add('hidden');
            }
        }
    }

    // Assign onchange listeners once (if not already set)
    if (globalBatchSscSelect && !globalBatchSscSelect.onchange) {
        globalBatchSscSelect.onchange = () => {
            updateGlobalSscDropdown();
            renderBatchTable();
        };
    }
    if (globalBatchSectorSelect && !globalBatchSectorSelect.onchange) {
        globalBatchSectorSelect.onchange = () => {
            updateGlobalSscDropdown();
            renderBatchTable();
        };
    }
    if (sectorMgmtSscSelect && !sectorMgmtSscSelect.onchange) {
        sectorMgmtSscSelect.onchange = () => {
            renderSectorsManagementTable();
        };
    }
}

export function renderSectorManagement() {
    updateGlobalSscDropdown();
    renderSectorsManagementTable();
}

export function renderSectorsManagementTable() {
    const sscSelect = document.getElementById('sector-management-ssc');
    const tableBody = document.getElementById('sectors-management-table-body');
    const countEl = document.getElementById('sector-management-count');
    const addBtn = document.getElementById('add-sector-tab-btn');

    if (!sscSelect || !sscSelect.value) {
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 2rem;">Please select an SSC to manage sectors.</td></tr>';
        if (countEl) countEl.textContent = 0;
        addBtn?.classList.add('hidden');
        return;
    }

    const sscName = sscSelect.value;
    addBtn?.classList.remove('hidden');
    const sscObj = state.sscs.find(s => s.name === sscName);
    const sectors = sscObj?.sectors || [];
    
    if (countEl) countEl.textContent = sectors.length;

    if (sectors.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 2rem;">No sectors found for this SSC.</td></tr>';
        return;
    }

    tableBody.innerHTML = sectors.map((sector, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${sector}</td>
            <td>
                <button class="action-btn delete-sector-btn" data-ssc="${sscName}" data-sector="${sector}" style="border-color: #ef4444; color: #ef4444; padding: 0.25rem 0.75rem;">Delete</button>
            </td>
        </tr>
    `).join('');

    tableBody.querySelectorAll('.delete-sector-btn').forEach(btn => {
        btn.onclick = () => deleteSector(btn.dataset.ssc, btn.dataset.sector);
    });
}

export async function deleteSector(sscName, sectorName) {
    if (!confirm(`Are you sure you want to delete sector "${sectorName}"?`)) return;

    try {
        const sscObj = state.sscs.find(s => s.name === sscName);
        if (!sscObj) return;

        const updatedSectors = sscObj.sectors.filter(s => s !== sectorName);
        const { updateDoc } = await import('../firebase-config.js'); // Ensure we can update
        await updateDoc(doc(db, "sscs", sscObj.id), { sectors: updatedSectors });
        
        await syncData();
        renderSectorsManagementTable();
    } catch (err) {
        console.error("Delete Sector Error:", err);
        alert("Failed to delete sector.");
    }
}

export function renderSscTable() {
    const sscTableBody = document.getElementById('ssc-table-body');
    const sscCount = document.getElementById('ssc-count');
    if (!sscTableBody) return;

    if (sscCount) sscCount.textContent = state.sscs.length;

    if (state.sscs.length === 0) {
        sscTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No SSCs added yet.</td></tr>`;
        return;
    }

    sscTableBody.innerHTML = state.sscs.map((ssc, index) => {
        const sectors = ssc.sectors ? ssc.sectors.join(', ') : 'None';
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${ssc.name}</td>
                <td>${ssc.code}</td>
                <td style="font-size: 0.85rem; color: #10b981;">${sectors}</td>
                <td>
                    <button class="action-btn delete-ssc-btn" data-id="${ssc.id}" style="border-color: #ef4444; color: #ef4444; padding: 0.25rem 0.75rem;">Delete</button>
                </td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.delete-ssc-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteSsc(btn.dataset.id));
    });
}

export function renderBatchTable() {
    const batchesTableBody = document.getElementById('batches-table-body');
    const batchCount = document.getElementById('batch-count');
    const globalBatchSscSelect = document.getElementById('global-batch-ssc');
    const globalBatchSectorSelect = document.getElementById('global-batch-sector');
    const bulkDeleteBtn = document.getElementById('bulk-delete-batches-btn');
    const selectAllCheckbox = document.getElementById('select-all-batches');
    if (!batchesTableBody) return;
    const selectedSsc = globalBatchSscSelect ? globalBatchSscSelect.value : '';
    const selectedSector = globalBatchSectorSelect ? globalBatchSectorSelect.value : '';

    if (!selectedSsc) {
        batchesTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">Please select a Sector Skill Council to view/add batches.</td></tr>`;
        if (batchCount) batchCount.textContent = 0;
        document.getElementById('bulk-download-pdf-btn')?.classList.add('hidden');
        document.getElementById('bulk-download-evidence-btn')?.classList.add('hidden');
        if (bulkDeleteBtn) bulkDeleteBtn.classList.add('hidden');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        return;
    }

    let filteredBatches = state.batches.filter(b => b.ssc === selectedSsc);
    if (selectedSector) {
        filteredBatches = filteredBatches.filter(b => b.sector === selectedSector);
    }
    // Sort numerically by SR
    filteredBatches.sort((a, b) => {
        const valA = parseInt(a.sr) || 0;
        const valB = parseInt(b.sr) || 0;
        return valA - valB;
    });

    if (batchCount) batchCount.textContent = filteredBatches.length;

    if (filteredBatches.length === 0) {
        batchesTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">No batches found for ${selectedSsc}.</td></tr>`;
        document.getElementById('bulk-download-pdf-btn')?.classList.add('hidden');
        document.getElementById('bulk-download-evidence-btn')?.classList.add('hidden');
        if (bulkDeleteBtn) bulkDeleteBtn.classList.add('hidden');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        return;
    }

    document.getElementById('bulk-download-pdf-btn')?.classList.remove('hidden');
    document.getElementById('bulk-download-evidence-btn')?.classList.remove('hidden');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    if (bulkDeleteBtn) bulkDeleteBtn.classList.add('hidden');

    batchesTableBody.innerHTML = filteredBatches.map((batch) => `
        <tr>
            <td><input type="checkbox" class="batch-select" data-id="${batch.id}" data-batch-id="${batch.batchId}"></td>
            <td>${batch.sr}</td>
            <td>${batch.day}</td>
            <td>${batch.month}</td>
            <td>${batch.ssc}</td>
            <td style="color: #10b981; font-weight: 500;">${batch.sector || 'N/A'}</td>
            <td>${batch.jobRole}</td>
            <td>${batch.batchId}</td>
            <td>${batch.skillHub}</td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="action-btn delete-batch-btn" data-id="${batch.id}" data-batch-id="${batch.batchId}" style="border-color: #ef4444; color: #ef4444; padding: 0.25rem 0.75rem;">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');

    // Checkbox logic for Select All and showing Bulk Delete button
    const toggleBulkDeleteBtn = () => {
        const hasSelection = document.querySelectorAll('.batch-select:checked').length > 0;
        if (bulkDeleteBtn) {
            if (hasSelection) bulkDeleteBtn.classList.remove('hidden');
            else bulkDeleteBtn.classList.add('hidden');
        }
    };

    if (selectAllCheckbox) {
        // Remove old listeners to prevent stacking
        const newSelectAll = selectAllCheckbox.cloneNode(true);
        selectAllCheckbox.replaceWith(newSelectAll);
        newSelectAll.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.batch-select');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            toggleBulkDeleteBtn();
        });
    }

    document.querySelectorAll('.batch-select').forEach(cb => {
        cb.addEventListener('change', toggleBulkDeleteBtn);
    });

    document.querySelectorAll('.delete-batch-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteBatch(btn.dataset.id, btn.dataset.batchId));
    });

    // Bulk Delete Action
    if (bulkDeleteBtn) {
        const newBulkBtn = bulkDeleteBtn.cloneNode(true);
        bulkDeleteBtn.replaceWith(newBulkBtn);
        newBulkBtn.addEventListener('click', async () => {
            const selectedBoxes = document.querySelectorAll('.batch-select:checked');
            if (selectedBoxes.length === 0) return;

            if (confirm(`Are you sure you want to delete ${selectedBoxes.length} batches? This will also delete ALL associated evidence photos from the cloud.`)) {
                newBulkBtn.disabled = true;
                newBulkBtn.textContent = 'Deleting...';
                
                try {
                    let totalDeletedCount = 0;
                    for (const box of selectedBoxes) {
                        const id = box.dataset.id;
                        const batchId = box.dataset.batchId;
                        
                        // Wait for each deletion rather than parallelizing completely to avoid crashing Firestore multi-reads
                        await executeBatchDeletion(id, batchId);
                        totalDeletedCount++;
                    }
                    await syncData();
                    renderBatchTable();
                    alert(`Successfully deleted ${totalDeletedCount} batches.`);
                } catch (err) {
                    console.error("Bulk Delete Error:", err);
                    alert("An error occurred during bulk deletion. Some batches may not have been deleted.");
                    // Refresh table anyway to show current state
                    await syncData();
                    renderBatchTable();
                } finally {
                    newBulkBtn.disabled = false;
                    newBulkBtn.innerHTML = '🗑️ Delete Selected';
                    if (selectAllCheckbox) selectAllCheckbox.checked = false;
                }
            }
        });
    }
}

export async function deleteSsc(id) {
    if (confirm('Are you sure you want to delete this SSC?')) {
        try {
            await deleteDoc(doc(db, "sscs", id));
            await syncData();
            renderSscTable();
            updateGlobalSscDropdown();
        } catch (err) {
            console.error("Delete SSC Error:", err);
            alert("Failed to delete SSC from cloud.");
        }
    }
}

export async function deleteBatch(id, batchIdName) {
    if (confirm(`Are you sure you want to delete Batch "${batchIdName || id}"? This will also delete ALL associated evidence photos from the cloud.`)) {
        try {
            await executeBatchDeletion(id, batchIdName || id);
            await syncData();
            renderBatchTable();
            alert(`Batch ${batchIdName || id} deleted.`);
        } catch (err) {
            console.error("Delete Batch Error:", err);
            alert("Failed to delete Batch.");
        }
    }
}

// Core function isolated for use in single and bulk deletes
export async function executeBatchDeletion(docId, batchIdName) {
    const q = query(collection(db, "assessments"), where("batchId", "==", batchIdName));
    const snapshot = await getDocs(q);
    const allPhotoUrls = [];
    const assessmentDocIds = [];

    snapshot.forEach(doc => {
        assessmentDocIds.push(doc.id);
        if (doc.data().photos) allPhotoUrls.push(...doc.data().photos);
    });

    if (allPhotoUrls.length > 0) {
        await fetch('/api/delete-photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: allPhotoUrls })
        }).catch(e => console.warn("Cloudinary delete failed/skipped", e));
    }

    await Promise.all(assessmentDocIds.map(aDocId => deleteDoc(doc(db, "assessments", aDocId))));
    await deleteDoc(doc(db, "batches", docId));
}

// Assessor Credentials Logic
export function renderAssessorCredentials() {
    const assessorFilterSsc = document.getElementById('assessor-filter-ssc');
    const assessorFilterBatch = document.getElementById('assessor-filter-batch');
    const assessorFilterDate = document.getElementById('assessor-filter-date');
    const container = document.getElementById('assessor-credentials-container');

    if (assessorFilterSsc && assessorFilterSsc.options.length === 1) {
        // Initialize date filter with today's date
        if (assessorFilterDate && !assessorFilterDate.value) {
            assessorFilterDate.value = new Date().toISOString().split('T')[0];
        }

        state.sscs.forEach(ssc => {
            const opt = document.createElement('option');
            opt.value = ssc.name;
            opt.textContent = ssc.name;
            assessorFilterSsc.appendChild(opt);
        });

        assessorFilterSsc.addEventListener('change', handleAssessorSscChange);
        assessorFilterBatch.addEventListener('change', renderAssessorCredentialsView);
        assessorFilterDate.addEventListener('change', handleAssessorDateChange);

        const printBtn = document.getElementById('print-credentials-btn');
        if (printBtn) {
            printBtn.addEventListener('click', exportAllCredentials);
        }
    }

    if (assessorFilterBatch && assessorFilterBatch.value && assessorFilterBatch.value !== "") {
        renderAssessorCredentialsView();
    } else if (container) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted);">Please select a Date or Sector Skill Council and Batch to view login credentials.</div>';
    }
}

function handleAssessorDateChange() {
    const assessorFilterSsc = document.getElementById('assessor-filter-ssc');
    const assessorFilterBatch = document.getElementById('assessor-filter-batch');
    const assessorFilterDate = document.getElementById('assessor-filter-date');

    // If date is selected, clear SSC and Batch
    if (assessorFilterDate.value) {
        if (assessorFilterSsc) assessorFilterSsc.value = "";
        if (assessorFilterBatch) {
            assessorFilterBatch.innerHTML = '<option value="">Select Batch</option>';
            assessorFilterBatch.disabled = true;
        }
    }
    renderAssessorCredentialsView();
}

function exportAllCredentials() {
    const ssc = document.getElementById('assessor-filter-ssc').value;
    const batchId = document.getElementById('assessor-filter-batch').value;
    const selectedDate = document.getElementById('assessor-filter-date').value;

    if (!ssc && !selectedDate) {
        alert("Please select a Date or Sector Skill Council (SSC) first.");
        return;
    }

    let batchesToPrint = [];
    let title = "Assessor Credentials";

    if (selectedDate) {
        batchesToPrint = state.batches.filter(b => b.day === selectedDate);
        title += ` - ${selectedDate}`;
    } else if (batchId) {
        batchesToPrint = state.batches.filter(b => b.batchId === batchId);
        title += ` - Batch ${batchId}`;
    } else if (ssc) {
        batchesToPrint = state.batches.filter(b => b.ssc === ssc);
        title += ` - ${ssc}`;
    }

    if (batchesToPrint.length === 0) {
        alert("No batches found to export.");
        return;
    }

    const csvHeaders = ["Batch ID", "SSC", "Job Role (Username)", "Batch ID (Password)"];
    const csvRows = batchesToPrint.map(b => `"${b.batchId}","${b.ssc}","${b.jobRole}","${b.batchId}"`);
    const csvContent = [csvHeaders.join(","), ...csvRows].join("\\n");

    let printHtml = `
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: 'Outfit', sans-serif; padding: 20px; }
                .credential-card { 
                    border: 2px solid #333; 
                    padding: 15px; 
                    margin-bottom: 25px; 
                    page-break-inside: avoid;
                    border-radius: 8px;
                    background: #fff;
                }
                .title { font-size: 1.4rem; font-weight: bold; margin-bottom: 5px; color: #1e40af; }
                .ssc-tag { font-size: 0.9rem; color: #666; margin-bottom: 15px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                .field { margin: 8px 0; }
                .label { font-weight: bold; color: #444; font-size: 0.85rem; display: block; }
                .value { font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; display: block; margin-top: 4px; border: 1px solid #ddd; font-size: 1.2rem; }
                @media print {
                    .no-print { display: none; }
                }
                .btn { padding: 12px 24px; color: white; border: none; border-radius: 6px; cursor: pointer; font-family: sans-serif; font-weight: bold; margin-right: 10px; }
                .btn-print { background: #3b82f6; }
                .btn-download { background: #10b981; }
            </style>
        </head>
        <body>
            <div class="no-print" style="margin-bottom: 20px; display: flex;">
                <button onclick="window.print()" class="btn btn-print">Print Credentials List</button>
                <button id="download-csv-btn" class="btn btn-download">Download CSV (Excel)</button>
            </div>
            <h1 style="border-bottom: 2px solid #333; padding-bottom: 10px;">${title}</h1>
    `;

    batchesToPrint.forEach(b => {
        // Generate QR Code data
        const qrContent = JSON.stringify({ u: b.jobRole, p: b.batchId });
        const qr = new QRious({
            value: qrContent,
            size: 150,
            level: 'M'
        });
        const qrDataUrl = qr.toDataURL();

        printHtml += `
            <div class="credential-card" style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <div class="title">Batch: ${b.batchId}</div>
                    <div class="ssc-tag">Council: ${b.ssc}</div>
                    <div class="field"><span class="label">Username (Job Role)</span> <span class="value">${b.jobRole}</span></div>
                    <div class="field"><span class="label">Password (Batch ID)</span> <span class="value">${b.batchId}</span></div>
                </div>
                <div style="margin-left: 20px; text-align: center;">
                    <img src="${qrDataUrl}" style="width: 120px; height: 120px; border: 1px solid #eee; padding: 5px; border-radius: 4px;">
                    <div style="font-size: 0.7rem; color: #666; margin-top: 5px; font-weight: bold;">Scan for Instant Login</div>
                </div>
            </div>
        `;
    });

    const fileName = title.replace(/\\s+/g, '_') + ".csv";
    printHtml += `
        <script>
            document.getElementById('download-csv-btn').onclick = () => {
                const csvData = \`${csvContent}\`;
                const blob = new Blob([csvData], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.setAttribute('hidden', '');
                a.setAttribute('href', url);
                a.setAttribute('download', '${fileName}');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
        </script>
    </body></html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml);
    printWindow.document.close();
}

export function handleAssessorSscChange() {
    const assessorFilterSsc = document.getElementById('assessor-filter-ssc');
    const assessorFilterBatch = document.getElementById('assessor-filter-batch');
    const assessorFilterDate = document.getElementById('assessor-filter-date');
    const assessorFilterSector = document.getElementById('assessor-filter-sector');
    const selectedSsc = assessorFilterSsc.value;

    // If SSC is selected, clear Date filter
    if (selectedSsc && assessorFilterDate) {
        assessorFilterDate.value = "";
    }

    const sscObj = state.sscs.find(s => s.name === selectedSsc);
    const sectors = sscObj?.sectors || [];
    
    assessorFilterSector.innerHTML = '<option value="">Select Sector</option>';
    sectors.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        assessorFilterSector.appendChild(opt);
    });
    assessorFilterSector.disabled = sectors.length === 0;

    assessorFilterSector.onchange = () => {
        assessorFilterBatch.innerHTML = '<option value="">Select Batch</option>';
        const filteredBatches = state.batches.filter(b => b.ssc === selectedSsc && (!assessorFilterSector.value || b.sector === assessorFilterSector.value));
        if (filteredBatches.length > 0) {
            assessorFilterBatch.disabled = false;
            filteredBatches.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.batchId; opt.textContent = b.batchId;
                assessorFilterBatch.appendChild(opt);
            });
        } else {
            assessorFilterBatch.disabled = true;
        }
        renderAssessorCredentialsView();
    };

    assessorFilterBatch.innerHTML = '<option value="">Select Batch</option>';
    assessorFilterBatch.disabled = true;

    if (!selectedSsc) {
        renderAssessorCredentialsView();
        return;
    }

    const filteredBatches = state.batches.filter(b => b.ssc === selectedSsc);
    if (filteredBatches.length > 0 && sectors.length === 0) {
        assessorFilterBatch.disabled = false;
        filteredBatches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.batchId; opt.textContent = b.batchId;
            assessorFilterBatch.appendChild(opt);
        });
    }

    renderAssessorCredentialsView();
}

function renderAssessorCredentialsView() {
    const assessorFilterSsc = document.getElementById('assessor-filter-ssc');
    const assessorFilterSector = document.getElementById('assessor-filter-sector');
    const assessorFilterBatch = document.getElementById('assessor-filter-batch');
    const assessorFilterDate = document.getElementById('assessor-filter-date');
    const credentialsContainer = document.getElementById('assessor-credentials-container');
    const printBtn = document.getElementById('print-credentials-btn');

    const selectedSsc = assessorFilterSsc ? assessorFilterSsc.value : "";
    const selectedSector = assessorFilterSector ? assessorFilterSector.value : "";
    const selectedBatchId = assessorFilterBatch ? assessorFilterBatch.value : "";
    const selectedDate = assessorFilterDate ? assessorFilterDate.value : "";

    let batchesToDisplay = [];
    let filterSource = "";

    if (selectedDate) {
        // Mode 1: Date based (Show all batches for that day across all SSCs)
        batchesToDisplay = state.batches.filter(b => b.day === selectedDate);
        filterSource = `all batches on ${selectedDate}`;
    } else if (selectedSsc) {
        // Mode 2: SSC selected
        if (selectedBatchId && selectedBatchId !== "") {
            // Specific Batch chosen
            batchesToDisplay = state.batches.filter(b => b.batchId === selectedBatchId);
            filterSource = `batch ${selectedBatchId}`;
        } else {
            // No Batch chosen yet - Clear view!
            if (credentialsContainer) {
                credentialsContainer.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted);">
                        <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">SSC: ${selectedSsc} Selected</div>
                        <div>Please select a specific Batch to view login credentials.</div>
                    </div>
                `;
            }
            if (printBtn) printBtn.style.display = 'inline-block'; // Keep print button for bulk SSC export
            return;
        }
    }

    if (!selectedSsc && !selectedDate) {
        if (credentialsContainer) credentialsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted);">Please select a Date or Sector Skill Council.</div>';
        if (printBtn) printBtn.style.display = 'none';
        return;
    }

    if (batchesToDisplay.length === 0) {
        if (credentialsContainer) credentialsContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted);">No batches found for ${filterSource}.</div>`;
        if (printBtn) printBtn.style.display = 'none';
        return;
    }

    if (printBtn) printBtn.style.display = 'inline-block';

    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; width: 100%;">`;

    batchesToDisplay.forEach(batch => {
        // Generate QR Code for the card
        const qrContent = JSON.stringify({ u: batch.jobRole, p: batch.batchId });
        const qr = new QRious({
            value: qrContent,
            size: 200,
            level: 'M'
        });
        const qrDataUrl = qr.toDataURL();

        html += `
            <div class="glass-panel" style="background: rgba(255, 255, 255, 0.05); padding: 2rem; border-radius: 12px; border: 1px solid var(--glass-border); display: flex; flex-direction: column; align-items: center;">
                <h3 style="margin-bottom: 1rem; text-align: center; color: var(--primary-color);">Login Credentials</h3>
                
                <div style="margin-bottom: 1.5rem; text-align: center;">
                    <img src="${qrDataUrl}" style="width: 140px; height: 140px; background: white; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="margin-top: 0.5rem;">
                        <button onclick="downloadSingleQR('${qrDataUrl}', '${batch.batchId}')" 
                                style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); padding: 5px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s;"
                                onmouseover="this.style.background='rgba(16, 185, 129, 0.2)'"
                                onmouseout="this.style.background='rgba(16, 185, 129, 0.1)'">
                            Download QR (.png)
                        </button>
                    </div>
                </div>

                <div style="width: 100%;">
                    <div style="margin-bottom: 0.5rem; text-align: center; font-size: 0.9rem; color: #10b981; font-weight: bold;">Batch: ${batch.batchId}</div>
                    <div style="margin-bottom: 0.2rem; text-align: center; font-size: 0.8rem; color: var(--text-muted);">SSC: ${batch.ssc}</div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Username (Job Role)</label>
                        <div style="background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 1.1rem; user-select: all;">${batch.jobRole}</div>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Password (Batch ID)</label>
                        <div style="background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 1.1rem; user-select: all;">${batch.batchId}</div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    if (credentialsContainer) credentialsContainer.innerHTML = html;
}

// Evidence Logic
export function renderAdminEvidence() {
    const countDisplay = document.getElementById('evidence-count');
    const filterSsc = document.getElementById('evidence-filter-ssc');
    const filterBatch = document.getElementById('evidence-filter-batch');
    const container = document.getElementById('evidence-grid');

    if (filterSsc && filterSsc.options.length === 1) {
        state.sscs.forEach(ssc => {
            const opt = document.createElement('option');
            opt.value = ssc.name;
            opt.textContent = ssc.name;
            filterSsc.appendChild(opt);
        });

        filterSsc.onchange = handleSscChange;
        filterBatch.onchange = renderEvidenceGrid;
    }

    if (filterBatch.value && filterBatch.value !== "") {
        renderEvidenceGrid();
    } else {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Please select a Sector Skill Council and Batch to view evidence.</div>';
        if (countDisplay) countDisplay.textContent = '0';
    }
}

function handleSscChange() {
    const selectedSsc = document.getElementById('evidence-filter-ssc').value;
    const filterSector = document.getElementById('evidence-filter-sector');
    const filterBatch = document.getElementById('evidence-filter-batch');
    const container = document.getElementById('evidence-grid');
    const countDisplay = document.getElementById('evidence-count');

    const sscObj = state.sscs.find(s => s.name === selectedSsc);
    const sectors = sscObj?.sectors || [];
    
    filterSector.innerHTML = '<option value="">Select Sector</option>';
    sectors.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        filterSector.appendChild(opt);
    });
    filterSector.disabled = sectors.length === 0;
    
    filterSector.onchange = () => {
        filterBatch.innerHTML = '<option value="">Select Batch</option>';
        const filteredBatches = state.batches.filter(b => b.ssc === selectedSsc && (!filterSector.value || b.sector === filterSector.value));
        if (filteredBatches.length > 0) {
            filterBatch.disabled = false;
            filteredBatches.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.batchId; opt.textContent = b.batchId;
                filterBatch.appendChild(opt);
            });
        } else {
            filterBatch.disabled = true;
        }
        renderEvidenceGrid();
    };

    filterBatch.innerHTML = '<option value="">Select Batch</option>';
    filterBatch.disabled = true;
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Please select a Batch.</div>';
    if (countDisplay) countDisplay.textContent = '0';

    if (!selectedSsc) return;

    const filteredBatches = state.batches.filter(b => b.ssc === selectedSsc);
    if (filteredBatches.length > 0 && sectors.length === 0) {
        filterBatch.disabled = false;
        filteredBatches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.batchId; opt.textContent = b.batchId;
            filterBatch.appendChild(opt);
        });
    }
}

async function renderEvidenceGrid() {
    const container = document.getElementById('evidence-grid');
    const countDisplay = document.getElementById('evidence-count');
    const selectedBatch = document.getElementById('evidence-filter-batch').value;

    if (!selectedBatch) return;

    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading evidence...</div>';

    const evidence = [];
    try {
        const q = query(collection(db, "assessments"), where("batchId", "==", selectedBatch));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            evidence.push({ id: doc.id, ...doc.data() });
        });
    } catch (err) {
        console.error("Error fetching evidence:", err);
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Error loading evidence.</div>';
        return;
    }

    evidence.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (countDisplay) countDisplay.textContent = evidence.length;

    if (evidence.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No evidence submitted for this batch yet.</div>';
        return;
    }

    container.innerHTML = evidence.map(item => `
        <div class="glass-panel" style="padding: 1.5rem; background: rgba(255,255,255,0.03);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <span class="badge ${item.type === 'Theory' ? 'safe' : item.type === 'Practical' ? 'warning' : 'pending'}" style="margin-bottom: 0.5rem; display: inline-block;">${item.type}</span>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
                    <button class="delete-evidence-btn" data-id="${item.id}" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; cursor: pointer; margin-bottom: 0.25rem;">Delete</button>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(item.timestamp).toLocaleDateString()}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(item.timestamp).toLocaleTimeString()}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 0.5rem;">
                ${item.photos.map(url => {
        const isPdf = url.includes('.pdf') || url.startsWith('data:application/pdf');
        if (isPdf) {
            return `
                            <div class="evidence-thumb pdf-thumb" data-url="${url}" style="width: 100%; height: 120px; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); color: #ef4444;">
                                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                <span style="font-size: 10px; margin-top: 4px; font-weight: bold;">PDF</span>
                            </div>
                        `;
        }
        return `<img src="${url}" class="evidence-thumb" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;">`;
    }).join('')}
            </div>
        </div>
    `).join('');

    // Attach listeners
    container.querySelectorAll('.delete-evidence-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteEvidence(btn.dataset.id));
    });
    container.querySelectorAll('.evidence-thumb').forEach(el => {
        el.addEventListener('click', () => {
            if (el.classList.contains('pdf-thumb')) {
                window.open(el.dataset.url, '_blank');
            } else {
                openLightbox(el.src);
            }
        });
    });
}

export async function deleteEvidence(id) {
    if (confirm('Are you sure you want to delete this evidence?')) {
        try {
            const docRef = doc(db, "assessments", id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists() && docSnap.data().photos) {
                const photos = docSnap.data().photos;
                await fetch('/api/delete-photos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urls: photos })
                }).catch(e => console.warn("Cloudinary delete failed/skipped", e));
            }

            await deleteDoc(docRef);
            await renderEvidenceGrid();
        } catch (err) {
            console.error("Delete Evidence Error:", err);
            alert("Failed to delete evidence.");
        }

    }
}

// Initialization
export function initAdminListeners() {
    // Global SSC Batch Filter
    const globalBatchSscSelect = document.getElementById('global-batch-ssc');
    const globalBatchSectorSelect = document.getElementById('global-batch-sector');
    if (globalBatchSscSelect) {
        // Handled in updateGlobalSscDropdown for onchange
    }

    // Modal Show/Hide Listeners
    document.getElementById('add-ssc-btn')?.addEventListener('click', () => {
        document.getElementById('add-ssc-modal').classList.remove('hidden');
    });
    document.getElementById('cancel-ssc-btn')?.addEventListener('click', () => {
        document.getElementById('add-ssc-modal').classList.add('hidden');
    });

    document.getElementById('add-batch-btn')?.addEventListener('click', () => {
        const globalSector = document.getElementById('global-batch-sector')?.value;
        const modalSector = document.getElementById('batch-sector');
        if (globalSector && modalSector) {
            modalSector.value = globalSector;
        }
        document.getElementById('add-batch-modal').classList.remove('hidden');
    });
    document.getElementById('cancel-batch-btn')?.addEventListener('click', () => {
        document.getElementById('add-batch-modal').classList.add('hidden');
    });

    // Add Sector Listener (Simple Prompt)
    document.getElementById('add-sector-tab-btn')?.addEventListener('click', async () => {
        const sscName = document.getElementById('sector-management-ssc').value;
        if (!sscName) return;

        const sectorName = prompt("Enter Sector Name:");
        if (sectorName && sectorName.trim()) {
            const sscObj = state.sscs.find(s => s.name === sscName);
            if (sscObj) {
                const updatedSectors = [...(sscObj.sectors || []), sectorName.trim()];
                const { updateDoc } = await import('../firebase-config.js');
                await updateDoc(doc(db, "sscs", sscObj.id), { sectors: updatedSectors });
                
                await syncData();
                renderSectorsManagementTable();
                updateGlobalSscDropdown();
            }
        }
    });

    // Add SSC Form
    const sscForm = document.getElementById('add-ssc-form');
    if (sscForm) {
        sscForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const sscName = document.getElementById('ssc-name').value.trim();
            const sscCode = document.getElementById('ssc-code').value.trim();
            
            if (sscName && sscCode) {
                await addDoc(collection(db, "sscs"), { 
                    name: sscName, 
                    code: sscCode, 
                    sectors: [], // New flow: sectors added separately
                    createdAt: new Date().toISOString() 
                });
                await syncData();
                renderSscTable();
                updateGlobalSscDropdown();
                document.getElementById('add-ssc-modal').classList.add('hidden');
                e.target.reset();
            }
        });
    }

    // Add Batch Form
    const batchForm = document.getElementById('create-batch-form');
    if (batchForm) {
        batchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ssc = document.getElementById('global-batch-ssc').value;
            const sector = document.getElementById('batch-sector').value;
            const sr = document.getElementById('batch-sr').value;
            const dateVal = document.getElementById('batch-day').value;
            const monthVal = document.getElementById('batch-month').value;
            const jobRole = document.getElementById('batch-job-role').value.trim();
            const batchId = document.getElementById('batch-id').value.trim();
            const skillHub = document.getElementById('batch-skill-hub').value.trim();

            if (ssc && batchId && jobRole && dateVal) {
                // Calculate next SR for this SSC if not provided or to ensure sequence
                const filteredBatches = state.batches.filter(b => b.ssc === ssc);
                const nextSr = filteredBatches.reduce((max, b) => Math.max(max, parseInt(b.sr) || 0), 0) + 1;

                const batchData = {
                    sr: sr || String(nextSr),
                    ssc,
                    sector,
                    batchId,
                    jobRole,
                    skillHub,
                    day: dateVal,
                    month: monthVal,
                    timestamp: new Date().toISOString()
                };

                await addDoc(collection(db, "batches"), batchData);
                await syncData();
                renderBatchTable();
                document.getElementById('add-batch-modal').classList.add('hidden');

                // Show success modal (if exists in HTML)
                const successModal = document.getElementById('batch-success-modal');
                if (successModal) {
                    document.getElementById('new-batch-username').textContent = batchId;
                    successModal.classList.remove('hidden');
                    document.getElementById('close-modal-btn').onclick = () => successModal.classList.add('hidden');
                }

                e.target.reset();
            }
        });
    }

    // Bulk Import & Sample Template Listeners
    const bulkImportBtn = document.getElementById('bulk-import-btn');
    const bulkUploadInput = document.getElementById('bulk-batch-upload');
    const downloadSampleBtn = document.getElementById('download-sample-btn');

    if (bulkImportBtn && bulkUploadInput) {
        bulkImportBtn.addEventListener('click', () => {
            const selectedSsc = document.getElementById('global-batch-ssc').value;
            if (!selectedSsc) {
                alert('Please select a Sector Skill Council first.');
                return;
            }
            bulkUploadInput.click();
        });

        bulkUploadInput.addEventListener('change', handleBulkBatchImport);
    }

    if (downloadSampleBtn) {
        downloadSampleBtn.addEventListener('click', downloadSampleTemplate);
    }

    // Select All Batches Logic
    document.getElementById('select-all-batches')?.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.batch-select');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });

    // Bulk Download PDF Btn
    document.getElementById('bulk-download-pdf-btn')?.addEventListener('click', generateBulkPDFZip);

    // Bulk Download Evidence Btn
    document.getElementById('bulk-download-evidence-btn')?.addEventListener('click', () => generateBulkEvidenceZip());
}

async function generateBulkPDFZip() {
    const selectedCheckboxes = document.querySelectorAll('.batch-select:checked');
    if (selectedCheckboxes.length === 0) {
        alert('Please select at least one batch to download.');
        return;
    }

    const confirmDownload = confirm(`This will generate and download ${selectedCheckboxes.length} PDFs. It may take a moment. Continue?`);
    if (!confirmDownload) return;

    const btn = document.getElementById('bulk-download-pdf-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating ZIP...';

    const zip = new JSZip();
    const folder = zip.folder("Batch_PDFs");

    try {
        for (let i = 0; i < selectedCheckboxes.length; i++) {
            const batchId = selectedCheckboxes[i].dataset.id;
            const batch = state.batches.find(b => b.batchId === batchId);
            if (!batch) continue;

            btn.textContent = `Processing ${i + 1}/${selectedCheckboxes.length}...`;

            // Get attendance photos for this batch
            const attendancePhotos = [];
            const q = query(collection(db, "assessments"),
                where("batchId", "==", batchId),
                where("type", "==", "Attendance")
            );
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.photos) attendancePhotos.push(...data.photos);
            });

            if (attendancePhotos.length === 0) continue;

            // Generate PDF Blob
            const element = document.createElement('div');
            element.style.padding = '40px';
            element.style.background = 'white';
            element.innerHTML = `
                <div style="font-family: Arial; color: black;">
                    <h1 style="text-align: center;">Attendance Report</h1>
                    <p><b>Batch ID:</b> ${batch.batchId}</p>
                    <p><b>SSC:</b> ${batch.ssc}</p>
                    <p><b>Job Role:</b> ${batch.jobRole}</p>
                    <hr>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
                        ${attendancePhotos.map(url => `
                            <img src="${url}" style="width: 100%; max-width: 800px; margin-bottom: 20px;">
                        `).join('')}
                    </div>
                </div>
            `;

            const opt = {
                margin: 0,
                filename: `Attendance_${batchId}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 1.5, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
            folder.file(`Attendance_${batchId}.pdf`, pdfBlob);
        }

        btn.textContent = 'Finalizing ZIP...';
        const content = await zip.generateAsync({ type: "blob" });
        const zipName = `Batches_Reports_${new Date().getTime()}.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = zipName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert('Bulk download complete!');
    } catch (err) {
        console.error("Bulk Zip Error:", err);
        alert('An error occurred during bulk generation.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Word Generator Logic
export function renderWordGenerator() {
    const wordFilterSsc = document.getElementById('word-filter-ssc');
    const wordFilterSector = document.getElementById('word-filter-sector');
    const wordTableBody = document.getElementById('word-batch-table-body');
    const bulkWordBtn = document.getElementById('bulk-word-zip-btn');
    const bulkPdfBtn = document.getElementById('bulk-pdf-zip-btn');
    const bulkAttendanceBtn = document.getElementById('bulk-attendance-zip-btn');

    // 1. Initialize SSC Dropdown (only once)
    if (wordFilterSsc && wordFilterSsc.options.length === 1) {
        state.sscs.forEach(ssc => {
            const opt = document.createElement('option');
            opt.value = ssc.name;
            opt.textContent = ssc.name;
            wordFilterSsc.appendChild(opt);
        });

        // 2. SSC Change Logic
        wordFilterSsc.onchange = () => {
            const selectedSsc = wordFilterSsc.value;
            
            // Clear & Disable Sector downstream
            wordFilterSector.innerHTML = '<option value="">Select Sector</option>';
            wordFilterSector.disabled = true;

            // Hide table contents
            wordTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">Select a Sector Skill Council and Sector to view reports.</td></tr>`;
            toggleBulkButtons();

            if (!selectedSsc) return;

            // Populate Sectors
            const sscObj = state.sscs.find(s => s.name === selectedSsc);
            const sectors = sscObj?.sectors || [];
            if (sectors.length > 0) {
                sectors.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s; opt.textContent = s;
                    wordFilterSector.appendChild(opt);
                });
                wordFilterSector.disabled = false;
            } else {
                // If SSC has no sectors, try rendering all batches for SSC
                renderTableForSelection(selectedSsc, null);
            }
        };

        // 3. Sector Change Logic (Render table for ALL batches in this sector)
        wordFilterSector.onchange = () => {
            const selectedSsc = wordFilterSsc.value;
            const selectedSector = wordFilterSector.value;
            renderTableForSelection(selectedSsc, selectedSector);
        };

        const renderTableForSelection = async (ssc, sector) => {
            // Hide bulk buttons while loading
            bulkWordBtn.classList.add('hidden');
            bulkPdfBtn.classList.add('hidden');
            bulkAttendanceBtn.classList.add('hidden');

            if (!ssc) {
                wordTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">Select an SSC and Sector to generate reports.</td></tr>`;
                return;
            }

            wordTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--primary-color); padding: 3rem;">Loading batch data...</td></tr>`;

            // Filter Batches for this SSC & Sector
            let filteredBatches = state.batches.filter(b => b.ssc === ssc);
            if (sector) {
                filteredBatches = filteredBatches.filter(b => b.sector === sector);
            }
            filteredBatches.sort((a, b) => (parseInt(a.sr) || 0) - (parseInt(b.sr) || 0));

            if (filteredBatches.length === 0) {
                wordTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">No batches found.</td></tr>`;
                return;
            }

            // Fetch summary of assessments for these batches to show "Status"
            const statusMap = {}; // { batchId: { photos: 0, hasAttend: false } }
            
            try {
                // Firestore "in" limit is 30. Handle chunks.
                const batchIds = filteredBatches.map(b => b.batchId);
                const chunks = [];
                for (let i = 0; i < batchIds.length; i += 30) {
                    chunks.push(batchIds.slice(i, i + 30));
                }

                const queryPromises = chunks.map(chunk => 
                    getDocs(query(collection(db, "assessments"), where("batchId", "in", chunk)))
                );
                
                const snapshots = await Promise.all(queryPromises);
                snapshots.forEach(snap => {
                    snap.forEach(doc => {
                        const data = doc.data();
                        if (data.batchId) {
                            if (!statusMap[data.batchId]) statusMap[data.batchId] = { photos: 0, hasAttend: false };
                            if (data.type === 'Attendance') {
                                statusMap[data.batchId].hasAttend = true;
                            } else {
                                const count = (data.photos ? data.photos.length : 0);
                                statusMap[data.batchId].photos += count;
                            }
                        }
                    });
                });
            } catch (err) { console.error("Error fetching status:", err); }

            wordTableBody.innerHTML = filteredBatches.map(batch => {
                const stats = statusMap[batch.batchId] || { photos: 0, hasAttend: false };
                const hasEnoughPhotos = stats.photos >= 6;
                const hasAttend = stats.hasAttend;

                let color = '#ffffff'; // Default
                let statusText = 'Pending';
                let icon = '⚪';
                let statusType = 'pending';

                if (hasEnoughPhotos && hasAttend) {
                    color = '#22c55e'; // Green
                    statusText = `Ready (${stats.photos} Ph + Attend)`;
                    icon = '🟢';
                    statusType = 'ready';
                } else if (hasEnoughPhotos) {
                    color = '#facc15'; // Yellow
                    statusText = `Photos Only (${stats.photos})`;
                    icon = '🟡';
                    statusType = 'photos';
                } else if (hasAttend) {
                    color = '#ef4444'; // Red
                    statusText = 'Attendance Only';
                    icon = '🔴';
                    statusType = 'attend';
                }

                const cellStyle = color !== '#ffffff' ? `color: ${color} !important; font-weight: 600;` : ''; 
                const statusHtml = `<span style="color: ${color}; font-size: 11px;">${icon} ${statusText}</span>`;

                return `
                    <tr style="${cellStyle}">
                        <td><input type="checkbox" class="word-batch-select" data-id="${batch.batchId}" data-status-type="${statusType}"></td>
                        <td style="${cellStyle}">${batch.batchId}</td>
                        <td style="${cellStyle}; color: #10b981; font-weight: 500;">${batch.sector || 'N/A'}</td>
                        <td style="${cellStyle}">${batch.jobRole}</td>
                        <td style="${cellStyle}">${batch.skillHub || 'N/A'}</td>
                        <td style="${cellStyle}">${statusHtml}</td>
                        <td>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                <button class="action-btn" onclick="generateWordDoc(false, '${batch.batchId}')" style="background: #2563eb; padding: 4px 12px; font-size: 12px; color: white;">Word</button>
                                <button class="action-btn" onclick="generateWordDoc(true, '${batch.batchId}')" style="background: #e11d48; padding: 4px 12px; font-size: 12px; color: white;">PDF</button>
                                <button class="action-btn" onclick="generateAttendanceReportForBatch('${batch.batchId}')" style="background: #9333ea; padding: 4px 12px; font-size: 12px; color: white;">Attend</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Listen for individual changes
            wordTableBody.querySelectorAll('.word-batch-select').forEach(cb => {
                cb.addEventListener('change', toggleBulkButtons);
            });
            toggleBulkButtons();
        };

        // Bulk Buttons & Quick Select Logic

        const toggleBulkButtons = () => {
            const hasSelection = document.querySelectorAll('.word-batch-select:checked').length > 0;
            if (hasSelection) {
                bulkWordBtn.classList.remove('hidden');
                bulkPdfBtn.classList.remove('hidden');
                bulkAttendanceBtn.classList.remove('hidden');
            } else {
                bulkWordBtn.classList.add('hidden');
                bulkPdfBtn.classList.add('hidden');
                bulkAttendanceBtn.classList.add('hidden');
            }
        };

        const selectByStatus = (type) => {
            const cbxs = document.querySelectorAll('.word-batch-select');
            cbxs.forEach(cb => {
                cb.checked = (cb.dataset.statusType === type);
            });
            toggleBulkButtons();
        };

        document.getElementById('sel-green-btn')?.addEventListener('click', () => selectByStatus('ready'));
        document.getElementById('sel-yellow-btn')?.addEventListener('click', () => selectByStatus('photos'));
        document.getElementById('sel-red-btn')?.addEventListener('click', () => selectByStatus('attend'));
        document.getElementById('sel-clear-btn')?.addEventListener('click', () => {
            document.querySelectorAll('.word-batch-select').forEach(cb => cb.checked = false);
            const selectAll = document.getElementById('select-all-word-batches');
            if (selectAll) selectAll.checked = false;
            toggleBulkButtons();
        });

        // Select All Handler
        document.getElementById('select-all-word-batches')?.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.word-batch-select');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            toggleBulkButtons();
        });

        // Bulk Actions
        bulkWordBtn?.addEventListener('click', () => generateBulkGenericZip('word'));
        bulkPdfBtn?.addEventListener('click', () => generateBulkGenericZip('pdf'));
        bulkAttendanceBtn?.addEventListener('click', () => generateBulkGenericZip('attendance'));
    }
}

// Global hook for single attendance
window.generateAttendanceReportForBatch = (batchId) => {
    // We need to set the value so generateAttendanceReport works, or refactor generateAttendanceReport
    const oldVal = document.getElementById('word-filter-batch')?.value;
    const mockSelect = document.createElement('select');
    mockSelect.id = 'word-filter-batch';
    mockSelect.value = batchId;
    // Actually, let's just refactor generateAttendanceReport slightly to accept ID
    generateAttendanceReport(batchId);
};

async function generateBulkGenericZip(type) {
    const selected = document.querySelectorAll('.word-batch-select:checked');
    if (selected.length === 0) { alert('Select at least one batch.'); return; }

    const btn = document.getElementById(`bulk-${type}-zip-btn`);
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating...';

    const zip = new JSZip();
    try {
        for (let i = 0; i < selected.length; i++) {
            const bId = selected[i].dataset.id;
            btn.textContent = `${type} ${i + 1}/${selected.length}...`;

            let blob;
            let ext;
            if (type === 'word') {
                blob = await generateWordDoc(false, bId, true);
                ext = 'doc';
            } else if (type === 'pdf') {
                blob = await generateWordDoc(true, bId, true);
                ext = 'pdf';
            } else if (type === 'attendance') {
                blob = await generateAttendanceReport(bId, true);
                ext = 'pdf';
            }

            if (blob) zip.file(`${type}_Report_${bId}.${ext}`, blob);
        }
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Bulk_${type}_Reports_${Date.now()}.zip`;
        link.click();
    } catch (e) {
        console.error(e);
        alert('Error during bulk generation.');
    }
    btn.disabled = false;
    btn.textContent = originalText;
}

// Attendance Download Logic
export async function generateAttendanceReport(targetBatchId = null, isBulk = false) {
    const selectedBatchId = targetBatchId || document.getElementById('word-filter-batch')?.value;
    if (!selectedBatchId) return;

    const batch = state.batches.find(b => b.batchId === selectedBatchId);
    if (!batch) return;

    console.log('Generating Attendance Report...');
    const attendanceItems = [];

    try {
        const q = query(collection(db, "assessments"),
            where("batchId", "==", selectedBatchId),
            where("type", "==", "Attendance")
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.photos) attendanceItems.push(...data.photos);
        });
    } catch (err) {
        console.error("Error fetching attendance:", err);
        alert("Error fetching attendance data.");
        return;
    }

    if (attendanceItems.length === 0) {
        alert('No attendance records found for this batch!');
        return;
    }

    // Create PDF logic for attendance
    const element = document.createElement('div');
    element.style.padding = '40px';
    element.style.background = 'white';
    element.innerHTML = `
        <div id="attendance-content" style="width: 100%; height: 100%;">
            ${attendanceItems.map((url, idx) => {
        const isPdf = url.includes('.pdf') || url.startsWith('data:application/pdf') || url.includes('/raw/upload/');
        const pageBreak = idx > 0 ? 'page-break-before: always;' : '';

        if (isPdf) {
            return `<div style="${pageBreak} padding: 40px; border: 2px dashed #cbd5e1; margin-top: 20px; text-align: center; border-radius: 12px; background: #f8fafc;">
                            <div style="font-size: 48px; margin-bottom: 10px;">📄</div>
                            <p style="font-size: 18px; font-weight: bold; color: #1e293b;">Attendance File ${idx + 1} (PDF)</p>
                            <div style="display: flex; gap: 10px; justify-content: center;">
                                <a href="${url}" target="_blank" style="display: inline-block; padding: 10px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Original PDF</a>
                            </div>
                        </div>`;
        }
        return `<div style="${pageBreak} position: relative; width: 100%; height: 11.2in; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <img src="${url}" style="width: 100%; height: 100%; object-fit: fill;">
                    </div>`;
    }).join('')}
        </div>
    `;

    const opt = {
        margin: 0,
        filename: `Attendance_${batch.batchId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 1.5, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    if (isBulk) {
        return await html2pdf().set(opt).from(element).output('blob');
    } else {
        html2pdf().set(opt).from(element).save();
    }
}

export async function generateWordDoc(isPdf = false, targetBatchId = null, isBulk = false) {
    const selectedBatchId = targetBatchId || document.getElementById('word-filter-batch').value;
    if (!selectedBatchId) return null;

    const batch = state.batches.find(b => b.batchId === selectedBatchId);
    if (!batch) { if (!isBulk) alert('Batch data not found.'); return null; }

    const photoGroups = { 'Theory': [], 'Practical': [], 'Viva': [], 'Group': [] };

    try {
        const q = query(collection(db, "assessments"), where("batchId", "==", selectedBatchId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.photos && Array.isArray(data.photos)) {
                const type = data.type || 'Unknown';
                if (photoGroups[type]) photoGroups[type].push(...data.photos);
            }
        });
    } catch (err) {
        console.error("Error fetching photos:", err);
        return null;
    }

    const orderedPhotos = [
        ...photoGroups['Theory'],
        ...photoGroups['Practical'],
        ...photoGroups['Viva'],
        ...photoGroups['Group']
    ];

    if (orderedPhotos.length === 0) {
        if (!isBulk) alert('No photos found for this batch!');
        return null;
    }

    // Chunk photos by 6 for multi-page
    const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const photoChunks = chunk(orderedPhotos, 6);

    let htmlPagesForWord = '';
    let htmlPagesForPdf = '';

    photoChunks.forEach((batchChunk, index) => {
        const pageBreakWord = index > 0 ? '<br clear=all style="mso-special-character:line-break;page-break-before:always">' : '';
        const pageBreakPdf = index > 0 ? 'page-break-before: always;' : '';

        // Word HTML
        htmlPagesForWord += `
            ${pageBreakWord}
            <div class="Section1">
                <table class="main-table" width="100%" height="9.8in" cellspacing="0" cellpadding="0" style="height: 9.8in; border-collapse: collapse;">
                    <tr>
                        <td height="9.8in" style="border: 6pt solid black; padding: 2pt; vertical-align: top; text-align: center;">
                            <div style="text-align: center; font-weight: bold; font-size: 14pt; color: black;">
                                <p style="margin: 0;">Name of the Skill Hub: ${batch.skillHub || 'NAC-Bhimavaram'}</p>
                                <p style="margin: 0;">Batch ID: ${batch.batchId}</p>
                                <p style="margin: 0;">Job Role: ${batch.jobRole}</p>
                            </div>
                            <table width="100%" cellspacing="2" cellpadding="0" style="margin: 0 auto; table-layout: fixed;">
                                ${generateGridRows(batchChunk)}
                            </table>
                        </td>
                    </tr>
                </table>
            </div>
        `;

        // PDF HTML
        htmlPagesForPdf += `
            <div style="${pageBreakPdf} width: 8in; padding: 0.1in; background: white;">
                <div style="border: 7.5pt solid black; min-height: 10in; padding: 10pt;">
                    <div style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 10pt; color: black;">
                         <p style="margin: 0;">Name of the Skill Hub: ${batch.skillHub || 'NAC-Bhimavaram'}</p>
                         <p style="margin: 0;">Batch ID: ${batch.batchId}</p>
                         <p style="margin: 0;">Job Role: ${batch.jobRole}</p>
                    </div>
                    <table width="100%" cellspacing="5" style="table-layout: fixed;">
                        ${generateGridRows(batchChunk)}
                    </table>
                </div>
            </div>
        `;
    });

    try {
        if (isPdf) {
            const element = document.createElement('div');
            element.innerHTML = htmlPagesForPdf;
            const opt = {
                margin: 0,
                filename: `Evidence_Report_${batch.batchId}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 1.5, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };
            if (isBulk) return await html2pdf().set(opt).from(element).output('blob');
            html2pdf().set(opt).from(element).save();
            return;
        }

        const htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset="utf-8">
                <style>
                    @page Section1 { size: A4; margin: 0.3in; mso-page-orientation: portrait; }
                    body { font-family: Calibri, Arial, sans-serif; }
                </style>
            </head>
            <body>${htmlPagesForWord}</body></html>
        `;

        const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
        if (isBulk) return blob;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Evidence_Report_${batch.batchId}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error(err);
        return null;
    }
}

function generateGridRows(photos) {
    let rows = '';
    for (let i = 0; i < photos.length; i += 2) {
        rows += '<tr>';
        for (let j = 0; j < 2; j++) {
            const p = photos[i + j];
            if (p) {
                rows += `<td align="center" style="padding: 2pt;">
                    <div style="border: 4pt solid black; line-height: 0;">
                        <img src="${p}" style="width: 3.3in; height: 2.8in; object-fit: cover;">
                    </div>
                </td>`;
            } else {
                rows += '<td></td>';
            }
        }
        rows += '</tr>';
    }
    return rows;
}

async function generateBulkEvidenceZip() {
    const selected = document.querySelectorAll('.batch-select:checked');
    if (selected.length === 0) { alert('Select at least one batch.'); return; }

    const btn = document.getElementById('bulk-download-evidence-btn');
    btn.disabled = true;
    btn.textContent = 'Generating ZIP...';

    const zip = new JSZip();
    try {
        for (let i = 0; i < selected.length; i++) {
            const bId = selected[i].dataset.id;
            btn.textContent = `Evidence ${i + 1}/${selected.length}...`;
            const blob = await generateWordDoc(true, bId, true);
            if (blob) zip.file(`Evidence_Report_${bId}.pdf`, blob);
        }
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Evidence_Reports_${Date.now()}.zip`;
        link.click();
    } catch (e) { console.error(e); }
    btn.disabled = false;
    btn.textContent = '📁 Evidence ZIP';
}

async function handleBulkBatchImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const ssc = document.getElementById('global-batch-ssc').value;
    const reader = new FileReader();

    reader.onload = async (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const rows = jsonData.slice(1);

        let successCount = 0;
        let errorCount = 0;

        const importBtn = document.getElementById('bulk-import-btn');
        importBtn.disabled = true;
        importBtn.textContent = 'Importing...';

        const filteredBatches = state.batches.filter(b => b.ssc === ssc);
        let currentMaxSr = filteredBatches.reduce((max, b) => Math.max(max, parseInt(b.sr) || 0), 0);

        for (const row of rows) {
            if (row.length < 5) continue;
            const [srInput, dateVal, monthVal, jobRole, batchId, skillHub] = row;
            if (batchId && jobRole) {
                try {
                    currentMaxSr++;
                    const batchData = {
                        sr: String(currentMaxSr),
                        ssc: ssc,
                        batchId: String(batchId),
                        jobRole: String(jobRole),
                        skillHub: String(skillHub || ""),
                        day: String(dateVal || new Date().toISOString().split('T')[0]),
                        month: String(monthVal || new Date().toISOString().slice(0, 7)),
                        timestamp: new Date().toISOString()
                    };
                    await addDoc(collection(db, "batches"), batchData);
                    successCount++;
                } catch (err) { errorCount++; }
            }
        }
        await syncData();
        renderBatchTable();
        alert(`Import Complete!\nSuccess: ${successCount}\nErrors: ${errorCount}`);
        importBtn.disabled = false;
        importBtn.textContent = 'Bulk Import (Excel/CSV)';
        e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function downloadSampleTemplate() {
    const data = [
        ["SR", "Date", "Month", "Job Role", "Batch ID", "Skill Hub"],
        ["1", "2026-02-23", "2026-02", "Electrician", "BATCH_ELECT01", "Main Center"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Batch_Import_Template.xlsx");
}

export function downloadSingleQR(dataUrl, batchId) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_${batchId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
