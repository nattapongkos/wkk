// 🛠️ ฟังก์ชันแปลง Base64 เป็น File
function base64ToFile(base64Str, filename) {
  let arr = base64Str.split(","),
    mime = arr[0].match(/:(.*?);/)[1],
    bstr = atob(arr[1]),
    n = bstr.length,
    u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

// 🛠️ ฟังก์ชันแปลง File กลับเป็น Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processImagesInContent(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const images = div.querySelectorAll("img");

  for (let img of images) {
    // จัดการเฉพาะรูปที่เป็น Base64 (data:image/...)
    if (img.src.startsWith("data:image/")) {
      try {
        const name = `article_img_${Date.now()}.jpg`;
        const imageFile = base64ToFile(img.src, name);

        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true };
        const compressedFile = await imageCompression(imageFile, options);

        // 🚀 อัปโหลดรูปในบทความเข้า Supabase
        const fileData = await uploadToSupabase(compressedFile, `Article`);
        img.src = fileData.url;
      } catch (e) {
        console.error("Image upload failed:", e);
      }
    }
  }
  return div.innerHTML;
}

let originalMediaUrls = [];

// 🛠️ ฟังก์ชันสแกนหา URL ของ Google Drive ในเนื้อหา HTML
function extractDriveUrls(html) {
  if (!html) return [];
  const div = document.createElement("div");
  div.innerHTML = html;
  const images = div.querySelectorAll("img");
  const urls = [];
  images.forEach((img) => {
    if (img.src.includes("drive.google.com")) urls.push(img.src);
  });
  return urls;
}

// 🟢 ตัวแปรส่วนหัว
let currentLogPage = 1;
const logsPerPage = 5;
let courses = [];
let materials = [];
let materialLogs = [];
let classLevels = []; // 🟢 ตัวแปรสำหรับเก็บข้อมูลระดับชั้น
let currentTab = "materials";
let editingMaterialId = null;
let quill;

window.onload = async () => {
  lucide.createIcons();

  let BlockEmbed = Quill.import("blots/block/embed");
  class AppIframe extends BlockEmbed {
    static create(value) {
      let node = super.create(value);
      let iframe = document.createElement("iframe");
      iframe.setAttribute("src", value);
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute("allowfullscreen", true);
      iframe.setAttribute("width", "100%");
      iframe.setAttribute("height", "500px");
      iframe.style.borderRadius = "15px";
      iframe.style.border = "1px solid #e2e8f0";
      node.appendChild(iframe);
      return node;
    }
    static value(node) {
      return node.querySelector("iframe").getAttribute("src");
    }
  }
  AppIframe.blotName = "video";
  AppIframe.tagName = "div";
  AppIframe.className = "ql-video-wrapper";
  Quill.register(AppIframe);

  quill = new Quill("#quill-editor", {
    theme: "snow",
    placeholder: "พิมพ์เนื้อหาบทความ หรือฝังเครื่องมือ 3D ที่นี่...",
    modules: {
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ color: [] }, { background: [] }],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ align: [] }],
          ["link", "image", "video"],
          ["clean"],
        ],
      },
    },
  });

  await loadInitialData();
};

// 🟢 โหลดข้อมูลตอนเข้าเว็บครั้งแรก
async function loadInitialData() {
    try {
        const [courseSnap, matSnap, classSnap] = await Promise.all([
            db.collection("courses").get(),
            db.collection("materials").get(),
            db.collection("classrooms").get(),
        ]);

        // ✅ รวม doc.id เป็น course_id ให้ตรงกับฝั่ง Student
        courses = courseSnap.docs.map((doc) => ({ course_id: doc.id, ...doc.data() }));
        materials = matSnap.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
                const orderA = a.order !== undefined && a.order !== null ? Number(a.order) : 9999;
                const orderB = b.order !== undefined && b.order !== null ? Number(b.order) : 9999;
                return orderA - orderB;
            });

        classLevels = classSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const filterEl = document.getElementById("filter-course");
        filterEl.innerHTML =
            '<option value="all">ดูทุกวิชา</option>' +
            courses.map((c) => `<option value="${c.course_id}">${c.course_name}</option>`).join("");

        renderMaterials();

        // ✅ Event listener ระดับ document ป้องกัน bind ซ้ำเมื่อ innerHTML ถูกเขียนทับ
        if (!window._courseSelectListenerAdded) {
            document.addEventListener('change', function(e) {
                if (e.target && e.target.id === 'inp-m-course') {
                    updateScoreCategoryDropdown(e.target.value);
                }
            });
            window._courseSelectListenerAdded = true;
        }

    } catch (e) {
        showToast("โหลดข้อมูลล้มเหลว", "error");
    }
}


function changeTab(tab) {
  currentTab = tab;
  document.getElementById("tab-materials").className =
    tab === "materials"
      ? "px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-800 shadow-sm transition-all"
      : "px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 transition-all";
  document.getElementById("tab-history").className =
    tab === "history"
      ? "px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-800 shadow-sm transition-all"
      : "px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 transition-all";
  document
    .getElementById("materials-list")
    .classList.toggle("hidden", tab !== "materials");
  document
    .getElementById("filter-container")
    .classList.toggle("hidden", tab !== "materials");
  document
    .getElementById("history-view")
    .classList.toggle("hidden", tab !== "history");
  document.getElementById("page-heading").textContent =
    tab === "materials" ? "สื่อการสอนทั้งหมด" : "ประวัติการเข้าชมสื่อ";
}

function getYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function renderMaterials() {
  const container = document.getElementById("materials-list");
  const filter = document.getElementById("filter-course").value;

  if (filter === "all") {
    container.innerHTML = `
            <div class="col-span-full py-16 flex flex-col items-center justify-center bg-white/50 backdrop-blur rounded-[3rem] border-2 border-dashed border-slate-200 shadow-inner">
                <div class="w-28 h-28 bg-gradient-to-br from-rose-400 to-orange-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-lg shadow-rose-200">
                    <i data-lucide="library" class="w-14 h-14 text-white"></i>
                </div>
                <h3 class="text-3xl font-bold text-slate-800 mb-3 font-outfit tracking-tight">เลือกคลังสื่อในระดับชั้น...</h3>
                <p class="text-slate-500 mb-12 text-lg font-medium text-center px-4">ยินดีต้อนรับสู่ Resource Hub กรุณาเลือกวิชา หรือระดับชั้นที่ต้องการจัดการสื่อการสอนครับ</p>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full px-12 max-w-5xl">
                    ${courses
                      .map(
                        (c) => `
                        <button onclick="selectCourse('${c.course_id}')" class="flex flex-col gap-4 p-8 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-[2.5rem] transition-all hover:-translate-y-2 hover:shadow-xl group">
                            <div class="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors shadow-sm">
                                <i data-lucide="book-open" class="w-7 h-7"></i>
                            </div>
                            <div class="text-left">
                                <span class="block text-xl font-bold text-slate-800 group-hover:text-rose-700 transition-colors">${c.course_name}</span>
                                <span class="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1 block">คลิกเพื่อจัดการสื่อ</span>
                            </div>
                        </button>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `;
    lucide.createIcons();
    return;
  }

  let filtered = materials.filter((m) => m.course_id === filter);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-full bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm"><div class="w-20 h-20 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-center mx-auto mb-4"><i data-lucide="inbox" class="w-10 h-10 text-slate-300"></i></div><p class="text-slate-500 font-medium">ยังไม่มีสื่อการสอนในวิชานี้</p></div>`;
    lucide.createIcons();
    return;
  }

  container.innerHTML = filtered
    .map((m) => {
      const c = courses.find((c) => c.course_id === m.course_id);
      const cName = c ? c.course_name : "ไม่ระบุวิชา";
      const ytUrl = m.youtube_url || (m.type === "youtube" ? m.url : "");
      let thumbUrl = m.cover_url || "";
      if (!thumbUrl && ytUrl) {
        const ytId = getYouTubeId(ytUrl);
        thumbUrl = ytId
          ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
          : "https://via.placeholder.com/640x360.png?text=YouTube+Video";
      }
      let mediaHtml = thumbUrl
        ? `<div class="w-full h-40 bg-slate-200 rounded-2xl mb-4 overflow-hidden relative"><img src="${thumbUrl}" class="w-full h-full object-cover"></div>`
        : `<div class="w-full h-40 bg-slate-100 rounded-2xl mb-4 flex items-center justify-center border border-slate-200"><i data-lucide="layers" class="w-12 h-12 text-slate-300"></i></div>`;

      return `
        <div class="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all flex flex-col group relative">
            <div class="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                <button onclick="editMaterial('${m.id}')" class="p-2 bg-white/90 backdrop-blur rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all shadow-sm"><i data-lucide="settings" class="w-4 h-4"></i></button>
                <button onclick="deleteMaterial('${m.id}')" class="p-2 bg-white/90 backdrop-blur rounded-xl text-slate-400 hover:text-red-500 hover:bg-blue-50 transition-all shadow-sm"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
            ${mediaHtml}
            <div class="flex items-center gap-2 mb-2">
                <span class="bg-slate-800 text-white px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1"><i data-lucide="hash" class="w-3 h-3"></i> ลำดับ ${m.order || "-"}</span>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">${cName}</p>
            </div>
            <h3 class="text-lg font-bold text-slate-800 leading-tight mb-2 line-clamp-2">${m.title}</h3>
            ${m.desc ? `<p class="text-xs text-slate-500 line-clamp-2 mb-6">${m.desc}</p>` : '<div class="mb-6"></div>'}
            <div class="mt-auto">
                 <button onclick="editMaterial('${m.id}')" class="w-full py-3.5 rounded-2xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">จัดการสื่อนี้ <i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
            </div>
        </div>`;
    })
    .join("");
  lucide.createIcons();
}

function toggleWorksheetBuilder() {
    const typeEl = document.getElementById("material-type");
    const builder = document.getElementById("worksheet-builder");

    if (!typeEl || !builder) return;

    const selectedType = typeEl.value;

    // ✅ แสดง/ซ่อน Worksheet Builder
    if (selectedType === "worksheet") {
        builder.classList.remove("hidden");
    } else {
        builder.classList.add("hidden");
    }

    // ✅ แสดง/ซ่อน field ตาม type (ถ้ามี element เหล่านี้ใน HTML)
    const fieldMap = {
        "inp-m-youtube": ["youtube"],
        "inp-m-link":    ["link"],
        "inp-m-album":   ["album"],
        "inp-m-file":    ["file"],
    };

    Object.entries(fieldMap).forEach(([fieldId, allowedTypes]) => {
        // หา wrapper (.field-group หรือ parent ของ input)
        const el = document.getElementById(fieldId);
        if (!el) return;
        const wrapper = el.closest('.field-group') || el.parentElement;
        if (!wrapper) return;

        if (allowedTypes.includes(selectedType)) {
            wrapper.classList.remove("hidden");
        } else {
            // ประเภทอื่นซ่อนไว้ แต่ไม่ล้างค่า (เผื่อสื่อมีหลาย type)
            // ถ้าต้องการล้างค่าด้วย ให้เปิด comment บรรทัดล่าง
            // el.value = "";
        }
    });
}

function addQuestionField(text = "") {
  const list = document.getElementById("questions-list");
  const div = document.createElement("div");
  div.className =
    "flex gap-3 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-200 question-item relative group";
  div.innerHTML = `
        <div class="flex-1">
            <textarea rows="2" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 q-text resize-none" placeholder="พิมพ์โจทย์คำถาม...">${text}</textarea>
        </div>
        <button onclick="this.parentElement.remove()" class="mt-2 text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition-all" title="ลบข้อนี้">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
        </button>
    `;
  list.appendChild(div);
  lucide.createIcons();
}

async function openCreateModal() {
    editingMaterialId = null;
    originalMediaUrls = [];

    const titleText = document.getElementById("modal-title-text");
    if (titleText) titleText.textContent = "เพิ่มสื่อการสอน";

    // 🔥 สั่งดูดข้อมูลวิชาและชั้นเรียนจาก Database สดๆ ทันทีที่เปิดหน้าต่าง
    try {
        const [cSnap, clSnap] = await Promise.all([
            db.collection('courses').get(),
            db.collection('classrooms').get()
        ]);

        // ช่องวิชา
        const courseSel = document.getElementById("inp-m-course");
        if (courseSel) {
            if (cSnap.empty) {
                courseSel.innerHTML = '<option value="" disabled selected>-- ไม่มีวิชา (ไปเพิ่มที่ "จัดการรายวิชา" ก่อนครับ) --</option>';
            } else {
                let html = '<option value="" disabled selected>-- กรุณาเลือกวิชา --</option>';
                cSnap.docs.forEach(doc => { html += `<option value="${doc.id}">${doc.data().course_name}</option>`; });
                courseSel.innerHTML = html;
            }
        }

        // ช่องชั้นเรียน (Checkbox)
        const gradeContainer = document.getElementById("material-target-grade-container");
        if (gradeContainer) {
            let html = `
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="chk-grade-all" value="all" class="w-4 h-4 text-blue-600 rounded border-slate-300" onchange="toggleAllGrades(this)" checked>
                    <span class="text-sm font-bold text-slate-700">ดูได้ทุกชั้น (ไม่ระบุ)</span>
                </label>
                <hr class="border-slate-200 my-1">
            `;
            clSnap.docs.forEach(doc => { 
                html += `
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" value="${doc.id}" class="w-4 h-4 text-blue-600 rounded border-slate-300 grade-item-checkbox" onchange="toggleSpecificGrade()">
                    <span class="text-sm font-bold text-slate-700">${doc.data().name || doc.id}</span>
                </label>`; 
            });
            gradeContainer.innerHTML = html;
        }
    } catch(e) { console.error("ดึงข้อมูลไม่สำเร็จ:", e); }

    if (typeof updateScoreCategoryDropdown === "function") updateScoreCategoryDropdown("");
    
    const typeSel = document.getElementById("material-type");
    if (typeSel) typeSel.value = "article";
    
    const qList = document.getElementById("questions-list");
    if (qList) qList.innerHTML = "";
    if (typeof toggleWorksheetBuilder === "function") toggleWorksheetBuilder();

    let nextOrder = 1;
    if (typeof materials !== 'undefined' && materials.length > 0) {
        nextOrder = Math.max(...materials.map(m => Number(m.order) || 0)) + 1;
    }
    
    const safeSetValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    safeSetValue("inp-m-order", nextOrder);
    safeSetValue("inp-m-title", "");
    safeSetValue("inp-m-desc", "");
    safeSetValue("inp-m-cover", "");
    safeSetValue("inp-m-youtube", "");
    safeSetValue("inp-m-link", "");
    safeSetValue("inp-m-album", "");
    safeSetValue("inp-m-file", "");
    
    const hint = document.getElementById("file-edit-hint");
    if (hint) hint.classList.add("hidden");
    if (typeof quill !== "undefined" && quill) quill.root.innerHTML = "";

    const modal = document.getElementById("material-modal");
    const box = document.getElementById("material-modal-box");
    if (modal && box) {
        modal.classList.remove("hidden");
        void modal.offsetWidth;
        modal.classList.remove("opacity-0");
        box.classList.remove("scale-95");
        box.classList.add("scale-100");
    }
}


function toggleAllGrades(chkAll) {
    if (chkAll.checked) {
        document.querySelectorAll('.grade-item-checkbox').forEach(chk => chk.checked = false);
    }
}

function toggleSpecificGrade() {
    const chkAll = document.getElementById('chk-grade-all');
    if (chkAll) chkAll.checked = false;
}



function selectCourse(courseId) {
  const filterEl = document.getElementById("filter-course");
  if (filterEl) {
    filterEl.value = courseId;
    renderMaterials();
  }
}

async function editMaterial(id) {
    const m = materials.find((x) => x.id === id);
    if (!m) return;

    editingMaterialId = id;
    const titleText = document.getElementById("modal-title-text");
    if (titleText) titleText.textContent = "แก้ไขสื่อการสอน";

    originalMediaUrls = [];
    if (m.cover_url && m.cover_url.includes("drive.google.com")) originalMediaUrls.push(m.cover_url);
    if (typeof extractDriveUrls === "function") originalMediaUrls = originalMediaUrls.concat(extractDriveUrls(m.content));

    // 🔥 สั่งดูดข้อมูลวิชาและชั้นเรียนจาก Database สดๆ ทันทีที่เปิดหน้าต่างแก้ไข
    try {
        const [cSnap, clSnap] = await Promise.all([
            db.collection('courses').get(),
            db.collection('classrooms').get()
        ]);

        // ช่องวิชา
        const courseSel = document.getElementById("inp-m-course");
        if (courseSel) {
            let html = '<option value="" disabled>-- กรุณาเลือกวิชา --</option>';
            let foundCourse = false;
            cSnap.docs.forEach(doc => { 
                html += `<option value="${doc.id}">${doc.data().course_name}</option>`; 
                if(doc.id === m.course_id) foundCourse = true;
            });
            
            // 🚨 ถ้าวิชาเดิมถูกลบไปแล้ว ให้แจ้งเตือนสีแดงในช่องเลย
            if (m.course_id && !foundCourse) {
                html += `<option value="${m.course_id}">⚠️ รหัสวิชาเดิม (${m.course_id}) ถูกลบไปแล้ว</option>`;
            }
            courseSel.innerHTML = html;
            if (m.course_id) courseSel.value = m.course_id;
        }

        // 🟢 แก้ไขใหม่: ช่องชั้นเรียน (Checkbox แบบเลือกได้หลายห้อง)
        const gradeContainer = document.getElementById("material-target-grade-container");
        if (gradeContainer) {
            let html = `
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="chk-grade-all" value="all" class="w-4 h-4 text-blue-600 rounded border-slate-300" onchange="toggleAllGrades(this)">
                    <span class="text-sm font-bold text-slate-700">ดูได้ทุกชั้น (ไม่ระบุ)</span>
                </label>
                <hr class="border-slate-200 my-1">
            `;
            clSnap.docs.forEach(doc => { 
                html += `
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" value="${doc.id}" class="w-4 h-4 text-blue-600 rounded border-slate-300 grade-item-checkbox" onchange="toggleSpecificGrade()">
                    <span class="text-sm font-bold text-slate-700">${doc.data().name || doc.id}</span>
                </label>`; 
            });
            gradeContainer.innerHTML = html;

            // ✅ ติ๊กเลือกห้องเดิมที่เคยบันทึกไว้ให้โดยอัตโนมัติ (รองรับข้อมูลเก่าที่เป็น String และของใหม่ที่เป็น Array)
            let targetGrades = m.target_grade || [];
            if (!Array.isArray(targetGrades)) {
                targetGrades = (targetGrades === "all" || targetGrades === "") ? ["all"] : [targetGrades];
            }

            if (targetGrades.length === 0 || targetGrades.includes("all")) {
                document.getElementById("chk-grade-all").checked = true;
            } else {
                document.getElementById("chk-grade-all").checked = false;
                const checkboxes = document.querySelectorAll('.grade-item-checkbox');
                checkboxes.forEach(chk => {
                    if (targetGrades.includes(chk.value)) {
                        chk.checked = true;
                    }
                });
            }
        }
    } catch(e) { console.error("ดึงข้อมูลไม่สำเร็จ:", e); }

    const typeSel = document.getElementById("material-type");
    if (typeSel) {
        // ✅ รองรับทุก type: article, youtube, file, link, album, worksheet
        const validTypes = ["article", "youtube", "file", "link", "album", "worksheet"];
        typeSel.value = validTypes.includes(m.type) ? m.type : "article";
    }

    const qList = document.getElementById("questions-list");
    if (qList) qList.innerHTML = "";

    if (typeof toggleWorksheetBuilder === "function") toggleWorksheetBuilder();

    if (m.type === "worksheet" && m.questions && m.questions.length > 0) {
        m.questions.forEach((q) => {
            if (typeof addQuestionField === "function") addQuestionField(q.text);
        });
    }

    if (typeof updateScoreCategoryDropdown === "function") updateScoreCategoryDropdown(m.course_id, m.score_category);

    const safeSetValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    safeSetValue("inp-m-order", m.order !== undefined ? m.order : "");
    safeSetValue("inp-m-title", m.title || "");
    safeSetValue("inp-m-desc", m.desc || "");
    safeSetValue("inp-m-cover", m.cover_url || "");
    safeSetValue("inp-m-youtube", m.youtube_url || (m.type === "youtube" ? m.url : "") || "");
    safeSetValue("inp-m-link", m.link_url || (m.type === "link" ? m.url : "") || "");
    safeSetValue("inp-m-album", m.album_url || (m.type === "album" ? m.url : "") || "");
    safeSetValue("inp-m-file", "");

    const hasFile = m.file_url || (m.type === "file" ? m.url : "");
    const hint = document.getElementById("file-edit-hint");
    if (hint) {
        if (hasFile) hint.classList.remove("hidden");
        else hint.classList.add("hidden");
    }

    if (typeof quill !== "undefined" && quill) quill.root.innerHTML = m.content || "";

    const modal = document.getElementById("material-modal");
    const box = document.getElementById("material-modal-box");
    if (modal && box) {
        modal.classList.remove("hidden");
        void modal.offsetWidth;
        modal.classList.remove("opacity-0");
        box.classList.remove("scale-95");
        box.classList.add("scale-100");
    }
}

function closeModal() {
  const modal = document.getElementById("material-modal");
  const box = document.getElementById("material-modal-box");
  modal.classList.add("opacity-0");
  box.classList.remove("scale-100");
  box.classList.add("scale-95");
  setTimeout(() => {
    modal.classList.add("hidden");
  }, 300);
}

// ========================================================
// 💾 ฟังก์ชันบันทึกสื่อการสอน (ย้ายไป Supabase)
// ========================================================
async function saveMaterial() {
  const course_id = document.getElementById("inp-m-course").value;
  const title = document.getElementById("inp-m-title").value.trim();
  const desc = document.getElementById("inp-m-desc").value.trim();
  const cover_url = document.getElementById("inp-m-cover").value.trim();

  let target_grade = [];
  const isAllChecked = document.getElementById("chk-grade-all")?.checked;
  if (isAllChecked) {
      target_grade = ["all"];
  } else {
      document.querySelectorAll('.grade-item-checkbox:checked').forEach(chk => {
          target_grade.push(chk.value);
      });
      if (target_grade.length === 0) target_grade = ["all"]; 
  }
  
  const selected_type = document.getElementById("material-type").value;
  const orderRaw = document.getElementById("inp-m-order").value;
  const order = orderRaw !== "" ? Number(orderRaw) : 999;

  if (!title) return showToast("กรุณาใส่ชื่อบทเรียน", "error");

  let questionsList = [];
  if (selected_type === "worksheet") {
    document.querySelectorAll(".question-item").forEach((el, index) => {
      const text = el.querySelector(".q-text").value.trim();
      if (text) {
        questionsList.push({
          id: `q${Date.now()}_${index}`,
          text: text,
          type: "short_answer",
        });
      }
    });

    if (questionsList.length === 0) {
      return showToast("กรุณาเพิ่มข้อคำถามอย่างน้อย 1 ข้อ สำหรับใบงาน", "error");
    }
  }

  const btn = document.getElementById("btn-save-material");
  const origHtml = btn.innerHTML;
  btn.disabled = true;

  const youtube_url = document.getElementById("inp-m-youtube").value.trim();
  const link_url = document.getElementById("inp-m-link").value.trim();
  const album_url = document.getElementById("inp-m-album").value.trim();
  
  let contentHtml = quill.root.innerHTML;
  if (quill.getText().trim().length === 0 && !contentHtml.includes("<img"))
    contentHtml = "";

  // 🚀 จัดการอัปโหลดรูปภาพที่แทรกในบทความเข้า Supabase
  if (contentHtml.includes("data:image/")) {
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังอัปโหลดรูป...';
    lucide.createIcons();
    contentHtml = await processImagesInContent(contentHtml);
  }

  btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังบันทึก...';
  lucide.createIcons();

  let oldMaterial = editingMaterialId ? materials.find((x) => x.id === editingMaterialId) : null;
  let file_url = oldMaterial ? (oldMaterial.file_url || "") : "";

  try {
    const fileInput = document.getElementById("inp-m-file");
    
    // 🚀 ส่วนที่แก้ไข: อัปโหลดไฟล์เอกสารเข้า Supabase
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      
      // ตรวจสอบขนาดไฟล์เบื้องต้น (เช่น ไม่เกิน 20MB)
      if (file.size > 20 * 1024 * 1024) throw new Error("ไฟล์ใหญ่เกิน 20MB ไม่สามารถอัปโหลดได้");

      // สั่งอัปโหลดเข้า Supabase โดยตรง (ส่ง File Object)
      const fileData = await uploadToSupabase(file, `Doc_${Date.now()}`);
      
      // ถ้าเป็นการแก้ไขและมีไฟล์เดิมอยู่ ให้สั่งลบไฟล์เก่าออกจาก Supabase ด้วย
      if (editingMaterialId && oldMaterial && oldMaterial.file_url) {
          if (oldMaterial.file_url.includes('supabase.co')) {
              await deleteFromSupabase(oldMaterial.file_url);
          }
      }
      
      file_url = fileData.url;
    }

    if (selected_type !== "worksheet" && !youtube_url && !link_url && !album_url && !file_url && !contentHtml) {
      throw new Error("กรุณาใส่เนื้อหาสื่ออย่างน้อย 1 อย่าง");
    }

    const payload = {
      course_id,
      title,
      desc,
      cover_url,
      order,
      type: selected_type,
      target_grade: target_grade,
      score_category: document.getElementById("mat-score-category") ? document.getElementById("mat-score-category").value : "",
      questions: questionsList,
      youtube_url,
      link_url,
      album_url,
      file_url,
      content: contentHtml,
    };

    if (editingMaterialId) {
      payload.updated_at = new Date().toISOString();
      await db.collection("materials").doc(editingMaterialId).update(payload);
      showToast("แก้ไขสื่อการสอนเรียบร้อย! 🎉");
    } else {
      payload.created_at = new Date().toISOString();
      await db.collection("materials").add(payload);
      showToast("เพิ่มสื่อการสอนเรียบร้อย! 🎉");
    }

    closeModal();
    await loadInitialData();
  } catch (err) {
    showToast(err.message || "บันทึกล้มเหลว", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
    lucide.createIcons();
  }
}

function deleteMaterial(id) {
  if (!confirm("ยืนยันการลบสื่อการสอนนี้? ไฟล์ที่เกี่ยวข้องจะถูกลบออกจากระบบด้วย")) return;

  const m = materials.find((x) => x.id === id);
  if (m) {
    let urlsToDelete = [];
    if (m.cover_url) urlsToDelete.push(m.cover_url);
    if (m.file_url) urlsToDelete.push(m.file_url);
    // ดึง URL รูปจากในเนื้อหาบทความด้วย
    urlsToDelete = urlsToDelete.concat(extractDriveUrls(m.content)); // ชื่อฟังก์ชันเก่ายังใช้สแกนหา URL ได้

    // 🚀 สั่งลบไฟล์ออกจาก Supabase
    urlsToDelete.forEach(async (url) => {
        if (url.includes('supabase.co')) {
            await deleteFromSupabase(url);
        }
    });
  }

  db.collection("materials").doc(id).delete().then(() => {
    showToast("ลบสื่อการสอนสำเร็จ");
    loadInitialData();
  });
}
function showToast(msg, type = "success") {
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = `bg-white rounded-xl px-5 py-3.5 border shadow-xl flex items-center gap-3 toast-show ${type === "success" ? "border-green-200 text-green-700" : "border-red-200 text-red-700"}`;
  t.innerHTML = `<i data-lucide="${type === "success" ? "check-circle" : "alert-circle"}" class="w-5 h-5 shrink-0"></i><span class="text-sm font-bold">${msg}</span>`;
  c.appendChild(t);
  lucide.createIcons({ nodes: [t] });
  setTimeout(() => {
    t.classList.replace("toast-show", "toast-hide");
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

async function uploadCoverImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const inputUrl = document.getElementById("inp-m-cover");

  showToast("กำลังบีบอัดและอัปโหลดหน้าปก...", "info");
  inputUrl.value = "กำลังอัปโหลด...";
  inputUrl.disabled = true;

  try {
    const options = { maxSizeMB: 0.3, maxWidthOrHeight: 800, useWebWorker: true };
    const compressedFile = await imageCompression(file, options);

    // 🚀 อัปโหลดรูปหน้าปกเข้า Supabase
    const fileData = await uploadToSupabase(compressedFile, `Cover_${Date.now()}`);

    inputUrl.value = fileData.url;
    showToast("อัปโหลดรูปหน้าปกสำเร็จ!", "success");
  } catch (e) {
    showToast("อัปโหลดล้มเหลว: " + e.message, "error");
    inputUrl.value = "";
  } finally {
    inputUrl.disabled = false;
    event.target.value = "";
  }
}

function renderHistoryLogs() {
  const container = document.getElementById("history-list");
  if (!materialLogs || materialLogs.length === 0) {
    container.innerHTML = `<div class="bg-white rounded-[2rem] p-12 text-center border border-slate-200 shadow-sm"><p class="text-slate-500 font-bold">ยังไม่มีประวัติการเข้าชม</p></div>`;
    return;
  }

  const grouped = materialLogs.reduce((acc, log) => {
    const sid = log.student_id;
    if (!acc[sid]) {
      acc[sid] = {
        student_id: sid,
        student_name: log.student_name,
        total: 0,
        latest: log,
      };
    }
    acc[sid].total++;
    if (new Date(log.accessed_at) > new Date(acc[sid].latest.accessed_at)) {
      acc[sid].latest = log;
    }
    return acc;
  }, {});

  const groupedList = Object.values(grouped).sort(
    (a, b) => new Date(b.latest.accessed_at) - new Date(a.latest.accessed_at),
  );

  const totalPages = Math.ceil(groupedList.length / logsPerPage);
  if (currentLogPage > totalPages) currentLogPage = totalPages;
  const startIndex = (currentLogPage - 1) * logsPerPage;
  const paginatedList = groupedList.slice(startIndex, startIndex + logsPerPage);

  let html = paginatedList
    .map((item) => {
      const dateStr = new Date(item.latest.accessed_at).toLocaleDateString(
        "th-TH",
        {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      );

      return `
        <div class="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center border border-rose-100 shadow-inner">
                        <i data-lucide="user" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-800 text-lg">${item.student_name}</h4>
                        <p class="text-xs text-slate-400 font-bold uppercase tracking-widest">รหัส: ${item.student_id}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="bg-slate-800 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tighter">เข้าชมทั้งหมด ${item.total} ครั้ง</span>
                </div>
            </div>
            
            <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ชมล่าสุดเมื่อ: ${dateStr} น.</p>
                <p class="text-sm font-bold text-indigo-600 flex items-center gap-2">
                    <i data-lucide="book-open" class="w-4 h-4"></i> ${item.latest.material_title}
                </p>
            </div>
        </div>`;
    })
    .join("");

  if (totalPages > 1) {
    html += `
        <div class="flex items-center justify-center gap-4 mt-8">
            <button onclick="changeLogPage(-1)" ${currentLogPage === 1 ? "disabled" : ""} class="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-all shadow-sm"><i data-lucide="chevron-left"></i></button>
            <span class="text-sm font-bold text-slate-600 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">หน้า ${currentLogPage} / ${totalPages}</span>
            <button onclick="changeLogPage(1)" ${currentLogPage === totalPages ? "disabled" : ""} class="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-all shadow-sm"><i data-lucide="chevron-right"></i></button>
        </div>`;
  }

  container.innerHTML = html;
  lucide.createIcons();
}

function changeLogPage(dir) {
  currentLogPage += dir;
  renderHistoryLogs();
  document
    .getElementById("history-view")
    .scrollIntoView({ behavior: "smooth" });
}

// ==========================================
// 🟢 ส่วนท้ายไฟล์ materials-admin.js (เวอร์ชันแก้บั๊กเรียบร้อย)
// ==========================================

// 1. ฟังก์ชันจัดการหมวดหมู่คะแนน (ลบของที่ซ้ำซ้อนออกเหลือตัวที่ปลอดภัยที่สุดตัวเดียว)
function updateScoreCategoryDropdown(courseId, targetCategory = "") {
    let selectDropdown = document.getElementById('mat-score-category');
    if (!selectDropdown) return;

    let matchedCourse = courses.find(c => c.course_id === courseId);
    
    if (matchedCourse && matchedCourse.score_categories) {
        try {
            let scoreCats = JSON.parse(matchedCourse.score_categories);
            let optionsHTML = '<option value="">-- ไม่เก็บคะแนน (เรียนเพื่อรู้) --</option>';
            
            scoreCats.forEach(c => {
                optionsHTML += `<option value="${c.name}">${c.name} (เต็ม ${c.max} คะแนน)</option>`;
            });
            
            selectDropdown.innerHTML = optionsHTML;
            
            // ยัดค่าอย่างปลอดภัย
            if (targetCategory !== "") {
                selectDropdown.value = targetCategory;
            }
        } catch(e) {
            selectDropdown.innerHTML = '<option value="">-- ไม่เก็บคะแนน (เรียนเพื่อรู้) --</option>';
        }
    } else {
        selectDropdown.innerHTML = '<option value="">-- ไม่เก็บคะแนน (เรียนเพื่อรู้) --</option>';
    }
}




// ==========================================
// 📚 ระบบเพิ่มข้อมูล: รายวิชา (Courses)
// ==========================================
async function saveCourse() {
    const cId = document.getElementById('inp-new-course-id').value.trim();
    const cName = document.getElementById('inp-new-course-name').value.trim();
    const editId = document.getElementById('editing-course-internal-id').value; // ID เดิมตอนกดแก้ไข
    
    if(!cId || !cName) return showToast('กรุณากรอกข้อมูลให้ครบครับ', 'error');

    const btn = document.getElementById('btn-save-course');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังตรวจสอบ...';
    lucide.createIcons();

    try {
        // 🟢 โหมดเพิ่มใหม่ (ไม่มี editId)
        if (!editId) {
            const checkDoc = await db.collection('courses').doc(cId).get();
            if (checkDoc.exists) {
                btn.disabled = false;
                btn.innerHTML = 'บันทึกรายวิชาใหม่';
                return showToast(`รหัสวิชา "${cId}" นี้มีในระบบแล้วครับ กรุณาใช้รหัสอื่น`, 'error');
            }
        }

        // 🟢 โหมดแก้ไข (มีการเปลี่ยน ID)
        if (editId && editId !== cId) {
            const checkDoc = await db.collection('courses').doc(cId).get();
            if (checkDoc.exists) {
                btn.disabled = false;
                btn.innerHTML = 'อัปเดตข้อมูลวิชา';
                return showToast(`ไม่สามารถเปลี่ยนเป็นรหัส "${cId}" ได้ เพราะซ้ำกับวิชาอื่น`, 'error');
            }
            // ย้ายสื่อตามมาบ้านใหม่
            const snapshot = await db.collection('materials').where('course_id', '==', editId).get();
            if (!snapshot.empty) {
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.update(doc.ref, { course_id: cId }));
                await batch.commit();
            }
            await db.collection('courses').doc(editId).delete();
        }

        await db.collection('courses').doc(cId).set({
            course_id: cId,
            course_name: cName,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast('บันทึกข้อมูลเรียบร้อยแล้ว! ✨');
        resetCourseForm();
        await loadInitialData();
        renderCourseList();
    } catch (e) {
        showToast('บันทึกล้มเหลว: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = editId ? 'อัปเดตข้อมูลวิชา' : 'บันทึกรายวิชาใหม่';
        lucide.createIcons();
    }
}

// ==========================================
// 🏫 ระบบเพิ่มข้อมูล: ระดับชั้น (Classrooms)
// ==========================================
// ==========================================
// 📚 ระบบจัดการ: รายวิชา (Courses) - FULL VERSION
// ==========================================

function openCourseModal() {
    resetCourseForm();
    renderCourseList();
    const modal = document.getElementById('course-modal');
    const box = document.getElementById('course-modal-box');
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    box.classList.remove('scale-95');
    box.classList.add('scale-100');
}

function resetCourseForm() {
    const idInput = document.getElementById('inp-new-course-id');
    document.getElementById('editing-course-internal-id').value = '';
    idInput.value = '';
    idInput.readOnly = false; // ปลดล็อกช่องกรอก ID
    document.getElementById('inp-new-course-name').value = '';
    document.getElementById('btn-save-course').textContent = 'บันทึกรายวิชาใหม่';
    document.getElementById('btn-save-course').classList.replace('bg-amber-500', 'bg-indigo-600');
}



function renderCourseList() {
    const container = document.getElementById('course-list-container');
    if (!container) return;

    if (courses.length === 0) {
        container.innerHTML = `<p class="text-center py-8 text-slate-400 text-xs italic">ยังไม่มีวิชาในระบบ</p>`;
        return;
    }

    container.innerHTML = courses.map(c => `
        <div class="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all group">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center text-[10px] font-bold">${c.course_id}</div>
                <span class="text-sm font-bold text-slate-700">${c.course_name}</span>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="prepareEditCourse('${c.course_id}')" class="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="แก้ไขข้อมูล">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button onclick="deleteCourse('${c.course_id}')" class="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="ลบข้อมูล">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join('');
    lucide.createIcons(); // สั่งเรนเดอร์ไอคอนใหม่
}

function prepareEditCourse(courseId) {
    const c = courses.find(x => x.course_id === courseId);
    if (!c) return;
    document.getElementById('editing-course-internal-id').value = courseId;
    document.getElementById('inp-new-course-id').value = c.course_id;
    document.getElementById('inp-new-course-name').value = c.course_name;
    
    const btn = document.getElementById('btn-save-course');
    btn.textContent = 'อัปเดตข้อมูลวิชา';
    btn.classList.replace('bg-indigo-600', 'bg-amber-500'); // เปลี่ยนสีปุ่มให้รู้ว่ากำลังแก้ไข
}

async function deleteCourse(courseId) {
    if(!confirm(`ยืนยันการลบวิชา ${courseId}? (ระวัง: สื่อที่ผูกกับวิชานี้อาจจะไม่แสดงผล)`)) return;
    try {
        await db.collection('courses').doc(courseId).delete();
        showToast('ลบวิชาเรียบร้อยแล้ว');
        await loadInitialData();
        renderCourseList();
    } catch (e) {
        showToast('ลบล้มเหลว', 'error');
    }
}

// ==========================================
// 🏫 ระบบจัดการ: ชั้นเรียน (Classrooms) - FULL VERSION
// ==========================================

function openClassroomModal() {
    resetClassroomForm();
    renderClassroomList();
    const modal = document.getElementById('classroom-modal');
    const box = document.getElementById('classroom-modal-box');
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    box.classList.remove('scale-95');
    box.classList.add('scale-100');
}

// ✅ ใหม่ (ครบถ้วน)
function resetClassroomForm() {
    // reset ช่องกรอก
    const idInput = document.getElementById('inp-new-class-id');
    if (idInput) {
        idInput.value = '';
        idInput.readOnly = false; // ✅ ปลดล็อก field รหัสชั้น
        idInput.classList.remove('bg-slate-200', 'text-slate-500', 'cursor-not-allowed'); // ✅ คืนสไตล์ปกติ
    }

    const nameInput = document.getElementById('inp-new-class-name');
    if (nameInput) nameInput.value = '';

    const editIdInput = document.getElementById('editing-class-internal-id');
    if (editIdInput) editIdInput.value = '';

    // ✅ คืนสีและข้อความปุ่มกลับเป็นปกติ
    const btn = document.getElementById('btn-save-classroom');
    if (btn) {
        btn.textContent = 'บันทึกชั้นเรียนใหม่';
        // classList.replace จะ fail เงียบๆ ถ้าไม่มี class เดิม
        // ใช้ remove+add แทนเพื่อความปลอดภัย
        btn.classList.remove('bg-amber-500');
        btn.classList.add('bg-emerald-600');
    }
}

function renderClassroomList() {
    const container = document.getElementById('classroom-list-container');
    if (!container) return;

    if (classLevels.length === 0) {
        container.innerHTML = `<p class="text-center py-8 text-slate-400 text-xs italic">ยังไม่มีชั้นเรียนในระบบ</p>`;
        return;
    }

    container.innerHTML = classLevels.map(c => `
        <div class="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl hover:border-emerald-200 transition-all group">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center text-[10px] font-bold">${c.id}</div>
                <span class="text-sm font-bold text-slate-700">${c.name || c.class_name || c.id}</span>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="prepareEditClass('${c.id}')" class="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="แก้ไขข้อมูล">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button onclick="deleteClassroom('${c.id}')" class="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="ลบข้อมูล">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join('');
    lucide.createIcons(); // สั่งเรนเดอร์ไอคอนใหม่
}

function prepareEditClass(classId) {
    const c = classLevels.find(x => x.id === classId);
    if (!c) return;

    document.getElementById('editing-class-internal-id').value = classId;

    // ✅ ล็อก field รหัสชั้น ป้องกันแก้ ID โดยไม่ตั้งใจ
    const idInput = document.getElementById('inp-new-class-id');
    if (idInput) {
        idInput.value = c.id;
        idInput.readOnly = true;
        idInput.classList.add('bg-slate-200', 'text-slate-500', 'cursor-not-allowed');
    }

    const nameInput = document.getElementById('inp-new-class-name');
    if (nameInput) nameInput.value = c.name || c.class_name || c.id;

    // ✅ เปลี่ยนสีและข้อความปุ่มให้รู้ว่ากำลังแก้ไขอยู่
    const btn = document.getElementById('btn-save-classroom');
    if (btn) {
        btn.textContent = 'อัปเดตข้อมูลชั้นเรียน';
        btn.classList.remove('bg-emerald-600');
        btn.classList.add('bg-amber-500');
    }
}

async function saveClassroom() {
    const clId = document.getElementById('inp-new-class-id').value.trim();
    const clName = document.getElementById('inp-new-class-name').value.trim();
    const editId = document.getElementById('editing-class-internal-id').value;
    
    if(!clId || !clName) return showToast('กรุณากรอกข้อมูลให้ครบครับ', 'error');

    const btn = document.getElementById('btn-save-classroom');
    btn.disabled = true;

    try {
        await db.collection('classrooms').doc(clId).set({
            id: clId,
            name: clName,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        if(editId && editId !== clId) {
            await db.collection('classrooms').doc(editId).delete();
        }
        
        showToast('บันทึกชั้นเรียนเรียบร้อย! ✨');
        resetClassroomForm();
        await loadInitialData();
        renderClassroomList();
    } catch (e) {
        showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

async function deleteClassroom(classId) {
    if(!confirm(`ยืนยันการลบชั้นเรียน ${classId}?`)) return;
    try {
        await db.collection('classrooms').doc(classId).delete();
        showToast('ลบชั้นเรียนเรียบร้อยแล้ว');
        await loadInitialData();
        renderClassroomList();
    } catch (e) {
        showToast('ลบล้มเหลว', 'error');
    }
}