//const GAS_URL = 'https://script.google.com/macros/s/AKfycbzTSa1DKU5hdxa3l_ghGMZVzkQj4h7z1LFCZ4CCFQ-CX9EBH4zNGGg8Po6Wlgz9uMSJ/exec';
let GAS_URL = localStorage.getItem("gasUrl") || "";

// ===== Global State =====
let allStudents = [];
let courses = [];
let allSubmissions = [];
let attRecords = [];
let previousSubCount = 0;
let deleteTarget = null;
let itemToDeleteSub = null;
let currentTab = "dashboard";
let teacherListTab = "pending";
let currentGradeItem = null;
let currentClass = "all";
let currentStudentPage = 1;

const studentsPerPage = 10; // แสดงหน้าละ 10 คน (แก้ไขตัวเลขได้ครับ)
let currentSubPage = 1;
const subsPerPage = 10;
let currentCourseId = "default_course";
let currentAttTab = "rooms";

const defaultCategories = [
  { name: "งาน/การบ้าน", max: 20 },
  { name: "สอบกลางภาค", max: 30 },
  { name: "สอบปลายภาค", max: 50 },
];
// 🌟 เกณฑ์คะแนนเริ่มต้นแบบมัธยม
const defaultGradeCriteria = JSON.stringify({
  g4: 80,
  g35: 75,
  g3: 70,
  g25: 65,
  g2: 60,
  g15: 55,
  g1: 50,
});

window.onload = async () => {
  lucide.createIcons();
  const btnDeleteSub = document.getElementById("btn-confirm-delete-sub");
  if (btnDeleteSub)
    btnDeleteSub.addEventListener("click", executeDeleteSubmission);

  loadAttSettings();
  document.getElementById("att-check-date").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("att-rpt-month").value = new Date()
    .toISOString()
    .slice(0, 7);

  const addRoomBtn = document.querySelector(
    "button[onclick=\"showAttModal('add-room')\"]",
  );
  if (addRoomBtn) addRoomBtn.style.display = "none";

  await loadAllData();

  // 🚨 ลบบรรทัด setInterval ออกไปเลย เพื่อหยุดการสูบ Data 🚨
  // setInterval(loadAllDataSilent, 15000);
};

function hideLoading() {
  const loader = document.getElementById("loading-overlay");
  if (loader) {
    loader.style.opacity = "0";
    setTimeout(() => {
      loader.style.display = "none";
      document.getElementById("app").classList.remove("hidden");
    }, 500);
  }
}

function getFilteredStudents() {
  let data = allStudents.filter((s) => s.course_id === currentCourseId);
  if (currentClass !== "all")
    data = data.filter((s) => s.classroom === currentClass);
  return data;
}

// 🌟 โหลดข้อมูลทั้งหมด
async function loadAllData() {
  try {
    const [studentSnap, courseSnap, subSnap, recordSnap] = await Promise.all([
      db.collection("students").get(),
      db.collection("courses").get(),
      db.collection("submissions").get(),
      db.collection("att_records").get(),
    ]);

    allStudents = studentSnap.docs.map((doc) => ({
      __backendId: doc.id,
      ...doc.data(),
    }));
    courses = courseSnap.docs.map((doc) => ({
      __backendId: doc.id,
      ...doc.data(),
    }));
    allSubmissions = subSnap.docs.map((doc) => ({
      __backendId: doc.id,
      ...doc.data(),
    }));
    attRecords = recordSnap.docs.map((doc) => ({
      __backendId: doc.id,
      ...doc.data(),
    }));
    previousSubCount = allSubmissions.length;

    if (courses.length === 0) {
      courses = [
        {
          course_id: "default_course",
          course_name: "วิชาเริ่มต้น",
          grade_criteria: defaultGradeCriteria,
          score_categories: JSON.stringify(defaultCategories),
        },
      ];
    }
    if (!courses.find((c) => c.course_id === currentCourseId))
      currentCourseId = courses[0].course_id;

    updateCourseSelectors();
    applyCourseSettingsToUI();
    updateClassSelector();
    updateAttRoomSelectors();
    updateGlobalBadges();
    refreshCurrentTab();
  } catch (e) {
    console.error(e);
    showToast("โหลดข้อมูลล้มเหลว กรุณารีเฟรชหน้าจอ", "error");
  } finally {
    hideLoading();
  }
}

async function loadAllDataSilent() {
  try {
    const studentSnap = await db.collection("students").get();
    allStudents = studentSnap.docs.map((doc) => ({
      __backendId: doc.id,
      ...doc.data(),
    }));
    const subSnap = await db.collection("submissions").get();
    allSubmissions = subSnap.docs.map((doc) => ({
      __backendId: doc.id,
      ...doc.data(),
    }));

    let pendingCount = 0;
    let resubmitCount = 0;
    let gradedCount = 0;
    allSubmissions.forEach((item) => {
      const student = allStudents.find(
        (s) => String(s.student_id) === String(item.student_id),
      );
      if (!student) return;
      let bucket = "pending";
      const isResubmitDesc =
        item.description && String(item.description).includes("[ส่งซ้ำ]");
      try {
        const scs = JSON.parse(student.scores || "[]");
        const found = scs.find((s) => s.name === item.title);
        if (found && found.score !== null && found.score !== "") {
          if (
            found.graded_at &&
            new Date(item.submitted_at) > new Date(found.graded_at)
          )
            bucket = "resubmit";
          else bucket = "graded";
        } else {
          bucket = isResubmitDesc ? "resubmit" : "pending";
        }
      } catch (e) {}
      if (bucket === "pending") pendingCount++;
      else if (bucket === "resubmit") resubmitCount++;
      else if (bucket === "graded") gradedCount++;
    });

    const dashBadge = document.getElementById("dash-badge-pending");
    if (
      dashBadge &&
      dashBadge.textContent !== String(pendingCount + resubmitCount)
    ) {
      dashBadge.textContent = pendingCount + resubmitCount;
      dashBadge.style.transition = "all 0.3s";
      dashBadge.style.transform = "scale(1.5)";
      dashBadge.style.backgroundColor = "#ec4899";
      setTimeout(() => {
        dashBadge.style.transform = "scale(1)";
        dashBadge.style.backgroundColor = "";
      }, 500);
    }
    const bPending = document.getElementById("badge-pending");
    if (bPending) bPending.textContent = pendingCount;
    const bResubmit = document.getElementById("badge-resubmit");
    if (bResubmit) bResubmit.textContent = resubmitCount;
    const bGraded = document.getElementById("badge-graded");
    if (bGraded) bGraded.textContent = gradedCount;

    if (allSubmissions.length !== previousSubCount) {
      previousSubCount = allSubmissions.length;
      const gradeModal = document.getElementById("grade-modal");
      if (
        currentTab === "submissions" &&
        (!gradeModal || !gradeModal.classList.contains("active"))
      )
        renderTeacherSubmissions();
    }
  } catch (e) {}
}

function showToast(msg, type = "success") {
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  const colors = {
    success: "bg-green-50 border-green-200 text-green-700",
    error: "bg-red-50 border-red-200 text-red-700",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };
  const icons = {
    success: "check-circle",
    error: "alert-circle",
    info: "info",
  };
  t.className = `bg-white rounded-xl px-5 py-3.5 border shadow-xl slide-up flex items-center gap-3 ${colors[type]}`;
  t.innerHTML = `<i data-lucide="${icons[type]}" class="w-5 h-5 shrink-0"></i><span class="text-sm font-bold">${msg}</span>`;
  c.appendChild(t);
  lucide.createIcons({ nodes: [t] });
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(10px)";
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

function switchTab(tab) {
  // 🟢 เปลี่ยนเส้นทาง tab เก่าไปยังศูนย์ควบคุมชั้นเรียนใหม่ (แท็บย่อย)
  if (["grading", "stats", "export", "attendance"].includes(tab)) {
    if (typeof switchSubTab === 'function') switchSubTab(tab);
    tab = "classroom-center";
  }

  currentTab = tab;
  // 🌟 อัปเดต Array ใหม่ให้ตรงกับเมนูหลัก
  [
    "dashboard",
    "submissions",
    "announcements",
    "system-settings",
    "classroom-center"
  ].forEach((t) => {
    const el = document.getElementById(`panel-${t}`);
    if (el) el.classList.toggle("hidden", t !== tab);
  });
  refreshCurrentTab();
}

function refreshCurrentTab() {
  if (currentTab === "submissions") renderTeacherSubmissions();
  if (currentTab === "announcements") loadAdminAnnouncements();
  if (currentTab === "system-settings") loadSystemToggles();

  // 🟢 โหลดข้อมูลเมื่อเปิดหน้าศูนย์ควบคุมชั้นเรียน
  if (currentTab === "classroom-center") {
    renderStudentList();
    renderGradingTable();
    renderStats();
    if (typeof switchAttTab === 'function') switchAttTab(currentAttTab);
    
    // อัปเดต Label หน้าส่งออก (เผื่อกรณีสลับไปใช้หน้าส่งออก)
    const exportLabel = document.getElementById("export-class-label");
    if (exportLabel) {
      exportLabel.textContent = currentClass === "all" ? "รวมทุกห้อง" : currentClass;
    }
  }

  lucide.createIcons();
}

// ==================== ส่วนที่ 1: โค้ดระบบส่งงานและ 360° Profile ====================
function openStudentProfileById(studentId) {
  const student = allStudents.find(
    (s) => String(s.student_id) === String(studentId),
  );
  if (!student) return showToast("ไม่พบข้อมูลนักเรียน", "error");

  document.getElementById("sp-name").textContent = student.student_name;
  document.getElementById("sp-id").textContent = student.student_id;
  document.getElementById("sp-room").textContent = student.classroom;
  document.getElementById("sp-avatar").src =
    student.profile_url ||
    student.avatar ||
    generateAvatar(student.student_name);

  document.getElementById("sp-grade").textContent = student.grade || "0";
  document.getElementById("sp-total").textContent = student.total || 0;
  document.getElementById("sp-pct").textContent = student.percentage || 0;

  const recs = attRecords.filter(
    (r) => String(r.student_id) === String(studentId),
  );
  let p = 0,
    a = 0,
    l = 0,
    lt = 0;
  recs.forEach((r) => {
    if (r.status === "present") p++;
    if (r.status === "absent") a++;
    if (r.status === "leave") l++;
    if (r.status === "late") lt++;
  });
  document.getElementById("sp-att-p").textContent = p;
  document.getElementById("sp-att-a").textContent = a;
  document.getElementById("sp-att-l").textContent = l;
  document.getElementById("sp-att-lt").textContent = lt;

  const course = courses.find((c) => c.course_id === student.course_id);
  let expectedCats = [];
  try {
    if (course) expectedCats = JSON.parse(course.score_categories);
  } catch (e) {}
  let scs = [];
  try {
    scs = JSON.parse(student.scores || "[]");
  } catch (e) {}
  const subs = allSubmissions.filter(
    (s) => String(s.student_id) === String(studentId),
  );

  let html = "";
  if (expectedCats.length === 0) {
    html =
      '<p class="text-slate-400 text-center py-8">ไม่มีข้อมูลช่องคะแนนในวิชานี้</p>';
  } else {
    expectedCats.forEach((cat) => {
      const graded = scs.find((s) => s.name === cat.name);
      const subItems = subs
        .filter((s) => s.title === cat.name)
        .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
      const subItem = subItems.length > 0 ? subItems[0] : null;

      let statusUI = "";
      let scoreUI = `<span class="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">ยังไม่มีคะแนน</span>`;

      if (graded && graded.score !== null && graded.score !== "") {
        if (
          subItem &&
          graded.graded_at &&
          new Date(subItem.submitted_at) > new Date(graded.graded_at)
        ) {
          statusUI = `<span class="bg-orange-100 text-orange-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"><i data-lucide="refresh-cw" class="w-3 h-3 inline mr-1"></i>ส่งอัปเดตใหม่ (รอตรวจ)</span>`;
          scoreUI = `<span class="text-sm font-bold text-slate-700">${graded.score} <span class="text-xs text-slate-400 font-medium">/ ${cat.max}</span></span>`;
        } else {
          statusUI = `<span class="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"><i data-lucide="check-circle" class="w-3 h-3 inline mr-1"></i>ตรวจแล้ว</span>`;
          scoreUI = `<span class="text-sm font-bold text-emerald-600">${graded.score} <span class="text-xs text-emerald-400 font-medium">/ ${cat.max}</span></span>`;
        }
      } else if (subItem) {
        statusUI = `<span class="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>รอตรวจ</span>`;
      } else {
        statusUI = `<span class="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"><i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i>ค้างส่ง</span>`;
      }

      html += `<div class="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 transition-all shadow-sm"><div class="flex items-center gap-4"><div class="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0"><i data-lucide="file-text" class="w-5 h-5 text-indigo-400"></i></div><div><p class="text-sm font-bold text-slate-800">${cat.name}</p><div class="mt-1.5">${statusUI}</div></div></div><div class="text-right shrink-0 ml-4">${scoreUI}</div></div>`;
    });
  }
  document.getElementById("sp-assignments").innerHTML = html;

  // 🌟 วางคำสั่งผูกปุ่มพิมพ์ไว้ตรงนี้ (ก่อนสั่งเปิดหน้าต่าง)
  const printBtn = document.getElementById("btn-print-portfolio");
  if (printBtn) printBtn.onclick = () => exportEPortfolio(studentId);

  // บรรทัดที่มีอยู่เดิม (เอาไว้ล่างสุดของส่วนนี้)
  document.getElementById("student-profile-modal").classList.remove("hidden");
  setTimeout(
    () =>
      document.getElementById("student-profile-modal").classList.add("active"),
    10,
  );
  lucide.createIcons();

  document.getElementById("student-profile-modal").classList.remove("hidden");
  setTimeout(
    () =>
      document.getElementById("student-profile-modal").classList.add("active"),
    10,
  );
  lucide.createIcons();
}

function closeStudentProfile() {
  document.getElementById("student-profile-modal").classList.remove("active");
  setTimeout(
    () =>
      document.getElementById("student-profile-modal").classList.add("hidden"),
    300,
  );
}

function switchTeacherListTab(tab) {
  teacherListTab = tab;
  currentSubPage = 1;
  const tabs = ["pending", "resubmit", "graded"];
  tabs.forEach((t) => {
    const btn = document.getElementById(`t-tab-${t}`);
    const badge = document.getElementById(`badge-${t}`);
    if (!btn || !badge) return;
    if (t === tab) {
      if (t === "pending") {
        btn.className =
          "px-6 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-indigo-200 transition-all whitespace-nowrap";
        badge.className =
          "bg-indigo-500 text-white px-2 py-0.5 rounded-md text-xs";
      } else if (t === "resubmit") {
        btn.className =
          "px-6 py-2.5 rounded-2xl bg-orange-500 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-orange-200 transition-all whitespace-nowrap";
        badge.className =
          "bg-orange-400 text-white px-2 py-0.5 rounded-md text-xs";
      } else if (t === "graded") {
        btn.className =
          "px-6 py-2.5 rounded-2xl bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-emerald-200 transition-all whitespace-nowrap";
        badge.className =
          "bg-emerald-400 text-white px-2 py-0.5 rounded-md text-xs";
      }
    } else {
      btn.className =
        "px-6 py-2.5 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap";
      badge.className =
        "bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-xs";
    }
  });
  renderTeacherSubmissions();
}

function openPreviewModal(url, name) {
  const modal = document.getElementById("preview-modal");
  const title = document.getElementById("preview-title");
  const iframe = document.getElementById("preview-iframe");
  const loader = document.getElementById("preview-loading");
  const dlBtn = document.getElementById("preview-download-btn");
  
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.add("active"), 10);
  
  title.innerHTML = `<div class="p-2 bg-indigo-100 rounded-xl"><i data-lucide="file-search" class="w-5 h-5 text-indigo-600"></i></div> <span class="truncate">${name}</span>`;
  dlBtn.href = url;
  
  // รีเซ็ตหน้าจอโหลดดิง
  loader.classList.remove("hidden");
  loader.style.opacity = "1";
  loader.innerHTML = `
    <i data-lucide="loader" class="w-14 h-14 text-indigo-600 animate-spin mb-6"></i>
    <p class="text-lg text-slate-800 font-bold tracking-wide">กำลังเปิดอ่านไฟล์...</p>
    <p class="text-xs text-slate-500 mt-2 text-center px-6">หากพบปัญหาเรื่องสิทธิ์การเข้าถึง ให้คลิกปุ่ม "เปิดในแท็บใหม่" ด้านบนขวา</p>
  `;
  lucide.createIcons();
  
  let embedUrl = url;
  let fileId = null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    fileId = match[1];
    embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  }
  
  // ตรวจสอบว่าเป็นไฟล์รูปภาพหรือไม่ (ดูจากชื่อไฟล์ หรือ URL ถ้ามีนามสกุล)
  const isImage = (name && name.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i)) || 
                  (url && url.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i));
                  
  const container = iframe.parentNode;
  
  // ลบรูปภาพจำลองเก่าทิ้ง (ถ้ามี)
  const oldImg = document.getElementById("preview-dynamic-img");
  if (oldImg) oldImg.remove();

  if (isImage) {
    // 💡 แก้ปัญหา CSP: ถ้าเป็นรูปภาพ ให้ใช้แท็ก <img> แทน <iframe>
    iframe.classList.add("hidden");
    iframe.src = ""; // หยุดการโหลด iframe
    
    const img = document.createElement("img");
    img.id = "preview-dynamic-img";
    img.className = "w-full h-full object-contain relative z-10 bg-slate-100 p-4";
    
    if (fileId) {
        // ใช้ uc?export=view ดึงรูปภาพโดยตรง ทะลุ CSP Frame Ancestors
        img.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
    } else {
        img.src = url;
    }
    
    img.onload = () => {
      loader.style.opacity = "0";
      setTimeout(() => loader.classList.add("hidden"), 300);
    };
    
    img.onerror = () => {
      loader.innerHTML = `
        <i data-lucide="image-off" class="w-14 h-14 text-rose-500 mb-6"></i>
        <p class="text-lg text-slate-800 font-bold tracking-wide">ไม่สามารถแสดงรูปภาพได้</p>
        <p class="text-xs text-rose-500 mt-2 text-center px-6 font-bold">ไฟล์อาจไม่ได้แชร์เป็น "ทุกคนที่มีลิงก์"<br>กรุณากด "เปิดในแท็บใหม่" ที่มุมขวาบน</p>
      `;
      lucide.createIcons();
    };
    
    container.appendChild(img);
  } else {
    // สำหรับไฟล์อื่นๆ เช่น PDF ใช้ iframe ตามปกติ
    iframe.classList.remove("hidden");
    iframe.src = embedUrl;
    iframe.onload = () => {
      loader.style.opacity = "0";
      setTimeout(() => loader.classList.add("hidden"), 300);
    };
  }
}

function closePreviewModal() {
  const modal = document.getElementById("preview-modal");
  modal.classList.remove("active");
  setTimeout(() => {
    modal.classList.add("hidden");
    const iframe = document.getElementById("preview-iframe");
    if(iframe) iframe.src = "";
    
    // ลบแท็ก <img> ทิ้งเพื่อคืนค่าหน้าต่างให้สะอาด
    const oldImg = document.getElementById("preview-dynamic-img");
    if (oldImg) oldImg.remove();
  }, 300);
}



// ========================================================
// ชุดคำสั่งวาดหน้าตรวจงานและระบบแบ่งหน้า (ทับของเดิมได้เลย)
// ========================================================

function renderTeacherSubmissions() {
  const el = document.getElementById("teacher-list");
  if (!el) return;

  const q = (document.getElementById("teacher-search").value || "").toLowerCase();
  
  let pendingCount = 0;
  let resubmitCount = 0;
  let gradedCount = 0;
  const groups = {};

  // 1. กรองข้อมูลและจัดกลุ่ม
  allSubmissions.forEach((item) => {
    if (q && !String(item.student_id).toLowerCase().includes(q) && !String(item.student_name).toLowerCase().includes(q)) {
      return;
    }

    const student = allStudents.find((s) => String(s.student_id) === String(item.student_id));
    if (!student) return;

    let bucket = "pending";
    let score = 0;
    let max = 10;
    const isResubmitDesc = item.description && String(item.description).includes("[ส่งซ้ำ]");

    try {
      const scs = JSON.parse(student.scores || "[]");
      const found = scs.find((s) => s.name === item.title);
      
      if (found && found.score !== null && found.score !== "") {
        score = found.score;
        if (found.graded_at && new Date(item.submitted_at) > new Date(found.graded_at)) {
          bucket = "resubmit";
        } else {
          bucket = "graded";
        }
      } else {
        bucket = isResubmitDesc ? "resubmit" : "pending";
      }

      const course = courses.find((c) => c.course_name === item.subject || c.course_id === item.course_id);
      if (course) {
        const cats = JSON.parse(course.score_categories || "[]");
        const cat = cats.find((c) => c.name === item.title);
        if (cat) max = cat.max;
      }
    } catch (e) {}

    if (bucket === "pending") pendingCount++;
    else if (bucket === "resubmit") resubmitCount++;
    else if (bucket === "graded") gradedCount++;

    if (teacherListTab === bucket) {
      if (!groups[item.student_id]) {
        groups[item.student_id] = { name: item.student_name, assignments: [] };
      }
      groups[item.student_id].assignments.push({ ...item, bucket, score, max });
    }
  });

  // อัปเดตตัวเลขแจ้งเตือน
  if (document.getElementById("badge-pending")) document.getElementById("badge-pending").textContent = pendingCount;
  if (document.getElementById("badge-resubmit")) document.getElementById("badge-resubmit").textContent = resubmitCount;
  if (document.getElementById("badge-graded")) document.getElementById("badge-graded").textContent = gradedCount;
  if (document.getElementById("dash-badge-pending")) document.getElementById("dash-badge-pending").textContent = pendingCount + resubmitCount;

  // 2. ระบบแบ่งหน้า (Pagination)
  const sortedGroups = Object.keys(groups).sort();
  if (!sortedGroups.length) {
    el.innerHTML = '<div class="text-center py-16"><i data-lucide="inbox" class="w-12 h-12 text-slate-200 mx-auto mb-3"></i><p class="text-slate-400 font-medium">ไม่มีงานในหมวดหมู่นี้</p></div>';
    const pag = document.getElementById("sub-pagination");
    if (pag) pag.innerHTML = "";
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const totalPages = Math.ceil(sortedGroups.length / subsPerPage);
  if (currentSubPage > totalPages) currentSubPage = totalPages;
  if (currentSubPage < 1) currentSubPage = 1;

  const startIndex = (currentSubPage - 1) * subsPerPage;
  const endIndex = startIndex + subsPerPage;
  const paginatedGroups = sortedGroups.slice(startIndex, endIndex);

  // 3. วาดรายการ
  el.innerHTML = paginatedGroups.map((id) => {
      const studentName = groups[id].name;
      const assignmentsHtml = groups[id].assignments.map((sub) => {
          let urls = [];
          let names = [];
          if (sub.file_url) {
            urls = String(sub.file_url).includes("\n") ? String(sub.file_url).split("\n") : [String(sub.file_url)];
            urls = urls.map((u) => u.trim()).filter((u) => u !== "");
          }
          if (sub.file_name) {
            names = String(sub.file_name).includes("\n") ? String(sub.file_name).split("\n") : [String(sub.file_name)];
            names = names.map((n) => n.trim()).filter((n) => n !== "");
          }

          const descText = sub.description ? String(sub.description).replace("[ส่งซ้ำ]", "").trim() : "";
          const resubmitBadge = sub.bucket === "resubmit" 
              ? `<span class="bg-orange-100 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase ml-2 inline-flex items-center gap-1 shadow-sm"><i data-lucide="refresh-cw" class="w-2.5 h-2.5"></i> ส่งซ้ำ</span>` 
              : "";

          let links = "";
          if (urls.length > 0) {
            links = '<div class="flex flex-wrap gap-2 mt-3">' +
              urls.map((u, i) => {
                  let n = names[i] || "ไฟล์แนบ " + (i + 1);
                  return `<button onclick="openPreviewModal('${u}', '${n}')" class="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-widest"><i data-lucide="search" class="w-3.5 h-3.5"></i> ดูไฟล์: ${n}</button>`;
              }).join("") + '</div>';
          } else if (sub.submission_type === "online_worksheet") {
            links = '<span class="text-blue-500 text-[10px] bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 mt-3 inline-block font-bold uppercase tracking-widest">ระบบใบงานออนไลน์</span>';
          }

          const starIconClass = sub.is_starred ? 'fill-amber-400 text-amber-500' : 'text-slate-300';
          const starBtnClass = sub.is_starred ? 'border-amber-300 bg-amber-50' : 'border-slate-200';

          return `
          <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div class="flex-1 min-w-0 pr-4">
                  <p class="text-sm font-bold text-slate-800 mb-1 truncate">${sub.title} ${resubmitBadge}</p>
                  ${descText ? `<p class="text-xs text-slate-500 mb-2 truncate"><i data-lucide="message-square" class="w-3 h-3 inline"></i> ${descText}</p>` : ""}
                  <div class="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      <span>${sub.subject}</span><span>•</span>
                      <span>ส่ง: ${new Date(sub.submitted_at).toLocaleDateString("th-TH")}</span>
                  </div>
                  ${links}
              </div>
              <div class="flex items-center gap-3 mt-3 sm:mt-0 shrink-0">
                  ${sub.bucket === "graded" 
                      ? `<button onclick="openGradeModal('${sub.__backendId}')" class="text-[10px] font-bold text-green-700 border border-green-300 bg-green-50 px-3 py-1.5 rounded-xl uppercase shadow-sm hover:bg-green-100 transition-all flex items-center gap-1.5"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i> ตรวจใหม่ (${sub.score}/${sub.max})</button>` 
                      : `<button onclick="openGradeModal('${sub.__backendId}')" class="text-xs bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all uppercase tracking-widest">ตรวจงานนี้</button>`
                  }
                  <button onclick="toggleStar('${sub.__backendId}', ${sub.is_starred || false})" class="p-2 bg-white rounded-xl shadow-sm border ${starBtnClass} transition-all hover:scale-110">
                      <i data-lucide="star" class="w-4 h-4 ${starIconClass}"></i>
                  </button>
                  <button onclick="openDeleteSubModal('${sub.__backendId}')" class="text-slate-400 hover:text-red-500 transition-colors p-2 bg-white rounded-xl shadow-sm border border-slate-200">
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
              </div>
          </div>`;
      }).join("");

      return `
        <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mb-4">
            <h4 class="font-bold text-slate-700 mb-4 flex items-center gap-3 text-sm uppercase tracking-wider">
                <div class="p-1.5 bg-indigo-50 rounded-lg"><i data-lucide="user" class="w-4 h-4 text-indigo-500"></i></div> 
                ${studentName} (${id})
            </h4>
            <div class="space-y-3">${assignmentsHtml}</div>
        </div>`;
  }).join("");

  // สั่งแสดงปุ่มแบ่งหน้า
  renderSubPaginationControls(totalPages);
  
  // แปลงคลาสเป็นไอคอน
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function changeSubPage(newPage) {
    currentSubPage = newPage;
    renderTeacherSubmissions();
    const listEl = document.getElementById("teacher-list");
    if (listEl) listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ฟังก์ชันสร้างปุ่มเปลี่ยนหน้าสำหรับหน้ารายการส่งงาน (หน้าครูตรวจงาน)
function renderSubPaginationControls(totalPages) {
    let pagContainer = document.getElementById("sub-pagination");

    // ถ้ายังไม่มีจุดวางปุ่มใน HTML ให้สร้าง <div> แทรกต่อท้ายรายการอัตโนมัติ
    if (!pagContainer) {
        const listEl = document.getElementById("teacher-list");
        if (listEl && listEl.parentNode) {
            pagContainer = document.createElement("div");
            pagContainer.id = "sub-pagination";
            pagContainer.className = "flex justify-center items-center gap-4 mt-6 mb-4";
            listEl.parentNode.appendChild(pagContainer);
        } else {
            return; // ถ้าหาที่วางไม่ได้ให้ออกไปก่อน
        }
    }

    // ถ้ามีหน้าเดียว ไม่ต้องแสดงปุ่มเปลี่ยนหน้า
    if (totalPages <= 1) {
        pagContainer.innerHTML = ""; 
        return;
    }

    // สร้าง HTML สำหรับปุ่ม ก่อนหน้า / ถัดไป
    let html = `
        <button onclick="changeSubPage(${currentSubPage - 1})" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed" ${currentSubPage === 1 ? 'disabled' : ''}>
            <i data-lucide="chevron-left" class="w-4 h-4 inline"></i> ก่อนหน้า
        </button>
        <span class="text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-100 shadow-sm">
            หน้า ${currentSubPage} / ${totalPages}
        </span>
        <button onclick="changeSubPage(${currentSubPage + 1})" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed" ${currentSubPage === totalPages ? 'disabled' : ''}>
            ถัดไป <i data-lucide="chevron-right" class="w-4 h-4 inline"></i>
        </button>
    `;
    
    pagContainer.innerHTML = html;
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}


function renderStudentList() {
  const tbody = document.getElementById("student-list-body");
  const empty = document.getElementById("student-list-empty");
  if (!tbody) return;
  
  let data = getFilteredStudents();
  data.sort((a, b) => String(a.student_id).localeCompare(String(b.student_id)));

  // ถ้าไม่มีข้อมูล
  if (data.length === 0) {
    tbody.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    const pag = document.getElementById("student-pagination");
    if(pag) pag.innerHTML = "";
    return;
  }
  if (empty) empty.classList.add("hidden");

  // --- ส่วนที่เพิ่มใหม่ (ระบบคำนวณหน้า Pagination) ---
  const totalPages = Math.ceil(data.length / studentsPerPage);
  if (currentStudentPage > totalPages) currentStudentPage = totalPages;
  if (currentStudentPage < 1) currentStudentPage = 1;

  const startIndex = (currentStudentPage - 1) * studentsPerPage;
  const endIndex = startIndex + studentsPerPage;
  const paginatedData = data.slice(startIndex, endIndex); // ตัดเอาแค่ 10 คน

  // --- สร้างตาราง ---
  tbody.innerHTML = paginatedData
    .map(
      (s) => `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td class="px-6 py-4 font-bold text-slate-500 tracking-tighter">${s.student_id}</td>
            <td class="px-6 py-4 text-slate-800 font-medium">
                <button onclick="openStudentProfileById('${s.student_id}')" class="text-indigo-600 font-bold hover:text-indigo-800 hover:underline flex items-center gap-2 text-left transition-colors">
                    <i data-lucide="user-circle" class="w-5 h-5"></i> ${s.student_name}
                </button>
            </td>
            <td class="px-6 py-4 text-center text-slate-400 font-bold text-xs">${s.classroom}</td>
            <td class="px-6 py-4 flex items-center justify-center gap-2">
                <button onclick='openEditStudentModal("${s.__backendId}")' class="text-slate-400 hover:text-blue-500 p-2 transition-colors" title="แก้ไขข้อมูล"><i data-lucide="settings" class="w-4 h-4"></i></button>
                <button onclick='confirmResetPin("${s.student_id}", "${s.student_name}")' class="text-slate-400 hover:text-amber-500 p-2 transition-colors" title="รีเซ็ตรหัสผ่าน"><i data-lucide="key-round" class="w-4 h-4"></i></button>
                <button onclick='openDeleteModal("${s.__backendId}")' class="text-slate-400 hover:text-red-500 p-2 transition-colors" title="ลบนักเรียน"><i data-lucide="user-minus" class="w-4 h-4"></i></button>
            </td>
        </tr>`,
    )
    .join("");

  // --- เรียกฟังก์ชันสร้างปุ่มเปลี่ยนหน้า ---
  renderPaginationControls(totalPages);
  lucide.createIcons();
}

// ฟังก์ชันสร้างปุ่ม หน้าถัดไป / ก่อนหน้า
function renderPaginationControls(totalPages) {
    let pagContainer = document.getElementById("student-pagination");
    
    // ถ้ายังไม่มีจุดวางปุ่ม ให้สร้าง <div> แทรกต่อท้ายตารางอัตโนมัติ
    if (!pagContainer) {
        const tableWrapper = document.getElementById("student-list-body").closest('.flex-1');
        pagContainer = document.createElement("div");
        pagContainer.id = "student-pagination";
        pagContainer.className = "flex justify-center items-center gap-4 mt-4 mb-2";
        tableWrapper.appendChild(pagContainer);
    }

    if (totalPages <= 1) {
        pagContainer.innerHTML = ""; // ถ้ามีหน้าเดียวไม่ต้องแสดงปุ่ม
        return;
    }

    let html = `
        <button onclick="changeStudentPage(${currentStudentPage - 1})" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed" ${currentStudentPage === 1 ? 'disabled' : ''}>
            <i data-lucide="chevron-left" class="w-4 h-4 inline"></i> ก่อนหน้า
        </button>
        <span class="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
            หน้า ${currentStudentPage} / ${totalPages}
        </span>
        <button onclick="changeStudentPage(${currentStudentPage + 1})" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed" ${currentStudentPage === totalPages ? 'disabled' : ''}>
            ถัดไป <i data-lucide="chevron-right" class="w-4 h-4 inline"></i>
        </button>
    `;
    pagContainer.innerHTML = html;
}

// ฟังก์ชันเมื่อครูกดปุ่มเปลี่ยนหน้า
function changeStudentPage(newPage) {
    currentStudentPage = newPage;
    renderStudentList();
}


// ==========================================
// 🔑 รีเซ็ต PIN นักเรียน
// ==========================================
function confirmResetPin(studentId, studentName) {
  const modal = document.getElementById("modal-reset-pin");
  document.getElementById("reset-pin-student-name").textContent = studentName;
  document.getElementById("reset-pin-student-id").textContent = studentId;
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.add("active"), 10);
}

function closeResetPinModal() {
  const modal = document.getElementById("modal-reset-pin");
  modal.classList.remove("active");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

async function doResetPin() {
  const studentId = document.getElementById("reset-pin-student-id").textContent;
  const studentName = document.getElementById("reset-pin-student-name").textContent;
  const btn = document.getElementById("btn-confirm-reset-pin");
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-1"></i> กำลังรีเซ็ต...';
  lucide.createIcons();

  try {
    await db.collection("student_auth").doc(studentId).set({
      pin: "123456",
      updated_at: new Date().toISOString(),
      reset_by_teacher: true,
    });
    closeResetPinModal();
    showToast(`รีเซ็ต PIN ของ ${studentName} เป็น 123456 แล้ว`, "success");
  } catch (e) {
    showToast("เกิดข้อผิดพลาด: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="key-round" class="w-4 h-4 inline mr-1"></i> ยืนยันรีเซ็ต';
    lucide.createIcons();
  }
}

// 🟢 อัปเกรดตารางคะแนนแบบใหม่ สัดส่วนสวยงาม
function renderGradingTable() {
  const tbody = document.getElementById("grading-body");
  const thead = document.getElementById("grading-head");
  const empty = document.getElementById("grading-empty");
  if (!tbody || !thead) return;
  const search = (
    document.getElementById("search-student-grading")?.value || ""
  ).toLowerCase();

  let data = getFilteredStudents();
  if (search)
    data = data.filter((s) =>
      String(s.student_id).toLowerCase().includes(search) ||
      String(s.student_name).toLowerCase().includes(search),
    );
  data.sort((a, b) => String(a.student_id).localeCompare(String(b.student_id)));

  const cats = getCategories();
  
  // 🟢 ปรับ UI หัวตารางสมุดคะแนนให้ดูง่าย แบ่งเป็นสัดส่วนชัดเจน
  thead.innerHTML = `
    <tr class="bg-slate-100 border-b-2 border-slate-200 shadow-sm">
        <th class="px-4 py-4 font-bold uppercase text-[10px] tracking-widest text-slate-600 sticky left-0 z-20 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">รหัสนักเรียน</th>
        <th class="px-4 py-4 font-bold uppercase text-[10px] tracking-widest text-slate-600 min-w-[150px] sticky left-[100px] z-20 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">ชื่อ-สกุล</th>
        ${cats.map((c, i) => `<th class="px-3 py-4 text-center text-[10px] uppercase leading-tight font-bold border-l border-slate-200 ${i%2===0 ? 'bg-indigo-50/50' : 'bg-white'} text-indigo-700 min-w-[80px]">${c.name}<br><span class="text-indigo-400 font-normal">เต็ม ${c.max}</span></th>`).join("")}
        <th class="px-4 py-4 text-center font-bold uppercase text-[10px] tracking-widest bg-emerald-50 text-emerald-700 border-l-2 border-emerald-200 min-w-[80px]">รวมคะแนน</th>
        <th class="px-4 py-4 text-center font-bold uppercase text-[10px] tracking-widest bg-amber-50 text-amber-700 border-l border-amber-200 min-w-[80px]">เกรด</th>
    </tr>`;
    
  if (data.length === 0) {
    tbody.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");
  
  // 🟢 ปรับ UI ช่องกรอกข้อมูลให้ไฮไลท์สัดส่วนสีชัดเจน
  tbody.innerHTML = data
    .map((s) => {
      let scs = [];
      try {
        scs = JSON.parse(s.scores || "[]");
      } catch (e) {}
      return `<tr data-bid="${s.__backendId}" class="group hover:bg-indigo-50/30 transition-colors border-b border-slate-100">
        <td class="px-4 py-3 font-bold text-slate-500 tracking-tight sticky left-0 z-10 bg-white group-hover:bg-indigo-50/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors">${s.student_id}</td>
        <td class="px-4 py-3 text-slate-800 font-bold whitespace-nowrap sticky left-[100px] z-10 bg-white group-hover:bg-indigo-50/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors">${s.student_name}</td>
        ${cats
        .map((c, i) => {
          const f = scs.find((sc) => sc.name === c.name);
          const val = f && f.score !== null && f.score !== "" ? f.score : "";
          return `<td class="px-3 py-2 text-center border-l border-slate-100 ${i%2===0 ? 'bg-indigo-50/20' : ''}">
            <input type="number" class="grading-input w-16 text-center border border-slate-200 rounded-lg py-1.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none font-bold text-slate-700 transition-all hover:border-indigo-300" data-cat="${c.name}" value="${val}">
          </td>`;
        }).join("")}
        <td class="px-4 py-3 text-center font-black text-emerald-600 text-lg tracking-tighter border-l-2 border-emerald-100 bg-emerald-50/20">${s.total || 0}</td>
        <td class="px-4 py-3 text-center border-l border-amber-100 bg-amber-50/20">
            <span class="px-3 py-1 rounded-lg text-xs font-bold text-white shadow-sm inline-block min-w-[40px]" style="${getPdfGradeColor(s.grade || '0')}">${s.grade || "0"}</span>
        </td>
      </tr>`;
    })
    .join("");
}



async function saveAllGrades() {
  const btn = document.getElementById("save-all-btn");
  
  // 🟢 เพิ่มการตรวจสอบว่ามีปุ่มอยู่จริงไหมก่อนสั่งปิดปุ่ม
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "Saving...";
  }

  const cats = getCategories();
  let totalMax = 0;
  cats.forEach((c) => (totalMax += c.max));
  const batch = db.batch();
  let hasChanges = false;

  document.querySelectorAll("#grading-body tr").forEach((tr) => {
    const student = allStudents.find((s) => s.__backendId === tr.dataset.bid);
    if (!student) return;
    let total = 0;
    const scores = [];
    // 🟢 ก่อนลูป input ให้ดึงคะแนนเดิมมาเตรียมไว้เทียบ
    const oldScores = student.scores ? JSON.parse(student.scores) : [];

    tr.querySelectorAll(".grading-input").forEach((inp) => {
      const catName = inp.getAttribute("data-cat");
      const catObj = cats.find((c) => c.name === catName);
      
      if (catObj && inp.value.trim() !== "") {
        const v = Math.min(parseFloat(inp.value), catObj.max);
        
        // 🟢 หารายการคะแนนเก่าของวิชานี้
        const oldScoreObj = oldScores.find(s => s.name === catObj.name);
        
        // 🟢 ถ้าคะแนนเท่าเดิมเป๊ะๆ ให้ใช้ timestamp เดิม! (ป้องกันการเสียโควต้า write ฟรีๆ)
        let gradedTime = new Date().toISOString();
        if (oldScoreObj && oldScoreObj.score === v) {
            gradedTime = oldScoreObj.graded_at || gradedTime; 
        }

        scores.push({
          name: catObj.name,
          max: catObj.max,
          score: v,
          graded_at: gradedTime, // 🟢 ใช้เวลาที่เช็คแล้ว
        });
        total += v;
      }
    });
    const pct = totalMax > 0 ? (total / totalMax) * 100 : 0;
    const newScoresStr = JSON.stringify(scores);
    if (student.scores !== newScoresStr) {
      hasChanges = true;
      batch.update(db.collection("students").doc(student.__backendId), {
        scores: newScoresStr,
        total: Math.round(total * 100) / 100,
        percentage: Math.round(pct * 100) / 100,
        grade: calcGrade(pct, student.course_id),
      });
    }
  });

  if (hasChanges) {
    try {
      await batch.commit();
      showToast(`อัปเดตเรียบร้อย ✨`);
      await loadAllData();
    } catch (err) {
      showToast("บันทึกผิดพลาด", "error");
    }
  } else {
    showToast("ไม่มีข้อมูลเปลี่ยนแปลง", "info");
  }

  // 🟢 ตรวจสอบว่าปุ่มยังมีอยู่ไหมก่อนสั่งคืนค่าปุ่ม
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check-circle-2" class="w-5 h-5"></i> บันทึกตารางคะแนน';
    lucide.createIcons();
  }
}
async function executeDeleteSubmission() {
  if (!itemToDeleteSub) return;
  const btn = document.getElementById("btn-confirm-delete-sub");
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังลบ...';
  lucide.createIcons();
  try {
    const item = allSubmissions.find((s) => s.__backendId === itemToDeleteSub);
    if (item && item.file_url) {
      const urls = String(item.file_url)
        .split("\n")
        .filter((u) => u.trim() !== "");
      for (let url of urls) {
        try {
          if (GAS_URL && !GAS_URL.includes("วาง_URL"))
            await fetch(GAS_URL, {
              method: "POST",
              body: JSON.stringify({
                action: "delete_file",
                data: { url: url },
              }),
              headers: { "Content-Type": "text/plain;charset=utf-8" },
            });
        } catch (e) {}
      }
    }
    await db.collection("submissions").doc(itemToDeleteSub).delete();
    showToast("ลบชิ้นงานเรียบร้อยแล้ว");
    await loadAllData();
  } catch (err) {
    showToast("ไม่สามารถลบข้อมูลได้", "error");
  }
  btn.disabled = false;
  btn.innerHTML = origHtml;
  closeDeleteSubModal();
}

// 🌟 ฟังก์ชันให้ดาว ผลงาน
async function toggleStar(id, currentStatus) {
  try {
    await db
      .collection("submissions")
      .doc(id)
      .update({ is_starred: !currentStatus });
    const item = allSubmissions.find((s) => s.__backendId === id);
    if (item) item.is_starred = !currentStatus;
    showToast(
      currentStatus
        ? "นำออกจาก Hall of Fame แล้ว"
        : "⭐ เพิ่มลง Hall of Fame สำเร็จ!",
    );
    renderTeacherSubmissions(); // อัปเดตหน้าจอทันที
  } catch (e) {
    showToast("เกิดข้อผิดพลาด", "error");
  }
}

// 🌟 ฟังก์ชันพิมพ์ E-Portfolio ประจำตัว
function exportEPortfolio(studentId) {
  const student = allStudents.find(
    (s) => String(s.student_id) === String(studentId),
  );
  if (!student) return showToast("ไม่พบนักเรียน", "error");

  // ดึงงานที่เคยส่งทั้งหมด
  const works = allSubmissions
    .filter((s) => String(s.student_id) === String(studentId))
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

  // ดึงคะแนน
  let scs = [];
  try {
    scs = JSON.parse(student.scores || "[]");
  } catch (e) {}

  const printDate = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const schoolName = localStorage.getItem("schoolName") || "โรงเรียนของคุณ";

  // วาดตารางผลงาน
  let worksHtml = works
    .map((w, idx) => {
      const isStarred = w.is_starred
        ? '<span style="color:#f59e0b;">⭐ (ผลงานดีเด่น)</span>'
        : "";
      const scoreMatch = scs.find((s) => s.name === w.title);
      const scoreText =
        scoreMatch && scoreMatch.score !== null && scoreMatch.score !== ""
          ? `${scoreMatch.score}/${scoreMatch.max}`
          : "รอตรวจ";
      return `
        <tr>
            <td style="width:30px; text-align:center;">${idx + 1}</td>
            <td><strong>${w.title}</strong> <br><span style="font-size:10pt; color:#64748b;">${w.subject}</span></td>
            <td>${new Date(w.submitted_at).toLocaleDateString("th-TH")}</td>
            <td style="text-align:center; font-weight:bold;">${scoreText}</td>
            <td style="text-align:center;">${isStarred}</td>
        </tr>`;
    })
    .join("");

  if (works.length === 0)
    worksHtml =
      '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">ยังไม่มีประวัติการส่งชิ้นงาน</td></tr>';

  const w = window.open("", "_blank");
  w.document.write(`
    <!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>E-Portfolio: ${student.student_name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Sarabun', sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #6366f1; }
        .header img { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 3px solid #e0e7ff; }
        h1 { font-size: 24pt; margin-bottom: 5px; color: #1e293b; }
        .subtitle { font-size: 14pt; color: #6366f1; font-weight: bold; }
        .info-grid { display: flex; justify-content: center; gap: 40px; margin-bottom: 30px; }
        .info-box { text-align: center; background: #f8fafc; padding: 15px 30px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .info-box span { display: block; font-size: 10pt; color: #64748b; text-transform: uppercase; }
        .info-box strong { font-size: 18pt; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 11pt; }
        th { background: #e0e7ff; color: #4f46e5; font-weight: bold; text-transform: uppercase; font-size: 10pt; }
        .footer { margin-top: 50px; font-size: 10pt; color: #94a3b8; display: flex; justify-content: space-between; }
        @media print { body { padding: 0; } }
    </style>
    </head><body>
        <div class="header">
            <img src="${student.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.student_name)}&background=random&color=fff`}">
            <h1>${student.student_name}</h1>
            <div class="subtitle">E-Portfolio & Academic Record</div>
        </div>
        
        <div class="info-grid">
            <div class="info-box"><span>รหัสประจำตัว</span><strong>${student.student_id}</strong></div>
            <div class="info-box"><span>ห้องเรียน</span><strong>${student.classroom}</strong></div>
            <div class="info-box"><span>เกรดเฉลี่ยปัจจุบัน</span><strong style="color:#10b981;">${student.grade || "0"}</strong></div>
            <div class="info-box"><span>ผลงานที่ส่ง</span><strong>${works.length}</strong></div>
        </div>

        <h3 style="border-left: 4px solid #6366f1; padding-left: 10px;">ประวัติการส่งผลงาน (Assignments History)</h3>
        <table>
            <thead><tr><th>ลำดับ</th><th>ชื่อผลงาน / วิชา</th><th>วันที่ส่ง</th><th style="text-align:center;">คะแนน</th><th style="text-align:center;">หมายเหตุ</th></tr></thead>
            <tbody>${worksHtml}</tbody>
        </table>

        <div class="footer">
            <span>ออกเอกสารโดย: ${schoolName}</span>
            <span>วันที่พิมพ์: ${printDate}</span>
        </div>
    </body></html>
    `);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 800);
}

function updateCourseSelectors() {
  const select = document.getElementById("global-course-select");
  if (!select) return;
  select.innerHTML = courses
    .map((c) => `<option value="${c.course_id}">${c.course_name}</option>`)
    .join("");
  select.value = currentCourseId;
  const c = courses.find((c) => c.course_id === currentCourseId);
  if (document.getElementById("course-display-header"))
    document.getElementById("course-display-header").textContent = c
      ? c.course_name
      : "N/A";
}
function changeGlobalCourse() {
  currentCourseId = document.getElementById("global-course-select").value;
  currentClass = "all";
  applyCourseSettingsToUI();
  updateClassSelector();
  updateAttRoomSelectors();
  currentStudentPage = 1;
  refreshCurrentTab();
}
function updateCourseName() {
  const n = document.getElementById("inp-course-name").value.trim() || "N/A";
  if (document.getElementById("course-display-header"))
    document.getElementById("course-display-header").textContent = n;
}

// 🌟 อัปเดต ดึงค่า 8 ระดับ
function applyCourseSettingsToUI() {
  const c = courses.find((c) => c.course_id === currentCourseId);
  if (!c) return;
  document.getElementById("inp-course-name").value = c.course_name;
  try {
    const g = JSON.parse(c.grade_criteria);
    document.getElementById("grade-4").value = g.g4 || 80;
    document.getElementById("grade-35").value = g.g35 || 75;
    document.getElementById("grade-3").value = g.g3 || 70;
    document.getElementById("grade-25").value = g.g25 || 65;
    document.getElementById("grade-2").value = g.g2 || 60;
    document.getElementById("grade-15").value = g.g15 || 55;
    document.getElementById("grade-1").value = g.g1 || 50;
  } catch (e) {}
  try {
    const cats = JSON.parse(c.score_categories);
    renderCategoriesEditor(cats);
  } catch (e) {
    renderCategoriesEditor(defaultCategories);
  }
}

// 🌟 1. อัปเดตรายชื่อห้องให้ตรงกันทั้ง 2 กล่อง (กล่องบน และ กล่องตรงกลางหน้า Export)
function updateClassSelector() { 
    const globalSelect = document.getElementById('global-class-select'); 
    if(!globalSelect) return; 
    
    // ดึงรายชื่อห้องเฉพาะวิชาที่เลือก
    const classes = [...new Set(allStudents.filter(s => s.course_id === currentCourseId).map(s => s.classroom))].sort(); 
    
    // สร้าง HTML สำหรับตัวเลือก
    const optionsHtml = `<option value="all">รวมทุกห้อง</option>` + classes.map(c => `<option value="${c}">${c}</option>`).join('');
    
    // อัปเดตกล่องด้านบน
    globalSelect.innerHTML = optionsHtml; 
    globalSelect.value = currentClass; 
    
    // อัปเดตกล่องตรงกลางหน้า Export (ถ้าเปิดหน้านั้นอยู่)
    const exportSelect = document.getElementById('export-class-select');
    if (exportSelect) {
        exportSelect.innerHTML = optionsHtml;
        exportSelect.value = currentClass;
    }
}

// 🌟 2. เมื่อเปลี่ยนห้องจากกล่องด้านบน ให้กล่องตรงกลางเปลี่ยนตาม
function changeClassroom() { 
    currentClass = document.getElementById('global-class-select').value; 
    
    const exportSelect = document.getElementById('export-class-select');
    if (exportSelect) exportSelect.value = currentClass; // ซิงค์ให้ตรงกัน
    currentStudentPage = 1;
    refreshCurrentTab(); 
}

// 🌟 3. เมื่อเปลี่ยนห้องจากกล่องตรงกลาง (หน้า Export) ให้กล่องด้านบนเปลี่ยนตาม
function changeExportClass() {
    currentClass = document.getElementById('export-class-select').value;
    
    const globalSelect = document.getElementById('global-class-select');
    if (globalSelect) globalSelect.value = currentClass; // ซิงค์กลับไปด้านบน
    
    refreshCurrentTab();
}

// 🌟 อัปเดต ตรรกะตัดเกรด 8 ระดับ
function calcGrade(p, cid) {
  let g4 = 80,
    g35 = 75,
    g3 = 70,
    g25 = 65,
    g2 = 60,
    g15 = 55,
    g1 = 50;
  const cr = courses.find((x) => x.course_id === (cid || currentCourseId));
  if (cr) {
    try {
      const x = JSON.parse(cr.grade_criteria);
      g4 = x.g4 || 80;
      g35 = x.g35 || 75;
      g3 = x.g3 || 70;
      g25 = x.g25 || 65;
      g2 = x.g2 || 60;
      g15 = x.g15 || 55;
      g1 = x.g1 || 50;
    } catch (e) {}
  }
  if (p >= g4) return "4";
  if (p >= g35) return "3.5";
  if (p >= g3) return "3";
  if (p >= g25) return "2.5";
  if (p >= g2) return "2";
  if (p >= g15) return "1.5";
  if (p >= g1) return "1";
  return "0";
}

// 🌟 อัปเดต สีของเกรด 8 ระดับ
function gradeClass(g) {
  const map = {
    4: "bg-green-100 text-green-700",
    3.5: "bg-emerald-100 text-emerald-700",
    3: "bg-blue-100 text-blue-700",
    2.5: "bg-indigo-100 text-indigo-700",
    2: "bg-yellow-100 text-yellow-700",
    1.5: "bg-orange-100 text-orange-700",
    1: "bg-red-100 text-red-700",
    0: "bg-slate-200 text-slate-700",
  };
  return map[g] || "bg-slate-100 text-slate-500";
}

function exportCSV() {
  const data = getFilteredStudents();
  if (!data.length) {
    showToast("ไม่มีข้อมูล", "error");
    return;
  }
  const cats = getCategories();
  let csv =
    "\uFEFF" +
    `"Class","ID","Name",${cats.map((c) => `"${c.name}"`).join(",")},"Total","%","Grade"\n`;
  data.forEach((s) => {
    let scs = [];
    try {
      scs = JSON.parse(s.scores || "[]");
    } catch (e) {}
    const row = cats.map((c) => {
      const f = scs.find((x) => x.name === c.name);
      return f && f.score !== null ? f.score : 0;
    });
    csv += `"${s.classroom}","${s.student_id}","${s.student_name}",${row.join(",")},${s.total},${(s.percentage || 0).toFixed(1)},"${s.grade}"\n`;
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  a.download = `Scores_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// 🌟 อัปเดต สีเกรดใน PDF
function getPdfGradeColor(g) {
  if (g === "4" || g === "3.5") return "color:#16a34a;background:#dcfce7;";
  if (g === "3" || g === "2.5") return "color:#2563eb;background:#dbeafe;";
  if (g === "2" || g === "1.5") return "color:#d97706;background:#fef3c7;";
  if (g === "1") return "color:#ea580c;background:#ffedd5;";
  return "color:#dc2626;background:#fee2e2;";
}

function exportPDF() {
  const data = getFilteredStudents();
  if (!data.length) {
    showToast("ไม่มีข้อมูล", "error");
    return;
  }
  const cats = getCategories();
  const title = document.getElementById("inp-course-name").value;
  const printDate = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const totals = data.map((s) => s.total || 0);
  const avg =
    data.length > 0
      ? data.map((s) => s.percentage || 0).reduce((a, b) => a + b, 0) /
        data.length
      : 0;

  // 🌟 เปลี่ยนชุดนับเกรดเป็น 8 ระดับ
  const grades = { 4: 0, 3.5: 0, 3: 0, 2.5: 0, 2: 0, 1.5: 0, 1: 0, 0: 0 };
  data.forEach((s) => {
    if (grades[s.grade] !== undefined) grades[s.grade]++;
  });
  const maxScore = totals.length > 0 ? Math.max(...totals) : 0;
  const minScore = totals.length > 0 ? Math.min(...totals) : 0;
  const w = window.open("", "_blank");
  w.document.write(
    `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>Score Report</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>:root{--primary:#4f46e5;--text-main:#1e293b;--text-muted:#64748b} *{margin:0;padding:0;box-sizing:border-box} body{font-family:'Sarabun',sans-serif;padding:40px;font-size:12pt;color:var(--text-main);line-height:1.5} .header{text-align:center;margin-bottom:20px;padding-bottom:10px;border-bottom:2px dashed #cbd5e1} h1{font-size:16pt;color:var(--primary);margin-bottom:8px;font-weight:700} .info{display:flex;justify-content:center;gap:20px;color:var(--text-muted);font-size:11pt;flex-wrap:wrap} .info span{font-weight:600;color:var(--text-main)} .stats{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;justify-content:center} .stat-box{flex:1;min-width:80px;padding:10px;border-radius:8px;text-align:center;border:1px solid #e2e8f0} .stat-box.blue{background:#eff6ff;border-top:4px solid #3b82f6} .stat-box.green{background:#f0fdf4;border-top:4px solid #22c55e} .stat-box.red{background:#fef2f2;border-top:4px solid #ef4444} .stat-box.purple{background:#faf5ff;border-top:4px solid #a855f7} .stat-box.orange{background:#fff7ed;border-top:4px solid #f97316} .stat-box span{font-size:9pt;color:var(--text-muted);display:block;margin-bottom:2px;text-transform:uppercase} .stat-box strong{font-size:14pt;color:var(--text-main);font-weight:700} h2{font-size:12pt;margin-bottom:10px;color:var(--text-main);font-weight:700;border-left:4px solid var(--primary);padding-left:10px} table{width:100%;border-collapse:separate;border-spacing:0;border-radius:8px;overflow:hidden;border:1px solid #cbd5e1} th,td{padding:6px 8px;text-align:center;font-size:9pt;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0} th:last-child,td:last-child{border-right:none} th{background-color:var(--primary);color:#ffffff;font-weight:600;font-size:9pt;border-bottom:none} tbody tr:nth-child(even){background-color:#f8fafc} tbody tr:last-child td{border-bottom:none} td.left{text-align:left} .grade{font-weight:700;padding:2px 6px;border-radius:4px;display:inline-block;min-width:24px;text-align:center} @media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:1cm}.stat-box{box-shadow:none;border:1px solid #cbd5e1}}</style></head><body><div class="header"><h1>รายงานผลการเรียนวิชา: ${title}</h1><div class="info"><div><span>ห้อง:</span> ${currentClass === "all" ? "รวมทุกห้องเรียน" : currentClass}</div><div><span>จำนวนนักเรียน:</span> ${data.length} คน</div><div><span>วันที่พิมพ์:</span> ${printDate}</div></div></div><div class="stats"><div class="stat-box blue"><span>คะแนนเฉลี่ย</span><strong>${avg.toFixed(1)}%</strong></div><div class="stat-box green"><span>สูงสุด</span><strong>${maxScore}</strong></div><div class="stat-box red"><span>ต่ำสุด</span><strong>${minScore}</strong></div></div><div class="stats" style="margin-top:10px;">${Object.entries(
    grades,
  )
    .map(
      ([g, n]) =>
        `<div class="stat-box" style="border-top-color:#6366f1;"><span>เกรด ${g}</span><strong>${n}</strong></div>`,
    )
    .join(
      "",
    )}</div><h2>ตารางสรุปคะแนน</h2><table><thead><tr><th style="width:30px;">ลำดับ</th><th style="width:40px;">ห้อง</th><th style="width:50px;">รหัส</th><th class="left">ชื่อ-สกุล</th>${cats.map((c) => `<th>${c.name}<br><span style="font-size:7pt; font-weight:400; opacity:0.8;">(${c.max})</span></th>`).join("")}<th style="width:40px;">รวม</th><th style="width:40px;">เกรด</th></tr></thead><tbody>${data
      .map((s, index) => {
        let sc = [];
        try {
          sc = JSON.parse(s.scores);
        } catch (e) {}
        return `<tr><td>${index + 1}</td><td>${s.classroom}</td><td>${s.student_id}</td><td class="left">${s.student_name}</td>${cats
          .map((c) => {
            const scoreObj = sc.find((score) => score.name === c.name);
            const scoreVal =
              scoreObj &&
              scoreObj.score !== undefined &&
              scoreObj.score !== null &&
              scoreObj.score !== ""
                ? scoreObj.score
                : "-";
            return `<td>${scoreVal}</td>`;
          })
          .join(
            "",
          )}<td><strong>${s.total || 0}</strong></td><td><span class="grade" style="${getPdfGradeColor(s.grade || "0")}">${s.grade || "0"}</span></td></tr>`;
      })
      .join("")}</tbody></table></body></html>`,
  );
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 800);
}



function getCategories() {
  const cats = [];
  document.querySelectorAll(".cat-item").forEach((d) => {
    // 🌟 ดึงค่า Checkbox ว่าติ๊กถูกให้ส่งผ่านเว็บหรือไม่
    const allowSubmitCheckbox = d.querySelector(".cat-allow-submit");
    const isAllowSubmit = allowSubmitCheckbox ? allowSubmitCheckbox.checked : true;

    cats.push({
      name: d.querySelector(".cat-name").value,
      max: parseFloat(d.querySelector(".cat-max").value) || 0,
      allow_submit: isAllowSubmit // บันทึกสถานะลงฐานข้อมูล
    });
  });
  return cats.length > 0 ? cats : JSON.parse(JSON.stringify(defaultCategories));
}

function renderCategoriesEditor(customCats) {
  const container = document.getElementById("score-categories");
  if (!container) return;
  container.innerHTML = (customCats || getCategories())
    .map((cat) => {
      // 🌟 ตรวจสอบว่างานนี้ถูกตั้งให้ส่งหน้าเว็บไหม (ถ้าไม่มีค่าเก่า ให้ถือว่าเปิดไว้ก่อน)
      const isChecked = cat.allow_submit !== false ? "checked" : "";
      
      return `
        <div class="cat-item flex flex-wrap sm:flex-nowrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <input type="text" value="${cat.name}" class="cat-name w-32 bg-transparent text-sm font-bold text-slate-700 outline-none" onchange="renderGradingTable()"> 
            <input type="number" value="${cat.max}" class="cat-max w-14 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-emerald-600 text-center outline-none" onchange="updateTotalMax(); renderGradingTable();"> 
            
            <label class="flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-2">
                <input type="checkbox" class="cat-allow-submit w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" ${isChecked}>
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">แสดงในฟอร์ม<br>ส่งงานนักเรียน</span>
            </label>

            <button onclick="removeCategory(this)" class="text-slate-400 hover:text-red-500 p-1.5 transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>`;
    })
    .join("");
  updateTotalMax();
  lucide.createIcons();
}

function addScoreCategory() {
  const cats = getCategories();
  // 🌟 เวลากดเพิ่มงานใหม่ ให้ default ว่าต้องส่งผ่านเว็บ (allow_submit: true)
  cats.push({ name: "งานใหม่", max: 10, allow_submit: true });
  renderCategoriesEditor(cats);
  renderGradingTable();
}





function updateTotalMax() {
  let sum = 0;
  document
    .querySelectorAll(".cat-item .cat-max")
    .forEach((el) => (sum += parseFloat(el.value) || 0));
  const el = document.getElementById("total-max");
  if (el) el.textContent = `เต็มรวม: ${sum}`;
}



function removeCategory(btn) {
  if (document.querySelectorAll(".cat-item").length <= 1) return;
  btn.closest(".cat-item").remove();
  updateTotalMax();
  renderGradingTable();
}
function toggleGradeSettings() {
  const el = document.getElementById("grade-settings");
  if (!el) return;
  el.classList.toggle("hidden");
  const btn = document.getElementById("toggle-grade-btn");
  btn.innerHTML = el.classList.contains("hidden")
    ? '<i data-lucide="chevron-down" class="w-4 h-4"></i> แสดงตั้งค่า'
    : '<i data-lucide="chevron-up" class="w-4 h-4"></i> ซ่อนตั้งค่า';
  lucide.createIcons();
}

// 🌟 อัปเดต ให้บันทึกวิชาพร้อม 8 ระดับ
async function saveCourseSettings() {
  const btn = document.getElementById("btn-save-settings");
  btn.disabled = true;
  const cats = getCategories();
  const payload = {
    course_id: currentCourseId,
    course_name: document.getElementById("inp-course-name").value.trim(),
    grade_criteria: JSON.stringify({
      g4: parseFloat(document.getElementById("grade-4").value),
      g35: parseFloat(document.getElementById("grade-35").value),
      g3: parseFloat(document.getElementById("grade-3").value),
      g25: parseFloat(document.getElementById("grade-25").value),
      g2: parseFloat(document.getElementById("grade-2").value),
      g15: parseFloat(document.getElementById("grade-15").value),
      g1: parseFloat(document.getElementById("grade-1").value),
    }),
    score_categories: JSON.stringify(cats),
  };
  try {
    await db
      .collection("courses")
      .doc(currentCourseId)
      .set(payload, { merge: true });
    showToast("บันทึกค่าวิชาเรียบร้อย");
    await loadAllData();
  } catch (err) {
    showToast("บันทึกผิดพลาด", "error");
  }
  btn.disabled = false;
}

async function addSingleStudent(e) {
  e.preventDefault();
  const cl = document.getElementById("inp-class").value.trim();
  const sid = document.getElementById("inp-id").value.trim();
  const sname = document.getElementById("inp-name").value.trim();
  
  const btn = document.getElementById("add-single-btn");
  btn.disabled = true;
  btn.innerHTML = "Saving...";

  try {
    const batch = db.batch();

    // 1. เพิ่มข้อมูลนักเรียน
    const studentRef = db.collection("students").doc();
    batch.set(studentRef, {
      classroom: cl,
      student_id: sid,
      student_name: sname,
      scores: "[]",
      total: 0,
      percentage: 0,
      grade: "0",
      created_at: new Date().toISOString(),
      course_id: currentCourseId,
    });

    // 2. สร้างบัญชี Login ในคอลเลกชัน 'users' (ใช้รหัสประจำตัวเป็นรหัสผ่านเริ่มต้น)
    const userRef = db.collection("users").doc(); // หรือใช้ .doc(sid) ถ้าต้องการให้รหัสประจำตัวเป็น ID ของเอกสาร
    batch.set(userRef, {
      student_id: sid,
      student_name: sname,
      password: sid, // ตั้งรหัสผ่านเริ่มต้นเป็นเลขประจำตัว
      role: "student",
      created_at: new Date().toISOString()
    });

    await batch.commit();
    showToast("เพิ่มนักเรียนและสร้างบัญชีผู้ใช้งานสำเร็จ ✅");
    
    document.getElementById("inp-id").value = "";
    document.getElementById("inp-name").value = "";
    await loadAllData();
  } catch (err) {
    showToast("ไม่สามารถบันทึกได้", "error");
  }
  btn.disabled = false;
  btn.innerHTML = "Add Student";
  lucide.createIcons();
}

// 1. ฟังก์ชันเปิด Popup 
function openDeleteModal(bid) {
  // ค้นหาข้อมูลเด็กจาก ID
  deleteTarget = allStudents.find((s) => s.__backendId === bid);
  if (!deleteTarget) return;

  // โชว์ชื่อเด็กใน Popup
  const nameEl = document.getElementById("delete-name");
  if (nameEl) nameEl.textContent = deleteTarget.student_name;

  const modal = document.getElementById("delete-modal");
  if (modal) {
    modal.classList.remove("hidden"); // เอา hidden ออกเพื่อให้กล่องปรากฏ
    
    // หน่วงเวลาให้แอนิเมชันทำงาน
    setTimeout(() => {
      modal.classList.remove("opacity-0");
      modal.classList.add("active");
      const box = modal.querySelector("div");
      if (box) box.classList.remove("scale-90");
    }, 10);
  }
}

// 2. ฟังก์ชันปิด Popup (ใช้ชื่อ cancelDelete ตามโค้ดเดิมของคุณครู)
function cancelDelete() {
  deleteTarget = null;
  const modal = document.getElementById("delete-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.classList.add("opacity-0");
    const box = modal.querySelector("div");
    if (box) box.classList.add("scale-90");

    // รอแอนิเมชันจางหาย 300ms แล้วค่อยใส่ hidden
    setTimeout(() => {
      modal.classList.add("hidden");
    }, 300);
  }
}

async function confirmDelete() {
  if (!deleteTarget) return;
  
  try {
    const rawStudentId = deleteTarget.student_id;
    const studentDocId = deleteTarget.__backendId;
    
    if (!rawStudentId) {
      showToast("ไม่พบรหัสประจำตัวนักเรียน", "error");
      return;
    }

    const studentIdStr = String(rawStudentId).trim();
    console.log(`🚀 กำลังเริ่มลบข้อมูลของนักเรียนรหัส: [${studentIdStr}]`);

    // 🌟 1. ลบข้อมูลในคอลเลกชัน 'student_auth' ทันที (แก้ชื่อให้ตรงกับระบบของอาจารย์แล้ว)
    console.log("🔍 กำลังค้นหาบัญชีในคอลเลกชัน student_auth...");
    const authQuery = await db.collection("student_auth").where("student_id", "==", studentIdStr).get();
    
    if (authQuery.empty) {
        console.log("⚠️ ระบบหาบัญชีผู้ใช้นี้ไม่เจอใน student_auth");
    } else {
        // ถ้าเจอ สั่งลบทิ้งทันที
        for (const doc of authQuery.docs) {
            await db.collection("student_auth").doc(doc.id).delete();
            console.log(`✅ ลบบัญชีผู้ใช้งาน ID: ${doc.id} สำเร็จ`);
        }
    }

    // 🌟 2. จัดการลบส่วนอื่นๆ ด้วย Batch (รวมทีเดียวเพื่อความไว)
    const batch = db.batch();

    // 2.1 ลบชิ้นงาน (Submissions) และเคลียร์ไฟล์ขยะใน Google Drive
    console.log("🔍 กำลังเคลียร์ชิ้นงานและการบ้าน...");
    const subSnap = await db.collection("submissions").where("student_id", "==", studentIdStr).get();
    for (const doc of subSnap.docs) {
      const item = doc.data();
      if (item.file_url) {
        const urls = String(item.file_url).split("\n").filter((u) => u.trim() !== "");
        for (let url of urls) {
          try {
            if (GAS_URL && !GAS_URL.includes("วาง_URL")) {
              await fetch(GAS_URL, {
                method: "POST",
                mode: "no-cors", // บังคับทะลุบล็อก
                body: JSON.stringify({ action: "delete_file", data: { url: url } }),
                headers: { "Content-Type": "text/plain;charset=utf-8" },
              });
            }
          } catch (e) { console.error("แจ้งลบไฟล์ Drive พลาด:", e); }
        }
      }
      batch.delete(doc.ref);
    }

    // 2.2 ลบประวัติเช็คชื่อ
    console.log("🔍 กำลังล้างประวัติการเช็คชื่อ...");
    const attSnap = await db.collection("att_records").where("student_id", "==", studentIdStr).get();
    attSnap.docs.forEach(doc => batch.delete(doc.ref));

    // 2.3 ลบตัวนักเรียนออกจากตารางหลัก
    batch.delete(db.collection("students").doc(studentDocId));

    // 🌟 3. ยืนยันการลบ Batch
    await batch.commit();
    console.log("✅ ลบข้อมูลประวัติที่เกี่ยวข้องทั้งหมดสำเร็จ");

    showToast("ลบข้อมูลนักเรียนและบัญชีเข้าใช้งานเรียบร้อยแล้ว", "success");
    await loadAllData();

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดร้ายแรงระหว่างลบ:", err);
    showToast("ระบบขัดข้อง: " + err.message, "error");
  }
  
  cancelDelete();
}







// ========================================================
// 🟢 ระบบตรวจงาน (อัปเดตแก้ไขบั๊ก: บันทึกคะแนน + เปลี่ยนสถานะ)
// ========================================================

// ผูกฟังก์ชันให้รองรับทั้งการกดปุ่ม (คลิก) และการกด Enter (Submit Form)
async function submitGradeData(e) {
    if (e && e.preventDefault) e.preventDefault();
    await executeGradingProcess();
}

async function submitGrade(e) {
    if (e && e.preventDefault) e.preventDefault();
    await executeGradingProcess();
}

async function openGradeModal(sid) { 
    // รองรับทั้ง id แบบใหม่และเก่า
    const item = allSubmissions.find((d) => d.__backendId === sid || d.id === sid || d.submission_id === sid);
    if (!item) {
        if(typeof showToast === 'function') showToast("ไม่พบข้อมูลชิ้นงาน กรุณารีเฟรชหน้าจอ", "error");
        return;
    }
    currentGradeItem = item;
    
    // อัปเดตชื่อและชื่องาน
    const elStudent = document.getElementById("grade-modal-student");
    if (elStudent) elStudent.textContent = item.student_name || "ไม่ทราบชื่อ";
    
    const elTitle = document.getElementById("grade-modal-title");
    if (elTitle) elTitle.textContent = item.title || "ไม่มีชื่องาน";
    
    const elGradeTitle = document.getElementById("grade-title");
    if (elGradeTitle) elGradeTitle.textContent = `ตรวจงาน: ${item.student_name || item.student_id}`;
    
    // 💡 1. วิ่งไปโหลดข้อมูล "ใบงานต้นฉบับ" จาก Database ทันที
    const matId = item.worksheet_id || item.material_id || item.assignment_id;
    let matData = null;
    if (matId) {
        try {
            const matDoc = await db.collection('materials').doc(matId).get();
            if (matDoc.exists) matData = matDoc.data();
        } catch (e) { console.error("ดึงข้อมูลใบงานต้นฉบับไม่สำเร็จ:", e); }
    }

    // 💡 2. ค้นหาหมวดหมู่คะแนนที่ถูกต้อง (ดึงจากต้นฉบับใบงานเป็นหลัก)
    let targetCategoryName = item.score_category || item.category;
    if (!targetCategoryName && matData) {
        targetCategoryName = matData.score_category || matData.category;
    }
    targetCategoryName = targetCategoryName || item.title; 

    currentGradeItem.resolved_category = targetCategoryName;

    // 💡 3. ดึงคะแนนเต็มจากโครงสร้างให้ตรงกับวิชาปัจจุบัน
    let maxScore = 10; // ค่าเริ่มต้น
    const course = courses.find((c) => c.course_name === item.subject || String(c.course_id) === String(item.course_id));
    if (course) {
        try {
            const cats = JSON.parse(course.score_categories || "[]");
            // ค้นหาหมวดหมู่ที่ตรงกับใบงานนี้
            const cat = cats.find((c) => c.name && targetCategoryName && c.name.trim() === targetCategoryName.trim());
            if (cat && cat.max) {
                maxScore = parseFloat(cat.max); // เจอแล้ว! อัปเดตคะแนนเต็มตามโครงสร้าง
            } else {
                 console.warn("ไม่พบหมวดหมู่คะแนนที่ตรงกันในโครงสร้างวิชา", targetCategoryName);
            }
        } catch (e) { console.error("Parse score categories failed:", e); }
    } else {
        console.warn("ไม่พบรายวิชาที่ผูกกับงานนี้", item.subject, item.course_id);
    }
    
    // 💡 4. แสดงคะแนนเต็มที่หน้าจอ Popup (ตรงจุดที่คุณครูวงมาเลยครับ!)
    const maxLabel = document.getElementById("grade-modal-max");
    if (maxLabel) maxLabel.textContent = `คะแนนเต็ม: ${maxScore}`; // อัปเดตข้อความตรงนี้
    
    // ตั้งค่าลิมิตช่องกรอกคะแนน และดึงคะแนนเก่า (ถ้าเคยตรวจแล้ว)
    const inputObj = document.getElementById("grade-input-score") || document.getElementById("grade-score");
    if (inputObj) {
        inputObj.max = maxScore;
        let oldScore = "";
        const student = allStudents.find((s) => String(s.student_id) === String(item.student_id));
        if (student) {
            try {
                const scs = JSON.parse(student.scores || "[]");
                const found = scs.find(s => s.name && s.name.trim() === targetCategoryName.trim());
                if (found && found.score !== null && found.score !== "") {
                    oldScore = found.score;
                }
            } catch(e) {}
        }
        inputObj.value = oldScore; 
    }

    // =========================================================================
    // 🟢 ส่วนที่ดึงโจทย์และคำตอบใบงานมาแสดง (คงเดิม)
    // =========================================================================
    let displayEl = document.getElementById("worksheet-answers-display");
    if (!displayEl) {
        const insertBeforeTarget = inputObj ? inputObj.closest('div') : null; 
        if (insertBeforeTarget && insertBeforeTarget.parentNode) {
            displayEl = document.createElement('div');
            displayEl.id = "worksheet-answers-display";
            displayEl.className = "w-full my-4 max-h-[40vh] overflow-y-auto custom-scrollbar";
            insertBeforeTarget.parentNode.insertBefore(displayEl, insertBeforeTarget);
        }
    }

    if (displayEl) {
        if (matData && item.submission_type === "online_worksheet") {
            const questions = matData.questions || [];
            const studentAns = item.answers || {};
            
            if (questions.length === 0) {
                displayEl.innerHTML = `<p class="text-slate-500 text-sm text-center bg-slate-50 p-4 rounded-xl border border-slate-200">ไม่มีข้อคำถามในใบงานนี้</p>`;
            } else {
                let html = `<div class="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 mb-4 space-y-4 shadow-inner">`;
                questions.forEach((q, i) => {
                    const ans = studentAns[q.id];
                    const safeAns = ans ? String(ans).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
                    const displayAns = safeAns ? safeAns.replace(/\n/g, '<br>') : `<span class="text-slate-400 italic">ไม่ได้ตอบคำถาม</span>`;
                    const safeQ = String(q.text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    
                    html += `
                    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <p class="text-sm font-bold text-slate-700 mb-3 border-b border-slate-100 pb-3">
                            <span class="text-blue-500 mr-1 text-base">ข้อ ${i + 1}.</span> ${safeQ}
                        </p>
                        <div class="text-sm text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-2 flex items-center gap-1"><i data-lucide="message-square" class="w-3 h-3"></i> คำตอบของนักเรียน</span>
                            <div class="font-medium">${displayAns}</div>
                        </div>
                    </div>`;
                });
                html += `</div>`;
                displayEl.innerHTML = html;
            }
        } else if (!matData && item.submission_type === "online_worksheet") {
            displayEl.innerHTML = `<p class="text-rose-500 text-sm text-center bg-rose-50 p-4 rounded-xl border border-rose-200">ไม่พบโจทย์ใบงานต้นฉบับ (อาจถูกลบไปแล้ว)</p>`;
        } else {
            const safeDesc = item.description ? String(item.description).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace("[ส่งซ้ำ]", "").trim() : "";
            displayEl.innerHTML = safeDesc ? `<div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 text-sm text-slate-600 shadow-sm"><strong>รายละเอียดเพิ่มเติมจากนักเรียน:</strong><br>${safeDesc.replace(/\n/g, '<br>')}</div>` : '';
        }
    }

    // เปิดหน้าต่าง Popup
    const modal = document.getElementById("grade-modal");
    if (modal) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.add("active");
            modal.classList.remove("opacity-0"); 
            const box = modal.querySelector('div');
            if(box) box.classList.remove("scale-90");
            if (inputObj) inputObj.focus();
        }, 10);
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}

async function executeGradingProcess() {
    if (!currentGradeItem) return;

    const scoreInputEl = document.getElementById("grade-input-score") || document.getElementById("grade-score");
    const rawScore = scoreInputEl ? scoreInputEl.value : "";

    if (rawScore === "") {
        if(typeof showToast === 'function') showToast("⚠️ กรุณาใส่คะแนนก่อนบันทึกครับ", "error");
        return;
    }

    const scoreVal = parseFloat(rawScore);
    if (isNaN(scoreVal)) {
        if(typeof showToast === 'function') showToast("⚠️ คะแนนต้องเป็นตัวเลขเท่านั้น", "error");
        return;
    }

    const btn = document.getElementById("btn-submit-grade") || document.querySelector('button[onclick="submitGrade()"]');
    const origHtml = btn ? btn.innerHTML : "บันทึก";
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังบันทึก...';
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }

    try {
        const sub = currentGradeItem;
        const student = allStudents.find((s) => String(s.student_id) === String(sub.student_id));
        if (!student) throw new Error("ไม่พบข้อมูลนักเรียนในระบบ");

        const course = courses.find((c) => c.course_id === student.course_id || c.course_name === sub.subject);
        const subId = sub.__backendId || sub.id;
        const studentId = student.__backendId || student.id;
        const courseId = course ? (course.__backendId || course.id) : null;

        if (!subId || !studentId) throw new Error("ไม่พบรหัสอ้างอิง Database กรุณารีเฟรชหน้าจอ");

        let cats = [];
        if (course) {
            try { cats = JSON.parse(course.score_categories || "[]"); } catch (e) {}
        }

        // 🌟 ดึงชื่อโครงสร้างที่เราหาอย่างยากลำบากมาจากตอนเปิดหน้าต่าง มาใช้บันทึกให้ตรงช่อง!
        const targetCategoryName = sub.resolved_category || sub.score_category || sub.category || sub.title;

        let catFound = cats.find(c => c.name && c.name.trim() === targetCategoryName.trim());
        if (!catFound && courseId) {
            catFound = { name: targetCategoryName, max: parseFloat(scoreInputEl?.max) || 10 };
            cats.push(catFound);
            await db.collection('courses').doc(courseId).update({
                score_categories: JSON.stringify(cats)
            });
        }

        let oldScores = [];
        try { oldScores = JSON.parse(student.scores || "[]"); } catch (e) {}

        const timestampNow = new Date().toISOString();
        let scoreIndex = oldScores.findIndex(s => s.name && s.name.trim() === targetCategoryName.trim()); 
        
        if (scoreIndex >= 0) {
            oldScores[scoreIndex].score = scoreVal;
            oldScores[scoreIndex].max = catFound ? parseFloat(catFound.max) : oldScores[scoreIndex].max;
            oldScores[scoreIndex].graded_at = timestampNow;
        } else {
            oldScores.push({
                name: targetCategoryName,
                max: catFound ? parseFloat(catFound.max) : (parseFloat(scoreInputEl?.max) || 10),
                score: scoreVal,
                graded_at: timestampNow
            });
        }

        // คำนวณเกรดและคะแนนรวม
        let total = 0;
        let totalMax = 0;
        cats.forEach((cat) => {
            totalMax += parseFloat(cat.max) || 0;
            const existing = oldScores.find((s) => s.name && s.name.trim() === cat.name.trim());
            if (existing && existing.score !== undefined && existing.score !== null && existing.score !== "") {
                total += parseFloat(existing.score);
            }
        });

        const pct = totalMax > 0 ? (total / totalMax) * 100 : 0;
        const finalGrade = typeof calcGrade === 'function' ? calcGrade(pct, student.course_id) : "0";

        // บันทึกกลับลง Firebase
        await db.collection("students").doc(studentId).update({
            scores: JSON.stringify(oldScores),
            total: Math.round(total * 100) / 100,
            percentage: Math.round(pct * 100) / 100,
            grade: finalGrade
        });

        await db.collection("submissions").doc(subId).update({
            score: scoreVal,
            status: "graded", 
            graded_at: timestampNow,
            description: firebase.firestore.FieldValue.delete() 
        });

        if(typeof showToast === 'function') showToast("ตรวจงานและบันทึกคะแนนสำเร็จ! ✅", "success");
        if(typeof closeGradeModal === 'function') closeGradeModal();
        if(typeof loadAllData === 'function') await loadAllData(); 

    } catch (err) {
        console.error("Submit Grade Error:", err);
        if(typeof showToast === 'function') showToast("เกิดข้อผิดพลาด: " + err.message, "error");
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function closeGradeModal() {
  const modal = document.getElementById("grade-modal");
  if (modal) {
    // 1. เอา active ออก และคืนค่า opacity-0 ให้หน้าต่างค่อยๆ จางลง
    modal.classList.remove("active"); 
    modal.classList.add("opacity-0"); 
    
    // 2. สั่งให้กล่องข้างในหดตัวกลับไป (scale-90)
    const box = modal.querySelector('div');
    if (box) box.classList.add("scale-90");

    // 3. รอแอนิเมชันทำงาน 300ms แล้วค่อยซ่อนออกจากหน้าจอ
    setTimeout(() => {
      modal.classList.add("hidden"); 
      currentGradeItem = null;
      
      // (เสริม) เคลียร์ช่องใส่คะแนนทิ้ง เพื่อให้สะอาดตอนเปิดครั้งต่อไป
      const inputObj = document.getElementById("grade-input-score") || document.getElementById("grade-score");
      if (inputObj) inputObj.value = ""; 
    }, 300);
  }
}



// 🛠️ แก้ไขฟังก์ชันเปิดกล่องยืนยันการลบงาน
function openDeleteSubModal(id) {
  itemToDeleteSub = id;
  const modal = document.getElementById("delete-sub-modal");
  
  if (!modal) {
    alert("⚠️ ระบบหาหน้าต่างยืนยันการลบไม่เจอ (delete-sub-modal) อาจจะตกหล่นในไฟล์ HTML ครับ");
    return;
  }

  // 🟢 สั่งเลิกซ่อนตัวก่อน แล้วค่อยแสดง Popup
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.add("active");
  }, 10);
}

// 🛠️ แก้ไขฟังก์ชันปิดกล่องยืนยันการลบงาน
function closeDeleteSubModal() {
  const modal = document.getElementById("delete-sub-modal");
  if (modal) {
    modal.classList.remove("active");
    setTimeout(() => {
      modal.classList.add("hidden"); // ซ่อนกลับไปเมื่อปิด
      itemToDeleteSub = null;
    }, 300);
  }
}

// 🌟 อัปเดต นำเกณฑ์ 8 ระดับมาใช้สร้างวิชา
async function confirmCreateCourse() {
  const name = document.getElementById("modal-inp-course-name").value.trim();
  if (!name) return;
  const newId = "course_" + Date.now();
  const payload = {
    course_id: newId,
    course_name: name,
    grade_criteria: defaultGradeCriteria,
    score_categories: JSON.stringify(defaultCategories),
  };
  try {
    await db.collection("courses").doc(newId).set(payload);
    currentCourseId = newId;
    showToast("สร้างวิชาใหม่สำเร็จ");
    closeCourseModal();
    await loadAllData();
  } catch (err) {
    showToast("สร้างไม่สำเร็จ", "error");
  }
}

// 🌟 แก้ไข: เปิดหน้าต่างสร้างวิชา
function openCourseModal() {
  document.getElementById("modal-inp-course-name").value = "";
  const modal = document.getElementById("course-modal");
  modal.classList.remove("hidden"); // เอาตัวซ่อนออกก่อน
  setTimeout(() => modal.classList.add("active"), 10); // ค่อยแสดงแอนิเมชัน
}

// 🌟 แก้ไข: ปิดหน้าต่างสร้างวิชา
function closeCourseModal() {
  const modal = document.getElementById("course-modal");
  modal.classList.remove("active"); // เอาแอนิเมชันออก
  setTimeout(() => modal.classList.add("hidden"), 300); // รอ 0.3 วิ แล้วค่อยซ่อนกลับ
}
function openDeleteCourseModal() {
  const c = courses.find((c) => c.course_id === currentCourseId);
  document.getElementById("delete-course-name").textContent = c
    ? c.course_name
    : "";
  document.getElementById("delete-course-modal").classList.add("active");
}
function closeDeleteCourseModal() {
  document.getElementById("delete-course-modal").classList.remove("active");
}
async function confirmDeleteCourseAction() {
  try {
    await db.collection("courses").doc(currentCourseId).delete();
    showToast("ลบวิชาเรียบร้อย");
    currentCourseId = courses[0].course_id;
    closeDeleteCourseModal();
    await loadAllData();
  } catch (err) {
    showToast("ลบไม่สำเร็จ", "error");
  }
}

// 🌟 อัปเดต แถบกราฟสถิติ 8 ระดับ
function renderStats() {
  const data = getFilteredStudents();
  const sEmpty = document.getElementById("stats-empty");
  const sCont = document.getElementById("stats-content");
  if (!sEmpty || !sCont) return;
  if (data.length === 0) {
    sEmpty.classList.remove("hidden");
    sCont.classList.add("hidden");
    return;
  }
  sEmpty.classList.add("hidden");
  sCont.classList.remove("hidden");
  const pcts = data.map((s) => s.percentage || 0);
  const totals = data.map((s) => s.total || 0);
  document.getElementById("stat-count").textContent = data.length;
  document.getElementById("stat-avg").textContent =
    (pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1) + "%";
  document.getElementById("stat-max").textContent = Math.max(...totals);
  document.getElementById("stat-min").textContent = Math.min(...totals);

  const grades = { 4: 0, 3.5: 0, 3: 0, 2.5: 0, 2: 0, 1.5: 0, 1: 0, 0: 0 };
  data.forEach((s) => {
    if (grades[s.grade] !== undefined) grades[s.grade]++;
  });
  const maxG = Math.max(...Object.values(grades), 1);
  const gColors = {
    4: "bg-green-500",
    3.5: "bg-emerald-500",
    3: "bg-blue-500",
    2.5: "bg-indigo-500",
    2: "bg-yellow-500",
    1.5: "bg-orange-500",
    1: "bg-red-500",
    0: "bg-slate-500",
  };
  const gradeBars = document.getElementById("grade-bars");
  if (gradeBars) {
    gradeBars.innerHTML = Object.entries(grades)
      .map(
        ([g, n]) =>
          `<div class="flex items-center gap-6"><span class="w-10 text-[10px] font-bold ${gradeClass(g)} px-2 py-1 rounded-lg text-center uppercase">${g}</span><div class="flex-1 bg-slate-100 rounded-full h-8 overflow-hidden border border-slate-200 shadow-inner"><div class="${gColors[g]} h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-4 shadow-sm" style="width:${Math.max((n / maxG) * 100, 8)}%"><span class="text-[9px] text-white font-bold">${n} คน</span></div></div></div>`,
      )
      .join("");
  }
}

// =========================================================================
// ==================== ส่วนที่ 2: โค้ดสำหรับระบบเช็คชื่อ (ซิงค์ออโต้) ====================
// =========================================================================

function escHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function formatDBDate(val) {
  if (!val) return "";
  let str = String(val);
  if (str.includes("T")) {
    const d = new Date(str);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }
  return str.substring(0, 10);
}
function generateAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=64`;
}

function switchAttTab(tab) {
  currentAttTab = tab;
  ["rooms", "check", "report", "settings"].forEach((t) => {
    const el = document.getElementById(`att-panel-${t}`);
    if (el) el.classList.toggle("hidden", t !== tab);
    const btn = document.getElementById(`att-tab-${t}`);
    if (btn) {
      if (t === tab)
        btn.className =
          "px-6 py-2.5 rounded-2xl bg-pink-500 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-pink-200 transition-all whitespace-nowrap";
      else
        btn.className =
          "px-6 py-2.5 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap";
    }
  });

  if (tab === "rooms") renderAttRooms();
  else if (tab === "check") loadAttendanceList();
  else if (tab === "report") loadAttReport();
}

function updateAttRoomSelectors() {
  const uniqueRooms = [...new Set(allStudents.map((s) => s.classroom))]
    .filter((c) => c && c.trim() !== "")
    .sort();
  const checkSel = document.getElementById("att-check-room");
  const rptSel = document.getElementById("att-rpt-room");

  if (checkSel) {
    const curCheck = checkSel.value;
    checkSel.innerHTML = uniqueRooms
      .map((r) => `<option value="${r}">${escHtml(r)}</option>`)
      .join("");
    if (curCheck && uniqueRooms.includes(curCheck)) checkSel.value = curCheck;
  }
  if (rptSel) {
    const curRpt = rptSel.value;
    rptSel.innerHTML = uniqueRooms
      .map((r) => `<option value="${r}">${escHtml(r)}</option>`)
      .join("");
    if (curRpt && uniqueRooms.includes(curRpt)) rptSel.value = curRpt;
  }

  const hasRooms = uniqueRooms.length > 0;
  const noRoomCheck = document.getElementById("att-check-no-room");
  const contentCheck = document.getElementById("att-check-content");
  if (noRoomCheck) noRoomCheck.classList.toggle("hidden", hasRooms);
  if (contentCheck) contentCheck.classList.toggle("hidden", !hasRooms);

  const noRoomRpt = document.getElementById("att-report-no-room");
  const contentRpt = document.getElementById("att-report-content");
  if (noRoomRpt) noRoomRpt.classList.toggle("hidden", hasRooms);
  if (contentRpt) contentRpt.classList.toggle("hidden", !hasRooms);
}

function renderAttRooms() {
  const container = document.getElementById("att-rooms-list");
  const searchTxt = (
    document.getElementById("search-att-room")?.value || ""
  ).toLowerCase();

  const uniqueRooms = [...new Set(allStudents.map((s) => s.classroom))]
    .filter((c) => c && c.trim() !== "")
    .sort();
  const filtered = uniqueRooms.filter((r) =>
    String(r).toLowerCase().includes(searchTxt),
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div class="bg-white border border-slate-200 rounded-3xl p-8 text-center col-span-full text-slate-400"><i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 opacity-50"></i><p>ไม่พบข้อมูลห้องเรียน</p><p class="text-xs mt-2">กรุณาเพิ่มนักเรียนในเมนู 'สมุดคะแนน'</p></div>`;
    lucide.createIcons();
    return;
  }

  let html = `<div class="col-span-full bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-2xl mb-2 flex items-start gap-3 shadow-sm">
        <i data-lucide="info" class="w-5 h-5 mt-0.5 shrink-0 text-blue-500"></i>
        <div class="text-sm"><p class="font-bold">รายชื่อและห้องเรียนทำงานอัตโนมัติ</p><p>ระบบเช็คชื่อดึงข้อมูลจากแท็บ "สมุดคะแนน" หากต้องการเพิ่ม/แก้ไขชื่อนักเรียน กรุณาจัดการที่สมุดคะแนนครับ</p></div>
    </div>`;

  html += filtered
    .map((r) => {
      const count = allStudents.filter((s) => s.classroom === r).length;
      return `
        <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center border border-pink-100"><i data-lucide="school" class="w-6 h-6 text-pink-500"></i></div>
              <div><h3 class="font-bold text-slate-800 text-lg">${escHtml(r)}</h3><p class="text-xs text-slate-500 font-bold uppercase tracking-widest">${count} คน</p></div>
            </div>
          </div>
          <div class="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
            ${renderAttStudentList(r)}
          </div>
        </div>`;
    })
    .join("");
  container.innerHTML = html;
  lucide.createIcons();
}

// ========================================================
// อัปเดต: เพิ่มปุ่มลบนักเรียนในรายชื่อหน้าระบบเช็คชื่อ
// ========================================================
function renderAttStudentList(roomId) {
  const st = allStudents
    .filter((s) => s.classroom === roomId)
    .sort((a, b) => String(a.student_id).localeCompare(String(b.student_id)));
    
  if (st.length === 0)
    return '<p class="text-xs text-center py-4 text-slate-400 font-medium">ยังไม่มีนักเรียน</p>';

  return st
    .map((s) => {
      const avatarUrl =
        s.profile_url || s.avatar || generateAvatar(s.student_name);
        
      return `
        <div class="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
          <div class="flex items-center gap-3 min-w-0">
            <img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover border border-slate-200">
            <button onclick="openStudentProfileById('${s.student_id}')" class="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline truncate text-left flex items-center transition-colors">
                ${escHtml(s.student_name)}
            </button>
          </div>
          
          <div class="flex items-center gap-2 shrink-0">
            <div class="text-xs text-slate-400 font-bold">${escHtml(s.student_id)}</div>
            
            <button onclick="openDeleteModal('${s.__backendId}')" class="text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-50" title="ลบข้อมูลนักเรียนคนนี้ออกจากระบบ">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>`;
    })
    .join("");
}

function loadAttendanceList() {
  const roomId = document.getElementById("att-check-room").value;
  const date = document.getElementById("att-check-date").value;
  const period = document.getElementById("att-check-period").value;
  const searchTxt = (
    document.getElementById("search-att-student")?.value || ""
  ).toLowerCase();

  if (!roomId || !date) return;

  let studs = allStudents
    .filter((s) => s.classroom === roomId)
    .sort((a, b) => String(a.student_id).localeCompare(String(b.student_id)));

  let dashP = 0,
    dashA = 0,
    dashL = 0,
    dashLt = 0;
  studs.forEach((s) => {
    const rec = attRecords.find(
      (a) =>
        a.student_id === s.student_id &&
        formatDBDate(a.date) === date &&
        String(a.period) === String(period),
    );
    if (rec) {
      if (rec.status === "present") dashP++;
      else if (rec.status === "absent") dashA++;
      else if (rec.status === "leave") dashL++;
      else if (rec.status === "late") dashLt++;
    }
  });

  const countTextEl = document.getElementById("att-check-count-text");
  if (countTextEl) {
    countTextEl.textContent = `(${studs.length} คน)`;
  }
  document.getElementById("att-dash-present").textContent = dashP;
  document.getElementById("att-dash-absent").textContent = dashA;
  document.getElementById("att-dash-leave").textContent = dashL;
  document.getElementById("att-dash-late").textContent = dashLt;

  if (searchTxt)
    studs = studs.filter(
      (s) =>
        String(s.student_name).toLowerCase().includes(searchTxt) ||
        String(s.student_id).includes(searchTxt),
    );

  const container = document.getElementById("att-check-list");
  if (studs.length === 0) {
    container.innerHTML = `<div class="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center text-slate-400"><p class="font-medium">${searchTxt ? "ไม่พบชื่อนักเรียนที่ค้นหา" : "ไม่มีนักเรียนในห้องนี้"}</p></div>`;
    return;
  }

  container.innerHTML = studs
    .map((s) => {
      const rec = attRecords.find(
        (a) =>
          a.student_id === s.student_id &&
          formatDBDate(a.date) === date &&
          String(a.period) === String(period),
      );
      const status = rec ? rec.status : "";
      const remark = rec ? rec.remark || "" : "";
      const avatarUrl =
        s.profile_url || s.avatar || generateAvatar(s.student_name);

      return `
        <div class="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all hover:border-pink-300">
          <div class="flex items-center gap-4 min-w-0 flex-1">
            <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-slate-200">
            <span class="text-sm font-bold w-12 text-center flex-shrink-0 text-slate-400">${escHtml(s.student_id)}</span>
            <span class="text-sm font-bold text-slate-800 truncate">${escHtml(s.student_name)}</span>
          </div>
          <div class="flex flex-col sm:flex-row items-center gap-3 justify-end w-full lg:w-auto">
            <input type="text" id="rem-${s.student_id}" class="bg-slate-50 border border-slate-200 focus:border-pink-500 outline-none text-xs px-3 py-2.5 rounded-xl w-full sm:w-32 flex-shrink-0 font-medium text-slate-700" placeholder="หมายเหตุ..." value="${escHtml(remark)}" onblur="saveAttRemarkOnly('${s.student_id}', '${status}')">
            <div class="flex gap-1.5 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end">
              <button onclick="markAtt('${s.student_id}','present')" class="flex-1 sm:flex-none sm:w-12 py-2.5 sm:py-0 h-auto sm:h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${status === "present" ? "bg-green-500 text-white shadow-sm shadow-green-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}" title="มา">✓</button>
              <button onclick="markAtt('${s.student_id}','absent')" class="flex-1 sm:flex-none sm:w-12 py-2.5 sm:py-0 h-auto sm:h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${status === "absent" ? "bg-red-500 text-white shadow-sm shadow-red-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}" title="ขาด">✗</button>
              <button onclick="markAtt('${s.student_id}','leave')" class="flex-1 sm:flex-none sm:w-12 py-2.5 sm:py-0 h-auto sm:h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${status === "leave" ? "bg-amber-500 text-white shadow-sm shadow-amber-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}" title="ลา">◎</button>
              <button onclick="markAtt('${s.student_id}','late')" class="flex-1 sm:flex-none sm:w-12 py-2.5 sm:py-0 h-auto sm:h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${status === "late" ? "bg-indigo-500 text-white shadow-sm shadow-indigo-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}" title="สาย">◷</button>
            </div>
          </div>
        </div>`;
    })
    .join("");
}

async function markAtt(studentId, status) {
  const roomId = document.getElementById("att-check-room").value;
  const date = document.getElementById("att-check-date").value;
  const period = document.getElementById("att-check-period").value;
  const remark =
    document.getElementById("rem-" + studentId)?.value.trim() || "";

  const existing = attRecords.find(
    (a) =>
      a.student_id === studentId &&
      formatDBDate(a.date) === date &&
      String(a.period) === String(period),
  );

  try {
    if (existing) {
      await db
        .collection("att_records")
        .doc(existing.__backendId)
        .update({ status, remark, timestamp: new Date().toISOString() });
      existing.status = status;
      existing.remark = remark;
    } else {
      const ref = await db
        .collection("att_records")
        .add({
          room_id: roomId,
          student_id: studentId,
          date,
          period,
          status,
          remark,
          timestamp: new Date().toISOString(),
        });
      attRecords.push({
        room_id: roomId,
        student_id: studentId,
        date,
        period,
        status,
        remark,
        timestamp: new Date().toISOString(),
        __backendId: ref.id,
      });
    }
    loadAttendanceList();
  } catch (e) {
    showToast("บันทึกไม่สำเร็จ", "error");
  }
}

function saveAttRemarkOnly(studentId, status) {
  if (!status) return;
  markAtt(studentId, status);
}

async function bulkMarkAtt(status) {
  const roomId = document.getElementById("att-check-room").value;
  const date = document.getElementById("att-check-date").value;
  const period = document.getElementById("att-check-period").value;
  const studs = allStudents.filter((s) => s.classroom === roomId);
  if (studs.length === 0) return;

  const batch = db.batch();
  studs.forEach((s) => {
    const remark =
      document.getElementById("rem-" + s.student_id)?.value.trim() || "";
    const existing = attRecords.find(
      (a) =>
        a.student_id === s.student_id &&
        formatDBDate(a.date) === date &&
        String(a.period) === String(period),
    );

    if (existing) {
      batch.update(db.collection("att_records").doc(existing.__backendId), {
        status,
        remark,
        timestamp: new Date().toISOString(),
      });
      existing.status = status;
      existing.remark = remark;
    } else {
      const ref = db.collection("att_records").doc();
      batch.set(ref, {
        room_id: roomId,
        student_id: s.student_id,
        date,
        period,
        status,
        remark,
        timestamp: new Date().toISOString(),
      });
      attRecords.push({
        room_id: roomId,
        student_id: s.student_id,
        date,
        period,
        status,
        remark,
        timestamp: new Date().toISOString(),
        __backendId: ref.id,
      });
    }
  });

  try {
    await batch.commit();
    const labels = {
      present: "มาเรียน",
      absent: "ขาดเรียน",
      leave: "ลา",
      late: "มาสาย",
    };
    showToast(`เช็คทั้งห้อง: ${labels[status]} สำเร็จ`);
    loadAttendanceList();
  } catch (e) {
    showToast("บันทึกไม่สำเร็จ", "error");
  }
}

async function sendAttLineNotify() {
  const token =
    document.getElementById("att-setting-line-token")?.value ||
    localStorage.getItem("lineToken");
  if (!token)
    return showToast("กรุณาตั้งค่า LINE Token ในเมนูตั้งค่าก่อน", "error");

  const roomId = document.getElementById("att-check-room").value;
  const date = document.getElementById("att-check-date").value;
  const period = document.getElementById("att-check-period").value;
  const studs = allStudents.filter((s) => s.classroom === roomId);

  if (studs.length === 0)
    return showToast("ไม่มีข้อมูลนักเรียนในห้องนี้", "error");

  let P = 0,
    A = 0,
    L = 0,
    Lt = 0;
  let arrA = [],
    arrL = [],
    arrLt = [];
  studs.forEach((s) => {
    const rec = attRecords.find(
      (a) =>
        a.student_id === s.student_id &&
        formatDBDate(a.date) === date &&
        String(a.period) === String(period),
    );
    if (rec) {
      if (rec.status === "present") P++;
      else if (rec.status === "absent") {
        A++;
        arrA.push(s.student_name + (rec.remark ? ` [${rec.remark}]` : ""));
      } else if (rec.status === "leave") {
        L++;
        arrL.push(s.student_name + (rec.remark ? ` [${rec.remark}]` : ""));
      } else if (rec.status === "late") {
        Lt++;
        arrLt.push(s.student_name + (rec.remark ? ` [${rec.remark}]` : ""));
      }
    }
  });

  const dSplit = date.split("-");
  const dateStr = `${dSplit[2]}/${dSplit[1]}/${parseInt(dSplit[0]) + 543}`;
  let msg = `\n📋 แจ้งเตือนเช็คชื่อ\nห้อง: ${roomId}\nวันที่: ${dateStr} คาบ: ${period}\n\n`;
  msg += `✅ มาเรียน: ${P} คน\n❌ ขาด: ${A} คน ${arrA.length > 0 ? "\n- " + arrA.join("\n- ") : ""}\n◎ ลา: ${L} คน ${arrL.length > 0 ? "\n- " + arrL.join("\n- ") : ""}\n◷ สาย: ${Lt} คน ${arrLt.length > 0 ? "\n- " + arrLt.join("\n- ") : ""}`;

  // 🛠️ จุดที่แก้ไข: เลิกใช้ event.currentTarget และค้นหาปุ่มด้วยวิธีที่ปลอดภัยกว่า
  const btn = document.querySelector('button[onclick*="sendAttLineNotify"]');
  let orig = "";
  if (btn) {
    orig = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังส่ง...';
    btn.disabled = true;
    lucide.createIcons();
  }

  try {
    if (!GAS_URL || GAS_URL.includes("วาง_URL"))
      throw new Error("GAS_URL_NOT_SET");
    const res = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "notify", data: { token, message: msg } }),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    });
    const json = await res.json();
    if (json.status === "success") showToast("ส่งแจ้งเตือน LINE สำเร็จ!");
    else throw new Error();
  } catch (e) {
    if (e.message === "GAS_URL_NOT_SET")
      showToast("กรุณาใส่ Web App URL ในโค้ดส่วนต้น", "error");
    else
      showToast("ส่งแจ้งเตือนล้มเหลว ตรวจสอบ Token หรือ Web App URL", "error");
  }
  
  // 🛠️ จุดที่แก้ไข: คืนค่าปุ่มให้ใช้งานได้ต่ออย่างปลอดภัย
  if (btn) {
    btn.innerHTML = orig;
    btn.disabled = false;
    lucide.createIcons();
  }
}

// 🌟 1. ดึงข้อมูลรายงานแบบแยกคาบ / รวมคาบ
function loadAttReport() {
  const roomId = document.getElementById("att-rpt-room").value;
  const month = document.getElementById("att-rpt-month").value;
  const periodFilter =
    document.getElementById("att-rpt-period")?.value || "all";

  if (!roomId || !month) return;

  const studs = allStudents
    .filter((s) => s.classroom === roomId)
    .sort((a, b) => String(a.student_id).localeCompare(String(b.student_id)));

  // กรองข้อมูลเบื้องต้น (ห้อง, เดือน)
  let recs = attRecords.filter(
    (a) =>
      a.room_id === roomId && a.date && formatDBDate(a.date).startsWith(month),
  );

  // 🔥 ถ้าเลือกคาบเฉพาะ ให้กรองทิ้งคาบอื่น
  if (periodFilter !== "all") {
    recs = recs.filter((a) => String(a.period) === String(periodFilter));
  }

  const dates = [...new Set(recs.map((r) => formatDBDate(r.date)))].sort();
  let totalP = 0,
    totalA = 0,
    totalL = 0,
    totalLt = 0;

  const thead = document.getElementById("att-report-thead");
  let thHtml =
    '<tr><th class="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap border-r border-slate-200">รหัส</th><th class="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap border-r border-slate-200">ชื่อ-สกุล</th>';
  dates.forEach((d) => {
    thHtml += `<th class="px-2 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-center min-w-[50px] border-r border-slate-200">${parseInt(d.split("-")[2])}</th>`;
  });
  thHtml +=
    '<th class="px-3 py-3 text-xs font-bold text-green-500 uppercase tracking-widest text-center">มา</th><th class="px-3 py-3 text-xs font-bold text-red-500 uppercase tracking-widest text-center">ขาด</th><th class="px-3 py-3 text-xs font-bold text-amber-500 uppercase tracking-widest text-center">ลา</th><th class="px-3 py-3 text-xs font-bold text-indigo-500 uppercase tracking-widest text-center">สาย</th></tr>';
  thead.innerHTML = thHtml;

  const tbody = document.getElementById("att-report-tbody");
  tbody.innerHTML = studs
    .map((s) => {
      let sp = 0,
        sa = 0,
        sl = 0,
        slt = 0;
      const cells = dates
        .map((d) => {
          const dayRecs = recs.filter(
            (r) => r.student_id === s.student_id && formatDBDate(r.date) === d,
          );
          if (dayRecs.length === 0)
            return '<td class="px-2 py-2 text-xs text-center font-bold text-slate-300 border-r border-slate-200">-</td>';

          dayRecs.forEach((r) => {
            if (r.status === "present") sp++;
            else if (r.status === "absent") sa++;
            else if (r.status === "leave") sl++;
            else if (r.status === "late") slt++;
          });

          const symbols = { present: "✓", absent: "✗", leave: "◎", late: "◷" };
          const colors = {
            present: "text-green-500",
            absent: "text-red-500",
            leave: "text-amber-500",
            late: "text-indigo-500",
          };

          // 🔥 วิธีแสดงผลในตาราง
          if (periodFilter !== "all") {
            const dom = dayRecs[0];
            return `<td class="px-2 py-2 text-sm text-center font-bold ${colors[dom.status]} border-r border-slate-200">${symbols[dom.status]}</td>`;
          } else {
            dayRecs.sort((a, b) => parseInt(a.period) - parseInt(b.period));
            const multiHtml = dayRecs
              .map(
                (r) =>
                  `<div class="text-[9px] ${colors[r.status]} whitespace-nowrap">ค.${r.period}:${symbols[r.status]}</div>`,
              )
              .join("");
            return `<td class="px-1 py-1 text-center font-bold leading-tight border-r border-slate-200">${multiHtml}</td>`;
          }
        })
        .join("");

      totalP += sp;
      totalA += sa;
      totalL += sl;
      totalLt += slt;
      return `<tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
          <td class="px-4 py-3 text-sm text-slate-500 font-bold whitespace-nowrap border-r border-slate-200">${escHtml(s.student_id)}</td>
          <td class="px-4 py-3 text-sm text-slate-800 font-bold whitespace-nowrap border-r border-slate-200">${escHtml(s.student_name)}</td>
          ${cells}
          <td class="px-3 py-3 text-sm text-center font-bold text-green-600 bg-green-50/50">${sp}</td><td class="px-3 py-3 text-sm text-center font-bold text-red-500 bg-red-50/50">${sa}</td><td class="px-3 py-3 text-sm text-center font-bold text-amber-500 bg-amber-50/50">${sl}</td><td class="px-3 py-3 text-sm text-center font-bold text-indigo-500 bg-indigo-50/50">${slt}</td>
        </tr>`;
    })
    .join("");

  document.getElementById("att-rpt-present").textContent = totalP;
  document.getElementById("att-rpt-absent").textContent = totalA;
  document.getElementById("att-rpt-leave").textContent = totalL;
  document.getElementById("att-rpt-late").textContent = totalLt;
}

// 🌟 2. ส่งออก Excel ให้อิงตามตัวกรองคาบด้วย
function exportAttExcel() {
  if (typeof XLSX === "undefined")
    return showToast("กำลังโหลดไลบรารี", "error");
  const roomId = document.getElementById("att-rpt-room").value;
  const month = document.getElementById("att-rpt-month").value;
  const periodFilter =
    document.getElementById("att-rpt-period")?.value || "all";

  const studs = allStudents
    .filter((s) => s.classroom === roomId)
    .sort((a, b) => String(a.student_id).localeCompare(String(b.student_id)));
  if (studs.length === 0)
    return showToast("ไม่มีข้อมูลนักเรียนให้ส่งออก", "error");

  let recs = attRecords.filter(
    (a) =>
      a.room_id === roomId && a.date && formatDBDate(a.date).startsWith(month),
  );
  if (periodFilter !== "all")
    recs = recs.filter((a) => String(a.period) === String(periodFilter));

  const dates = [...new Set(recs.map((r) => formatDBDate(r.date)))].sort();
  if (dates.length === 0)
    return showToast(
      "ยังไม่มีประวัติการเช็คชื่อในเดือนและคาบที่เลือก",
      "error",
    );

  let headerRow = ["รหัส", "ชื่อ-สกุล"];
  dates.forEach((d) => {
    headerRow.push(parseInt(d.split("-")[2]) + " (ว/ด/ป)");
  });
  headerRow.push("มาเรียน", "ขาด", "ลา", "มาสาย", "หมายเหตุสะสม");

  let dataRows = [];
  studs.forEach((s) => {
    let sp = 0,
      sa = 0,
      sl = 0,
      slt = 0;
    let remarks = [];
    let row = [s.student_id, s.student_name];

    dates.forEach((d) => {
      const dayRecs = recs.filter(
        (r) => r.student_id === s.student_id && formatDBDate(r.date) === d,
      );
      if (dayRecs.length === 0) {
        row.push("-");
        return;
      }

      dayRecs.forEach((r) => {
        if (r.status === "present") sp++;
        else if (r.status === "absent") sa++;
        else if (r.status === "leave") sl++;
        else if (r.status === "late") slt++;
        if (r.remark) remarks.push(`[ค.${r.period}] ${d}: ${r.remark}`);
      });

      if (periodFilter !== "all") {
        const dom = dayRecs[0].status;
        if (dom === "present") row.push("มา");
        else if (dom === "absent") row.push("ขาด");
        else if (dom === "leave") row.push("ลา");
        else if (dom === "late") row.push("สาย");
      } else {
        dayRecs.sort((a, b) => parseInt(a.period) - parseInt(b.period));
        const txt = dayRecs
          .map(
            (r) =>
              `ค.${r.period}:${r.status === "present" ? "มา" : r.status === "absent" ? "ขาด" : r.status === "leave" ? "ลา" : "สาย"}`,
          )
          .join(", ");
        row.push(txt);
      }
    });
    row.push(sp, sa, sl, slt, remarks.join(", "));
    dataRows.push(row);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");

  const safeRoomName = String(roomId).replace(/[\/\\]/g, "-");
  const periodText = periodFilter === "all" ? "รวมคาบ" : `คาบ${periodFilter}`;
  XLSX.writeFile(wb, `เช็คชื่อ_${safeRoomName}_${periodText}_${month}.xlsx`);
  showToast("ดาวน์โหลด Excel สำเร็จ!");
}

// 🌟 3. ส่งออก PDF ให้อิงตามตัวกรองคาบด้วย
function exportAttPDF() {
  const roomId = document.getElementById("att-rpt-room").value;
  const month = document.getElementById("att-rpt-month").value;
  const periodFilter =
    document.getElementById("att-rpt-period")?.value || "all";

  const studs = allStudents
    .filter((s) => s.classroom === roomId)
    .sort((a, b) => String(a.student_id).localeCompare(String(b.student_id)));
  if (studs.length === 0)
    return showToast("ไม่มีข้อมูลนักเรียนให้ส่งออก", "error");

  let recs = attRecords.filter(
    (a) =>
      a.room_id === roomId && a.date && formatDBDate(a.date).startsWith(month),
  );
  if (periodFilter !== "all")
    recs = recs.filter((a) => String(a.period) === String(periodFilter));

  const dates = [...new Set(recs.map((r) => formatDBDate(r.date)))].sort();
  if (dates.length === 0)
    return showToast(
      "ยังไม่มีประวัติการเช็คชื่อในเดือนและคาบที่เลือก",
      "error",
    );

  const thaiMonth = new Date(month + "-01").toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
  });
  const teacherName =
    localStorage.getItem("teacherName") ||
    ".........................................";
  const schoolName = localStorage.getItem("schoolName") || "โรงเรียนของคุณ";

  let tableHtml = `<tr><th>รหัส</th><th>ชื่อ-สกุล</th>`;
  dates.forEach((d) => {
    tableHtml += `<th>${parseInt(d.split("-")[2])}</th>`;
  });
  tableHtml += `<th>มา</th><th>ขาด</th><th>ลา</th><th>สาย</th></tr>`;

  studs.forEach((s) => {
    let sp = 0,
      sa = 0,
      sl = 0,
      slt = 0;
    tableHtml += `<tr><td>${escHtml(s.student_id)}</td><td style="text-align:left;">${escHtml(s.student_name)}</td>`;
    dates.forEach((d) => {
      const dayRecs = recs.filter(
        (r) => r.student_id === s.student_id && formatDBDate(r.date) === d,
      );
      if (dayRecs.length === 0) {
        tableHtml += "<td>-</td>";
        return;
      }

      dayRecs.forEach((r) => {
        if (r.status === "present") sp++;
        else if (r.status === "absent") sa++;
        else if (r.status === "leave") sl++;
        else if (r.status === "late") slt++;
      });

      if (periodFilter !== "all") {
        const dom = dayRecs[0].status;
        const sym = { present: "✓", absent: "✗", leave: "◎", late: "◷" };
        const cls = {
          present: "stat-present",
          absent: "stat-absent",
          leave: "stat-leave",
          late: "stat-late",
        };
        tableHtml += `<td class="${cls[dom]}">${sym[dom]}</td>`;
      } else {
        dayRecs.sort((a, b) => parseInt(a.period) - parseInt(b.period));
        const sym = { present: "✓", absent: "✗", leave: "◎", late: "◷" };
        const cls = {
          present: "stat-present",
          absent: "stat-absent",
          leave: "stat-leave",
          late: "stat-late",
        };
        const multiHtml = dayRecs
          .map(
            (r) =>
              `<div class="${cls[r.status]}" style="font-size:7px; white-space:nowrap;">ค.${r.period}:${sym[r.status]}</div>`,
          )
          .join("");
        tableHtml += `<td style="padding:1px;">${multiHtml}</td>`;
      }
    });
    tableHtml += `<td class="stat-present">${sp}</td><td class="stat-absent">${sa}</td><td class="stat-leave">${sl}</td><td class="stat-late">${slt}</td></tr>`;
  });

  const periodText =
    periodFilter === "all" ? "รวมทุกคาบ" : `เฉพาะคาบ ${periodFilter}`;
  const pdfHtml = `<div class="pdf-report" style="font-family:'Sarabun',sans-serif;color:#1e293b;padding:24px;background:#fff;"><h2 style="text-align:center;font-size:18px;font-weight:700;margin-bottom:4px;">รายงานการเช็คชื่อ (${periodText})</h2><p style="text-align:center;font-size:13px;color:#64748b;margin-bottom:12px;">${escHtml(schoolName)}</p><p style="font-size:13px;margin-bottom:8px;"><strong>ห้อง:</strong> ${escHtml(roomId)} &nbsp; | &nbsp; <strong>เดือน:</strong> ${thaiMonth}</p><table style="width:100%;border-collapse:collapse;font-size:11px;">${tableHtml}</table><style>table th,table td{border:1px solid #cbd5e1;padding:6px 8px;text-align:center;}table th{background:#4f46e5;color:#fff;font-weight:600;} .stat-present{color:#059669;font-weight:600;} .stat-absent{color:#dc2626;font-weight:600;} .stat-leave{color:#d97706;font-weight:600;} .stat-late{color:#4f46e5;font-weight:600;}</style><table style="width: 100%; border: none; margin-top: 35px;"><tr style="border: none;"><td style="border: none; text-align: left; vertical-align: bottom; padding: 0;"><p style="font-size:10px;color:#94a3b8;">สร้างโดยระบบเช็คชื่อออนไลน์ — ${new Date().toLocaleDateString("th-TH")}</p></td><td style="border: none; text-align: center; width: 220px; padding: 0;"><p style="font-size:12px; margin-bottom: 35px;">ลงชื่อครูผู้สอน</p><p style="font-size:12px;">(${escHtml(teacherName)})</p></td></tr></table></div>`;

  const container = document.getElementById("pdf-container");
  container.innerHTML = pdfHtml;

  const safeRoomName = String(roomId).replace(/[\/\\]/g, "-");
  const pText = periodFilter === "all" ? "รวมคาบ" : `คาบ${periodFilter}`;
  html2pdf()
    .set({
      margin: 10,
      filename: `เช็คชื่อ_${safeRoomName}_${pText}_${month}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: dates.length > 12 ? "landscape" : "portrait",
      },
    })
    .from(container.firstChild)
    .save()
    .then(() => {
      showToast("ดาวน์โหลด PDF สำเร็จ!");
    });
}

// 🌟 1. อัปเดตให้ดึงพิกัดจาก Firebase มาแสดงบนหน้าเว็บแอดมิน
async function loadAttSettings() {
  const el1 = document.getElementById("att-setting-teacher-name");
  if (el1) el1.value = localStorage.getItem("teacherName") || "";
  const el2 = document.getElementById("att-setting-school-name");
  if (el2) el2.value = localStorage.getItem("schoolName") || "";
  const el3 = document.getElementById("att-setting-line-token");
  if (el3) el3.value = localStorage.getItem("lineToken") || "";
  const el4 = document.getElementById("att-setting-gas-url");
  if (el4) el4.value = localStorage.getItem("gasUrl") || "";

  // ดึงค่า GPS จาก Firebase
  try {
    const snap = await db.collection("settings").doc("system").get();
    if (snap.exists) {
      const data = snap.data();
      if (data.lineToken && el3) el3.value = data.lineToken;
      const latEl = document.getElementById("att-setting-lat");
      if (latEl && data.schoolLat) latEl.value = data.schoolLat;
      const lngEl = document.getElementById("att-setting-lng");
      if (lngEl && data.schoolLng) lngEl.value = data.schoolLng;
      const radEl = document.getElementById("att-setting-radius");
      if (radEl && data.schoolRadius) radEl.value = data.schoolRadius;
    }
  } catch (e) {}
}

// 🌟 2. อัปเดตให้เซฟพิกัดลง Firebase ให้นักเรียนดึงไปใช้ได้
async function saveAttSettings() {
  const tName = document
    .getElementById("att-setting-teacher-name")
    ?.value.trim();
  const sName = document
    .getElementById("att-setting-school-name")
    ?.value.trim();
  const lToken = document
    .getElementById("att-setting-line-token")
    ?.value.trim();
  const gUrl = document.getElementById("att-setting-gas-url")?.value.trim();

  // รับค่า GPS
  const lat = document.getElementById("att-setting-lat")?.value.trim();
  const lng = document.getElementById("att-setting-lng")?.value.trim();
  const radius = document.getElementById("att-setting-radius")?.value.trim();

  if (tName !== undefined) localStorage.setItem("teacherName", tName);
  if (sName !== undefined) localStorage.setItem("schoolName", sName);
  if (gUrl !== undefined) {
    localStorage.setItem("gasUrl", gUrl);
    GAS_URL = gUrl; // ✨ เพิ่มบรรทัดนี้เข้าไปครับ
  }

  let dbPayload = {};
  if (lToken !== undefined) {
    localStorage.setItem("lineToken", lToken);
    dbPayload.lineToken = lToken;
  }

  if (lat) dbPayload.schoolLat = parseFloat(lat);
  if (lng) dbPayload.schoolLng = parseFloat(lng);
  if (radius) dbPayload.schoolRadius = parseInt(radius);

  try {
    if (Object.keys(dbPayload).length > 0) {
      // เซฟค่าระบบส่วนกลางเข้า Firebase
      await db
        .collection("settings")
        .doc("system")
        .set(dbPayload, { merge: true });
    }
    showToast("บันทึกข้อมูลการตั้งค่าระบบเรียบร้อยแล้ว");
  } catch (e) {
    showToast("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล", "error");
  }
}

// =========================================================================
// ==================== ส่วนที่ 4: ระบบแก้ไขข้อมูลนักเรียน =======================
// =========================================================================

let editStudentTarget = null;

function openEditStudentModal(backendId) {
  editStudentTarget = allStudents.find((s) => s.__backendId === backendId);
  if (!editStudentTarget) return;

  // ดึงข้อมูลมาแสดงในช่องพิมพ์
  document.getElementById("edit-stu-id").value =
    editStudentTarget.student_id || "";
  document.getElementById("edit-stu-name").value =
    editStudentTarget.student_name || "";
  document.getElementById("edit-stu-class").value =
    editStudentTarget.classroom || "";
  document.getElementById("edit-stu-avatar").value =
    editStudentTarget.profile_url || editStudentTarget.avatar || "";
  document.getElementById("edit-stu-remark").value =
    editStudentTarget.remark || "";

  const modal = document.getElementById("edit-student-modal");
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.add("active");
  }, 10);
}

function closeEditStudentModal() {
  editStudentTarget = null;
  const modal = document.getElementById("edit-student-modal");
  modal.classList.remove("active");
  setTimeout(() => {
    modal.classList.add("hidden");
  }, 300);
}

async function saveEditStudent(e) {
  e.preventDefault();
  if (!editStudentTarget) return;

  const btn = document.getElementById("btn-save-edit-student");
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Saving...';
  lucide.createIcons();

  // ข้อมูลใหม่ที่ต้องการบันทึกทับ
  const payload = {
    student_id: document.getElementById("edit-stu-id").value.trim(),
    student_name: document.getElementById("edit-stu-name").value.trim(),
    classroom: document.getElementById("edit-stu-class").value.trim(),
    avatar: document.getElementById("edit-stu-avatar").value.trim(),
    profile_url: document.getElementById("edit-stu-avatar").value.trim(), // 🌟 เซฟให้ตรงกับของนักเรียน
    remark: document.getElementById("edit-stu-remark").value.trim(),
  };

  try {
    await db
      .collection("students")
      .doc(editStudentTarget.__backendId)
      .update(payload);
    showToast("แก้ไขข้อมูลนักเรียนสำเร็จ ✅");
    closeEditStudentModal();
    await loadAllData(); // โหลดตารางใหม่
  } catch (err) {
    showToast("ไม่สามารถบันทึกข้อมูลได้", "error");
  }

  btn.disabled = false;
  btn.innerHTML = origHtml;
}

// =========================================================================
// ==================== ส่วนที่ 5: ระบบทวงงานค้างอัจฉริยะ =======================
// =========================================================================

function openReminderModal() {
  const select = document.getElementById("remind-task-select");
  const cats = getCategories();

  if (cats.length === 0) {
    return showToast("ไม่พบรายการชิ้นงานในวิชานี้", "error");
  }

  select.innerHTML = cats
    .map((c) => `<option value="${c.name}">${c.name}</option>`)
    .join("");
  document.getElementById("remind-custom-msg").value = "";

  const modal = document.getElementById("reminder-modal");
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.add("active");
  }, 10);
  lucide.createIcons();
}

function closeReminderModal() {
  const modal = document.getElementById("reminder-modal");
  modal.classList.remove("active");
  setTimeout(() => {
    modal.classList.add("hidden");
  }, 300);
}

async function sendReminderLineNotify() {
  const token = localStorage.getItem("lineToken");
  if (!token)
    return showToast(
      "กรุณาตั้งค่า LINE Token ในเมนูตั้งค่าระบบเช็คชื่อก่อน",
      "error",
    );

  const taskName = document.getElementById("remind-task-select").value;
  const customMsg = document.getElementById("remind-custom-msg").value.trim();
  if (!taskName) return;

  // 1. ดึงนักเรียนในห้องที่เลือกอยู่ปัจจุบัน (ดึงจาก Filter หน้าตารางคะแนน)
  const data = getFilteredStudents();
  if (data.length === 0)
    return showToast("ไม่มีข้อมูลนักเรียนในห้องนี้", "error");

  let missingStudents = [];

  // 2. ตรวจสอบว่าใครยังไม่ส่งงาน หรือยังไม่มีคะแนน
  data.forEach((student) => {
    let hasScore = false;
    let hasSubmitted = false;

    // เช็คจากคะแนนที่มีอยู่
    try {
      const scs = JSON.parse(student.scores || "[]");
      const found = scs.find((s) => s.name === taskName);
      if (found && found.score !== null && found.score !== "") hasScore = true;
    } catch (e) {}

    // เช็คจากไฟล์ที่ส่งเข้ามา (รอตรวจ)
    const pendingWork = allSubmissions.find(
      (s) =>
        String(s.student_id) === String(student.student_id) &&
        s.title === taskName,
    );
    if (pendingWork) hasSubmitted = true;

    // ถ้าไม่มีคะแนน และไม่ได้ส่งงานมาทิ้งไว้ = งานค้าง!
    if (!hasScore && !hasSubmitted) {
      missingStudents.push(`- ${student.student_id} ${student.student_name}`);
    }
  });

  if (missingStudents.length === 0) {
    closeReminderModal();
    return showToast(`เยี่ยมมาก! ทุกคนส่งงาน "${taskName}" ครบแล้ว 🎉`);
  }

  // 3. สร้างข้อความแจ้งเตือน
  const roomText = currentClass === "all" ? "ทุกห้อง" : currentClass;
  let msg = `\n🔔 แจ้งเตือน: ทวงงานค้าง\nวิชา: ${document.getElementById("inp-course-name").value}\nห้อง: ${roomText}\n📌 ชิ้นงาน: ${taskName}\n\n`;
  msg += `รายชื่อผู้ที่ยังไม่ส่งงาน (${missingStudents.length} คน):\n${missingStudents.join("\n")}`;

  if (customMsg) {
    msg += `\n\n💬 ข้อความจากครู:\n${customMsg}`;
  }

  // 4. ส่งเข้า LINE Notify
  const btn = document.getElementById("btn-send-reminder");
  const origHtml = btn.innerHTML;
  btn.innerHTML =
    '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังส่ง...';
  btn.disabled = true;
  lucide.createIcons();

  try {
    if (!GAS_URL || GAS_URL.includes("วาง_URL"))
      throw new Error("GAS_URL_NOT_SET");
    const res = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "notify", data: { token, message: msg } }),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    });
    const json = await res.json();

    if (json.status === "success") {
      showToast("ส่งแจ้งเตือนทวงงานเข้า LINE สำเร็จ!");
      closeReminderModal();
    } else {
      throw new Error();
    }
  } catch (e) {
    showToast("ส่งแจ้งเตือนล้มเหลว ตรวจสอบ Token หรือเครือข่าย", "error");
  }

  btn.innerHTML = origHtml;
  btn.disabled = false;
  lucide.createIcons();
}



// รายการระบบที่จะเปิดปิด
const systemFeatures = [
  { id: "toggle_news", label: "Latest News", icon: "megaphone" },
  {
    id: "toggle_assignment",
    label: "Daily Assignment",
    icon: "clipboard-list",
  },
  { id: "toggle_treasure", label: "Treasure Hunt", icon: "compass" },
  { id: "toggle_gacha", label: "Gacha Showcase", icon: "crown" },
  { id: "toggle_2dgame", label: "โลกการเรียนรู้ 2D", icon: "gamepad-2" },
  {
    id: "toggle_review",
    label: "ทบทวนบทเรียน & ทดสอบความรู้",
    icon: "book-open-check",
  },
];

// ดึงข้อมูลตอนเปิดหน้า Tab
async function loadSystemToggles() {
  const container = document.getElementById("system-toggles-container");
  container.innerHTML =
    '<div class="text-center text-slate-400 py-4"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto"></i></div>';
  lucide.createIcons();

  let settings = {};
  try {
    const doc = await db.collection("settings").doc("system_toggles").get();
    if (doc.exists) {
      settings = doc.data();

      // 🌟 จุดที่แก้ไข: ดึงค่า URL รูปภาพมาแสดงในช่อง Input และกล่อง Preview ให้ถูกต้อง
      if (document.getElementById("setting-mood-bg")) {
        document.getElementById("setting-mood-bg").value =
          settings.mood_bg_url || "";
        document.getElementById("preview-mood").src =
          settings.mood_bg_url || ""; // ดึงรูปมาแสดง
      }
      if (document.getElementById("setting-profile-bg")) {
        document.getElementById("setting-profile-bg").value =
          settings.profile_bg_url || "";
        document.getElementById("preview-profile").src =
          settings.profile_bg_url || ""; // ดึงรูปมาแสดง
      }
      if (document.getElementById("setting-assign-img")) {
        document.getElementById("setting-assign-img").value =
          settings.assign_img_url || "";
        document.getElementById("preview-assign").src =
          settings.assign_img_url || ""; // ดึงรูปมาแสดง
      }
    } else {
      systemFeatures.forEach((f) => (settings[f.id] = true));
    }

    container.innerHTML = systemFeatures
      .map(
        (f) => `
            <div class="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-white rounded-xl shadow-sm"><i data-lucide="${f.icon}" class="w-5 h-5 text-slate-600"></i></div>
                    <span class="font-bold text-slate-700 text-base">${f.label}</span>
                </div>
                <div class="relative inline-block w-14 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" name="${f.id}" id="${f.id}" class="toggle-checkbox absolute block w-7 h-7 rounded-full bg-white border-4 appearance-none cursor-pointer" ${settings[f.id] !== false ? "checked" : ""}/>
                    <label for="${f.id}" class="toggle-label block overflow-hidden h-7 rounded-full bg-gray-300 cursor-pointer"></label>
                </div>
            </div>
        `,
      )
      .join("");
    lucide.createIcons();
  } catch (e) {
    showToast("โหลดตั้งค่าไม่สำเร็จ", "error");
  }
}

// บันทึกลง Firebase
async function saveSystemToggles() {
  const btn = document.getElementById("btn-save-toggles");

  // ป้องกัน Error กรณีหาปุ่มไม่เจอ
  if (!btn) return;

  const originalText = btn.innerHTML;
  btn.innerHTML =
    '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> บันทึก...';

  let payload = {};

  // 1. ดึงค่าจากสวิตช์เปิด-ปิดเมนูต่างๆ
  if (typeof systemFeatures !== "undefined") {
    systemFeatures.forEach((f) => {
      const toggleEl = document.getElementById(f.id);
      if (toggleEl) {
        payload[f.id] = toggleEl.checked;
      }
    });
  }

  // 2. 🌟 ดึงค่า URL ภาพพื้นหลังจาก Input ทั้ง 3 ช่อง เพื่อเซฟ
  const moodBgEl = document.getElementById("setting-mood-bg");
  if (moodBgEl) {
    payload.mood_bg_url = moodBgEl.value.trim();
  }

  const profileBgEl = document.getElementById("setting-profile-bg");
  if (profileBgEl) {
    payload.profile_bg_url = profileBgEl.value.trim();
  }

  const assignImgEl = document.getElementById("setting-assign-img");
  if (assignImgEl) {
    payload.assign_img_url = assignImgEl.value.trim();
  }

  // 3. ส่งข้อมูลไปบันทึกที่ Firebase
  try {
    await db
      .collection("settings")
      .doc("system_toggles")
      .set(payload, { merge: true });
    showToast("บันทึกการตั้งค่าสำเร็จ", "success");
  } catch (e) {
    console.error("Save Settings Error: ", e);
    showToast("บันทึกไม่สำเร็จ", "error");
  }

  // คืนค่าปุ่มกลับมาเหมือนเดิม
  btn.innerHTML = originalText;
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

// ========================================================
// 🖼️ ระบบบีบอัดและอัพโหลดแบนเนอร์ข่าวสาร
// ========================================================

// 1. ฟังก์ชันย่อขนาดภาพ (ทำงานบนเครื่องครูก่อนส่งไป Drive)
function compressImage(file, maxWidth, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
    };
    reader.onerror = (error) => reject(error);
  });
}

// ========================================================
// 📢 โครงสร้างใหม่: ระบบจัดการข่าวสาร (Announcements)
// ========================================================

// 1. ตัวแปรเก็บสถานะ (State) เพื่อให้ระบบจำได้ว่ากำลังแก้ข่าวไหน และรูปเดิมคืออะไร
let newsState = {
  editId: null,
  oldCoverUrl: null,
  oldFileUrl: null,
};

// 2. ฟังก์ชันช่วยเหลือ: ส่งคำสั่งลบไฟล์ไปที่ Google Drive (ซ่อน CORS)
async function deleteFileFromDrive(url) {
  if (!url || !GAS_URL || GAS_URL.includes("วาง_URL")) return;
  try {
    console.log("กำลังสั่งลบไฟล์ขยะออกจาก Drive:", url);
    await fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors", // บังคับทะลุบล็อก
      body: JSON.stringify({ action: "delete_file", data: { url: url } }),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    });
  } catch (e) {
    console.error("ลบไฟล์จาก Drive ไม่สำเร็จ:", e);
  }
}

// 3. ฟังก์ชันโหลดรายการข่าว
async function loadAdminAnnouncements() {
  const container = document.getElementById("admin-news-list");
  if (!container) return;
  container.innerHTML =
    '<div class="text-center py-8 text-slate-400"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-2"></i> กำลังโหลดข้อมูล...</div>';
  lucide.createIcons();

  try {
    const snap = await db
      .collection("announcements")
      .orderBy("timestamp", "desc")
      .get();
    if (snap.empty) {
      container.innerHTML =
        '<div class="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200"><i data-lucide="inbox" class="w-10 h-10 mx-auto mb-2 opacity-30"></i> ยังไม่มีการประกาศข่าวสาร</div>';
      lucide.createIcons();
      return;
    }

    container.innerHTML = snap.docs
      .map((doc) => {
        const d = doc.data();
        const dateStr = new Date(d.timestamp).toLocaleDateString("th-TH", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return `
            <div class="flex items-start justify-between bg-white shadow-sm p-5 rounded-2xl border border-slate-200 hover:border-rose-300 transition-all gap-4 mb-3">
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-800 text-base mb-1">${d.title}</h4>
                    <p class="text-xs text-slate-500 line-clamp-2 mb-3">${d.content}</p>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200"><i data-lucide="calendar" class="w-3 h-3 inline"></i> ${dateStr}</span>
                        ${d.cover_url ? `<span class="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded border border-rose-200"><i data-lucide="image" class="w-3 h-3 inline"></i> มีรูปภาพ</span>` : ""}
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button type="button" onclick="editAnnouncement('${doc.id}')" class="p-2.5 text-amber-500 hover:bg-amber-50 rounded-xl border border-transparent hover:border-amber-200 transition-colors shadow-sm">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                    <button type="button" onclick="confirmDeleteAnnouncement('${doc.id}')" class="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-colors shadow-sm">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>`;
      })
      .join("");
    lucide.createIcons();
  } catch (e) {
    container.innerHTML =
      '<div class="text-center py-8 text-rose-500 font-bold">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
  }
}

// 4. ฟังก์ชันดึงข้อมูลมาแก้ไข (ดึงรูปมาโชว์ 100%)
async function editAnnouncement(id) {
  try {
    const doc = await db.collection("announcements").doc(id).get();
    if (!doc.exists) return showToast("ไม่พบข้อมูลข่าวสาร", "error");

    const data = doc.data();

    // จำค่าเดิมไว้ใน State
    newsState.editId = id;
    newsState.oldCoverUrl = data.cover_url || data.coverUrl || null;
    newsState.oldFileUrl = data.file_url || data.fileUrl || null;

    // นำข้อมูลไปใส่ในฟอร์ม
    document.getElementById("edit-news-id").value = id;
    document.getElementById("news-title").value = data.title || "";
    document.getElementById("news-content").value = data.content || "";
    document.getElementById("news-file").value = newsState.oldFileUrl || "";

    // จัดการรูปภาพแบนเนอร์
    const coverInput = document.getElementById("news-cover");
    const previewContainer = document.getElementById(
      "banner-preview-container",
    );
    const previewImg = document.getElementById("banner-preview");

    if (newsState.oldCoverUrl) {
      coverInput.value = newsState.oldCoverUrl;
      previewImg.src = newsState.oldCoverUrl;
      previewContainer.classList.remove("hidden");
    } else {
      coverInput.value = "";
      previewImg.src = "";
      previewContainer.classList.add("hidden");
    }

    document
      .getElementById("panel-announcements")
      .scrollIntoView({ behavior: "smooth" });
    showToast("ดึงข้อมูลพร้อมแก้ไข ✏️", "success");
  } catch (error) {
    showToast("เกิดข้อผิดพลาดในการดึงข้อมูล", "error");
  }
}

// 5. ฟังก์ชันอัปโหลดภาพ (ถ้ามีรูปเดิมอยู่ จะลบรูปเดิมทิ้งทันที)
async function uploadBannerToDrive() {
  const fileInput = document.getElementById("banner-upload");
  const file = fileInput.files[0];
  if (!file) return showToast("กรุณาเลือกรูปภาพก่อนครับ", "error");

  if (!GAS_URL || GAS_URL.includes("ใส่_URL")) {
    return showToast("กรุณาตั้งค่า Web App URL ก่อนครับ", "error");
  }

  const btn = document.getElementById("btn-upload-banner");
  const originalHtml = btn.innerHTML;
  btn.innerHTML =
    '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> อัปโหลด...';
  btn.disabled = true;
  lucide.createIcons();

  try {
    const base64Image = await compressImage(file, 1200, 0.8);
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "upload_banner",
        data: { base64: base64Image },
      }),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    });

    const result = await response.json();
    if (result.status === "success") {
      // ถ้านี่คือการแก้ไข และมีรูปเก่าอยู่ ให้สั่งลบรูปเก่าจาก Drive ทิ้งเลย
      if (newsState.oldCoverUrl) {
        await deleteFileFromDrive(newsState.oldCoverUrl);
      }

      // นำลิงก์ใหม่มาแสดง
      const newUrl = result.url;
      document.getElementById("news-cover").value = newUrl;
      document.getElementById("banner-preview").src = newUrl;
      document
        .getElementById("banner-preview-container")
        .classList.remove("hidden");

      // อัปเดต State ให้จำรูปใหม่
      newsState.oldCoverUrl = newUrl;
      showToast("อัปโหลดและอัปเดตรูปภาพสำเร็จ 🖼️", "success");
    } else {
      throw new Error("อัปโหลดล้มเหลว");
    }
  } catch (error) {
    showToast("ไม่สามารถอัปโหลดได้", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    fileInput.value = ""; // เคลียร์ช่องเลือกไฟล์
    lucide.createIcons();
  }
}

// 6. ฟังก์ชันลบรูปภาพพรีวิวออก (สั่งลบจาก Drive ด้วย)
async function removeBanner() {
  const coverInput = document.getElementById("news-cover");
  const currentUrl = coverInput.value;

  if (currentUrl) {
    await deleteFileFromDrive(currentUrl); // ลบทิ้งจากระบบเลย
  }

  coverInput.value = "";
  document.getElementById("banner-preview").src = "";
  document.getElementById("banner-preview-container").classList.add("hidden");
  document.getElementById("banner-upload").value = "";
  newsState.oldCoverUrl = null;
  showToast("ลบรูปภาพออกแล้ว", "info");
}

// 7. ฟังก์ชันบันทึกข้อมูล (สร้างใหม่ / อัปเดต)
async function submitAnnouncement(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-news");
  const origHtml = btn.innerHTML;

  const payload = {
    title: document.getElementById("news-title").value.trim(),
    content: document.getElementById("news-content").value.trim(),
    cover_url: document.getElementById("news-cover").value.trim() || null,
    file_url: document.getElementById("news-file").value.trim() || null,
    timestamp: new Date().toISOString(),
  };

  btn.disabled = true;
  btn.innerHTML =
    '<i data-lucide="loader-2" class="w-5 h-5 animate-spin inline"></i> กำลังบันทึก...';
  lucide.createIcons();

  try {
    if (newsState.editId) {
      await db
        .collection("announcements")
        .doc(newsState.editId)
        .update(payload);
      showToast("อัปเดตประกาศข่าวสารสำเร็จ! ✨", "success");
    } else {
      await db.collection("announcements").add(payload);
      showToast("เพิ่มประกาศข่าวสารใหม่สำเร็จ! 📢", "success");
    }

    // เคลียร์ฟอร์มและ State ให้สะอาด
    e.target.reset();
    document.getElementById("edit-news-id").value = "";
    document.getElementById("news-cover").value = "";
    document.getElementById("banner-preview").src = "";
    document.getElementById("banner-preview-container").classList.add("hidden");
    newsState = { editId: null, oldCoverUrl: null, oldFileUrl: null }; // Reset State

    loadAdminAnnouncements(); // อัปเดตรายการ
  } catch (err) {
    showToast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
  }
  btn.disabled = false;
  btn.innerHTML = origHtml;
  lucide.createIcons();
}

// 8. ระบบลบข่าวสาร (ลบทั้ง DB และ Drive)
let newsIdToDelete = null;
function confirmDeleteAnnouncement(id) {
  newsIdToDelete = id;
  const modal = document.getElementById("delete-news-modal");
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.add("opacity-100");
    modal.querySelector("div").classList.remove("scale-90");
  }, 10);

  document.getElementById("btn-confirm-delete-news").onclick =
    executeDeleteAnnouncement;
}

function closeDeleteNewsModal() {
  const modal = document.getElementById("delete-news-modal");
  modal.classList.remove("opacity-100");
  modal.querySelector("div").classList.add("scale-90");
  setTimeout(() => modal.classList.add("hidden"), 300);
  newsIdToDelete = null;
}

async function executeDeleteAnnouncement() {
  const btn = document.getElementById("btn-confirm-delete-news");
  const origHtml = btn.innerHTML;
  btn.innerHTML =
    '<i data-lucide="loader-2" class="w-5 h-5 animate-spin inline"></i> กำลังลบ...';
  btn.disabled = true;
  lucide.createIcons();

  try {
    // ดึงข้อมูลเพื่อเช็คหา URL ที่ต้องลบจาก Drive
    const doc = await db.collection("announcements").doc(newsIdToDelete).get();
    if (doc.exists) {
      const data = doc.data();
      const imageUrl = data.cover_url || data.coverUrl;
      if (imageUrl) {
        await deleteFileFromDrive(imageUrl); // ส่งลบ Drive
      }
    }

    // ลบจาก Database
    await db.collection("announcements").doc(newsIdToDelete).delete();

    // ถ้าข่าวที่ลบ บังเอิญเป็นข่าวที่เรากำลังเปิดแก้ไขคาฟอร์มอยู่ ให้เคลียร์ฟอร์มทิ้งด้วย
    if (newsState.editId === newsIdToDelete) {
      document
        .querySelector('form[onsubmit="submitAnnouncement(event)"]')
        .reset();
      document.getElementById("edit-news-id").value = "";
      document
        .getElementById("banner-preview-container")
        .classList.add("hidden");
      newsState = { editId: null, oldCoverUrl: null, oldFileUrl: null };
    }

    showToast("ลบประกาศและล้างไฟล์รูปใน Drive เรียบร้อย 🗑️", "success");
    closeDeleteNewsModal();
    loadAdminAnnouncements();
  } catch (e) {
    showToast("เกิดข้อผิดพลาดในการลบ", "error");
  }

  btn.disabled = false;
  btn.innerHTML = origHtml;
  lucide.createIcons();
}

// ==========================================
// 🖼️ ระบบแสดงรูปตัวอย่างทันทีที่เลือกไฟล์ (Pre-upload Preview)
// ==========================================
// ตรวจสอบว่ามี input นี้ในหน้าจอไหม ถ้ามีให้ดักจับการเลือกไฟล์
if (document.getElementById("banner-upload")) {
  document
    .getElementById("banner-upload")
    .addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
          const previewImg = document.getElementById("banner-preview");
          const previewContainer = document.getElementById(
            "banner-preview-container",
          );

          if (previewImg && previewContainer) {
            previewImg.src = event.target.result; // เอาไฟล์ที่เลือกมาทำเป็น URL ชั่วคราว
            previewContainer.classList.remove("hidden"); // สั่งให้กรอบรูปแสดงตัวออกมา
          }
        };
        reader.readAsDataURL(file);
      }
    });
}

// ==========================================
// 🔄 ระบบย้ายนักเรียนเข้าวิชาปัจจุบัน
// ==========================================

let migrateTargetList = []; // เก็บรายชื่อที่จะย้าย

function openMigrateCourseModal() {
    migrateTargetList = [];

    // แสดงชื่อวิชาปัจจุบัน
    const course = courses.find(c => c.course_id === currentCourseId);
    const courseName = course ? course.course_name : currentCourseId;
    document.getElementById('migrate-target-course-name').textContent = `วิชาปลายทาง: ${courseName} (${currentCourseId})`;

    // reset UI
    document.getElementById('migrate-preview').innerHTML = '<span class="text-slate-400 italic">กด "ตรวจสอบ" เพื่อดูรายชื่อที่จะย้าย</span>';
    document.getElementById('btn-confirm-migrate').disabled = true;
    document.getElementById('migrate-from-course').value = 'default_course';

    const modal = document.getElementById('migrate-course-modal');
    const box = document.getElementById('migrate-course-modal-box');
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    box.classList.remove('scale-95');
    box.classList.add('scale-100');
    lucide.createIcons();
}

function closeMigrateCourseModal() {
    const modal = document.getElementById('migrate-course-modal');
    const box = document.getElementById('migrate-course-modal-box');
    modal.classList.add('opacity-0');
    box.classList.remove('scale-100');
    box.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
    migrateTargetList = [];
}

async function previewMigration() {
    const fromCourse = document.getElementById('migrate-from-course').value;
    const previewDiv = document.getElementById('migrate-preview');

    previewDiv.innerHTML = '<span class="text-slate-400 italic">กำลังค้นหา...</span>';
    document.getElementById('btn-confirm-migrate').disabled = true;

    try {
        let snap;
        if (fromCourse === 'all') {
            // ดึงทุกคนที่ course_id ไม่ตรงกับวิชาปัจจุบัน
            const allSnap = await db.collection('students').get();
            migrateTargetList = allSnap.docs
                .filter(d => d.data().course_id !== currentCourseId)
                .map(d => ({ docId: d.id, ...d.data() }));
        } else {
            // ดึงเฉพาะ course_id ที่เลือก
            snap = await db.collection('students')
                .where('course_id', '==', fromCourse)
                .get();
            migrateTargetList = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
        }

        if (migrateTargetList.length === 0) {
            previewDiv.innerHTML = '<span class="text-emerald-600 font-bold">✅ ไม่มีนักเรียนที่ต้องย้ายแล้วครับ</span>';
            return;
        }

        // แสดงรายชื่อ
        previewDiv.innerHTML = `
            <div class="w-full">
                <p class="text-xs font-bold text-amber-600 mb-2">พบ ${migrateTargetList.length} คนที่จะย้าย:</p>
                <div class="max-h-40 overflow-y-auto space-y-1.5">
                    ${migrateTargetList.map(s => `
                        <div class="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs">
                            <span class="font-bold text-slate-700">${s.student_name}</span>
                            <div class="flex items-center gap-2">
                                <span class="bg-red-100 text-red-600 px-2 py-0.5 rounded-lg font-bold">${s.course_id || 'ไม่มี'}</span>
                                <i data-lucide="arrow-right" class="w-3 h-3 text-slate-400"></i>
                                <span class="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-lg font-bold">${currentCourseId}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.getElementById('btn-confirm-migrate').disabled = false;
        lucide.createIcons();

    } catch (e) {
        previewDiv.innerHTML = '<span class="text-rose-500 font-bold">เกิดข้อผิดพลาดในการค้นหา</span>';
        console.error(e);
    }
}

async function confirmMigration() {
    if (migrateTargetList.length === 0) return;

    const btn = document.getElementById('btn-confirm-migrate');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังย้าย...';
    lucide.createIcons();

    try {
        // ✅ ใช้ batch write เพื่อประสิทธิภาพ (Firestore จำกัด 500 ต่อ batch)
        const batchSize = 400;
        for (let i = 0; i < migrateTargetList.length; i += batchSize) {
            const batch = db.batch();
            const chunk = migrateTargetList.slice(i, i + batchSize);
            chunk.forEach(s => {
                const ref = db.collection('students').doc(s.docId);
                batch.update(ref, { course_id: currentCourseId });
            });
            await batch.commit();
        }

        showToast(`✅ ย้ายนักเรียน ${migrateTargetList.length} คน เข้าวิชา ${currentCourseId} สำเร็จ!`);
        closeMigrateCourseModal();
        await loadAllData(); // รีโหลดข้อมูลใหม่

    } catch (e) {
        showToast('เกิดข้อผิดพลาดในการย้ายวิชา', 'error');
        console.error(e);
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> ยืนยันย้ายวิชา';
        lucide.createIcons();
    }
}


/**
 * ฟังก์ชันตรวจงานและสร้างช่องคะแนนอัตโนมัติ (Upsert Logic)
 * @param {Object} submission - ข้อมูลการส่งงานของเด็ก (จาก Collection submissions)
 * @param {Number} finalScore - คะแนนที่ครูให้
 */
async function approveAndUpsertGrade(submission, finalScore) {
    const { worksheet_id, title, course_id, student_id, id: submissionDocId } = submission;

    // 1. อ้างอิงไปยัง Collection ต่างๆ
    const assignmentsRef = db.collection('assignments');
    const submissionsRef = db.collection('submissions');

    try {
        console.log("กำลังตรวจสอบช่องคะแนน...");

        // 2. ค้นหาว่ามี Assignment (ช่องคะแนน) นี้ในวิชานี้หรือยัง
        const assignmentSnap = await assignmentsRef
            .where('course_id', '==', course_id || currentCourseId)
            .where('worksheet_id', '==', worksheet_id)
            .get();

        let assignmentId;

        if (assignmentSnap.empty) {
            // 🚩 กรณีที่ 1: ครูลืมสร้างช่องคะแนน -> ระบบสร้างให้ใหม่เลย!
            console.log("ไม่พบช่องคะแนน... ระบบกำลังสร้างช่องคะแนนให้อัตโนมัติ ✨");
            
            const newAssignment = await assignmentsRef.add({
                course_id: course_id || currentCourseId,
                worksheet_id: worksheet_id,
                title: title || "งานที่มอบหมายใหม่",
                category: "งาน/การบ้าน", // หมวดหมู่เริ่มต้น
                max_score: 10,           // คะแนนเต็มเริ่มต้น (ครูไปแก้ทีหลังได้ในตาราง)
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                auto_created: true       // มาร์คไว้ว่าระบบสร้างให้เอง
            });
            assignmentId = newAssignment.id;
            showToast("สร้างช่องคะแนนใหม่ในตารางอัตโนมัติเรียบร้อย!", "success");
        } else {
            // ✅ กรณีที่ 2: มีช่องคะแนนอยู่แล้ว -> ใช้ ID เดิม
            assignmentId = assignmentSnap.docs[0].id;
        }

        // 3. บันทึกคะแนนลงในใบงานที่เด็กส่ง (Update Submission)
        await submissionsRef.doc(submissionDocId).update({
            score: Number(finalScore),
            status: "graded", // เปลี่ยนสถานะเป็นตรวจแล้ว
            graded_at: firebase.firestore.FieldValue.serverTimestamp(),
            assignment_ref_id: assignmentId // ผูกไอดีช่องคะแนนไว้เผื่อเรียกดู
        });

        // 4. (Optional) ถ้าคุณมี Collection 'grades' แยกต่างหากสำหรับดึงขึ้นตารางคะแนนโดยเฉพาะ
        // ให้บันทึก/อัปเดตตรงนี้ด้วย
        await db.collection('grades').doc(`${assignmentId}_${student_id}`).set({
            assignment_id: assignmentId,
            student_id: student_id,
            course_id: course_id || currentCourseId,
            score: Number(finalScore),
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast("บันทึกคะแนนเรียบร้อยแล้วครับ! 🎉");
        
        // สั่งโหลดข้อมูลใหม่เพื่ออัปเดต UI
        if (typeof loadAllData === "function") await loadAllData();

    } catch (error) {
        console.error("Error in approveAndUpsertGrade:", error);
        showToast("เกิดข้อผิดพลาด: " + error.message, "error");
    }
}

// ==========================================
// 🟢 ฟังก์ชันสลับแท็บย่อยใน "ศูนย์ควบคุมชั้นเรียน"
// ==========================================
function switchSubTab(tabName) {
    // 1. ซ่อนเนื้อหาทั้งหมดใน sub-panel
    document.querySelectorAll('.sub-panel').forEach(el => {
      el.classList.remove('active');
      el.classList.add('hidden');
    });
    
    // 2. แสดงเฉพาะเนื้อหาที่เลือก
    let targetPanel = document.getElementById('subpanel-' + tabName);
    if(targetPanel) {
        targetPanel.classList.remove('hidden');
        targetPanel.classList.add('active');
    }

    // 3. รีเซ็ตสีปุ่มทั้งหมดให้เป็นสีเทา
    document.querySelectorAll('.subtab-btn').forEach(btn => {
        btn.className = "subtab-btn px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-slate-200";
    });

    // 4. ไฮไลต์สีปุ่มที่ถูกคลิก (แยกสีตามระบบ)
    let activeBtn = document.getElementById('subtab-' + tabName);
    if(activeBtn) {
        if(tabName === 'attendance') {
            activeBtn.className = "subtab-btn px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all bg-indigo-600 text-white shadow-sm border border-transparent";
        } else if(tabName === 'grading') {
            activeBtn.className = "subtab-btn px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all bg-emerald-600 text-white shadow-sm border border-transparent";
        } else if(tabName === 'stats') {
            activeBtn.className = "subtab-btn px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all bg-amber-500 text-white shadow-sm border border-transparent";
        } else if(tabName === 'export') {
            activeBtn.className = "subtab-btn px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all bg-blue-600 text-white shadow-sm border border-transparent";
        }
    }
    
    // 5. โหลดข้อมูลของหน้านั้นๆ อัตโนมัติเมื่อกดเปลี่ยนแท็บ
    if(tabName === 'attendance' && typeof renderAttRooms === 'function') setTimeout(renderAttRooms, 100);
    if(tabName === 'grading' && typeof renderGradingTable === 'function') setTimeout(renderGradingTable, 100);
}

// 🟢 ฟังก์ชันสำหรับอัปเดตตัวเลขแจ้งเตือนงานค้าง
function updateGlobalBadges() {
    let pendingCount = 0;
    let resubmitCount = 0;
    let gradedCount = 0;

    allSubmissions.forEach((item) => {
        const student = allStudents.find((s) => String(s.student_id) === String(item.student_id));
        if (!student) return;

        let bucket = "pending";
        const isResubmitDesc = item.description && String(item.description).includes("[ส่งซ้ำ]");

        try {
            const scs = JSON.parse(student.scores || "[]");
            const found = scs.find((s) => s.name === item.title);
            if (found && found.score !== null && found.score !== "") {
                if (found.graded_at && new Date(item.submitted_at) > new Date(found.graded_at)) {
                    bucket = "resubmit";
                } else {
                    bucket = "graded";
                }
            } else {
                bucket = isResubmitDesc ? "resubmit" : "pending";
            }
        } catch (e) {}

        if (bucket === "pending") pendingCount++;
        else if (bucket === "resubmit") resubmitCount++;
        else if (bucket === "graded") gradedCount++;
    });

    // อัปเดตตัวเลขที่เมนูด้านซ้าย (ศูนย์ควบคุม)
    const dashBadge = document.getElementById("dash-badge-pending");
    if (dashBadge) {
        const total = pendingCount + resubmitCount;
        dashBadge.textContent = total > 0 ? total : ""; // ถ้าไม่มีงานจะซ่อนตัวเลขไว้
    }
    
    // อัปเดตตัวเลขในแท็บย่อย (รอตรวจ, ส่งซ้ำ, ตรวจแล้ว)
    const bp = document.getElementById("badge-pending");
    if (bp) bp.textContent = pendingCount;
    const br = document.getElementById("badge-resubmit");
    if (br) br.textContent = resubmitCount;
    const bg = document.getElementById("badge-graded");
    if (bg) bg.textContent = gradedCount;
}


// ========================================================
// ระบบจัดการบัญชีผู้ใช้งานโดยตรง (Student Auth Manager)
// ========================================================

let authListState = []; // เก็บข้อมูล Auth ชั่วคราวเพื่อให้ค้นหาได้ไว
let currentAuthPage = 1; // ตัวแปรเก็บหน้าที่กำลังเปิดอยู่
const authsPerPage = 10; // กำหนดให้แสดงหน้าละ 10 คน

// 1. เปิดหน้าต่าง
async function openAuthManagerModal() {
    const modal = document.getElementById("auth-manager-modal");
    const box = document.getElementById("auth-manager-box");
    
    // รีเซ็ตช่องค้นหาและหน้า
    const searchInput = document.getElementById("search-auth-input");
    if(searchInput) searchInput.value = "";
    currentAuthPage = 1; 
    
    modal.classList.remove("hidden");
    setTimeout(() => {
        modal.classList.remove("opacity-0");
        box.classList.remove("scale-95");
        box.classList.add("scale-100");
    }, 10);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // สั่งโหลดข้อมูลทันทีที่เปิด
    await loadAuthData();
}

// 2. ปิดหน้าต่าง
function closeAuthManagerModal() {
    const modal = document.getElementById("auth-manager-modal");
    const box = document.getElementById("auth-manager-box");
    
    modal.classList.add("opacity-0");
    box.classList.remove("scale-100");
    box.classList.add("scale-95");
    
    setTimeout(() => {
        modal.classList.add("hidden");
        document.getElementById("auth-list-container").innerHTML = "";
    }, 300);
}

// 3. ดึงข้อมูลจาก Firebase Collection: student_auth
async function loadAuthData() {
    const container = document.getElementById("auth-list-container");
    container.innerHTML = '<div class="text-center py-12 text-slate-400"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-3"></i><p class="text-sm font-bold">กำลังดึงข้อมูลจากฐานข้อมูล...</p></div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const snap = await db.collection("student_auth").get();
        authListState = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // เรียงตามรหัสนักเรียน
        authListState.sort((a, b) => String(a.student_id || "").localeCompare(String(b.student_id || "")));
        
        renderAuthList();
    } catch (err) {
        console.error("Load Auth Error:", err);
        container.innerHTML = '<div class="text-center py-8 text-rose-500 font-bold bg-rose-50 rounded-xl border border-rose-200">ไม่สามารถดึงข้อมูลจาก Firebase ได้</div>';
    }
}

// 4. วาดรายการบัญชีลงบนหน้าจอ (เพิ่มระบบแบ่งหน้า 10 คน/หน้า)
function renderAuthList() {
    const container = document.getElementById("auth-list-container");
    const q = (document.getElementById("search-auth-input").value || "").toLowerCase();
    
    let filtered = authListState;
    // กรองค้นหา
    if (q) {
        filtered = filtered.filter(item => 
            String(item.student_id || "").toLowerCase().includes(q) || 
            String(item.student_name || "").toLowerCase().includes(q)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 font-medium shadow-sm"><i data-lucide="search-x" class="w-10 h-10 mx-auto mb-3 opacity-30"></i> ไม่พบบัญชีในระบบ</div>';
        renderAuthPagination(0); // ล้างปุ่มแบ่งหน้า
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // --- ส่วนคำนวณการแบ่งหน้า ---
    const totalPages = Math.ceil(filtered.length / authsPerPage);
    if (currentAuthPage > totalPages) currentAuthPage = totalPages;
    if (currentAuthPage < 1) currentAuthPage = 1;

    const startIndex = (currentAuthPage - 1) * authsPerPage;
    const endIndex = startIndex + authsPerPage;
    const paginatedData = filtered.slice(startIndex, endIndex); // ตัดมาเฉพาะ 10 คน

    // --- วาดรายการ 10 คน ---
    container.innerHTML = paginatedData.map(item => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all gap-4">
            <div class="flex items-start gap-4 min-w-0">
                <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-100 shrink-0"><i data-lucide="user-check" class="w-5 h-5 text-slate-400"></i></div>
                <div>
                    <div class="font-bold text-slate-800 text-sm truncate">
                        ${escHtml(item.student_name || "ไม่ระบุชื่อ")} 
                    </div>
                    <div class="flex flex-wrap items-center gap-2 mt-1.5">
                        <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100 tracking-wider">ID: ${escHtml(item.student_id || "ไม่มีรหัส")}</span>
                        <span class="text-[10px] text-slate-400 font-mono tracking-tighter truncate max-w-[150px] sm:max-w-xs" title="${item.id}">Doc: ${item.id}</span>
                    </div>
                </div>
            </div>
            
            <button onclick="deleteAuthAccount('${item.id}', '${item.student_id}')" class="shrink-0 px-4 py-2 text-rose-600 bg-rose-50 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-bold transition-colors border border-rose-100 shadow-sm flex items-center gap-2" title="ลบบัญชีนี้ถาวร">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> ลบทิ้ง
            </button>
        </div>
    `).join('');
    
    // เรียกฟังก์ชันวาดปุ่มเปลี่ยนหน้า
    renderAuthPagination(totalPages);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// 5. วาดปุ่มเปลี่ยนหน้า (Pagination)
function renderAuthPagination(totalPages) {
    let pagContainer = document.getElementById("auth-pagination-container");

    // ถ้ายืนยันว่ายังไม่มีกล่องใส่ปุ่ม ให้สร้างอัตโนมัติ
    if (!pagContainer) {
        const listContainer = document.getElementById("auth-list-container");
        if (listContainer && listContainer.parentNode) {
            pagContainer = document.createElement("div");
            pagContainer.id = "auth-pagination-container";
            pagContainer.className = "flex justify-center items-center gap-4 mt-6 mb-2";
            listContainer.parentNode.appendChild(pagContainer);
        } else {
            return;
        }
    }

    // ถ้ามีแค่ 1 หน้า ไม่ต้องโชว์ปุ่ม
    if (totalPages <= 1) {
        pagContainer.innerHTML = "";
        return;
    }

    pagContainer.innerHTML = `
        <button onclick="changeAuthPage(${currentAuthPage - 1})" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed" ${currentAuthPage === 1 ? 'disabled' : ''}>
            <i data-lucide="chevron-left" class="w-4 h-4 inline"></i> ก่อนหน้า
        </button>
        <span class="text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-100 shadow-sm">
            หน้า ${currentAuthPage} / ${totalPages}
        </span>
        <button onclick="changeAuthPage(${currentAuthPage + 1})" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed" ${currentAuthPage === totalPages ? 'disabled' : ''}>
            ถัดไป <i data-lucide="chevron-right" class="w-4 h-4 inline"></i>
        </button>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// 6. เมื่อครูกดเปลี่ยนหน้า
function changeAuthPage(newPage) {
    currentAuthPage = newPage;
    renderAuthList();
    
    // สั่งเลื่อนสกอร์บาร์ใน Modal กลับไปบนสุดแบบนุ่มนวล
    const modalBody = document.querySelector("#auth-manager-box .overflow-y-auto");
    if (modalBody) modalBody.scrollTo({ top: 0, behavior: 'smooth' });
}

// 7. ตัวกรองค้นหาเวลาพิมพ์ (ปรับให้เด้งกลับไปหน้า 1 เสมอเวลาพิมพ์ค้นหา)
function filterAuthList() {
    currentAuthPage = 1; 
    renderAuthList();
}

// 8. ฟังก์ชันลบบัญชีออกจาก Firebase (student_auth)
async function deleteAuthAccount(docId, studentId) {
    if(!confirm(`⚠️ ยืนยันการลบบัญชีของรหัสนักเรียน [${studentId}] ใช่หรือไม่?\nการกระทำนี้จะลบข้อมูลล็อกอินออกจากฐานข้อมูลโดยตรง`)) return;

    try {
        await db.collection("student_auth").doc(docId).delete();
        showToast(`ลบบัญชีของ ${studentId} สำเร็จ`, "success");
        
        // ลบข้อมูลทิ้งจาก State แล้ววาดหน้าจอใหม่ทันที
        authListState = authListState.filter(item => item.id !== docId);
        
        // ตรวจสอบว่าถ้าลบคนสุดท้ายในหน้านั้นแล้วหน้าว่าง ให้ถอยกลับ 1 หน้า
        const totalPages = Math.ceil(authListState.length / authsPerPage);
        if (currentAuthPage > totalPages && currentAuthPage > 1) {
            currentAuthPage--;
        }
        
        renderAuthList();
        
    } catch (err) {
        console.error("Delete Auth Error:", err);
        showToast("ลบบัญชีไม่สำเร็จ โปรดลองอีกครั้ง", "error");
    }
}


// ========================================================
// ฟังก์ชันนำเข้านักเรียนจากไฟล์ CSV
// ========================================================
async function importStudentsFromCSV() {
    const fileInput = document.getElementById('csv-file-input');
    const file = fileInput.files[0];
    
    if (!file) return showToast("กรุณาเลือกไฟล์ CSV ก่อนกดอัปโหลดครับ", "error");

    const btn = document.querySelector('button[onclick="importStudentsFromCSV()"]');
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังประมวลผล...';
    btn.disabled = true;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const reader = new FileReader();
    
    // ตั้งค่าให้อ่านไฟล์ภาษาไทยได้ไม่เพี้ยน (UTF-8)
    reader.readAsText(file, 'UTF-8');
    
    reader.onload = async function(e) {
        const text = e.target.result;
        
        // แยกบรรทัดและลบช่องว่าง (ตัดบรรทัดที่ว่างเปล่าทิ้ง)
        const rows = text.split('\n').map(row => row.trim()).filter(row => row !== '');
        
        if (rows.length === 0) {
            showToast("ไฟล์ CSV ไม่มีข้อมูล", "error");
            resetImportBtn(btn, origHtml, fileInput);
            return;
        }

        try {
            // Firebase ยอมให้บันทึกแบบ Batch ได้สูงสุด 500 รายการต่อรอบ
            // เราเขียนข้อมูล 2 ที่ (students และ student_auth) ดังนั้น 1 คน = 2 operations
            // จึงตั้ง Batch Size ไว้ที่ 400 (เผื่อเหลือเผื่อขาด)
            const batchSize = 400; 
            let currentBatch = db.batch();
            let operationCount = 0;
            let successCount = 0;

            for (let i = 0; i < rows.length; i++) {
                // แยกคอลัมน์ด้วยคอมม่า (,) และลบเครื่องหมาย " ออก (ถ้ามี)
                const cols = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                
                // ข้ามบรรทัดที่เป็นหัวตาราง (ถ้าครูใส่หัวตารางมา)
                if (cols[0] === 'รหัสนักเรียน' || cols[0].toUpperCase() === 'ID') continue;
                
                // ถ้าข้อมูลไม่ครบ 3 คอลัมน์ ให้ข้ามบรรทัดนั้นไป
                if (cols.length < 3) continue;

                const sid = cols[0];
                const sname = cols[1];
                const sclass = cols[2];

                // 1. เตรียมข้อมูลเพิ่มในคอลเลกชัน students
                const studentRef = db.collection("students").doc();
                currentBatch.set(studentRef, {
                    student_id: sid,
                    student_name: sname,
                    classroom: sclass,
                    scores: "[]",
                    total: 0,
                    percentage: 0,
                    grade: "0",
                    created_at: new Date().toISOString(),
                    course_id: currentCourseId // นำเข้าวิชาที่เลือกอยู่ปัจจุบัน
                });
                operationCount++;

                // 2. เตรียมข้อมูลเพิ่มในคอลเลกชัน student_auth (สำหรับให้นักเรียนล็อกอิน)
                const authRef = db.collection("student_auth").doc();
                currentBatch.set(authRef, {
                    student_id: sid,
                    student_name: sname,
                    password: sid, // ตั้งรหัสผ่านเริ่มต้นเป็นรหัสนักเรียน
                    role: "student",
                    created_at: new Date().toISOString()
                });
                operationCount++;
                
                successCount++;

                // ถ้าสะสมคำสั่งถึงกำหนดแล้ว ให้กด Commit ทิ้ง 1 รอบ แล้วเริ่มชุดใหม่
                if (operationCount >= batchSize) {
                    await currentBatch.commit();
                    currentBatch = db.batch();
                    operationCount = 0;
                }
            }

            // สั่ง Commit ข้อมูลส่วนที่เหลือ (เศษที่ยังไม่ถึง batchSize)
            if (operationCount > 0) {
                await currentBatch.commit();
            }

            if (successCount > 0) {
                showToast(`นำเข้านักเรียนสำเร็จ ${successCount} คน ✅`, "success");
                await loadAllData(); // รีเฟรชตารางใหม่
            } else {
                showToast("ไม่พบข้อมูลที่ถูกต้องในไฟล์", "error");
            }

        } catch (error) {
            console.error("CSV Import Error:", error);
            showToast("เกิดข้อผิดพลาดในการนำเข้าข้อมูล", "error");
        }

        resetImportBtn(btn, origHtml, fileInput);
    };
    
    reader.onerror = function() {
        showToast("อ่านไฟล์ไม่สำเร็จ", "error");
        resetImportBtn(btn, origHtml, fileInput);
    };
}

// ฟังก์ชันเสริมสำหรับคืนค่าปุ่ม
function resetImportBtn(btn, origHtml, fileInput) {
    btn.innerHTML = origHtml;
    btn.disabled = false;
    fileInput.value = ""; // เคลียร์ไฟล์ออกจากกล่อง
    if (typeof lucide !== 'undefined') lucide.createIcons();
}


// ========================================================
// ฟังก์ชัน ย่อ-ขยาย เมนูเพิ่มนักเรียน
// ========================================================
function toggleAddStudentSection() {
  const content = document.getElementById("add-student-collapsible");
  const iconBox = document.getElementById("toggle-add-icon");
  
  if (content.classList.contains("hidden")) {
    // กรณีที่ซ่อนอยู่ ให้เปิดขึ้นมา
    content.classList.remove("hidden");
    // เปลี่ยนไอคอนเป็นลูกศรชี้ขึ้น
    iconBox.innerHTML = '<i data-lucide="chevron-up" class="w-5 h-5"></i>';
  } else {
    // กรณีที่เปิดอยู่ ให้ซ่อนกลับไป
    content.classList.add("hidden");
    // เปลี่ยนไอคอนเป็นลูกศรชี้ลง
    iconBox.innerHTML = '<i data-lucide="chevron-down" class="w-5 h-5"></i>';
  }
  
  // สั่งให้วาดไอคอนใหม่
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ฟังก์ชัน ย่อ-ขยาย เมนูจัดการรายชื่อ (ครอบคลุมฟอร์มและตาราง)
function toggleStudentManagement() {
  const content = document.getElementById("student-management-collapsible");
  const iconBox = document.getElementById("toggle-student-icon");
  
  if (content.classList.contains("hidden")) {
    content.classList.remove("hidden");
    iconBox.innerHTML = '<i data-lucide="chevron-up" class="w-5 h-5"></i>';
  } else {
    content.classList.add("hidden");
    iconBox.innerHTML = '<i data-lucide="chevron-down" class="w-5 h-5"></i>';
  }
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
}








// ==========================================
// 📡 ระบบดึงรายชื่อนักเรียนออนไลน์แบบ Real-time
// ==========================================
function updateOnlineStatus() {
    const rtdb = firebase.database();
    const onlineUsersRef = rtdb.ref('onlineUsers');

    onlineUsersRef.on('value', (snapshot) => {
        const users = snapshot.val();
        const container = document.getElementById('student-list-container');
        const badge = document.getElementById('online-count-badge');
        
        if (!container) return;
        container.innerHTML = ""; 
        
        if (users) {
            const userIds = Object.keys(users);
            if (badge) badge.innerText = userIds.length;
            
            userIds.forEach(id => {
                const user = users[id];
                const cardHTML = `
                    <div class="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center gap-3 hover:shadow-md transition-all">
                        <div class="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-100">
                            ${user.name ? user.name.substring(0, 1) : '?'}
                        </div>
                        <div class="min-w-0">
                            <p class="text-slate-700 font-prompt text-[13px] font-bold truncate leading-tight">${user.name}</p>
                            <div class="flex items-center gap-1">
                                <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                <span class="text-[9px] text-slate-400 font-bold uppercase">Online</span>
                            </div>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', cardHTML);
            });
        } else {
            if (badge) badge.innerText = "0";
            container.innerHTML = `<p class="col-span-full text-center text-slate-400 font-prompt text-xs py-4 italic">ขณะนี้ไม่มีนักเรียนออนไลน์</p>`;
        }
    });
}

// เรียกใช้งานฟังก์ชันเมื่อไฟล์โหลดสำเร็จ
updateOnlineStatus();


// --- 🌟 ระบบควบคุมสถานะระบบ (Dynamic Switch) ---
let systemStatus = { gacha_active: true, treasure_active: true };

// 1. โหลดสถานะล่าสุดเมื่อเปิดหน้าครู
async function loadSystemStatus() {
    try {
        const doc = await db.collection("configs").doc("system").get();
        if (doc.exists) {
            systemStatus = doc.data();
            renderToggleButtons();
        } else {
            // ถ้ายังไม่มี Document ให้สร้างค่าเริ่มต้น
            await db.collection("configs").doc("system").set(systemStatus);
            renderToggleButtons();
        }
    } catch (error) {
        console.error("Error loading system status:", error);
    }
}

// 2. ฟังก์ชันสลับสถานะ (Update Firebase)
async function toggleSystemConfig(field) {
    const newValue = !systemStatus[field];
    try {
        await db.collection("configs").doc("system").update({
            [field]: newValue
        });
        systemStatus[field] = newValue;
        renderToggleButtons();
        
        const label = field === 'gacha_active' ? 'ระบบกาชา' : 'ระบบสมบัติ';
        const statusText = newValue ? 'เปิดใช้งาน' : 'ปิดการใช้งาน';
        // ใช้ฟังก์ชัน toast ที่มีในระบบของคุณครู
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'success', title: 'สำเร็จ', text: `${statusText}${label} เรียบร้อย`, timer: 1500, showConfirmButton: false });
        }
    } catch (error) {
        console.error("Error updating status:", error);
    }
}

// 3. วาดสีปุ่ม Toggle ตามสถานะ
function renderToggleButtons() {
    const configs = [
        { id: 'gacha', active: systemStatus.gacha_active },
        { id: 'treasure', active: systemStatus.treasure_active }
    ];

    configs.forEach(conf => {
        const btn = document.getElementById(`btn-toggle-${conf.id}`);
        const dot = document.getElementById(`dot-toggle-${conf.id}`);
        if (btn && dot) {
            if (conf.active) {
                btn.classList.remove("bg-slate-300");
                btn.classList.add("bg-green-500");
                dot.classList.remove("translate-x-1");
                dot.classList.add("translate-x-6");
            } else {
                btn.classList.remove("bg-green-500");
                btn.classList.add("bg-slate-300");
                dot.classList.remove("translate-x-6");
                dot.classList.add("translate-x-1");
            }
        }
    });
}

// --- สั่งให้โหลดสถานะปุ่มสวิตช์ ทันทีที่เปิดหน้าครู ---
setTimeout(() => {
    if (typeof loadSystemStatus === "function") {
        loadSystemStatus();
    }
}, 800); // หน่วงเวลาเล็กน้อยรอให้ระบบ Firebase โหลดเสร็จ