let courses = []; let quizzes = []; let editingQuizId = null;

window.onload = async () => {
    lucide.createIcons();
    await loadInitialData();
};

async function loadInitialData() {
    try {
        const [courseSnap, quizSnap] = await Promise.all([ db.collection('courses').get(), db.collection('quizzes').get() ]);
        courses = courseSnap.docs.map(doc => doc.data());
        quizzes = quizSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const filterEl = document.getElementById('filter-course');
        filterEl.innerHTML = '<option value="all">ดูทุกวิชา</option>' + courses.map(c => `<option value="${c.course_id}">${c.course_name}</option>`).join('');
        
        renderQuizzes();
    } catch(e) { showToast('โหลดข้อมูลล้มเหลว', 'error'); }
}

function renderQuizzes() {
    const container = document.getElementById('quiz-list');
    const filter = document.getElementById('filter-course').value;
    let filtered = quizzes;
    if (filter !== 'all') filtered = quizzes.filter(q => q.course_id === filter);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm"><i data-lucide="file-question" class="w-12 h-12 text-slate-300 mx-auto mb-4"></i><p class="text-slate-500 font-medium">ยังไม่มีข้อสอบในระบบ</p></div>`;
        lucide.createIcons(); return;
    }

    container.innerHTML = filtered.map(q => {
        const c = courses.find(c => c.course_id === q.course_id);
        const cName = c ? c.course_name : 'ไม่พบวิชา';
        const statusHtml = q.is_active ? `<span class="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase"><i data-lucide="wifi" class="w-3 h-3 inline mr-1"></i>เปิดสอบอยู่</span>` : `<span class="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-bold uppercase"><i data-lucide="wifi-off" class="w-3 h-3 inline mr-1"></i>ปิดรับคำตอบ</span>`;
        
        return `
        <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:border-indigo-300 transition-all flex flex-col">
            <div class="flex justify-between items-start mb-4">
                <div><p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${cName}</p><h3 class="text-lg font-bold text-slate-800">${q.title}</h3></div>
                ${statusHtml}
            </div>
            <p class="text-sm text-slate-500 mb-6"><i data-lucide="list-checks" class="w-4 h-4 inline mr-1 text-slate-400"></i> จำนวน ${q.questions.length} ข้อ</p>
            <div class="mt-auto pt-4 border-t border-slate-100 flex gap-2">
                <button onclick="toggleQuizStatus('${q.id}', ${!q.is_active})" class="flex-1 py-2.5 rounded-xl text-xs font-bold ${q.is_active ? 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'} transition-all">${q.is_active ? 'ปิดสอบ' : 'เปิดสอบ'}</button>
                <button onclick="editQuiz('${q.id}')" class="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-all">แก้ไข</button>
                <button onclick="deleteQuiz('${q.id}')" class="py-2.5 px-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function openCreateModal() {
    editingQuizId = null;
    const courseSel = document.getElementById('inp-q-course');
    courseSel.innerHTML = courses.map(c => `<option value="${c.course_id}">${c.course_name}</option>`).join('');
    updateCategoryOptions();
    document.getElementById('questions-container').innerHTML = '';
    document.getElementById('inp-q-active').checked = true;
    addQuestionBlock(); // แถวข้อแรก
    document.getElementById('quiz-modal').classList.remove('hidden');
}

function updateCategoryOptions() {
    const courseId = document.getElementById('inp-q-course').value;
    const c = courses.find(c => c.course_id === courseId);
    const titleSel = document.getElementById('inp-q-title');
    if(c) {
        try { const cats = JSON.parse(c.score_categories); titleSel.innerHTML = cats.map(cat => `<option value="${cat.name}">${cat.name} (เต็ม ${cat.max})</option>`).join(''); } 
        catch(e) { titleSel.innerHTML = '<option value="ข้อสอบ">ข้อสอบ</option>'; }
    }
}

function addQuestionBlock(qData = null) {
    const container = document.getElementById('questions-container');
    const idx = container.children.length;
    const text = qData ? qData.text : '';
    const opts = qData ? qData.options : ['', '', '', ''];
    const correct = qData ? qData.correct_index : 0;
    
    const div = document.createElement('div');
    div.className = "q-block bg-white border border-slate-200 rounded-2xl p-5 relative shadow-sm";
    div.innerHTML = `
        <button type="button" onclick="this.parentElement.remove()" class="absolute top-4 right-4 text-slate-300 hover:text-red-500"><i data-lucide="x" class="w-4 h-4"></i></button>
        <p class="text-xs font-bold text-indigo-500 mb-2 uppercase">ข้อที่ ${idx + 1}</p>
        <textarea class="q-text w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 mb-4 resize-none" rows="2" placeholder="พิมพ์โจทย์คำถาม...">${text}</textarea>
        <div class="space-y-2 pl-2 border-l-2 border-slate-100">
            ${[0,1,2,3].map(i => `
                <div class="flex items-center gap-3">
                    <input type="radio" name="q-correct-${idx}" value="${i}" ${correct === i ? 'checked' : ''} class="w-4 h-4 accent-emerald-500 cursor-pointer" title="เลือกข้อนี้เป็นข้อที่ถูก">
                    <span class="text-xs font-bold text-slate-400">${['ก','ข','ค','ง'][i]}.</span>
                    <input type="text" class="q-opt w-full border-b border-slate-200 bg-transparent py-1 text-sm outline-none focus:border-indigo-500" value="${opts[i]}" placeholder="ตัวเลือก...">
                </div>
            `).join('')}
        </div>
    `;
    container.appendChild(div); lucide.createIcons();
}

async function saveQuiz() {
    const course_id = document.getElementById('inp-q-course').value;
    const title = document.getElementById('inp-q-title').value;
    const is_active = document.getElementById('inp-q-active').checked;
    
    const qBlocks = document.querySelectorAll('.q-block');
    const questions = [];
    let hasError = false;

    qBlocks.forEach((block, idx) => {
        const text = block.querySelector('.q-text').value.trim();
        const opts = Array.from(block.querySelectorAll('.q-opt')).map(inp => inp.value.trim());
        const correctRadio = block.querySelector(`input[name="q-correct-${idx}"]:checked`);
        if(!text || opts.some(o => !o) || !correctRadio) hasError = true;
        questions.push({ text, options: opts, correct_index: parseInt(correctRadio.value) });
    });

    if (hasError || questions.length === 0) return showToast('กรุณากรอกโจทย์และตัวเลือกให้ครบทุกข้อ', 'error');

    const payload = { course_id, title, is_active, questions, updated_at: new Date().toISOString() };
    
    try {
        if (editingQuizId) { await db.collection('quizzes').doc(editingQuizId).update(payload); showToast('อัปเดตข้อสอบสำเร็จ'); } 
        else { await db.collection('quizzes').add({ quiz_id: 'q_' + Date.now(), created_at: new Date().toISOString(), ...payload }); showToast('สร้างข้อสอบสำเร็จ'); }
        closeModal(); await loadInitialData();
    } catch(e) { showToast('บันทึกล้มเหลว', 'error'); }
}

function editQuiz(id) {
    const q = quizzes.find(x => x.id === id); if(!q) return;
    editingQuizId = id;
    document.getElementById('inp-q-course').innerHTML = courses.map(c => `<option value="${c.course_id}">${c.course_name}</option>`).join('');
    document.getElementById('inp-q-course').value = q.course_id;
    updateCategoryOptions(); document.getElementById('inp-q-title').value = q.title;
    document.getElementById('inp-q-active').checked = q.is_active;
    
    const container = document.getElementById('questions-container'); container.innerHTML = '';
    q.questions.forEach(qd => addQuestionBlock(qd));
    document.getElementById('quiz-modal').classList.remove('hidden');
}

async function toggleQuizStatus(id, newStatus) {
    try { await db.collection('quizzes').doc(id).update({ is_active: newStatus }); showToast(newStatus ? 'เปิดให้สอบแล้ว' : 'ปิดรับคำตอบแล้ว'); await loadInitialData(); } 
    catch(e) { showToast('อัปเดตล้มเหลว', 'error'); }
}

// 🌟 แทนที่ฟังก์ชัน deleteQuiz เดิมด้วยตัวนี้
function deleteQuiz(id) {
    openConfirmModal('ลบข้อสอบ', 'คุณยืนยันที่จะลบชุดข้อสอบนี้หรือไม่? ข้อมูลทั้งหมดจะถูกลบถาวร', 'delete', async () => {
        try { await db.collection('quizzes').doc(id).delete(); showToast('ลบสำเร็จ'); await loadInitialData(); } 
        catch(e) { showToast('ลบล้มเหลว', 'error'); }
    });
}

// 🌟 เพิ่มฟังก์ชันควบคุม Popup ไว้ล่างสุดของไฟล์
let confirmActionCallback = null;

function openConfirmModal(title, message, type, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    confirmActionCallback = callback;
    
    const modal = document.getElementById('custom-confirm-modal');
    const box = document.getElementById('custom-confirm-box');
    modal.classList.remove('hidden');
    void modal.offsetWidth; // Trigger reflow
    modal.classList.remove('opacity-0');
    box.classList.remove('scale-95');
    box.classList.add('scale-100');
}

function closeConfirmModal() {
    const modal = document.getElementById('custom-confirm-modal');
    const box = document.getElementById('custom-confirm-box');
    modal.classList.add('opacity-0');
    box.classList.remove('scale-100');
    box.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        confirmActionCallback = null;
    }, 300);
}

document.getElementById('btn-confirm-action').addEventListener('click', () => {
    if (confirmActionCallback) confirmActionCallback();
    closeConfirmModal();
});

function closeModal() { document.getElementById('quiz-modal').classList.add('hidden'); }
function showToast(msg, type='success') {
    const c = document.getElementById('toast-container'); const t = document.createElement('div');
    t.className = `bg-white rounded-xl px-5 py-3.5 border shadow-xl flex items-center gap-3 toast-show ${type === 'success' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`;
    t.innerHTML = `<i data-lucide="${type==='success'?'check-circle':'alert-circle'}" class="w-5 h-5 shrink-0"></i><span class="text-sm font-bold">${msg}</span>`;
    c.appendChild(t); lucide.createIcons({nodes: [t]}); setTimeout(() => { t.classList.replace('toast-show','toast-hide'); setTimeout(()=>t.remove(), 300); }, 3500);
}