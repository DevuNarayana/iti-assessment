import re
import os

path = 'd:/New folder/script.js'

try:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_code = r'''    function renderAdminEvidence() {
        const container = document.getElementById('evidence-grid');
        const countDisplay = document.getElementById('evidence-count');
        const filterSsc = document.getElementById('evidence-filter-ssc');
        const filterBatch = document.getElementById('evidence-filter-batch');
        
        // --- Populate SSC Dropdown (only once) ---
        if (filterSsc && filterSsc.options.length === 1) {
            const sscList = JSON.parse(localStorage.getItem('sscs')) || [];
            sscList.forEach(ssc => {
                const opt = document.createElement('option');
                opt.value = ssc.name;
                opt.textContent = ssc.name;
                filterSsc.appendChild(opt);
            });
            
            filterSsc.addEventListener('change', handleSscChange);
            filterBatch.addEventListener('change', renderEvidenceGrid);
        }
        
        if (filterBatch.value && filterBatch.value !== '') {
            renderEvidenceGrid();
        } else {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Please select a Sector Skill Council and Batch to view evidence.</div>';
            if (countDisplay) countDisplay.textContent = '0';
        }
    }

    function handleSscChange() {
        const selectedSsc = document.getElementById('evidence-filter-ssc').value;
        const filterBatch = document.getElementById('evidence-filter-batch');
        const container = document.getElementById('evidence-grid');
        const countDisplay = document.getElementById('evidence-count');
        
        filterBatch.innerHTML = '<option value="">Select Batch</option>';
        filterBatch.disabled = true;
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Please select a Batch.</div>';
        if (countDisplay) countDisplay.textContent = '0';
        
        if (!selectedSsc) return;

        const allBatches = JSON.parse(localStorage.getItem('batches')) || [];
        const filteredBatches = allBatches.filter(b => b.ssc === selectedSsc);
        
        if (filteredBatches.length > 0) {
            filterBatch.disabled = false;
            filteredBatches.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.batchId;
                opt.textContent = b.batchId; 
                filterBatch.appendChild(opt);
            });
        } else {
            filterBatch.innerHTML = '<option value="">No Batches Found</option>';
            filterBatch.disabled = true;
        }
    }

    function renderEvidenceGrid() {
        const container = document.getElementById('evidence-grid');
        const countDisplay = document.getElementById('evidence-count');
        const selectedBatch = document.getElementById('evidence-filter-batch').value;
        
        if (!selectedBatch) return;

        container.innerHTML = '';
        
        const evidence = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('assessment_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data.batchId === selectedBatch) {
                        evidence.push(data);
                    }
                } catch (e) { console.error('Error parsing evidence item', key); }
            }
        }

        evidence.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        if (countDisplay) countDisplay.textContent = evidence.length;

        if (evidence.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No evidence submitted for this batch yet.</div>';
            return;
        }

        evidence.forEach(item => {
            const date = new Date(item.timestamp).toLocaleDateString();
            const time = new Date(item.timestamp).toLocaleTimeString();
            
            const photosHtml = item.photos.map(url => `
                <img src="${url}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;" onclick="openLightbox(this.src)">
            `).join('');

            const html = `
                <div class="glass-panel" style="padding: 1.5rem; background: rgba(255,255,255,0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                        <div>
                            <span class="badge ${item.type === 'Theory' ? 'safe' : item.type === 'Practical' ? 'warning' : 'pending'}" style="margin-bottom: 0.5rem; display: inline-block;">${item.type}</span>
                        </div>
                        <div style="text-align: right; font-size: 0.8rem; color: var(--text-muted);">
                            <div>${date}</div>
                            <div>${time}</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 0.5rem;">
                        ${photosHtml}
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });
    }

    renderAssessorTable();'''

    pattern = r'function\s+renderAdminEvidence\s*\(\)\s*\{[\s\S]*?renderAssessorTable\(\);'
    
    # Check if pattern exists
    if re.search(pattern, content):
        new_content = re.sub(pattern, new_code, content)
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(new_content)
        print("SUCCESS: Code replaced via Regex.")
    else:
        print("FAILURE: Pattern not found.")
        # Debug: print snippet of where we expect it
        idx = content.find('function renderAdminEvidence')
        if idx != -1:
             print(f"Found function at index {idx}, but regex failed. Content snippet:\n{content[idx:idx+100]}...")
        else:
             print("Function 'renderAdminEvidence' not found in file string search.")

except Exception as e:
    print(f"Error: {e}")
