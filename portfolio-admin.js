let portfolios = []; 
let editingId = null; 
let tempImageFiles = []; let tempOldImages = []; 
let tempDocFiles = []; let tempOldDocs = [];
let GAS_URL = '';
let targetDeleteId = null; // ตัวแปรสำหรับจำว่ากำลังจะลบ ID ไหน

window.onload = async () => {
    lucide.createIcons();
    GAS_URL = localStorage.getItem('gasUrl');
    
    if(!GAS_URL) {
        document.getElementById('sys-loading').style.display = 'none';
        document.getElementById('error-screen').classList.remove('hidden');
        return;
    }

    document.getElementById('inp-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('inp-year').value = new Date().getFullYear() + 543;
    
    await loadPortfolios();
};

function getDisplayImageUrl(url) {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
    }
    return url;
}

async function loadPortfolios() {
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'get_portfolios' }) });
        const json = await res.json();
        
        if (json.status === 'success') {
            portfolios = (json.data || []).sort((a,b) => new Date(b.date) - new Date(a.date));
            const years = [...new Set(portfolios.map(p => p.academic_year))].sort((a,b) => b - a);
            const yearFilter = document.getElementById('filter-year');
            yearFilter.innerHTML = '<option value="all">ทุกปีการศึกษา</option>' + years.map(y => `<option value="${y}">ปีการศึกษา ${y}</option>`).join('');
            
            renderPortfolios();
            document.getElementById('sys-loading').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('sys-loading').style.display = 'none';
                document.getElementById('main-content').classList.remove('hidden');
            }, 300);
        } else { throw new Error('Failed to load DB'); }
    } catch(e) { 
        document.getElementById('sys-loading').innerHTML = `<i data-lucide="alert-triangle" class="w-16 h-16 text-rose-500 mb-4"></i><h2 class="text-xl font-bold text-rose-500 font-outfit">เกิดข้อผิดพลาด</h2><p class="text-slate-500 text-sm mt-2">ไม่สามารถเชื่อมต่อ Google Drive ได้</p>`;
        lucide.createIcons();
    }
}

function renderPortfolios() {
    const container = document.getElementById('portfolio-list');
    const fYear = document.getElementById('filter-year').value;
    const fCat = document.getElementById('filter-category').value;
    
    let filtered = portfolios;
    if (fYear !== 'all') filtered = filtered.filter(p => p.academic_year === fYear);
    if (fCat !== 'all') filtered = filtered.filter(p => p.category === fCat);

    document.getElementById('stat-total').textContent = filtered.length;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full glass-panel rounded-[2rem] p-24 text-center border-dashed border-2 border-slate-200"><i data-lucide="folder-search" class="w-16 h-16 text-slate-300 mx-auto mb-6"></i><p class="text-slate-500 font-bold text-lg tracking-wide">ยังไม่มีข้อมูลผลงานในหมวดหมู่นี้</p></div>`;
        lucide.createIcons(); return;
    }

    container.innerHTML = filtered.map(p => {
        let coverHtml = (p.images && p.images.length > 0) 
            ? `<img src="${getDisplayImageUrl(p.images[0])}" class="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-700">`
            : `<div class="w-full h-56 bg-slate-100 flex items-center justify-center"><i data-lucide="image" class="w-12 h-12 text-slate-300"></i></div>`;

        const docBadge = (p.documents && p.documents.length > 0) ? `<span class="absolute top-4 left-4 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-700 shadow-lg flex items-center gap-1.5"><i data-lucide="paperclip" class="w-3.5 h-3.5 text-blue-500"></i> ${p.documents.length} เอกสาร</span>` : '';

        return `
        <div class="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col group relative overflow-hidden cursor-pointer" onclick="viewPortfolio('${p.id}')">
            <div class="relative overflow-hidden bg-slate-100 rounded-t-[2.5rem]">
                ${coverHtml}
                ${docBadge}
            </div>
            
            <div class="p-8 flex-1 flex flex-col">
                <div class="flex items-center justify-between gap-2 mb-4">
                    <span class="bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest truncate">${p.category}</span>
                    <span class="text-[10px] font-bold text-slate-400 uppercase"><i data-lucide="calendar" class="w-3 h-3 inline"></i> ${new Date(p.date).toLocaleDateString('th-TH')}</span>
                </div>
                <h3 class="text-xl font-bold text-slate-800 leading-tight mb-2 line-clamp-2">${p.title}</h3>
                
                <div class="mt-auto pt-6 flex gap-2 justify-end relative z-10" onclick="event.stopPropagation()">
                    <button onclick="editPortfolio('${p.id}')" class="px-5 py-2.5 bg-slate-50 text-slate-500 text-xs font-bold hover:text-blue-600 hover:bg-blue-50 border border-slate-100 rounded-xl transition-all shadow-sm flex items-center gap-1.5"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i> แก้ไข</button>
                    <button onclick="openDeleteModal('${p.id}')" class="px-5 py-2.5 bg-slate-50 text-slate-500 text-xs font-bold hover:text-red-600 hover:bg-red-50 border border-slate-100 rounded-xl transition-all shadow-sm flex items-center gap-1.5"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> ลบ</button>
                </div>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function openFormModal() {
    editingId = null; tempImageFiles = []; tempOldImages = []; tempDocFiles = []; tempOldDocs = [];
    document.getElementById('modal-title').textContent = 'เพิ่มข้อมูลผลงาน';
    document.getElementById('inp-title').value = ''; document.getElementById('inp-desc').value = '';
    document.getElementById('inp-images').value = ''; document.getElementById('inp-docs').value = '';
    
    document.getElementById('image-preview').innerHTML = ''; document.getElementById('image-preview').classList.add('hidden');
    document.getElementById('doc-preview').innerHTML = ''; document.getElementById('doc-preview').classList.add('hidden');
    
    document.getElementById('form-modal').classList.add('active');
}

function closeFormModal() { document.getElementById('form-modal').classList.remove('active'); }

function editPortfolio(id) {
    const p = portfolios.find(x => x.id === id); if(!p) return;
    editingId = id; tempImageFiles = []; tempDocFiles = [];
    tempOldImages = p.images || []; tempOldDocs = p.documents || [];
    
    document.getElementById('modal-title').textContent = 'แก้ไขผลงาน';
    document.getElementById('inp-date').value = p.date;
    document.getElementById('inp-year').value = p.academic_year;
    document.getElementById('inp-category').value = p.category;
    document.getElementById('inp-title').value = p.title;
    document.getElementById('inp-desc').value = p.description || '';
    
    renderImagePreview(); renderDocPreview();
    document.getElementById('form-modal').classList.add('active');
}

async function handleImageSelect(e) {
    const files = Array.from(e.target.files); if (!files.length) return;
    showToast('กำลังเตรียมรูปภาพ...', 'info');
    const compressOptions = { maxSizeMB: 0.5, maxWidthOrHeight: 1600, useWebWorker: true };
    for (let file of files) {
        try {
            const compressed = await imageCompression(file, compressOptions);
            const base64 = await readFileAsBase64(compressed);
            tempImageFiles.push({ name: file.name, type: file.type, base64: base64 });
        } catch (error) { console.error(error); }
    }
    renderImagePreview(); e.target.value = '';
}

async function handleDocSelect(e) {
    const files = Array.from(e.target.files); if (!files.length) return;
    for (let file of files) {
        const base64 = await readFileAsBase64(file);
        tempDocFiles.push({ name: file.name, type: file.type, base64: base64 });
    }
    renderDocPreview(); e.target.value = '';
}

function readFileAsBase64(file) { return new Promise((res, rej) => { const reader = new FileReader(); reader.onload = () => res(reader.result); reader.onerror = rej; reader.readAsDataURL(file); }); }

function renderImagePreview() {
    const el = document.getElementById('image-preview');
    if (tempOldImages.length === 0 && tempImageFiles.length === 0) { el.classList.add('hidden'); return; }
    
    el.classList.remove('hidden'); let html = '';
    tempOldImages.forEach((url, i) => { html += `<div class="relative group rounded-2xl overflow-hidden border border-slate-200"><img src="${getDisplayImageUrl(url)}" class="w-full h-24 object-cover opacity-80"><button type="button" onclick="tempOldImages.splice(${i},1); renderImagePreview();" class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 text-white transition-opacity"><i data-lucide="trash" class="w-6 h-6 text-red-400"></i></button></div>`; });
    tempImageFiles.forEach((file, i) => { html += `<div class="relative group rounded-2xl overflow-hidden border border-fuchsia-300 shadow-[0_0_15px_rgba(217,70,239,0.3)]"><img src="${file.base64}" class="w-full h-24 object-cover"><span class="absolute top-2 left-2 bg-fuchsia-600 text-white text-[9px] px-2 py-0.5 font-bold rounded-lg uppercase tracking-widest">New</span><button type="button" onclick="tempImageFiles.splice(${i},1); renderImagePreview();" class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 text-white transition-opacity"><i data-lucide="x" class="w-6 h-6"></i></button></div>`; });
    el.innerHTML = html; lucide.createIcons();
}

function renderDocPreview() {
    const el = document.getElementById('doc-preview');
    if (tempOldDocs.length === 0 && tempDocFiles.length === 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden'); let html = '';
    tempOldDocs.forEach((doc, i) => { html += `<div class="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200"><span class="text-sm font-bold text-slate-600 truncate flex-1 flex items-center gap-2"><i data-lucide="paperclip" class="w-4 h-4 text-blue-500"></i> ${doc.name}</span><button type="button" onclick="tempOldDocs.splice(${i},1); renderDocPreview();" class="text-slate-400 hover:text-red-500 p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`; });
    tempDocFiles.forEach((doc, i) => { html += `<div class="flex items-center justify-between bg-blue-50 px-4 py-3 rounded-2xl border border-blue-200 shadow-sm"><span class="text-sm font-bold text-blue-700 truncate flex-1 flex items-center gap-2"><i data-lucide="file-plus" class="w-4 h-4 text-blue-600"></i> ${doc.name} <span class="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-lg uppercase ml-2">New</span></span><button type="button" onclick="tempDocFiles.splice(${i},1); renderDocPreview();" class="text-blue-400 hover:text-red-500 p-2"><i data-lucide="x" class="w-4 h-4"></i></button></div>`; });
    el.innerHTML = html; lucide.createIcons();
}

async function savePortfolio() {
    const title = document.getElementById('inp-title').value.trim();
    if(!title) return showToast('กรุณากรอกชื่อกิจกรรม', 'error');

    const btn = document.getElementById('btn-save'); const origHtml = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> กำลังอัปโหลดสู่ระบบ...'; lucide.createIcons();

    let finalImages = [...tempOldImages];
    let finalDocs = [...tempOldDocs];

    try {
        for(let img of tempImageFiles) {
            const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'upload_portfolio_file', data: { name: img.name, type: img.type, base64: img.base64 } }) });
            const json = await res.json(); if(json.status === 'success') finalImages.push(json.file.url);
        }
        for(let file of tempDocFiles) {
            const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'upload_portfolio_file', data: { name: file.name, type: file.type, base64: file.base64 } }) });
            const json = await res.json(); if(json.status === 'success') finalDocs.push({ name: json.file.name, url: json.file.url });
        }

        const payload = {
            id: editingId, 
            title: title, 
            date: document.getElementById('inp-date').value,
            academic_year: document.getElementById('inp-year').value.trim(),
            category: document.getElementById('inp-category').value,
            description: document.getElementById('inp-desc').value.trim(),
            images: finalImages, 
            documents: finalDocs,
            timestamp: new Date().toISOString()
        };

        const dbRes = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'save_portfolio', data: payload }) });
        const dbJson = await dbRes.json();

        if (dbJson.status === 'success') {
            showToast('ซิงค์ข้อมูลกับ Drive สำเร็จ! 🎉');
            closeFormModal(); 
            document.getElementById('sys-loading').style.display = 'flex';
            setTimeout(() => document.getElementById('sys-loading').style.opacity = '1', 10);
            await loadPortfolios();
        } else { throw new Error('Database Error'); }

    } catch (e) { showToast('อัปโหลดล้มเหลว', 'error'); }
    
    btn.disabled = false; btn.innerHTML = origHtml; lucide.createIcons();
}

function viewPortfolio(id) {
    const p = portfolios.find(x => x.id === id); if(!p) return;
    
    document.getElementById('view-category').textContent = p.category;
    document.getElementById('view-title').textContent = p.title;
    document.getElementById('view-date').textContent = new Date(p.date).toLocaleDateString('th-TH', {year:'numeric',month:'long',day:'numeric'});
    document.getElementById('view-year').textContent = p.academic_year;
    document.getElementById('view-desc').textContent = p.description || '-';

    const gal = document.getElementById('view-gallery');
    if(p.images && p.images.length > 0) {
        let galHtml = `<img src="${getDisplayImageUrl(p.images[0])}" class="w-full h-[400px] object-cover rounded-[2.5rem] mb-4 shadow-lg cursor-pointer border-2 border-white" onclick="window.open('${p.images[0]}')">`;
        if(p.images.length > 1) {
            galHtml += `<div class="album-grid">${p.images.slice(1).map(url => `<img src="${getDisplayImageUrl(url)}" class="shadow-sm border-2 border-white cursor-pointer" onclick="window.open('${url}')">`).join('')}</div>`;
        }
        gal.innerHTML = galHtml; gal.classList.remove('hidden');
    } else { gal.classList.add('hidden'); }

    const docSec = document.getElementById('view-docs-section'); const docList = document.getElementById('view-docs-list');
    if(p.documents && p.documents.length > 0) {
        docList.innerHTML = p.documents.map(d => `<a href="${d.url}" target="_blank" class="flex items-center gap-4 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 p-5 rounded-[1.5rem] transition-all group shadow-sm"><div class="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all"><i data-lucide="file-text" class="w-6 h-6"></i></div><span class="text-sm font-bold text-slate-700 group-hover:text-blue-700 truncate">${d.name}</span></a>`).join('');
        docSec.classList.remove('hidden');
    } else { docSec.classList.add('hidden'); }

    document.getElementById('view-modal').classList.add('active'); lucide.createIcons();
}
function closeViewModal() { document.getElementById('view-modal').classList.remove('active'); }

// 🌟 ระบบ Popup ยืนยันการลบแบบสวยงาม
function openDeleteModal(id) {
    targetDeleteId = id;
    document.getElementById('delete-modal').classList.add('active');
}
function closeDeleteModal() {
    targetDeleteId = null;
    document.getElementById('delete-modal').classList.remove('active');
}

// 🌟 ผูกฟังก์ชันเข้ากับปุ่มยืนยันใน HTML
document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    if(!targetDeleteId) return;
    
    const btn = document.getElementById('btn-confirm-delete');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> กำลังลบ...';
    lucide.createIcons();

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_portfolio', data: { id: targetDeleteId } }) });
        const json = await res.json();
        
        if (json.status === 'success') { 
            showToast('ลบผลงานพร้อมย้ายไฟล์ลงถังขยะสำเร็จ! 🗑️'); 
            closeDeleteModal();
            // รีโหลดหน้าจอเพื่อให้แสดงข้อมูลอัปเดต
            document.getElementById('sys-loading').style.display = 'flex';
            setTimeout(() => document.getElementById('sys-loading').style.opacity = '1', 10);
            await loadPortfolios(); 
        } else {
            throw new Error('ไม่สามารถลบได้');
        }
    } catch(e) { 
        showToast('ลบไม่สำเร็จ กรุณาลองใหม่', 'error'); 
    }
    
    btn.disabled = false;
    btn.innerHTML = origHtml;
    lucide.createIcons();
});

function showToast(msg, type='success') {
    const c = document.getElementById('toast-container'); const t = document.createElement('div');
    t.className = `glass-panel rounded-2xl px-6 py-4 flex items-center gap-3 toast-show ${type === 'success' ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500'}`;
    t.innerHTML = `<i data-lucide="${type==='success'?'check-circle-2':'alert-triangle'}" class="w-6 h-6 ${type==='success'?'text-emerald-500':'text-rose-500'} shrink-0"></i><span class="text-sm font-bold text-slate-700 tracking-wide">${msg}</span>`;
    c.appendChild(t); lucide.createIcons({nodes: [t]}); setTimeout(() => { t.classList.replace('toast-show','toast-hide'); setTimeout(()=>t.remove(), 400); }, 3500);
}