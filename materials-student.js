

let currentStudent = null; 
let studentProfiles = []; // 🟢 เพิ่มตัวแปรเก็บ Profile ทุกวิชาของเด็ก
let courses = []; 
let materials = [];
let studentSubmissions = {}; // 🟢 เพิ่มตัวแปรนี้เพื่อเก็บสถานะใบงาน
let currentTypeFilter = 'all';
let currentWorksheetId = null;
let isSubmittingWorksheet = false; // ✅ เพิ่ม flag ป้องกัน double submit

window.onload = () => { 
    lucide.createIcons(); 
    checkAuthSession();
};

function checkAuthSession() {
    const savedSession = localStorage.getItem('student_session');
    if (savedSession) {
        // 🟢 แก้ไข: ให้ทำการ Login ทันทีที่มี Session โดยไม่สนว่าจะมีช่องกรอกเลขที่หรือไม่
        const loggedInUser = JSON.parse(savedSession);
        const loginInput = document.getElementById('login-id');
        
        if (loginInput) {
            loginInput.value = loggedInUser.id; 
            loginInput.readOnly = true; 
        }
        
        // 🟢 เรียก handleLogin โดยส่งข้อมูลจำลองไปเพื่อให้ระบบทำงานต่อได้
        handleLogin({ 
            preventDefault: () => {}, 
            isAutoLogin: true, 
            savedId: loggedInUser.id 
        });
    }
}

/**
 * ฟังก์ชันเข้าสู่ระบบสำหรับนักเรียน (Full Version)
 * - ตรวจสอบตัวตนผ่าน Firebase
 * - ป้องกันเคสเด็กที่ถูกลบออกจากระบบแต่ยังมี Session ค้าง
 * - จัดการ UI Loading และพิกัด/ข้อมูลเบื้องต้น
 */
async function handleLogin(e) {
    if (e) e.preventDefault();

    const idInput = document.getElementById('login-id');
    const btn = document.getElementById('btn-login');
    const studentId = idInput ? idInput.value.trim() : "";

    // 1. Validation เบื้องต้น
    if (!studentId) {
        showToast('กรุณากรอกรหัสนักเรียนด้วยครับ 📝', 'error');
        return;
    }

    // 2. แสดงสถานะกำลังโหลด (Loading State)
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <div class="flex items-center justify-center gap-2">
                <i data-lucide="loader" class="w-4 h-4 animate-spin"></i>
                <span>กำลังยืนยันตัวตน...</span>
            </div>
        `;
        lucide.createIcons();
    }

    try {
        // 3. ตรวจสอบข้อมูลจาก Database (Firestore) โดยตรง
        // ใช้ .where('student_id', '==', studentId) เพื่อหาเด็กคนนี้
        const snapshot = await db.collection('students')
            .where('student_id', '==', studentId)
            .get();

        // 🚨 กรณีที่ 1: ไม่พบข้อมูล (อาจจะพิมพ์ผิด หรือ ครูลบออกไปแล้ว)
        if (snapshot.empty) {
            console.warn(`[Login] Student ID ${studentId} not found or deleted.`);
            
            // ล้าง Session เก่าทิ้งทันที กันเด็กเข้าหน้า Dashboard ได้
            localStorage.removeItem('student_session');
            
            // รีเซ็ตหน้าจอ Login ให้พร้อมพิมพ์ใหม่
            if (idInput) {
                idInput.value = "";
                idInput.readOnly = false;
                idInput.classList.remove('bg-slate-200', 'text-slate-500', 'cursor-not-allowed');
            }
            
            showToast('ไม่พบรหัสนักเรียนนี้ในระบบ หรือบัญชีถูกระงับ! ❌', 'error');
            
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'เข้าสู่ระบบ';
            }
            return;
        }

        // 🚨 กรณีที่ 2: พบข้อมูลนักเรียน
        const studentDoc = snapshot.docs[0];
        const studentData = studentDoc.data();
        
        // เก็บข้อมูลลงตัวแปร Global ของระบบ
        currentStudent = { 
            __backendId: studentDoc.id, 
            ...studentData 
        };

        // 4. บันทึก Session ลงในเครื่องนักเรียน (จำล็อกอิน)
        const sessionData = {
            id: currentStudent.student_id,
            name: currentStudent.student_name,
            docId: studentDoc.id,
            lastLogin: new Date().toISOString()
        };
        localStorage.setItem('student_session', JSON.stringify(sessionData));

        // 5. ปรับปรุง UI หน้า Login ให้ดูเหมือนล็อกอินแล้ว
        if (idInput) {
            idInput.readOnly = true;
            idInput.classList.add('bg-slate-200', 'text-slate-500', 'cursor-not-allowed');
        }

        showToast(`ยินดีต้อนรับครับ คุณ${currentStudent.student_name} 🎉`, 'success');

        // 6. เปลี่ยนหน้าจอ และโหลดข้อมูลที่เกี่ยวข้อง
        // เก็บข้อมูลทุกวิชาที่เด็กคนนี้เรียน (กรณีระบบจับคู่หลาย Course)
        studentProfiles = snapshot.docs.map(doc => ({ __backendId: doc.id, ...doc.data() }));

        // อัปเดตข้อมูลนักเรียนที่แถบ Header ด้านบน
        const headerInfo = document.getElementById('student-header-info');
        if (headerInfo) {
            headerInfo.classList.remove('hidden');
            document.getElementById('sh-name').innerText = currentStudent.student_name || currentStudent.name || 'นักเรียน';
            document.getElementById('sh-id').innerText = currentStudent.student_id || '';
        }

        // ดึงข้อมูลรายวิชาและสื่อการสอน
        await fetchCoursesAndMaterials();

    } catch (error) {
        console.error("Login System Error:", error);
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ 🌐', 'error');
    } finally {
        // คืนค่าปุ่มให้กลับมาปกติ
        if (btn && !currentStudent) {
            btn.disabled = false;
            btn.innerHTML = 'เข้าสู่ระบบ';
            lucide.createIcons();
        } else if (btn && currentStudent) {
            btn.innerHTML = 'เข้าสู่ระบบสำเร็จ';
        }
    }
}


// 🟢 1. วางทับฟังก์ชัน renderCourseSelection เดิม
function renderCourseSelection() {
    // ดักจับ Error ปิด/เปิด หน้าต่างอย่างปลอดภัย
    const courseSel = document.getElementById('view-course-selection');
    const materialsView = document.getElementById('view-materials');
    const appView = document.getElementById('app'); // เผื่อหน้าจอหลักใช้ชื่อ id="app"
    
    if (courseSel) courseSel.classList.remove('hidden');
    if (materialsView) materialsView.classList.add('hidden');
    if (appView) appView.classList.remove('hidden');
    
    const container = document.getElementById('student-course-list');
    if (!container) return; // ป้องกันโค้ดพังถ้าหา HTML ไม่เจอ

    container.innerHTML = studentProfiles.map(profile => {
        const course = courses.find(c => c.course_id === profile.course_id);
        const courseName = course ? course.course_name : 'สื่อทั่วไป';
        
        return `
        <button onclick="selectCourse('${profile.course_id}')" class="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-indigo-300 transition-all flex flex-col items-center justify-center gap-4 group text-center">
            <div class="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors border border-indigo-100 shadow-inner">
                <i data-lucide="book-open" class="w-8 h-8"></i>
            </div>
            <div>
                <h3 class="text-xl font-bold text-slate-800 mb-1 leading-tight">${courseName}</h3>
                <p class="text-xs text-slate-400 font-bold uppercase tracking-widest bg-slate-50 inline-block px-3 py-1 rounded-lg border border-slate-100">${profile.course_id || 'ทั่วไป'}</p>
            </div>
            <div class="mt-2 w-full py-2.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors flex items-center justify-center gap-2">
                เข้าสู่บทเรียน <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </div>
        </button>`;
    }).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// 🟢 2. วางทับฟังก์ชัน selectCourse เดิม
function selectCourse(courseId) {
    const specificProfile = studentProfiles.find(p => p.course_id === courseId);
    if (specificProfile) currentStudent = specificProfile;

    const course = courses.find(c => c.course_id === courseId);
    const courseName = course ? course.course_name : 'สื่อทั่วไป';

    // ดักจับ Error ปิด/เปิด หน้าต่างอย่างปลอดภัย
    const courseSel = document.getElementById('view-course-selection');
    const materialsView = document.getElementById('view-materials');
    const appView = document.getElementById('app');
    
    if (courseSel) courseSel.classList.add('hidden');
    if (materialsView) materialsView.classList.remove('hidden');
    if (appView) appView.classList.remove('hidden');

    const titleDisplay = document.getElementById('course-title-display');
    if (titleDisplay) {
        const titleHtml = studentProfiles.length > 1 
            ? `<button onclick="renderCourseSelection()" class="w-10 h-10 shrink-0 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center transition-colors border border-slate-200"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
               <span class="truncate"><i data-lucide="book" class="w-6 h-6 text-rose-500 inline mr-2 mb-1"></i>${courseName}</span>`
            : `<i data-lucide="book" class="w-6 h-6 text-rose-500 inline mr-2 mb-1"></i>${courseName}`;
        titleDisplay.innerHTML = titleHtml;
    }

    filterByType('all'); 
    if (typeof lucide !== 'undefined') lucide.createIcons();
}



function getYouTubeId(url) {
    if(!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp); return (match && match[2].length === 11) ? match[2] : null;
}

async function handleMaterialAction(id, title) {
    try {
        await db.collection('material_logs').add({
            student_id: currentStudent.student_id,
            student_name: currentStudent.student_name,
            material_id: id,
            material_title: title,
            accessed_at: new Date().toISOString()
        });
    } catch(e) { }
}

function openArticleModal(id) {
    const m = materials.find(x => x.id === id);
    if (!m) return;
    
    handleMaterialAction(m.id, m.title + " (อ่านบทความ)");
    
    document.getElementById('article-read-title').textContent = m.title;
    document.getElementById('article-read-content').innerHTML = m.content || '<p class="text-center text-slate-400 mt-10">ไม่มีเนื้อหา</p>';
    const modal = document.getElementById('article-modal'); const box = document.getElementById('article-modal-box');
    modal.classList.remove('hidden'); void modal.offsetWidth; modal.classList.remove('opacity-0'); box.classList.remove('scale-95'); box.classList.add('scale-100');
}

function openExternalMedia(id, url, titleSuffix) {
    const m = materials.find(x => x.id === id);
    if (m) handleMaterialAction(m.id, m.title + " (" + titleSuffix + ")");
    window.open(url, '_blank');
}

function closeArticleModal() {
    const modal = document.getElementById('article-modal'); const box = document.getElementById('article-modal-box');
    modal.classList.add('opacity-0'); box.classList.remove('scale-100'); box.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function filterByType(type) {
    currentTypeFilter = type;
    // 🟢 เพิ่ม 'worksheet' เข้าไปใน Array ตัวกรอง
    const types = ['all', 'youtube', 'file', 'link', 'album', 'article', 'worksheet'];
    
    types.forEach(t => {
        const btn = document.getElementById(`btn-filter-${t}`);
        if(!btn) return;
        btn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 transition-all flex items-center gap-1';
        if (t === type) {
            if(t === 'all') btn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white shadow-sm transition-all border border-slate-800 flex items-center gap-1';
            else if(t === 'youtube') btn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-200 shadow-sm transition-all flex items-center gap-1';
            else if(t === 'file') btn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm transition-all flex items-center gap-1';
            else if(t === 'link') btn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 shadow-sm transition-all flex items-center gap-1';
            else if(t === 'album') btn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 shadow-sm transition-all flex items-center gap-1';
            else if(t === 'article') btn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm transition-all flex items-center gap-1';
            // 🟢 เพิ่มสไตล์ตอนกดปุ่มใบงาน
            else if(t === 'worksheet') btn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 shadow-sm transition-all flex items-center gap-1';
        }
    });
    renderMaterials();
}


// 🟢 1. นำฟังก์ชันนี้ไปวางไว้ส่วนบนของไฟล์ materials-student.js (เพื่อเอาไว้ทำความสะอาดข้อความ)
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    );
}

// 🟢 2. โค้ดฟังก์ชัน renderMaterials ที่แก้ XSS แล้ว (วางทับฟังก์ชันเดิม)
function renderMaterials() {
    const container = document.getElementById('student-materials-list');
    
    let filteredMaterials = materials.filter(m => {

        // ✅ ขั้นที่ 1: กรองตามวิชา (course_id) ของนักเรียนก่อนเลย
        const studentCourseId = String(currentStudent.course_id || "").trim();
        const materialCourseId = String(m.course_id || "").trim();

        // ถ้านักเรียนมี course_id และสื่อมี course_id → ต้องตรงกันเท่านั้น
        if (studentCourseId && materialCourseId) {
            if (studentCourseId !== materialCourseId) return false;
        }

        // 🟢 แก้ไขใหม่: ขั้นที่ 2 กรองตามระดับชั้น (classroom) รองรับการเลือกหลายห้อง (Array)
        let targetGrades = m.target_grade;
        // ถ้าระบบเก่ายังเป็น String ให้แปลงเป็น Array ก่อนเพื่อความปลอดภัย
        if (!Array.isArray(targetGrades)) {
            targetGrades = targetGrades ? [targetGrades] : ["all"];
        }

        // ตรวจสอบเฉพาะกรณีที่ไม่ได้เลือก "ดูได้ทุกชั้น" ("all")
        if (targetGrades.length > 0 && !targetGrades.includes("all") && !targetGrades.includes("")) {
            const studentGrade = String(
                currentStudent.class_id      ||
                currentStudent.classroom_id  ||
                currentStudent.classroom     ||
                currentStudent.grade         ||
                currentStudent.student_grade || ""
            ).trim().toLowerCase();

            let isMatch = false;

            if (studentGrade) {
                // วนลูปเช็คว่าห้องของนักเรียน ตรงกับห้องใดห้องหนึ่งใน Array ที่ครูเลือกไว้หรือไม่
                for (const tg of targetGrades) {
                    const targetGradeStr = String(tg).trim().toLowerCase();
                    
                    // แบบเป๊ะๆ (Exact match)
                    if (studentGrade === targetGradeStr) {
                        isMatch = true;
                        break;
                    }

                    // แบบเช็คคำนำหน้า (Prefix match) เช่น ม.3/5 เห็นสื่อของ ม.3 ได้
                    const studentParts = studentGrade.split(/[\/\-\s\.]+/);
                    const targetParts  = targetGradeStr.split(/[\/\-\s\.]+/);
                    const isPrefixMatch = targetParts.every((part, i) => studentParts[i] === part);

                    if (isPrefixMatch) {
                        isMatch = true;
                        break;
                    }
                }
            }

            // ถ้าวนเช็คทุกห้องที่ครูตั้งไว้แล้วไม่ตรงเลย ให้ซ่อนสื่อนี้
            if (!isMatch) return false;
        }

        return true;
    });

    // 🟢 2. กรองตามประเภทสื่อ (เมนูด้านบน)
    if (currentTypeFilter !== 'all') {
        filteredMaterials = filteredMaterials.filter(m => {
            if(currentTypeFilter === 'youtube') return !!m.youtube_url || m.type === 'youtube';
            if(currentTypeFilter === 'file') return !!m.file_url || m.type === 'file';
            if(currentTypeFilter === 'link') return !!m.link_url || m.type === 'link';
            if(currentTypeFilter === 'album') return !!m.album_url || m.type === 'album';
            if(currentTypeFilter === 'article') return (m.content && m.content.length > 15) || m.type === 'article';
            if(currentTypeFilter === 'worksheet') return m.type === 'worksheet'; 
            return true;
        });
    }

    // 🟢 3. กรณีไม่มีสื่อให้แสดงผล
    if(filteredMaterials.length === 0) {
        container.innerHTML = `<div class="col-span-full bg-white p-12 rounded-[2rem] text-center border border-slate-200 shadow-sm"><i data-lucide="coffee" class="w-12 h-12 text-slate-300 mx-auto mb-4"></i><p class="text-slate-500 font-medium">ยังไม่มีสื่อในหมวดหมู่นี้ครับ</p></div>`; 
        lucide.createIcons(); 
        return;
    }

    // 🟢 4. วาดการ์ดสื่อการสอน
    container.innerHTML = filteredMaterials.map(m => {
        const c = courses.find(c => c.course_id === m.course_id); 
        const cName = c ? c.course_name : 'สื่อทั่วไป';
        
        // 🛡️ ทำความสะอาดตัวแปรข้อความต่างๆ ก่อนนำไปยัดลง HTML
        const safeTitle = escapeHTML(m.title);
        const safeDesc = escapeHTML(m.desc);
        const safeCName = escapeHTML(cName);
        
        const yt = m.youtube_url || (m.type === 'youtube' ? m.url : '');
        const fl = m.file_url || (m.type === 'file' ? m.url : '');
        const ln = m.link_url || (m.type === 'link' ? m.url : '');
        const al = m.album_url || (m.type === 'album' ? m.url : '');
        const ar = (m.content && m.content.length > 15) ? m.content : (m.type === 'article' ? m.content : '');
        const isWs = (m.type === 'worksheet'); 

        let thumbUrl = m.cover_url || '';
        if (!thumbUrl && yt) {
            const ytId = getYouTubeId(yt);
            thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : 'https://via.placeholder.com/640x360.png?text=YouTube+Video';
        }
        
        // 🛡️ ป้องกันกรณี URL ของรูปภาพมีการใส่ Quote แปลกๆ
        const safeThumbUrl = escapeHTML(thumbUrl);

        let mediaHtml = '';
        if (safeThumbUrl) {
            mediaHtml = `<div class="w-full h-48 bg-slate-900 rounded-2xl mb-4 overflow-hidden relative"><img src="${safeThumbUrl}" class="w-full h-full object-cover opacity-90 transition-all duration-500 hover:scale-105 hover:opacity-100"></div>`;
        } else {
            const iconType = isWs ? 'edit-3' : 'layers';
            const iconColor = isWs ? 'text-blue-300' : 'text-slate-300';
            const bgColor = isWs ? 'bg-blue-50' : 'bg-slate-100';
            mediaHtml = `<div class="w-full h-32 ${bgColor} rounded-2xl mb-4 flex items-center justify-center border border-slate-200"><i data-lucide="${iconType}" class="w-12 h-12 ${iconColor}"></i></div>`;
        }

        let buttonsHtml = `<div class="mt-auto flex flex-col gap-2 pt-2">`;
        
        if(yt) buttonsHtml += `<button data-action="open-media" data-id="${m.id}" data-url="${encodeURIComponent(yt)}" data-label="ดูคลิป" class="w-full py-3 rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"><i data-lucide="youtube" class="w-4 h-4"></i> ดูคลิปวิดีโอ</button>`;
        if(fl) buttonsHtml += `<button data-action="open-media" data-id="${m.id}" data-url="${encodeURIComponent(fl)}" data-label="ดาวน์โหลดไฟล์" class="w-full py-3 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"><i data-lucide="download" class="w-4 h-4"></i> ดาวน์โหลดเอกสาร</button>`;
        if(al) buttonsHtml += `<button data-action="open-media" data-id="${m.id}" data-url="${encodeURIComponent(al)}" data-label="ดูอัลบั้ม" class="w-full py-3 rounded-xl text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"><i data-lucide="image" class="w-4 h-4"></i> ดูอัลบั้มภาพ</button>`;
        if(ln) buttonsHtml += `<button data-action="open-media" data-id="${m.id}" data-url="${encodeURIComponent(ln)}" data-label="เปิดเว็บไซต์" class="w-full py-3 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"><i data-lucide="external-link" class="w-4 h-4"></i> ไปที่เว็บไซต์อ้างอิง</button>`;
        if(ar) buttonsHtml += `<button data-action="open-article" data-id="${m.id}" class="w-full py-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"><i data-lucide="book-open" class="w-4 h-4"></i> อ่านบทความ/เนื้อหา</button>`;
        
        // 🟢 ชุดโค้ดปุ่มใบงานแบบใหม่ที่เพิ่มเข้าไป
        if(isWs) {
            // ดัก Error กรณี studentSubmissions ประกาศผิดที่ หรือยังไม่โหลด
            const submissionsMap = typeof studentSubmissions !== 'undefined' ? studentSubmissions : {};
            const submission = submissionsMap[m.id]; 

            if (!submission) {
                // สถานะ: ยังไม่เคยทำ
                buttonsHtml += `<button data-action="open-worksheet" data-id="${m.id}" class="w-full py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white border border-blue-500 hover:from-blue-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 shadow-[0_4px_0_0_rgba(59,130,246,0.5)] hover:shadow-[0_2px_0_0_rgba(59,130,246,0.5)] hover:translate-y-[2px]"><i data-lucide="edit-3" class="w-4 h-4"></i> เริ่มทำใบงาน</button>`;
            } else if (submission.status === 'pending') {
                // สถานะ: รอตรวจ
                buttonsHtml += `<button data-action="open-worksheet" data-id="${m.id}" class="w-full py-3 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-400/50 text-amber-600 backdrop-blur-sm transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-amber-500/20"><i data-lucide="clock" class="w-4 h-4 animate-pulse"></i> ส่งแล้ว (คลิกเพื่อแก้ไข)</button>`;
            } else {
                // สถานะ: ตรวจแล้ว
                const scoreToShow = submission.score !== undefined ? submission.score : '-';
                buttonsHtml += `<button data-action="open-worksheet" data-id="${m.id}" class="w-full py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-400 to-teal-500 text-white border border-emerald-400 hover:from-emerald-500 hover:to-teal-600 transition-all flex items-center justify-center gap-2 shadow-[0_4px_0_0_rgba(16,185,129,0.5)] hover:shadow-[0_2px_0_0_rgba(16,185,129,0.5)] hover:translate-y-[2px]"><i data-lucide="check-circle" class="w-4 h-4"></i> ตรวจแล้ว (${scoreToShow} คะแนน) - ส่งแก้</button>`;
            }
        }
        
        buttonsHtml += `</div>`;

        const badgeHtml = isWs ? `<span class="bg-blue-600 text-white px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1"><i data-lucide="pen-tool" class="w-3 h-3"></i> ใบงาน</span>` : '';

        // 🛡️ ใช้ safeTitle, safeDesc, safeCName ในส่วนของการแสดงผล
        return `
        <div class="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all flex flex-col group h-full">
            ${mediaHtml}
            <div class="flex items-center gap-2 mb-2">
                <span class="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1"><i data-lucide="book" class="w-3 h-3"></i> ${safeCName}</span>
                ${badgeHtml}
            </div>
            <h3 class="text-xl font-bold text-slate-800 leading-tight mb-2">${safeTitle}</h3>
            ${safeDesc ? `<p class="text-sm text-slate-500 mb-4">${safeDesc}</p>` : '<div class="mb-4"></div>'}
            ${buttonsHtml}
        </div>`;
    }).join('');
    
    lucide.createIcons();
}


// ==========================================
// 🛡️ Event Delegation (แก้บั๊ก XSS)
// ==========================================
document.getElementById('student-materials-list').addEventListener('click', function(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'open-media') {
        const url = decodeURIComponent(btn.dataset.url);
        const label = btn.dataset.label;
        openExternalMedia(id, url, label);
    } else if (action === 'open-article') {
        openArticleModal(id);
    } else if (action === 'open-worksheet') {
        const m = materials.find(x => x.id === id);
        if (!m) return;
        const c = courses.find(c => c.course_id === m.course_id);
        const cName = c ? c.course_name : 'สื่อทั่วไป';
        openWorksheetModal(id, m.title, cName);
    }
});



function showToast(msg, type='success') {
    const c = document.getElementById('toast-container'); const t = document.createElement('div');
    t.className = `bg-white rounded-xl px-5 py-3.5 border shadow-xl flex items-center gap-3 toast-show ${type === 'success' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`;
    t.innerHTML = `<i data-lucide="${type==='success'?'check-circle':'alert-circle'}" class="w-5 h-5 shrink-0"></i><span class="text-sm font-bold">${msg}</span>`;
    c.appendChild(t); lucide.createIcons({nodes: [t]}); setTimeout(() => { t.classList.replace('toast-show','toast-hide'); setTimeout(()=>t.remove(), 300); }, 3500);
}

// เปลี่ยนฟังก์ชันเป็น async เพื่อให้ดึงข้อมูลจาก Database ได้
async function openWorksheetModal(id, title, subject) {
    currentWorksheetId = id;
    document.getElementById('worksheet-title').innerText = title;
    document.getElementById('worksheet-subject').innerText = subject;
    
    const contentDiv = document.getElementById('worksheet-content');
    
    // แสดงไอคอนโหลดข้อมูลระหว่างรอเช็คประวัติการส่ง
    contentDiv.innerHTML = '<div class="flex justify-center items-center py-10"><i data-lucide="loader" class="w-8 h-8 animate-spin text-blue-500"></i><span class="ml-2 text-slate-500">กำลังตรวจสอบข้อมูล...</span></div>';
    
    const modal = document.getElementById('worksheet-modal');
    const box = document.getElementById('worksheet-modal-box');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        box.classList.remove('scale-95');
    }, 10);
    lucide.createIcons();

    try {
        // 1. ดึงโจทย์จาก materials
        const m = materials.find(item => item.id === id);
        const questions = m.questions || []; 

        // 2. เช็คประวัติว่าเด็กคนนี้เคยส่งใบงานนี้แล้วหรือยัง
        const existingSnap = await db.collection('submissions')
            .where('student_id', '==', currentStudent.student_id)
            .where('worksheet_id', '==', id)
            .get();

        let previousAnswers = {};
        let isResubmit = false;
        let statusText = '';

        if (!existingSnap.empty) {
            const existingData = existingSnap.docs[0].data();
            previousAnswers = existingData.answers || {}; // เก็บคำตอบเดิม
            isResubmit = true;
            statusText = existingData.status === 'pending' ? 'รอครูตรวจ' : 'ครูตรวจแล้ว';
        }

        // 3. สร้างแบนเนอร์แจ้งเตือนถ้าเป็นการส่งซ้ำ
        let alertHtml = '';
        if (isResubmit) {
            alertHtml = `
            <div class="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start shadow-sm">
                <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-500 shrink-0 mt-0.5"></i>
                <div>
                    <h4 class="text-sm font-bold text-amber-800">คุณเคยส่งใบงานนี้แล้ว (สถานะ: ${statusText})</h4>
                    <p class="text-xs text-amber-600 mt-1">ข้อมูลด้านล่างคือคำตอบเดิมของคุณ หากแก้ไขและกดส่งใหม่ จะถือเป็นการส่งงานซ้ำครับ</p>
                </div>
            </div>`;
        }

        // 4. นำคำถามและ "คำตอบเดิม" มาใส่ลงในช่อง Textarea
        if (questions.length === 0) {
            contentDiv.innerHTML = alertHtml + '<p class="text-center text-slate-500 my-10 font-medium">คุณครูยังไม่ได้เพิ่มข้อคำถามในใบงานนี้ครับ</p>';
        } else {
            contentDiv.innerHTML = alertHtml + questions.map((q, i) => {
                const oldAns = previousAnswers[q.id] || ''; // ดึงคำตอบเดิมมาแสดง (ถ้าไม่มีจะเป็นค่าว่าง)
                return `
                <div class="mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p class="text-slate-800 font-bold mb-3 text-sm">${i+1}. ${q.text}</p>
                    <textarea id="ans_${q.id}" rows="3" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all worksheet-answer" placeholder="พิมพ์คำตอบของคุณที่นี่...">${oldAns}</textarea>
                </div>
            `}).join('');
        }
        
        handleMaterialAction(m.id, m.title + " (เปิดทำใบงาน)");
        lucide.createIcons();

    } catch (error) {
        console.error("Error loading worksheet data:", error);
        contentDiv.innerHTML = '<p class="text-center text-rose-500 my-10 font-medium">เกิดข้อผิดพลาดในการโหลดข้อมูลใบงาน</p>';
    }
}

function closeWorksheetModal() {
    const modal = document.getElementById('worksheet-modal');
    const box = document.getElementById('worksheet-modal-box');
    modal.classList.add('opacity-0');
    box.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
    currentWorksheetId = null;
    isSubmittingWorksheet = false; // ✅ reset flag ทุกครั้งที่ปิด modal
}

async function submitWorksheet() {
    // ✅ ป้องกัน double submit
    if (isSubmittingWorksheet) return;

    // ✅ เช็คก่อนว่ายังมี worksheet อยู่ไหม
    if (!currentWorksheetId) {
        showToast('เกิดข้อผิดพลาด กรุณาเปิดใบงานใหม่อีกครั้ง', 'error');
        return;
    }

    const answers = {};
    let isComplete = true;
    
    document.querySelectorAll('.worksheet-answer').forEach(el => {
        const qId = el.id.replace('ans_', '');
        const val = el.value.trim();
        if (!val) isComplete = false;
        answers[qId] = val;
    });

    if (!isComplete) return showToast('กรุณาตอบคำถามให้ครบทุกข้อครับ', 'error');

    // ✅ ตั้ง flag ก่อน await เสมอ
    isSubmittingWorksheet = true;

    const btn = document.getElementById('btn-submit-worksheet');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังส่ง...';
    lucide.createIcons();

    try {
        const studentGrade = currentStudent.grade 
            || currentStudent.student_grade 
            || currentStudent.classroom 
            || "";

       // ✅ เช็คงานซ้ำก่อน submit จริง
        const existingSnap = await db.collection('submissions')
            .where('student_id', '==', currentStudent.student_id)
            .where('worksheet_id', '==', currentWorksheetId)
            .get();

        let existingDocId = null;

        if (!existingSnap.empty) {
            const existingDoc = existingSnap.docs[0];
            
            // ✅ เก็บ ID ของงานเดิมไว้ เพื่อใช้อัปเดตข้อมูลทับของเดิม (อนุญาตให้แก้ไขได้ทุกสถานะ)
            existingDocId = existingDoc.id; 
        }
        
        const payload = {
            student_id: currentStudent.student_id,
            student_name: currentStudent.student_name || currentStudent.name, 
            grade: studentGrade,
            title: document.getElementById('worksheet-title').innerText,
            subject: document.getElementById('worksheet-subject').innerText, 
            course_id: currentStudent.course_id || "", 
            submitted_at: new Date().toISOString(), 
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: "pending", // 🟢 เปลี่ยนสถานะกลับเป็นรอตรวจ
            submission_type: "online_worksheet",
            worksheet_id: currentWorksheetId,
            answers: answers,
            score: 0
        };

        // 🟢 แยกว่าจะสร้างใหม่ หรืออัปเดตงานเดิม
        if (existingDocId) {
            payload.description = "[ส่งซ้ำ] แก้ไขใบงาน"; // แปะป้ายให้ครูรู้ว่านี่คืองานส่งซ้ำ
            await db.collection('submissions').doc(existingDocId).update(payload);
            showToast('ส่งงานแก้ไขสำเร็จแล้วครับ! รอครูตรวจอีกครั้งนะ 🎉', 'success');
        } else {
            await db.collection('submissions').add(payload);
            showToast('ส่งใบงานสำเร็จแล้วครับ! รอครูตรวจนะ 🎉', 'success');
        }
        // ========================================================
        // 🚀 เพิ่มโค้ดแจ้งเตือน LINE สำหรับ "แบบฝึกหัด" ตรงนี้เลยครับ
        // ========================================================
        try {
            const setSnap = await db.collection("settings").doc("system").get();
            if (setSnap.exists && setSnap.data().lineToken) {
                let currentUrl = window.location.href.split("?")[0].replace("index.html", "");
                if (!currentUrl.endsWith("/")) currentUrl += "/";
                
                // 📝 ครูเบียร์สามารถปรับแก้ข้อความแจ้งเตือนตรงนี้ได้เลยครับ (ผมใส่ไอคอน 📝 ให้ต่างจากงานปกติ)
                const msg = `\n📝 มีการส่งใบงาน/แบบฝึกหัด!\n👨‍🎓 ${currentStudent.student_name}\n📚 วิชา: ${document.getElementById('worksheet-subject').innerText}\n📌 ชื่อใบงาน: ${document.getElementById('worksheet-title').innerText}\n\n✅ คลิกเพื่อเข้าตรวจใบงาน:\n${currentUrl}quick-grade.html`;
                
                // นำ Web App URL ของครูเบียร์มาใส่ (ดึงมาจากไฟล์ submit-script.js)
                const UPLOAD_GAS_URL = "https://script.google.com/macros/s/AKfycbzTSa1DKU5hdxa3l_ghGMZVzkQj4h7z1LFCZ4CCFQ-CX9EBH4zNGGg8Po6Wlgz9uMSJ/exec";
                
                // ยิงข้อมูลไปที่ Google Apps Script เพื่อส่งเข้า LINE
                fetch(UPLOAD_GAS_URL, {
                    method: "POST",
                    body: JSON.stringify({
                        action: "notify",
                        data: { token: setSnap.data().lineToken, message: msg }
                    }),
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                });
            }
        } catch (lineErr) {
            console.error("LINE Notify Error: ", lineErr);
        }
        // ========================================================
        // อัปเดตตัวแปรสถานะของนักเรียนทันที
        if (typeof studentSubmissions === 'undefined') studentSubmissions = {};
        studentSubmissions[currentWorksheetId] = {
            status: 'pending',
            score: 0
        };
        // สั่งวาดการ์ดสื่อใหม่เพื่อให้ปุ่มเปลี่ยนสถานะ
        renderMaterials(); 
        closeWorksheetModal();

    } catch (e) { 
        console.error("Error submit worksheet:", e);
        showToast('เกิดข้อผิดพลาดในการส่งงาน', 'error'); 
    } finally {
        // ✅ คืนค่าทุกอย่างใน finally เสมอ ไม่ว่าจะสำเร็จหรือไม่
        isSubmittingWorksheet = false;
        btn.disabled = false;
        btn.innerHTML = origHtml;
        lucide.createIcons();
    }
}


// 🟢 3. วางทับฟังก์ชัน fetchCoursesAndMaterials เดิม
async function fetchCoursesAndMaterials() {
    try {
        const courseSnap = await db.collection('courses').get();
        courses = courseSnap.docs.map(d => ({ course_id: d.id, ...d.data() })); 

        const materialSnap = await db.collection('materials').get();
        materials = materialSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        materials.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        // 🟢 เพิ่มโค้ดส่วนนี้: ดึงข้อมูลประวัติการส่งงานของเด็กคนนี้มาเก็บไว้
        studentSubmissions = {};
        if (currentStudent && currentStudent.student_id) {
            const subSnap = await db.collection('submissions')
                .where('student_id', '==', currentStudent.student_id)
                .where('submission_type', '==', 'online_worksheet')
                .get();

            subSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.worksheet_id) {
                    studentSubmissions[data.worksheet_id] = data; 
                }
            });
        }

        // ปิดหน้า Login อย่างปลอดภัย ไม่ว่า HTML จะตั้งชื่อ id ของหน้าล็อกอินว่าอะไร
        const loginViews = ['view-login', 'login-section', 'login-overlay', 'login-container'];
        loginViews.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        if (studentProfiles.length > 1) {
            renderCourseSelection();
        } else if (studentProfiles.length === 1) {
            const courseId = studentProfiles[0].course_id || '';
            selectCourse(courseId);
        } else {
             showToast('ไม่พบข้อมูลรายวิชาของคุณ', 'error');
        }

    } catch (error) {
        console.error("Error fetching data:", error);
        showToast('เกิดข้อผิดพลาดในการโหลดบทเรียน 📚', 'error');
    }
}

