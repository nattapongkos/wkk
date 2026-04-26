let currentStudent = null; let currentCourse = null; let availableQuizzes = []; 
let activeQuiz = null; let userAnswers = {};

window.onload = () => { 
    lucide.createIcons(); 
    checkAuthSession(); // เรียกใช้ฟังก์ชันเช็คการล็อกอิน
};

// 🌟 ฟังก์ชันดึงรหัสจากการล็อกอินหน้าหลักมาใส่อัตโนมัติ
function checkAuthSession() {
    const savedSession = localStorage.getItem('student_session');
    if (savedSession) {
        const loggedInUser = JSON.parse(savedSession);
        const loginInput = document.getElementById('login-id');
        
        if (loginInput) {
            loginInput.value = loggedInUser.id; // ใส่รหัส
            loginInput.readOnly = true; // ล็อกไม่ให้แก้
            loginInput.classList.add('bg-slate-200', 'text-slate-500', 'cursor-not-allowed');
            
            // สั่งให้ระบบกดปุ่ม "ถัดไป" ให้อัตโนมัติ เพื่อดูข้อสอบทันที
            handleLogin({ preventDefault: () => {} });
        }
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById('login-id').value.trim();
    const btn = document.getElementById('btn-login'); btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Checking...'; lucide.createIcons();

    try {
        const [studentSnap, courseSnap, quizSnap] = await Promise.all([ db.collection('students').where('student_id', '==', id).get(), db.collection('courses').get(), db.collection('quizzes').where('is_active', '==', true).get() ]);
        
        if (studentSnap.empty) { showToast('ไม่พบรหัสนักเรียน', 'error'); btn.disabled = false; btn.innerHTML = '<i data-lucide="arrow-right" class="w-4 h-4"></i> ถัดไป'; lucide.createIcons(); return; }
        
        currentStudent = { __backendId: studentSnap.docs[0].id, ...studentSnap.docs[0].data() };
        const courses = courseSnap.docs.map(d => d.data());
        currentCourse = courses.find(c => c.course_id === currentStudent.course_id);
        
        const allQ = quizSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // กรองเอาเฉพาะข้อสอบที่ตรงกับวิชาของเด็ก
        availableQuizzes = allQ.filter(q => q.course_id === currentStudent.course_id);

        document.getElementById('sh-name').textContent = currentStudent.student_name;
        document.getElementById('sh-id').textContent = currentStudent.student_id;
        document.getElementById('student-header-info').classList.remove('hidden');

        document.getElementById('view-login').classList.add('hidden');
        renderQuizzes();
        document.getElementById('view-quiz-list').classList.remove('hidden');
    } catch(err) { showToast('เชื่อมต่อล้มเหลว', 'error'); btn.disabled = false; btn.innerHTML = 'ลองใหม่'; }
}

function renderQuizzes() {
    const container = document.getElementById('student-quizzes');
    if(availableQuizzes.length === 0) {
        container.innerHTML = `<div class="bg-white p-8 rounded-3xl text-center border border-slate-200"><p class="text-slate-500 font-medium">ไม่มีข้อสอบเปิดอยู่ในขณะนี้</p></div>`; return;
    }

    let scs = []; try { scs = JSON.parse(currentStudent.scores || "[]"); } catch(e){}

    container.innerHTML = availableQuizzes.map(q => {
        // เช็คว่าเด็กเคยทำหรือมีคะแนนในช่องนี้หรือยัง
        const hasDone = scs.find(s => s.name === q.title && s.score !== null && s.score !== '');
        if (hasDone) {
            return `<div class="bg-slate-100 rounded-3xl p-6 border border-slate-200 flex justify-between items-center opacity-70"><div class="min-w-0"><h3 class="text-base font-bold text-slate-700 truncate">${q.title}</h3><p class="text-xs text-slate-500 mt-1">จำนวน ${q.questions.length} ข้อ</p></div><span class="bg-emerald-100 text-emerald-600 px-3 py-1.5 rounded-xl text-xs font-bold uppercase"><i data-lucide="check-circle" class="w-3 h-3 inline mr-1"></i>ทำแล้ว</span></div>`;
        }
        return `
        <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex justify-between items-center hover:border-indigo-300 transition-all cursor-pointer" onclick="startQuiz('${q.id}')">
            <div class="min-w-0 pr-4"><h3 class="text-lg font-bold text-slate-800 truncate">${q.title}</h3><p class="text-xs text-slate-500 mt-1 font-bold tracking-widest uppercase"><i data-lucide="list-checks" class="w-3 h-3 inline mr-1 text-slate-400"></i> ${q.questions.length} ข้อ</p></div>
            <button class="shrink-0 bg-indigo-50 text-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center"><i data-lucide="play" class="w-5 h-5 ml-1"></i></button>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function startQuiz(quizId) {
    activeQuiz = availableQuizzes.find(q => q.id === quizId);
    userAnswers = {};
    document.getElementById('play-title').textContent = activeQuiz.title;
    document.getElementById('play-course').textContent = currentCourse.course_name;
    document.getElementById('play-total').textContent = activeQuiz.questions.length;
    updateProgress();

    const container = document.getElementById('play-questions');
    container.innerHTML = activeQuiz.questions.map((q, idx) => `
        <div class="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
            <div class="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
            <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">ข้อที่ ${idx + 1}</p>
            <h3 class="text-lg font-bold text-slate-800 mb-6 leading-relaxed">${q.text.replace(/\n/g, '<br>')}</h3>
            <div class="grid grid-cols-1 gap-3">
                ${q.options.map((opt, oIdx) => `
                    <input type="radio" name="q-${idx}" id="q-${idx}-o-${oIdx}" value="${oIdx}" class="hidden choice-radio" onchange="recordAnswer(${idx}, ${oIdx})">
                    <label for="q-${idx}-o-${oIdx}" class="choice-label">
                        <span class="choice-letter">${['ก','ข','ค','ง'][oIdx]}</span>
                        <span class="text-slate-700 leading-snug">${opt}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');

    document.getElementById('view-quiz-list').classList.add('hidden');
    document.getElementById('view-playing').classList.remove('hidden');
    window.scrollTo(0,0);
}

function recordAnswer(qIndex, oIndex) {
    userAnswers[qIndex] = oIndex;
    updateProgress();
}

function updateProgress() { document.getElementById('play-current').textContent = Object.keys(userAnswers).length; }
// 🌟 ฟังก์ชันที่ปุ่มเรียกใช้เพื่อเปิด Popup
function confirmSubmitQuiz() {
    if (Object.keys(userAnswers).length < activeQuiz.questions.length) { 
        return showToast('กรุณาตอบให้ครบทุกข้อก่อนส่ง', 'error'); 
    }
    openConfirmModal('ส่งคำตอบ', 'ยืนยันการส่งคำตอบ? (ส่งแล้วจะไม่สามารถกลับมาแก้ไขได้อีก)', 'submit', () => {
        executeSubmitQuiz();
    });
}

// 🌟 เปลี่ยนชื่อจาก submitQuiz เป็น executeSubmitQuiz
async function executeSubmitQuiz() {
    const btn = document.getElementById('btn-submit-quiz'); 
    btn.disabled = true; 
    btn.innerHTML = '<i data-lucide="loader" class="w-6 h-6 animate-spin"></i> กำลังตรวจ...'; 
    lucide.createIcons();

    // 1. ตรวจคำตอบ (Auto-Grading)
    let rawScore = 0;
    activeQuiz.questions.forEach((q, idx) => { if (userAnswers[idx] === q.correct_index) rawScore++; });

    // 2. เทียบบัญญัติไตรยางศ์เพื่อให้เข้ากับคะแนนเต็มในระบบสมุดคะแนน
    let maxScore = 10;
    try { const cats = JSON.parse(currentCourse.score_categories); const targetCat = cats.find(c => c.name === activeQuiz.title); if(targetCat) maxScore = parseFloat(targetCat.max); } catch(e){}
    
    // สูตร: (คะแนนที่ทำได้ / จำนวนข้อ) * คะแนนเต็มของช่องนั้น
    const finalScore = Number(((rawScore / activeQuiz.questions.length) * maxScore).toFixed(2));

    // 3. อัปเดตข้อมูลนักเรียน (รวมคะแนนใหม่ + ประมวลผลเกรด)
    let oldScores = []; try { oldScores = JSON.parse(currentStudent.scores || "[]"); } catch(e){}
    
    let newScores = []; let newTotal = 0; let totalMax = 0;
    let expectedCats = []; try { expectedCats = JSON.parse(currentCourse.score_categories); } catch(e){}
    
    expectedCats.forEach(cat => {
        totalMax += parseFloat(cat.max) || 0;
        if (cat.name === activeQuiz.title) {
            newTotal += finalScore; newScores.push({ name: cat.name, max: cat.max, score: finalScore, graded_at: new Date().toISOString() });
        } else {
            const existing = oldScores.find(s => s.name === cat.name);
            if (existing && existing.score !== undefined && existing.score !== null && existing.score !== '') { newTotal += existing.score; newScores.push(existing); }
        }
    });

    const pct = totalMax > 0 ? (newTotal / totalMax) * 100 : 0;
    // ดึงเกณฑ์จากวิชามาคำนวณ 8 ระดับ (ยืม logic จากฝั่งครู)
    let g4=80, g35=75, g3=70, g25=65, g2=60, g15=55, g1=50; 
    try { const x = JSON.parse(currentCourse.grade_criteria); g4=x.g4||80; g35=x.g35||75; g3=x.g3||70; g25=x.g25||65; g2=x.g2||60; g15=x.g15||55; g1=x.g1||50; } catch(e){} 
    let grade = '0'; if(pct>=g4) grade='4'; else if(pct>=g35) grade='3.5'; else if(pct>=g3) grade='3'; else if(pct>=g25) grade='2.5'; else if(pct>=g2) grade='2'; else if(pct>=g15) grade='1.5'; else if(pct>=g1) grade='1';
    
    const payload = { scores: JSON.stringify(newScores), total: Math.round(newTotal*100)/100, percentage: Math.round(pct*100)/100, grade: grade };

    try {
        await db.collection('students').doc(currentStudent.__backendId).update(payload);
        
        // โชว์หน้าสรุปผล
        document.getElementById('view-playing').innerHTML = `
            <div class="bg-white rounded-[2rem] p-12 text-center border border-slate-200 shadow-xl relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                <div class="w-24 h-24 bg-emerald-50 rounded-full mx-auto flex items-center justify-center mb-6 border-4 border-emerald-100"><i data-lucide="check-circle-2" class="w-12 h-12 text-emerald-500"></i></div>
                <h2 class="text-3xl font-bold text-slate-800 mb-2 font-outfit">ส่งคำตอบสำเร็จ!</h2>
                <p class="text-slate-500 mb-8">ระบบได้บันทึกคะแนนลงในสมุดคะแนนของคุณครูเรียบร้อยแล้ว</p>
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-6 inline-block mx-auto min-w-[250px]">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">คะแนนที่ได้</p>
                    <p class="text-4xl font-outfit font-bold text-emerald-600">${finalScore} <span class="text-lg text-slate-400">/ ${maxScore}</span></p>
                    <p class="text-xs text-slate-500 mt-2 font-medium">(ตอบถูก ${rawScore} จาก ${activeQuiz.questions.length} ข้อ)</p>
                </div>
                <button onclick="location.reload()" class="mt-8 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest block mx-auto">กลับหน้าหลัก</button>
            </div>`;
        lucide.createIcons();
    } catch(err) { showToast('บันทึกคะแนนล้มเหลว', 'error'); btn.disabled = false; btn.innerHTML = 'ลองส่งใหม่'; }
}

// 🌟 ระบบควบคุม Popup (เพิ่มไว้ล่างสุดของไฟล์)
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
async function executeSubmitQuiz() {
    if (Object.keys(userAnswers).length < activeQuiz.questions.length) { return showToast('กรุณาตอบให้ครบทุกข้อก่อนส่ง', 'error'); }
    if (!confirm('ยืนยันการส่งคำตอบ? (ส่งแล้วแก้ไขไม่ได้)')) return;

    const btn = document.getElementById('btn-submit-quiz'); btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" class="w-6 h-6 animate-spin"></i> กำลังตรวจ...'; lucide.createIcons();

    // 1. ตรวจคำตอบ (Auto-Grading)
    let rawScore = 0;
    activeQuiz.questions.forEach((q, idx) => { if (userAnswers[idx] === q.correct_index) rawScore++; });

    // 2. เทียบบัญญัติไตรยางศ์เพื่อให้เข้ากับคะแนนเต็มในระบบสมุดคะแนน
    let maxScore = 10;
    try { const cats = JSON.parse(currentCourse.score_categories); const targetCat = cats.find(c => c.name === activeQuiz.title); if(targetCat) maxScore = parseFloat(targetCat.max); } catch(e){}
    
    // สูตร: (คะแนนที่ทำได้ / จำนวนข้อ) * คะแนนเต็มของช่องนั้น
    const finalScore = Number(((rawScore / activeQuiz.questions.length) * maxScore).toFixed(2));

    // 3. อัปเดตข้อมูลนักเรียน (รวมคะแนนใหม่ + ประมวลผลเกรด)
    let oldScores = []; try { oldScores = JSON.parse(currentStudent.scores || "[]"); } catch(e){}
    
    let newScores = []; let newTotal = 0; let totalMax = 0;
    let expectedCats = []; try { expectedCats = JSON.parse(currentCourse.score_categories); } catch(e){}
    
    expectedCats.forEach(cat => {
        totalMax += parseFloat(cat.max) || 0;
        if (cat.name === activeQuiz.title) {
            newTotal += finalScore; newScores.push({ name: cat.name, max: cat.max, score: finalScore, graded_at: new Date().toISOString() });
        } else {
            const existing = oldScores.find(s => s.name === cat.name);
            if (existing && existing.score !== undefined && existing.score !== null && existing.score !== '') { newTotal += existing.score; newScores.push(existing); }
        }
    });

    const pct = totalMax > 0 ? (newTotal / totalMax) * 100 : 0;
    // ดึงเกณฑ์จากวิชามาคำนวณ 8 ระดับ (ยืม logic จากฝั่งครู)
    let g4=80, g35=75, g3=70, g25=65, g2=60, g15=55, g1=50; 
    try { const x = JSON.parse(currentCourse.grade_criteria); g4=x.g4||80; g35=x.g35||75; g3=x.g3||70; g25=x.g25||65; g2=x.g2||60; g15=x.g15||55; g1=x.g1||50; } catch(e){} 
    let grade = '0'; if(pct>=g4) grade='4'; else if(pct>=g35) grade='3.5'; else if(pct>=g3) grade='3'; else if(pct>=g25) grade='2.5'; else if(pct>=g2) grade='2'; else if(pct>=g15) grade='1.5'; else if(pct>=g1) grade='1';
    
    const payload = { scores: JSON.stringify(newScores), total: Math.round(newTotal*100)/100, percentage: Math.round(pct*100)/100, grade: grade };

    try {
        await db.collection('students').doc(currentStudent.__backendId).update(payload);
        
        // โชว์หน้าสรุปผล
        document.getElementById('view-playing').innerHTML = `
            <div class="bg-white rounded-[2rem] p-12 text-center border border-slate-200 shadow-xl relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                <div class="w-24 h-24 bg-emerald-50 rounded-full mx-auto flex items-center justify-center mb-6 border-4 border-emerald-100"><i data-lucide="check-circle-2" class="w-12 h-12 text-emerald-500"></i></div>
                <h2 class="text-3xl font-bold text-slate-800 mb-2 font-outfit">ส่งคำตอบสำเร็จ!</h2>
                <p class="text-slate-500 mb-8">ระบบได้บันทึกคะแนนลงในสมุดคะแนนของคุณครูเรียบร้อยแล้ว</p>
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-6 inline-block mx-auto min-w-[250px]">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">คะแนนที่ได้</p>
                    <p class="text-4xl font-outfit font-bold text-emerald-600">${finalScore} <span class="text-lg text-slate-400">/ ${maxScore}</span></p>
                    <p class="text-xs text-slate-500 mt-2 font-medium">(ตอบถูก ${rawScore} จาก ${activeQuiz.questions.length} ข้อ)</p>
                </div>
                <button onclick="location.reload()" class="mt-8 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest block mx-auto">กลับหน้าหลัก</button>
            </div>`;
        lucide.createIcons();
    } catch(err) { showToast('บันทึกคะแนนล้มเหลว', 'error'); btn.disabled = false; btn.innerHTML = 'ลองส่งใหม่'; }
}

function showToast(msg, type='success') {
    const c = document.getElementById('toast-container'); const t = document.createElement('div');
    t.className = `bg-white rounded-xl px-5 py-3.5 border shadow-xl flex items-center gap-3 toast-show ${type === 'success' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`;
    t.innerHTML = `<i data-lucide="${type==='success'?'check-circle':'alert-circle'}" class="w-5 h-5 shrink-0"></i><span class="text-sm font-bold">${msg}</span>`;
    c.appendChild(t); lucide.createIcons({nodes: [t]}); setTimeout(() => { t.classList.replace('toast-show','toast-hide'); setTimeout(()=>t.remove(), 300); }, 3500);
}