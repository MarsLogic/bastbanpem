/**
 * [AUTO-002] Injected Bridge Script for Portal Forms
 * assist_script.js
 * Injected into bastbanpem.pertanian.go.id
 * Handles auto-filling and file injection using Tauri bridge.
 */

(function() {
    console.log("[VA] System Initialized");

    const CONFIG = {
        panelId: 'vendor-assist-panel',
        matchUrl: '/Kontrak/detail/',
        targetTab: 2
    };

    function init() {
        if (!window.location.href.includes(CONFIG.matchUrl)) return;
        
        // Simple UI Injection
        createFloatingPanel();
        
        // Modal Observation
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.id === 'modal-unggah-do' || (node.classList && node.classList.contains('modal'))) {
                            handleModalOpen(node);
                        }
                    });
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function createFloatingPanel() {
        if (document.getElementById(CONFIG.panelId)) return;

        const panel = document.createElement('div');
        panel.id = CONFIG.panelId;
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1a1a1a;
            color: #00ff88;
            padding: 12px 20px;
            border-radius: 8px;
            border: 1px solid #00ff88;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            transition: transform 0.2s;
        `;
        panel.innerHTML = `
            <span style="font-weight: bold;">[VA] VENDOR ASSIST</span>
            <button id="va-next-row" style="background:#00ff88; color:#000; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer;">Next Row</button>
        `;
        document.body.appendChild(panel);

        document.getElementById('va-next-row').onclick = (e) => {
            e.stopPropagation();
            findAndClickNextRow();
        };
    }

    function findAndClickNextRow() {
        const buttons = Array.from(document.querySelectorAll('.btn-info, .btn-primary'))
            .filter(b => b.innerText.includes('Unggah') || b.title?.includes('Unggah'));
        
        if (buttons.length > 0) {
            buttons[0].click();
        } else {
            alert("No more 'Blue Buttons' found in this table.");
        }
    }

    async function handleModalOpen(modal) {
        // Find NIK in modal - usually in a specific span or label
        // This is a guess based on typical government forms
        const nikElement = modal.querySelector('.nik-display') || Array.from(modal.querySelectorAll('td, span, label')).find(el => el.innerText.match(/^\d{16}$/));
        
        if (!nikElement) return;
        const nik = nikElement.innerText.trim();
        console.log("[SEARCH] Detected NIK:", nik);

        try {
            // TODO: Migrate to FastAPI endpoint (/automation/data)
            // const response = await axios.get(`${API_BASE_URL}/automation/data/${nik}`);
            // const data = response.data;
            console.log("[VA] Skipping Tauri invoke for NIK:", nik);
            // if (data) {
            //     magicFill(modal, data);
            // }
        } catch (err) {
            console.error("[ERROR] Automation Bridge Error:", err);
        }
    }

    async function magicFill(modal, data) {
        console.log("[ACTION] Starting Magic Fill for:", data.name);

        // Fill Text Fields
        const fields = {
            'txt-no-sertifikat': data.certificateNo,
            'txt-tgl-sertifikat': data.certificateDate,
            'txt-lembaga': data.testingAgency
        };

        for (const [id, value] of Object.entries(fields)) {
            const input = modal.querySelector(`#${id}`);
            if (input) {
                input.value = value;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // Handle File Inputs
        const fileFields = {
            'file-do': data.paths.do,
            'file-lab': data.paths.lab,
            'file-photo': data.paths.photo
        };

        for (const [id, path] of Object.entries(fileFields)) {
            if (path) {
                await injectFile(modal.querySelector(`#${id}`), path);
            }
        }
    }

    async function injectFile(input, filename) {
        if (!input || !filename) return;

        try {
            console.log(`[VA] Fetching from High-Speed Local Server: ${filename}`);
            // Use the dynamically injected __APP_DATA_URL__
            const url = `${window.__APP_DATA_URL__}/${encodeURIComponent(filename)}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const blob = await response.blob();
            const file = new File([blob], filename, { type: blob.type });

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            
            // Trigger events
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[DONE] Injected file: ${filename}`);
        } catch (err) {
            console.error(`[ERROR] Local Asset Fetch Failed for ${filename}:`, err);
        }
    }

    // Run init
    init();

})();
