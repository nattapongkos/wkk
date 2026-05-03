// =================================================================
// 📍 ระบบดึงพิกัด GPS ของเบราว์เซอร์ (Safe Version)
// =================================================================
if (typeof window.CUSTOM_GPS === "undefined") {
  window.CUSTOM_GPS = {
    enable: false, // 🔴 ปิดการทำงาน (false) เพื่อให้นักเรียนลงสนามจริงด้วยมือถือ
    lat: 20.266, 
    lng: 99.988, 
  };
}

if (window.CUSTOM_GPS.enable) {
  console.warn("⚠️ บังคับใช้พิกัดจำลอง (Mock GPS)");
  if (!navigator.geolocation) navigator.geolocation = {};
  
  const mockSuccess = (success) => {
      setTimeout(() => success({ coords: { latitude: window.CUSTOM_GPS.lat, longitude: window.CUSTOM_GPS.lng, accuracy: 10 } }), 100);
  };

  navigator.geolocation.getCurrentPosition = mockSuccess;
  navigator.geolocation.watchPosition = (success) => { mockSuccess(success); return 999; };
}
// =================================================================
// -----------------------------------------------------------------
// 🚨 สำคัญ: นำ Web App URL ของคุณครูที่ได้ใหม่มาวางที่นี่
const UPLOAD_GAS_URL =
  "https://script.google.com/macros/s/AKfycbzTSa1DKU5hdxa3l_ghGMZVzkQj4h7z1LFCZ4CCFQ-CX9EBH4zNGGg8Po6Wlgz9uMSJ/exec";
let currentSystemSettings = {}; // เพิ่มตัวแปร global สำหรับเก็บสถานะเปิด-ปิดระบบ

// 🌟 ตัวแปร Global (ประกาศครั้งเดียว)
let teacherDbStudents = [];
let globalMissingAssignments = []; // ตัวแปรเก็บรายชื่องานที่เด็กค้างส่ง
let teacherDbCourses = [];
let allData = [];
let selectedFilesArray = [];
let isSubmitting = false;
let existingSubmissions = [];

let selectedMoodValue = null;
let todayMoodsList = [];
let currentMoodSlide = 0;
let moodSlideInterval = null;

let currentStudentCoins = 0;
let availableTitles = [];
let gachaSettings = {
  price: 1000,
  rates: { common: 50, rare: 30, epic: 15, legendary: 5 },
};
let allUnlockedTitles = [];
let showcasePage = 1;
const itemsPerPage = 4;
let legendaryTitles = [];
let legendarySlideIndex = 0;
let legendaryInterval = null;

// ==========================================
// 🗄️ ตั้งค่า Supabase 2 โกดัง (Load Balancing)
// ==========================================
const SUPA1_URL = 'https://vbdfnsathdkhthxejkws.supabase.co';
const SUPA1_KEY = 'sb_publishable_2-XHNvGBpfZwH0gtfjcdIg_bkWv7nqY';
const supabase1 = supabase.createClient(SUPA1_URL, SUPA1_KEY);

const SUPA2_URL = 'https://cdduysitlkvirsbgbaqj.supabase.co';
const SUPA2_KEY = 'sb_publishable_fuvWgbT4puXvHmf96dXx5w_kv0BoaC4';
const supabase2 = supabase.createClient(SUPA2_URL, SUPA2_KEY);

// ชื่อ Bucket ที่ครูต้องไปสร้างไว้ใน Supabase (ต้องตั้งชื่อให้เหมือนกันทั้ง 2 โกดัง)
const BUCKET_NAME = 'student_works';

// ---------------------------------------------------------
// 🚀 ฟังก์ชัน 1: อัปโหลดไฟล์เข้า Supabase
// ---------------------------------------------------------
async function uploadToSupabase(file, prefixId) {
    // [บัค #3 แก้แล้ว] เพิ่ม fallback: ถ้าโกดังแรกล้มเหลว ให้ลองโกดังที่สองอัตโนมัติ
    const fileExt = file.name.split('.').pop();
    const fileName = `${prefixId}_${Date.now()}.${fileExt}`;

    // สุ่มลำดับโกดัง (50/50) แต่มี fallback เสมอ
    const useStorage1First = Math.random() > 0.5;
    const primarySupa = useStorage1First ? supabase1 : supabase2;
    const fallbackSupa = useStorage1First ? supabase2 : supabase1;

    for (const activeSupa of [primarySupa, fallbackSupa]) {
        try {
            const { data, error } = await activeSupa.storage
                .from(BUCKET_NAME)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: urlData } = activeSupa.storage
                .from(BUCKET_NAME)
                .getPublicUrl(fileName);

            return { url: urlData.publicUrl, name: file.name };

        } catch (error) {
            console.warn("Supabase Upload: โกดังแรกล้มเหลว กำลังสลับโกดัง...", error.message);
            // วนต่อไปลอง fallback โกดัง
        }
    }

    throw new Error("อัปโหลดไฟล์ไม่สำเร็จ: ทั้งสองโกดังไม่ตอบสนอง");
}

// ---------------------------------------------------------
// 🗑️ ฟังก์ชัน 2: ลบไฟล์ออกจาก Supabase ข้ามโกดัง
// ---------------------------------------------------------
async function deleteFromSupabase(fileUrl) {
    if (!fileUrl) return;

    try {
        // [บัค #4 แก้แล้ว] ใช้ URL API ตัดชื่อไฟล์ให้ถูกต้อง ป้องกัน ?token=xxx ติดมาด้วย
        const fileName = new URL(fileUrl).pathname.split('/').pop();

        if (fileUrl.includes(SUPA1_URL.split('//')[1])) {
            const { error } = await supabase1.storage.from(BUCKET_NAME).remove([fileName]);
            if (error) console.error("ลบจากโกดัง 1 พลาด:", error);
        } else if (fileUrl.includes(SUPA2_URL.split('//')[1])) {
            const { error } = await supabase2.storage.from(BUCKET_NAME).remove([fileName]);
            if (error) console.error("ลบจากโกดัง 2 พลาด:", error);
        }
    } catch (error) {
        console.error("Supabase Delete Error:", error);
    }
}


// ==========================================
// 📱 ฟังก์ชันตรวจสอบว่าเป็น "มือถือ" หรือไม่ (แคบกว่า 768px)
// ==========================================
function isMobilePhone() {
  return window.innerWidth < 768;
}

// ==========================================
// 📱 ฟังก์ชันตรวจสอบว่าเป็นมือถือหรือไม่ (ถ้าวางไว้แล้วข้ามได้เลยครับ)
// ==========================================
function isMobileDevice() {
  const isMobileOS = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isSmallScreen = window.innerWidth < 1024;
  return isMobileOS || isSmallScreen;
}

// ==========================================
// 🚀 ฟังก์ชันอัปเดตหน้า Loading (ตัวเลข & หลอดพลัง)
// ==========================================
function updateLoadingProgress(percent, text) {
    const bar = document.getElementById("main-loading-bar");
    const status = document.getElementById("loading-status-text");
    const pctText = document.getElementById("loading-percent-text");

    if (bar) bar.style.width = percent + "%";
    if (status) status.textContent = text;
    
    // อนิเมชันตัวเลขวิ่ง
    if (pctText) {
        let current = parseInt(pctText.innerText) || 0;
        let target = percent;
        let interval = setInterval(() => {
            if (current >= target) {
                clearInterval(interval);
                pctText.innerText = target + "%";
            } else {
                current += Math.ceil((target - current) / 4); // วิ่งไวขึ้น
                pctText.innerText = current + "%";
            }
        }, 30);
    }
}

// ==========================================
// 🚀 เริ่มการทำงานเมื่อโหลดหน้าเว็บเสร็จ
// ==========================================
window.onload = async () => {
  // === ลบตัวเช็ค isMobileDevice ออกไปแล้ว เริ่มรันระบบปกติได้เลย ===
  if (typeof lucide !== "undefined") lucide.createIcons();
  
  if (document.getElementById("inp-due")) {
    document.getElementById("inp-due").value = new Date().toISOString().split("T")[0];
  }

  // 🟢 20% - เริ่มเชื่อมต่อฐานข้อมูล
  updateLoadingProgress(20, "Connecting Database...");
  await autoClearOldMoods();

  // 🟢 40% - โหลดการตั้งค่า
  updateLoadingProgress(40, "Checking Configurations...");
  await fetchGachaConfig();

  // 🟢 60% - เตรียมหน้าต่างผู้ใช้งาน
  updateLoadingProgress(60, "Loading Interface...");
  try {
    const courseSnap = await db.collection("courses").get();
    teacherDbCourses = courseSnap.docs.map((doc) => doc.data());
    if (typeof populateSubjectDropdown === "function") populateSubjectDropdown();
  } catch (e) {
    console.error("Course load error:", e);
  }

  // 🟢 80% - ตรวจสอบการเข้าสู่ระบบ
  updateLoadingProgress(80, "Authenticating Session...");
  // 🚨 ตรวจสอบการล็อกอิน (เมื่อเช็คผ่านแล้ว ถ้าเป็นมือถือ Popup ยินดีต้อนรับจะเด้งตรงนี้)
  await checkAuthSession();

  // 🟢 90% - ใช้การตั้งค่าระบบ
  updateLoadingProgress(90, "Applying System Settings...");
  await applySystemToggles();

  // 🟢 95% - ซิงค์ข้อมูลโปรไฟล์นักเรียน
  updateLoadingProgress(95, "Syncing User Profile...");
  await syncProfileWithGachaData();

  // 🟢 100% - พร้อมใช้งาน!
  updateLoadingProgress(100, "Portal Ready!");
  
  if (typeof startMemoryFlashback === "function") {
      startMemoryFlashback();
  }

  // [บัค #5 แก้แล้ว] เรียก listenToBackgrounds ในนี้แทน เพราะ Firebase พร้อมแน่นอน
  if (typeof listenToBackgrounds === "function") {
      listenToBackgrounds();
  }

  // หน่วงเวลาให้เห็น 100% แป๊บนึงแล้วค่อยปิดหน้า Loading แบบสมูท
  setTimeout(() => {
    hideLoading();
  }, 800);
};

// ==========================================
// 💾 ฟังก์ชันบันทึกการตกแต่งโปรไฟล์ (Nickname, Hobby, Bio, Color, Pet)
// ==========================================
async function saveProfileDecoration() {
    if (typeof loggedInUser === "undefined" || !loggedInUser) return;
    
    // 1. ดึงค่าจากหน้าจอ Popup
    const newNickname = document.getElementById("edit-nickname").value;
    const newHobby = document.getElementById("edit-hobby").value;
    const newBio = document.getElementById("edit-bio").value;
    const newColor = document.getElementById("edit-color").value;
    const newPet = document.getElementById("edit-pet").value;

    if (typeof showToast === 'function') showToast("กำลังบันทึกข้อมูล...", "info");

    try {
        // 2. ค้นหา Document ID ของนักเรียนคนนี้ใน Firestore
        const studentSnap = await db.collection("students")
            .where("student_id", "==", String(loggedInUser.id))
            .get();

        if (!studentSnap.empty) {
            const docId = studentSnap.docs[0].id;

            // 3. อัปเดตข้อมูลลง Firestore (เก็บถาวร)
            await db.collection("students").doc(docId).update({
                nickname: newNickname,
                hobby: newHobby,
                bio: newBio,
                theme_color: newColor,
                equipped_pet: newPet,
                last_updated: Date.now()
            });

            if (typeof showToast === 'function') showToast("บันทึกข้อมูลเรียบร้อย! ✨", "success");
            
            // 4. ปิดหน้าต่าง Popup
            if (typeof closeEditProfileModal === 'function') closeEditProfileModal();

            // 5. 🚨 สำคัญ: สั่งให้หน้าจอหลักโหลดข้อมูลใหม่ทันที (เพื่ออัปเดตชื่อเล่น/งานอดิเรก/สีธีม)
            syncProfileWithGachaData();
        }
    } catch (error) {
        console.error("Save Profile Error:", error);
        if (typeof showToast === 'function') showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
    }
}


// [บัค #1 แก้แล้ว] ลบ updateLoadingProgress ตัวซ้ำออก ใช้ตัวที่ประกาศด้านบนตัวเดียว


// =======================================================
// 🌟 นำฟังก์ชันนี้ไปวางไว้ข้างนอก window.onload
// =======================================================
async function applySystemToggles() {
  try {
    const doc = await db.collection("settings").doc("system_toggles").get();
    if (doc.exists) {
      currentSystemSettings = doc.data(); // เก็บค่าไว้ที่นี่

      const toggleMap = {
        toggle_news: "news-feed-container",
        toggle_assignment: "feature-assignment",
        toggle_treasure: "feature-treasure",
        toggle_gacha: "feature-gacha",
        toggle_2dgame: "feature-2dgame",
        toggle_review: "feature-review",
      };

      for (const [key, elementId] of Object.entries(toggleMap)) {
        const el = document.getElementById(elementId);
        if (el) {
          // ปรับเงื่อนไขการซ่อน: เฉพาะหน้า Home เท่านั้นที่ซ่อนกล่อง
          if (currentSystemSettings[key] === false) {
            el.style.display = "none";
          } else {
            el.style.display = "";
          }
        }
      }
      // 🌟 1. นำภาพพื้นหลัง Live Mood
      const moodBgElement = document.getElementById("live-mood-bg");
      // รองรับทั้งแบบมี _ และไม่มี _ เผื่อหลังบ้านเซฟมาคนละชื่อ
      const moodBg =
        currentSystemSettings.mood_bg_url || currentSystemSettings.moodBgUrl;
      if (moodBgElement && moodBg) {
        moodBgElement.style.backgroundImage = `url('${moodBg}')`;
      }

      // 🌟 2. นำภาพพื้นหลัง My Profile
      const profileBgElement = document.getElementById("profile-bg-hero");
      // รองรับชื่อตัวแปรทุกรูปแบบที่เป็นไปได้
      const profileBg =
        currentSystemSettings.profile_bg_url ||
        currentSystemSettings.profileBgUrl ||
        currentSystemSettings.profile_bg ||
        currentSystemSettings.profileBg;
      if (profileBgElement && profileBg) {
        profileBgElement.style.backgroundImage = `url('${profileBg}')`;
      }

      // 🌟 3. นำภาพประกอบ Assignment
      const assignImgElement = document.getElementById(
        "assignment-illustration",
      );
      const assignImg =
        currentSystemSettings.assign_img_url ||
        currentSystemSettings.assignImgUrl;
      if (assignImgElement && assignImg) {
        assignImgElement.src = assignImg;
      }
    }
  } catch (e) {
    console.error("Failed to load system toggles:", e);
  }
}

function hideLoading() {
  const loader = document.getElementById("loading-overlay");
  if (!loader) return;

  loader.style.opacity = "0";
  loader.style.transform = "scale(1.1)"; // ขยายตัวออกตอนหายไป

  setTimeout(() => {
    loader.style.display = "none";
    const app = document.getElementById("app");
    if (app) app.classList.remove("hidden");
  }, 1000);
}

async function uploadFileToGAS(url, payload, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
      });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message);
      return json;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function loadDataFromFirebase() {
  // 🟢 แก้ไขเพื่อป้องกัน ReferenceError ทำให้หน้าเว็บขาว
  if (typeof loggedInUser === 'undefined' || !loggedInUser) return; 
  try {
    showToast("กำลังซิงค์ข้อมูลประจำตัว...", "info");
    // 1. โหลดงาน "เฉพาะของตัวเอง" เท่านั้น
    const snapshot = await db
      .collection("submissions")
      .where("student_id", "==", String(loggedInUser.id))
      .get();
    let myData = snapshot.docs.map((doc) => ({
      __backendId: doc.id,
      ...doc.data(),
    }));

    // 2. โหลดลานเกียรติยศ (ดึงแค่ 20 งานล่าสุดที่ติดดาว เพื่อประหยัดโควต้า)
    const hofSnap = await db
      .collection("submissions")
      .where("is_starred", "==", true)
      .limit(20)
      .get();
    let hofData = hofSnap.docs.map((doc) => ({
      __backendId: doc.id,
      ...doc.data(),
    }));

    // รวมข้อมูลเพื่อใช้งานในหน้าเว็บ
    const allDataMap = new Map();
    myData.forEach((d) => allDataMap.set(d.__backendId, d));
    hofData.forEach((d) => allDataMap.set(d.__backendId, d));
    allData = Array.from(allDataMap.values());

    if (document.getElementById("history-list")) renderHistory();
  } catch (e) {
    console.error(e);
  }
}

async function loadTeacherDatabase() {
  try {
    const studentSnap = await db.collection("students").get();
    teacherDbStudents = studentSnap.docs.map((doc) => doc.data());
    const courseSnap = await db.collection("courses").get();
    teacherDbCourses = courseSnap.docs.map((doc) => doc.data());
    populateSubjectDropdown();
  } catch (e) {
    console.error(e);
  }
}

// ========================================================
// 🌟 2. ระบบนำทาง (Router)
// ========================================================
// 1. ฟังก์ชันกลับหน้าแรก
function goToHome() {
  // สั่งเปิด Tab ที่ชื่อว่า 'home'
  switchTab("home");

  // ปรับแต่ง UI เพิ่มเติม (ถ้ามี)
  document.getElementById("page-title").innerText = "Student Portal";
  document.getElementById("btn-back-home").classList.add("hidden");
}

// [บัค #2 แก้แล้ว] ลบ switchTab ตัวแรกที่ไม่มี system toggle check และ panel list ไม่ครบออก
// ใช้ switchTab ด้านล่างตัวเดียว (มี accessMap + panel list ครบ)

// ========================================================
// 🌟 2. ระบบนำทาง (Router) - แก้ไขยุบรวม switchTab()
// ========================================================
function switchTab(tab) {
  // 1. ตรวจสอบสถานะเปิด-ปิดระบบจากหลังบ้าน
  const accessMap = {
    submit: "toggle_assignment",
    halloffame: "toggle_assignment",
    shop: "toggle_gacha",
    treasure: "toggle_treasure",
    
    mood: "toggle_news",
    "2dgame": "toggle_2dgame"
  };

  const toggleKey = accessMap[tab];
  if (toggleKey && currentSystemSettings && currentSystemSettings[toggleKey] === false) {
    showDisabledModal();
    return;
  }

  // 2. ซ่อนทุก Panel ก่อน
  const allPanels = [
    "home", "submit", "halloffame", "attendance", 
    "mood", "shop", "treasure", "logo-shop", "live-class"
  ];
  
  allPanels.forEach((id) => {
    const el = document.getElementById(`panel-${id}`);
    if (el) el.classList.add("hidden");
  });
  // 👇 --- เพิ่มโค้ดควบคุมปุ่มย้อนกลับบน Header ตรงนี้ --- 👇
  const backBtn = document.getElementById("btn-back-home");
  if (backBtn) {
    if (tab === "home") {
      backBtn.classList.add("hidden"); // ซ่อนปุ่มถ้าอยู่หน้าหลัก
    } else {
      backBtn.classList.remove("hidden"); // แสดงปุ่มถ้าอยู่หน้าอื่น
    }
  }
  // 3. แสดงเฉพาะ Panel ที่เลือก
  const targetPanel = document.getElementById(`panel-${tab}`);
  if (targetPanel) {
    targetPanel.classList.remove("hidden");
    
    // 🟢 สั่งให้กล่อง #app เลื่อนขึ้นบนสุด (หน่วงเวลาเล็กน้อยให้หน้าเว็บวาดเสร็จก่อน)
    setTimeout(() => {
        const appContainer = document.getElementById("app");
        if (appContainer) {
            appContainer.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, 50);
  }

  // 5. อัปเดต Title
  const titles = {
    submit: "ส่งงาน / การบ้าน",
    halloffame: "ลานเกียรติยศ",
    mood: "เช็คอินความรู้สึก",
    shop: "ร้านค้าห้องเรียน",
    "logo-shop": "ตลาดนัด Logo",
    treasure: "ล่าสมบัติระดับตำนาน",
    "live-class": "Live Classroom"
  };
  const titleEl = document.getElementById("page-title");
  if(titleEl) titleEl.textContent = titles[tab] || "Student Portal";

  // 6. การทำงานเฉพาะของแต่ละ Tab
  if (tab === "submit") switchSubTab("form");
  if (tab === "halloffame") renderHallOfFame();
  if (tab === "logo-shop" && typeof switchAuctionTab === "function") switchAuctionTab("market");
  if (tab === "treasure" && typeof initTreasureHunt === "function") initTreasureHunt();
  if (typeof lucide !== "undefined") lucide.createIcons();
}

// เพิ่มฟังก์ชันแสดง/ปิด Modal ระบบปิดใช้งาน
function showDisabledModal() {
  const modal = document.getElementById("system-disabled-modal");
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.add("active"), 10);
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function closeDisabledModal() {
  const modal = document.getElementById("system-disabled-modal");
  modal.classList.remove("active");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

function switchSubTab(sub) {
  document.getElementById("view-form").classList.toggle("hidden", sub !== "form");
  document.getElementById("view-hist").classList.toggle("hidden", sub !== "hist");
  const btnForm = document.getElementById("subtab-form");
  const btnHist = document.getElementById("subtab-hist");
  
  const activeClass = "px-6 py-3 bg-[#009de0] text-white border-2 border-black border-b-[4px] active:border-b-[2px] active:translate-y-[2px] rounded-2xl text-sm font-black tracking-widest uppercase transition-all whitespace-nowrap shadow-[4px_4px_0px_rgba(0,0,0,0.2)]";
  const inactiveClass = "px-6 py-3 bg-white text-slate-700 hover:bg-slate-100 border-2 border-black border-b-[4px] active:border-b-[2px] active:translate-y-[2px] rounded-2xl text-sm font-black tracking-widest uppercase transition-all whitespace-nowrap shadow-[4px_4px_0px_rgba(0,0,0,0.2)]";

  if (sub === "form") {
    btnForm.className = activeClass;
    btnHist.className = inactiveClass;
  } else {
    btnForm.className = inactiveClass;
    btnHist.className = activeClass;
    renderHistory();
  }
}

function requestTeacherAccess() {
  document.getElementById("password-modal").classList.add("active");
  document.getElementById("teacher-password").focus();
}
function closePasswordModal() {
  document.getElementById("password-modal").classList.remove("active");
  document.getElementById("teacher-password").value = "";
}
async function verifyTeacherPassword(e) {
  e.preventDefault();
  const pwd = document.getElementById("teacher-password").value;

  try {
    const doc = await db.collection("settings").doc("system").get();
    if (!doc.exists || !doc.data().adminPassword) {
      showToast("ระบบยังไม่ได้ตั้งรหัสผ่านผู้ดูแล โปรดตั้งค่าในฐานข้อมูล", "error");
      return;
    }

    const realPassword = doc.data().adminPassword;

    if (pwd === realPassword) {
      showToast("รหัสผ่านถูกต้อง...", "success");
      sessionStorage.setItem("teacher_secure_access", "secured_" + encodeURIComponent(pwd));
      setTimeout(() => {
        window.location.href = "teacher.html";
      }, 1000);
    } else {
      showToast("รหัสผ่านไม่ถูกต้อง", "error");
      document.getElementById("teacher-password").value = "";
    }
  } catch (err) {
    showToast("ตรวจสอบรหัสไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
  }
}

async function verifyLiveTeacher(e) {
  e.preventDefault();
  const pwd = document.getElementById('live-teacher-pwd').value;
  
  try {
    const doc = await db.collection("settings").doc("system").get();
    if (!doc.exists || !doc.data().adminPassword) {
      return showToast("ไม่พบรหัสผ่านผู้ดูแลในระบบ", "error");
    }

    const realPassword = doc.data().adminPassword;

    if (pwd === realPassword) { 
        isLiveTeacher = true;
        closeTeacherLogin();
        
        const teacherRef = firebase.database().ref(`live_classrooms/${currentLiveRoomId}/teacher`);
        teacherRef.onDisconnect().remove(); 
        
        teacherRef.set({
            online: true,
            name: loggedInUser.name,
            avatar: loggedInUser.profile_url || `https://ui-avatars.com/api/?name=Teacher&background=f59e0b`,
            last_active: Date.now()
        });

        document.getElementById('live-teacher-controls').classList.remove('hidden');
        showToast("เข้าสู่โหมดครูผู้สอนเรียบร้อย!", "success");
    } else {
        showToast("รหัสผ่านไม่ถูกต้อง!", "error");
        document.getElementById('live-teacher-pwd').value = "";
    }
  } catch(err) {
      showToast("ตรวจสอบรหัสผ่านไม่สำเร็จ", "error");
  }
}

function leaveLiveClass() {
    if (isLiveTeacher) {
        firebase.database().ref(`live_classrooms/${currentLiveRoomId}/teacher`).remove();
        isLiveTeacher = false; // ป้องกันสถานะ True ค้างเมื่อเข้าห้องใหม่
    }

    const mySeatRef = firebase.database().ref(`live_classrooms/${currentLiveRoomId}/seats/${loggedInUser.id}`);
    mySeatRef.remove();
    
    firebase.database().ref(`live_classrooms/${currentLiveRoomId}/seats`).off();
    firebase.database().ref(`live_classrooms/${currentLiveRoomId}/teacher`).off();
    firebase.database().ref(`live_classrooms/${currentLiveRoomId}/status`).off();
    
    document.getElementById("panel-live-class").classList.add("hidden");
    goToHome();
}

function showToast(msg, type = "success") {
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  const colors = {
    success: "border-emerald-500",
    error: "border-rose-500",
    info: "border-blue-500",
  };
  const icons = {
    success: "check-circle-2",
    error: "alert-triangle",
    info: "info",
  };
  const iconColors = {
    success: "text-emerald-500",
    error: "text-rose-500",
    info: "text-blue-500",
  };
  t.className = `glass-panel rounded-2xl px-6 py-4 flex items-center gap-3 toast-show border-l-4 ${colors[type]}`;
  t.innerHTML = `<i data-lucide="${icons[type]}" class="w-6 h-6 ${iconColors[type]} shrink-0"></i><span class="text-sm font-bold text-slate-700 tracking-wide">${msg}</span>`;
  c.appendChild(t);
  lucide.createIcons({ nodes: [t] });
  setTimeout(() => {
    t.classList.replace("toast-show", "toast-hide");
    setTimeout(() => t.remove(), 400);
  }, 3500);
}

// ========================================================
// 🌟 3. ระบบส่งงาน (Submit Form & History)
// ========================================================
function searchStudentData() {
  const id = document.getElementById("inp-student-id").value.trim();
  if (!id) {
    showToast("กรุณากรอกรหัส", "error");
    return;
  }

  // ค้นหานักเรียนในระบบ
  const student = teacherDbStudents.find(
    (s) => String(s.student_id) === String(id),
  );

  if (student) {
    document.getElementById("inp-student-name").value =
      student.student_name || "";
    document.getElementById("inp-class").value =
      student.classroom || "ไม่ระบุห้อง";

    // 🌟 ส่วนล็อกรายวิชาที่ทำไว้ก่อนหน้านี้
    const subjSelect = document.getElementById("inp-subject");
    const course = teacherDbCourses.find(
      (c) => String(c.course_id) === String(student.course_id),
    );

    if (course) {
      subjSelect.innerHTML = `<option value="${course.course_name}" data-cid="${course.course_id}" selected>${course.course_name}</option>`;
      subjSelect.classList.add("bg-slate-100", "cursor-not-allowed");
      subjSelect.style.pointerEvents = "none";
      updateAssignmentOptionsFromSelect();
    } else {
      subjSelect.innerHTML =
        '<option value="" disabled selected>-- ยังไม่มีวิชาที่ลงทะเบียน --</option>';
      document.getElementById("inp-title").innerHTML =
        '<option value="" disabled selected>-- ติดต่อครูผู้สอน --</option>';
    }

    // =========================================================
    // 🌟 เพิ่มใหม่ตรงนี้: ระบบสุ่มข้อความทักทายรู้ใจ
    // =========================================================
    const welcomeTextElement = document.getElementById("welcome-text");
    if (welcomeTextElement) {
      // เอาแค่ชื่อจริงมาทักทาย (แยกด้วยช่องว่าง แล้วเอาคำแรก)
      const firstName = student.student_name
        ? student.student_name.split(" ")[0]
        : "วัยรุ่น";

      // เรียกใช้ฟังก์ชันสุ่มข้อความที่เราสร้างไว้ แล้วเอาไปแสดงบนจอ
      welcomeTextElement.innerHTML = generateGreeting(firstName);
    }
    // =========================================================

    showToast("ดึงข้อมูลสำเร็จ!", "success");
    lucide.createIcons();
  } else {
    showToast("ไม่พบรหัสนี้ในระบบ", "error");
    document.getElementById("inp-student-name").value = "";
  }
  checkDuplicateSubmission();
}
function populateSubjectDropdown() {
  // 🌟 แก้ไข: ไม่ต้องโหลดทุกวิชามาโชว์แล้ว ให้รอระบบค้นหารหัสนักเรียนก่อน
  const subjSelect = document.getElementById("inp-subject");
  if (subjSelect)
    subjSelect.innerHTML =
      '<option value="" disabled selected>-- รอตรวจสอบรหัสนักเรียน --</option>';
}

function updateAssignmentOptionsFromSelect() {
  const subjSelect = document.getElementById("inp-subject");
  const titleSelect = document.getElementById("inp-title");
  if (!subjSelect || !subjSelect.value) return;
  const cid =
    subjSelect.options[subjSelect.selectedIndex].getAttribute("data-cid");
  const course = teacherDbCourses.find((c) => c.course_id === cid);
  
  if (course && course.score_categories) {
    try {
      const cats = JSON.parse(course.score_categories);
      
      // 🌟 กรองเอาเฉพาะงานที่ครู "ติ๊กถูก (allow_submit !== false)" มาแสดงให้นักเรียนเห็น
      const onlineCats = cats.filter(c => c.allow_submit !== false);

      if (onlineCats.length > 0) {
        titleSelect.innerHTML =
          '<option value="" disabled selected>-- คลิกเลือกชื่องาน --</option>' +
          onlineCats
            .map(
              (c) =>
                `<option value="${c.name}">${c.name} (เต็ม ${c.max})</option>`,
            )
            .join("");
      } else {
        // กรณีวิชานี้ ครูไม่ได้ติ๊กให้ส่งงานผ่านเว็บเลยสักงานเดียว
        titleSelect.innerHTML = '<option value="" disabled selected>-- ไม่มีงานที่ต้องส่งผ่านเว็บในวิชานี้ --</option>';
      }
    } catch (e) {
        console.error(e);
    }
  } else {
      titleSelect.innerHTML = '<option value="" disabled selected>-- ไม่พบโครงสร้างงาน --</option>';
  }
  checkDuplicateSubmission();
}

function checkDuplicateSubmission() {
  const stuId = document.getElementById("inp-student-id").value.trim();
  const title = document.getElementById("inp-title").value;
  const btn = document.getElementById("submit-btn");
  const alertBox = document.getElementById("duplicate-alert");
  const alertText = document.getElementById("duplicate-alert-text");
  if (stuId && title)
    existingSubmissions = allData.filter(
      (d) => String(d.student_id) === String(stuId) && d.title === title,
    );
  else existingSubmissions = [];

  if (existingSubmissions.length > 0) {
    btn.innerHTML = '<i data-lucide="refresh-cw" style="width:24px;height:24px"></i> ส่งงานซ้ำ (ทับของเดิม)';
    btn.className = "w-full py-4 mt-4 rounded-[1.5rem] bg-[#f97316] hover:bg-[#ea580c] text-white font-black text-base uppercase tracking-widest shadow-[4px_4px_0px_rgba(0,0,0,0.2)] border-4 border-black border-b-[6px] active:border-b-[2px] active:translate-y-[4px] flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1";
    if (alertBox) {
      alertBox.classList.remove("hidden");
      alertText.textContent = `เคยส่งชิ้นนี้แล้วเมื่อ ${formatDate(existingSubmissions[0].submitted_at)}`;
    }
  } else {
    btn.innerHTML = '<i data-lucide="send" style="width:24px;height:24px"></i> ยืนยันการส่งงาน';
    btn.className = "w-full py-4 mt-4 rounded-[1.5rem] bg-[#10b981] hover:bg-[#059669] text-white font-black text-base uppercase tracking-widest shadow-[4px_4px_0px_rgba(0,0,0,0.2)] border-4 border-black border-b-[6px] active:border-b-[2px] active:translate-y-[4px] flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1";
    if (alertBox) alertBox.classList.add("hidden");
  }
  lucide.createIcons();
}

async function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  if (selectedFilesArray.length + files.length > 5) {
    showToast("สูงสุด 5 ไฟล์", "error");
    e.target.value = "";
    return;
  }
  showToast("กำลังเตรียมไฟล์แนบ...", "info");

  const compressOptions = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
  };
  for (let file of files) {
    let processedFile = file;
    if (file.type.startsWith("image/")) {
      try {
        processedFile = await imageCompression(file, compressOptions);
      } catch (error) {}
    } else {
      if (file.size > 10 * 1024 * 1024) {
        showToast(`ไฟล์ ${file.name} ใหญ่เกิน 10MB`, "error");
        continue;
      }
    }
    const base64 = await readFileAsBase64(processedFile);
    selectedFilesArray.push({
      name: processedFile.name,
      type: processedFile.type || "application/octet-stream",
      size: processedFile.size,
      base64: base64,
      file: processedFile // 🟢 เพิ่มบรรทัดนี้ เพื่อเก็บไฟล์ต้นฉบับไว้โยนให้ Supabase ตรงๆ
    });
  }
  renderFilePreview();
  e.target.value = "";
}

function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function renderFilePreview() {
  const placeholder = document.getElementById("upload-placeholder");
  const preview = document.getElementById("file-preview");
  if (selectedFilesArray.length === 0) {
    placeholder.classList.remove("hidden");
    preview.classList.add("hidden");
    preview.innerHTML = "";
    return;
  }
  placeholder.classList.add("hidden");
  preview.classList.remove("hidden");
  preview.innerHTML = selectedFilesArray
    .map(
      (f, i) =>
        `<div class="flex items-center justify-between bg-white px-4 py-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] mb-2"><div class="flex items-center gap-3 overflow-hidden"><div class="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center border border-sky-200 shrink-0"><i data-lucide="file-check-2" class="w-4 h-4 text-[#009de0]"></i></div><p class="text-sm font-bold text-slate-700 truncate">${f.name} <span class="text-xs text-slate-400">(${(f.size / 1024).toFixed(0)}KB)</span></p></div><button type="button" onclick="event.stopPropagation(); removeFileIndex(${i})" class="bg-rose-100 hover:bg-rose-500 hover:text-white text-rose-500 p-2 rounded-lg border border-rose-200 hover:border-black shrink-0 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`,
    )
    .join("");
  lucide.createIcons();
}
function removeFileIndex(i) {
  selectedFilesArray.splice(i, 1);
  renderFilePreview();
}

function handleSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;
  const title = document.getElementById("inp-title").value;
  const subject = document.getElementById("inp-subject").value;
  if (!title) {
    showToast("กรุณาเลือกชื่องาน", "error");
    return;
  }
  document.getElementById("confirm-subj-text").textContent = subject;
  document.getElementById("confirm-title-text").textContent = title;
  document.getElementById("confirm-modal").classList.add("active");
}
function closeConfirmModal() {
  document.getElementById("confirm-modal").classList.remove("active");
}

async function executeSubmission() {
  closeConfirmModal();
  isSubmitting = true;
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.innerHTML =
    '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> กำลังดำเนินการ...';
  lucide.createIcons();

  const pCont = document.getElementById("upload-progress-container");
  const pText = document.getElementById("upload-status-text");
  const pBar = document.getElementById("upload-progress-bar");
  const pPct = document.getElementById("upload-percent-text");
  if (pCont) {
  pCont.classList.remove("hidden");
  pBar.className = "bg-[#009de0] h-full rounded-full transition-all duration-300 relative";
}
  const updateProgress = (text, percent) => {
    if (pText) pText.textContent = text;
    if (pBar) pBar.style.width = `${percent}%`;
    if (pPct) pPct.textContent = `${Math.round(percent)}%`;
  };

  try {
    updateProgress("กำลังเตรียมระบบ...", 5);
   


// 🗑️ จัดการลบงานเก่า กรณีที่นักเรียนส่งงานซ้ำ
    if (existingSubmissions.length > 0) {
        for (let oldSub of existingSubmissions) {
            // 🟢 1. สั่งลบไฟล์เก่าออกจาก Supabase
            if (oldSub.file_url) {
                const urls = String(oldSub.file_url).split("\n").filter((u) => u.trim() !== "");
                for (let url of urls) {
                    if (url.includes('supabase.co')) {
                        await deleteFromSupabase(url); // เรียกใช้ฟังก์ชันลบของ Supabase
                    }
                }
            }
            // 🟢 2. แล้วค่อยลบข้อมูลใน Firestore
            await db.collection("submissions").doc(oldSub.__backendId).delete();
        }
    }

    // 🚀 อัปโหลดงานใหม่เข้า Supabase
    let uploadedFilesData = [];
    if (selectedFilesArray.length > 0) {
        const studentIdInput = document.getElementById("inp-student-id").value.trim();
        for (let i = 0; i < selectedFilesArray.length; i++) {
            updateProgress(
                `กำลังอัปโหลดไฟล์เข้าคลังข้อมูล ${i + 1}/${selectedFilesArray.length}...`,
                20 + (i / selectedFilesArray.length) * 60
            );
            
            // 🟢 เรียกใช้ Supabase (ส่ง File Object และรหัสนักเรียนไป)
            const fileData = await uploadToSupabase(selectedFilesArray[i].file, studentIdInput);
            
            // เก็บข้อมูล URL และชื่อไฟล์กลับมา
            uploadedFilesData.push({ url: fileData.url, name: fileData.name });
        }
    }
    

    updateProgress("กำลังบันทึกข้อมูล...", 90);
    let classSec = document.getElementById("inp-class").value;
    let gradeLvl = classSec.includes("/")
      ? classSec.split("/")[0].trim()
      : classSec;
    let desc = document.getElementById("inp-desc").value.trim();
    if (existingSubmissions.length > 0) desc = "[ส่งซ้ำ] " + desc;

    const record = {
      student_id: document.getElementById("inp-student-id").value.trim(),
      student_name: document.getElementById("inp-student-name").value.trim(),
      name: document.getElementById("inp-student-name").value.trim(), // เพิ่มบรรทัดนี้ให้หน้าจอครูอ่านชื่อออก
      grade_level: gradeLvl,
      class_section: classSec.includes("/")
        ? classSec.split("/")[1].trim()
        : classSec,
      room: classSec.includes("/") ? classSec.split("/")[1].trim() : classSec, // เพิ่มบรรทัดนี้ให้หน้าจอครูอ่านห้องออก
      subject: document.getElementById("inp-subject").value,
      title: document.getElementById("inp-title").value,
      description: desc,
      due_date: document.getElementById("inp-due").value,
      submitted_at: new Date().toISOString(),
      timestamp: new Date().toISOString(), // เพิ่มบรรทัดนี้ให้หน้าจอครูอ่านวันที่ออก
      status: "pending", // เพิ่มสถานะเพื่อให้เข้าแท็บ "รอตรวจ" อัตโนมัติ
      file_url: uploadedFilesData.map((f) => f.url).join("\n"),
      file_name: uploadedFilesData.map((f) => f.name).join("\n"),
    };

    const docRef = await db.collection("submissions").add(record);

    try {
      const setSnap = await db.collection("settings").doc("system").get();
      if (setSnap.exists && setSnap.data().lineToken) {
        let currentUrl = window.location.href
          .split("?")[0]
          .replace("index.html", "");
        if (!currentUrl.endsWith("/")) currentUrl += "/";
        const msg = `\n📩 มีงานส่งใหม่!\n👨‍🎓 ${record.student_name}\n📚 วิชา: ${record.subject}\n📌 ชิ้นงาน: ${record.title}\n\n✅ คลิกเพื่อตรวจงานด่วน:\n${currentUrl}quick-grade.html?id=${docRef.id}`;
        fetch(UPLOAD_GAS_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "notify",
            data: { token: setSnap.data().lineToken, message: msg },
          }),
          headers: { "Content-Type": "text/plain;charset=utf-8" },
        });
      }
    } catch (lineErr) {}

    updateProgress("เสร็จสิ้นกระบวนการ! 🎉", 100);
    if (pBar) pBar.className = "bg-[#10b981] h-full rounded-full transition-all duration-300 relative";
      pBar.className =
        "bg-gradient-to-r from-emerald-400 to-teal-500 h-full rounded-full transition-all duration-300";
    showToast(
      existingSubmissions.length > 0
        ? "ส่งงานซ้ำสำเร็จแล้ว! 🎉"
        : "ส่งงานสำเร็จ! 🎉",
      "success",
    );
    // ยิงพลุฉลองส่งงานสำเร็จ!
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#4f46e5", "#10b981", "#f59e0b"],
    });
    setTimeout(async () => {
      document.getElementById("submit-form").reset();
      selectedFilesArray = [];
      renderFilePreview();
      if (pCont) pCont.classList.add("hidden");
      updateProgress("", 0);
      checkDuplicateSubmission();
      await loadDataFromFirebase();
      switchSubTab("hist");
    }, 2000);
  } catch (err) {
    updateProgress("ข้อผิดพลาด: " + err.message, 100);
    if (pBar) pBar.className = "bg-[#f43f5e] h-full rounded-full transition-all duration-300 relative";
      pBar.className =
        "bg-gradient-to-r from-red-500 to-rose-600 h-full rounded-full transition-all duration-300";
    showToast("ส่งไม่สำเร็จ: " + err.message, "error");
  } finally {
    isSubmitting = false;
    btn.disabled = false;
    checkDuplicateSubmission();
  }
}

function getStatus(item) {
  if (!item.due_date)
    return {
      label: "ส่งแล้ว",
      cls: "bg-indigo-100 text-indigo-700 border-indigo-200",
    };
  const due = new Date(item.due_date);
  due.setHours(23, 59, 59);
  return new Date(item.submitted_at) <= due
    ? {
        label: "ตรงเวลา",
        cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
      }
    : { label: "ล่าช้า", cls: "bg-rose-100 text-rose-700 border-rose-200" };
}
function formatDate(iso) {
  return iso
    ? new Date(iso).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
}

function renderHistory() {
  const el = document.getElementById("history-list");
  const q = (document.getElementById("search-input").value || "").toLowerCase();
  let filtered = allData;
  if (q)
    filtered = allData.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.subject.toLowerCase().includes(q) ||
        d.student_id.includes(q) ||
        d.student_name.toLowerCase().includes(q),
    );
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.submitted_at) - new Date(a.submitted_at),
  );

  if (!sorted.length) {
    el.innerHTML = `<div class="text-center py-16 text-slate-400 font-bold"><i data-lucide="search-x" class="w-12 h-12 mx-auto mb-4 opacity-30"></i><p>ไม่พบข้อมูลประวัติการส่งงาน</p></div>`;
    lucide.createIcons();
    return;
  }

  el.innerHTML = sorted
    .map((item) => {
      let urls = item.file_url ? String(item.file_url).split("\n").filter((u) => u.trim() !== "") : [];
      let names = item.file_name ? String(item.file_name).split("\n").filter((n) => n.trim() !== "") : [];
      let fileLinks = urls.length > 0
          ? urls.map((u, i) => `<a href="${u}" target="_blank" class="flex items-center gap-1.5 text-blue-700 hover:text-white bg-blue-100 hover:bg-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-[2px] active:shadow-none"><i data-lucide="file-check-2" class="w-4 h-4"></i> ${names[i] || "ไฟล์แนบ"}</a>`).join("")
          : '<span class="text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-xl border-2 border-slate-200">ไม่มีไฟล์แนบ</span>';
      
      const st = getStatus(item);
      const isLate = st.label === "ล่าช้า";
      const badgeStyle = isLate ? "bg-[#f43f5e] text-white border-black" : "bg-[#10b981] text-white border-black";

      return `
        <div class="bg-white rounded-[2rem] p-5 sm:p-6 border-4 border-black shadow-[6px_6px_0px_rgba(0,0,0,0.15)] hover:-translate-y-1 transition-transform relative overflow-hidden group mb-4">
            <div class="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div class="w-14 h-14 bg-[#ffd200] border-2 border-black rounded-2xl flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000] transform -rotate-3 group-hover:rotate-0 transition-transform">
                    <i data-lucide="folder-check" class="w-7 h-7 text-black"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                        <h3 class="text-lg font-black text-slate-800 leading-tight">${item.title}</h3>
                        <span class="text-[10px] font-black px-2.5 py-1 rounded-full border-2 ${badgeStyle} shadow-sm tracking-widest uppercase">${st.label}</span>
                    </div>
                    <div class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex flex-wrap gap-2 items-center">
                        <span class="bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-slate-600">รหัส: <span class="text-sky-600">${item.student_id}</span></span>
                        <span class="bg-slate-100 px-2 py-1 rounded-md border border-slate-200">วิชา: ${item.subject}</span>
                        <span class="bg-slate-100 px-2 py-1 rounded-md border border-slate-200"><i data-lucide="clock" class="w-3 h-3 inline mr-0.5"></i> ${formatDate(item.submitted_at)}</span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        ${fileLinks}
                    </div>
                </div>
            </div>
        </div>`;
    })
    .join("");
  lucide.createIcons();
}

// ========================================================
// 🌟 4. ลานเกียรติยศ (Hall of Fame)
// ========================================================
function renderHallOfFame() {
  const el = document.getElementById("halloffame-list");
  const starredWorks = allData
    .filter((d) => d.is_starred === true)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

  if (starredWorks.length === 0) {
    el.innerHTML = `<div class="col-span-full glass-panel rounded-[2rem] p-12 text-center border border-slate-200"><i data-lucide="star-off" class="w-12 h-12 text-slate-300 mx-auto mb-4"></i><p class="text-slate-500 font-bold">ยังไม่มีผลงานที่ได้รับการติดดาวในขณะนี้</p></div>`;
    lucide.createIcons();
    return;
  }

  el.innerHTML = starredWorks
    .map((item) => {
      let urls = item.file_url
        ? String(item.file_url)
            .split("\n")
            .filter((u) => u.trim() !== "")
        : [];
      let displayMedia = `<div class="w-full h-40 bg-orange-50 flex items-center justify-center rounded-t-[2rem] border-b border-slate-100"><i data-lucide="award" class="w-12 h-12 text-orange-200"></i></div>`;

      if (urls.length > 0) {
        const match = urls[0].match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          const imgUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
          displayMedia = `<div class="w-full h-48 bg-slate-100 overflow-hidden relative cursor-pointer rounded-t-[2rem] border-b border-slate-200" onclick="window.open('${urls[0]}', '_blank')"><img src="${imgUrl}" class="w-full h-full object-cover opacity-90 hover:opacity-100 hover:scale-105 transition-all duration-500" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="absolute inset-0 flex items-center justify-center hidden bg-indigo-50"><i data-lucide="file-text" class="w-12 h-12 text-indigo-300"></i></div></div>`;
        }
      }

      const likes = item.likes || 0;
      return `
        <div class="bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
            ${displayMedia}
            <div class="p-6 flex-1 flex flex-col">
                <h3 class="text-lg font-bold text-slate-800 leading-tight mb-1 line-clamp-2">${item.title}</h3>
                <p class="text-[10px] text-orange-500 font-bold uppercase tracking-widest mb-4">${item.subject}</p>
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white font-bold shadow-sm">${item.student_name.charAt(0)}</div>
                    <div><p class="text-sm font-bold text-slate-700">${item.student_name}</p><p class="text-[10px] text-slate-400">ส่งเมื่อ ${formatDate(item.submitted_at)}</p></div>
                </div>
                <div class="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                    <button onclick="likeSubmission('${item.__backendId}')" class="flex items-center gap-1.5 text-slate-400 hover:text-pink-500 transition-colors group/like"><i data-lucide="heart" class="w-5 h-5 group-hover/like:fill-pink-200 transition-all ${likes > 0 ? "fill-pink-500 text-pink-500" : ""}"></i> <span class="text-xs font-bold" id="like-count-${item.__backendId}">${likes > 0 ? likes : "ชื่นชม"}</span></button>
                    ${urls.length > 0 ? `<a href="${urls[0]}" target="_blank" class="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"><i data-lucide="eye" class="w-4 h-4"></i> ดูผลงาน</a>` : ""}
                </div>
            </div>
        </div>`;
    })
    .join("");
  lucide.createIcons();
}

async function likeSubmission(id) {
  const likeText = document.getElementById(`like-count-${id}`);
  if (
    likeText.innerText.includes("กำลัง") ||
    localStorage.getItem(`liked_${id}`)
  )
    return showToast("คุณได้ชื่นชมผลงานนี้ไปแล้ว ❤️", "info");
  try {
    likeText.innerText = "...";
    await db
      .collection("submissions")
      .doc(id)
      .update({ likes: firebase.firestore.FieldValue.increment(1) });
    localStorage.setItem(`liked_${id}`, "true");
    const target = allData.find((d) => d.__backendId === id);
    if (target) target.likes = (target.likes || 0) + 1;
    renderHallOfFame();
    showToast("ส่งหัวใจให้เพื่อนเรียบร้อย! ❤️", "success");
  } catch (e) {
    showToast("ผิดพลาด", "error");
  }
}

// ========================================================
// 🌟 5. ระบบ Daily Mood Tracker (เช็คอินความรู้สึก + Live Ticker)
// ========================================================
async function autoClearOldMoods() {
  try {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const snap = await db
      .collection("mood_checkins")
      .where("timestamp", "<", midnight.toISOString())
      .get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch (e) {}
}

async function fetchTodayMoods() {
  try {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const snap = await db
      .collection("mood_checkins")
      .where("timestamp", ">=", midnight.toISOString())
      .get();
    todayMoodsList = snap.docs.map((d) => d.data());
    if (typeof startMoodSlider === "function") startMoodSlider();
  } catch (e) {}
}

// 🌟 5. ระบบ Daily Mood Tracker (เช็คอินความรู้สึก + Live Ticker)
function startMoodSlider() {
  const container = document.getElementById("mood-slider-content");
  if (!container) return;
  clearInterval(moodSlideInterval);

  if (todayMoodsList.length === 0) {
    container.innerHTML =
      '<span class="text-white/80 text-base sm:text-lg font-medium drop-shadow-md">ยังไม่มีใครเช็คอินวันนี้เลย เป็นคนแรกสิ! 🥰</span>';
    return;
  }

  // ปรับสี Text ให้เหมาะกับพื้นหลังแบบ Hero (โทนสว่าง)
  const moodData = {
    happy: { icon: "🥰", text: "มีความสุขพร้อมลุย", color: "text-pink-300" },
    calm: { icon: "😌", text: "ชิลๆ สบายใจ", color: "text-blue-300" },
    tired: {
      icon: "😩",
      text: "รู้สึกเหนื่อยล้าไปนิด",
      color: "text-orange-300",
    },
    sick: {
      icon: "🤒",
      text: "รู้สึกป่วย รักษาสุขภาพนะ",
      color: "text-emerald-300",
    },
  };

  const showSlide = () => {
    const item = todayMoodsList[currentMoodSlide];
    const m = moodData[item.mood] || moodData["calm"];
    const firstName = item.student_name.split(" ")[0];

    // รูปแบบฉายาที่ตัดขอบให้คมชัด สไตล์เกมบนสีเข้ม
    const titleBadge = item.equipped_title
      ? `<span class="bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-950 border-2 border-yellow-200 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-black tracking-wider shadow-md ml-3">"${item.equipped_title}"</span>`
      : "";

    container.style.opacity = "0";
    container.style.transform = "translateY(10px)";

    setTimeout(() => {
      container.innerHTML = `
                <div class="flex items-center gap-4 sm:gap-6 w-full">
                    <span class="text-5xl sm:text-6xl drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">${m.icon}</span>
                    <div class="flex flex-col min-w-0">
                        <div class="flex items-center flex-wrap gap-y-2 mb-1">
                            <b class="text-2xl sm:text-3xl font-black text-white drop-shadow-lg truncate max-w-[200px] sm:max-w-[300px]">${firstName}</b>
                            ${titleBadge}
                        </div>
                        <span class="text-sm sm:text-base font-bold ${m.color} drop-shadow-md tracking-wide">${m.text}</span>
                    </div>
                </div>
            `;

      container.style.opacity = "1";
      container.style.transform = "translateY(0)";
      currentMoodSlide = (currentMoodSlide + 1) % todayMoodsList.length;
    }, 400);
  };

  showSlide();
  if (todayMoodsList.length > 1)
    moodSlideInterval = setInterval(showSlide, 4500);
}

function syncStudentNameMood() {
  const id = document.getElementById("mood-student-id").value.trim();
  const nameField = document.getElementById("mood-student-name");
  if (!id) {
    nameField.value = "";
    document.getElementById("mood-history-list").innerHTML =
      '<div class="bg-white rounded-2xl p-6 text-center border border-slate-200 shadow-sm"><p class="text-sm text-slate-400 font-bold">พิมพ์รหัสนักเรียนเพื่อดูประวัติ</p></div>';
    return;
  }
  const student = teacherDbStudents.find(
    (s) => String(s.student_id) === String(id),
  );
  if (student) {
    nameField.value = student.student_name;
    loadMoodHistory(id);
  } else {
    nameField.value = "ไม่พบรหัสในระบบ";
    document.getElementById("mood-history-list").innerHTML =
      '<div class="bg-white rounded-2xl p-6 text-center border border-slate-200 shadow-sm"><p class="text-sm text-slate-400 font-bold">ไม่พบรหัสในระบบ</p></div>';
  }
}

function selectMood(mood) {
  selectedMoodValue = mood;
  ["happy", "calm", "tired", "sick"].forEach((m) => {
    const btn = document.getElementById(`mood-${m}`);
    btn.classList.remove(`active-${m}`);
    if (m === mood) btn.classList.add(`active-${m}`);
  });
}

async function submitMood() {
  const stuId = document.getElementById("mood-student-id").value.trim();
  const stuName = document.getElementById("mood-student-name").value.trim();
  const note = document.getElementById("mood-note").value.trim();
  if (!stuId || stuName === "ไม่พบรหัสในระบบ" || !stuName)
    return showToast("กรุณากรอกรหัสนักเรียนก่อนครับ", "error");
  if (!selectedMoodValue)
    return showToast("อย่าลืมกดเลือกอารมณ์ของคุณวันนี้ก่อนบันทึกนะ", "error");

  const btn = document.getElementById("btn-submit-mood");
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> กำลังบันทึก...';
  lucide.createIcons();

  try {
    let currentEquipped = "";
    const equipSnap = await db
      .collection("student_equipped_titles")
      .doc(stuId)
      .get();
    if (equipSnap.exists) currentEquipped = equipSnap.data().title_name;

    await db
      .collection("mood_checkins")
      .add({
        student_id: stuId,
        student_name: stuName,
        mood: selectedMoodValue,
        note: note,
        equipped_title: currentEquipped,
        timestamp: new Date().toISOString(),
      });
    const emojiMap = { happy: "🥰", calm: "😌", tired: "😩", sick: "🤒" };
    document.getElementById("mood-success-emoji").textContent =
      emojiMap[selectedMoodValue];
    document.getElementById("mood-success-modal").classList.add("active");
    selectedMoodValue = null;
    document.getElementById("mood-note").value = "";
    selectMood("");
    loadMoodHistory(stuId);
    fetchTodayMoods();
  } catch (e) {
    showToast("เกิดข้อผิดพลาด", "error");
  }
  btn.disabled = false;
  btn.innerHTML = origHtml;
  lucide.createIcons();
}

function closeMoodSuccessModal() {
  document.getElementById("mood-success-modal").classList.remove("active");
  goToHome();
}

async function loadMoodHistory(studentId) {
  const container = document.getElementById("mood-history-list");
  try {
    const snap = await db
      .collection("mood_checkins")
      .where("student_id", "==", studentId)
      .get();
    if (snap.empty) {
      container.innerHTML =
        '<div class="bg-white rounded-2xl p-6 text-center border border-slate-200"><p class="text-sm text-slate-400 font-bold">ยังไม่มีประวัติการเช็คอิน</p></div>';
      return;
    }
    let records = snap.docs
      .map((d) => d.data())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);
    const moodData = {
      happy: {
        icon: "🥰",
        color: "text-pink-600",
        bg: "bg-pink-50",
        border: "border-pink-200",
      },
      calm: {
        icon: "😌",
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
      },
      tired: {
        icon: "😩",
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
      },
      sick: {
        icon: "🤒",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
      },
    };
    container.innerHTML = records
      .map((d) => {
        const m = moodData[d.mood] || moodData["calm"];
        const dateStr = new Date(d.timestamp).toLocaleDateString("th-TH", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return `<div class="flex items-start gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm"><div class="w-14 h-14 rounded-2xl ${m.bg} ${m.border} border flex items-center justify-center text-3xl shrink-0">${m.icon}</div><div class="flex-1 min-w-0 pt-1"><div class="flex justify-between items-start mb-1"><p class="font-bold ${m.color} text-base">${d.equipped_title ? `"${d.equipped_title}" ` : ""}</p><p class="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">${dateStr}</p></div>${d.note ? `<p class="text-sm text-slate-600 mt-2  bg-slate-50 p-3 rounded-xl border border-slate-100"><i data-lucide="quote" class="w-3 h-3 inline text-slate-400 mr-1"></i> ${d.note}</p>` : '<p class="text-xs text-slate-400 italic mt-1">ไม่ได้ระบุข้อความ</p>'}</div></div>`;
      })
      .join("");
    lucide.createIcons();
  } catch (e) {}
}

// ========================================================
// 🌟 6. ระบบ Gacha Shop, Inventory & Showcase โปเกมอนการ์ด
// ========================================================
async function fetchGachaConfig() {
  try {
    const snap = await db.collection("settings").doc("gacha_config").get();
    if (snap.exists) gachaSettings = snap.data();
    const descPrice = document.getElementById("gacha-display-desc-price");
    const btnPrice = document.getElementById("gacha-display-btn-price");
    if (descPrice) descPrice.textContent = gachaSettings.price.toLocaleString();
    if (btnPrice) btnPrice.textContent = gachaSettings.price.toLocaleString();
  } catch (e) {}
}

async function checkShopCoins() {
  const id = document.getElementById("shop-student-id").value.trim();
  if (!id) return showToast("กรุณาใส่รหัสนักเรียน", "error");
  const student = teacherDbStudents.find(
    (s) => String(s.student_id) === String(id),
  );
  if (!student) return showToast("ไม่พบรหัสนักเรียนในระบบ", "error");

  try {
    let spentSnap;
    const query = db.collection("shop_transactions").where("student_id", "==", id);
    
    try {
        // ลองหาใน Cache เครื่องก่อน (ฟรี ไม่เสียโควต้า)
        spentSnap = await query.get({ source: 'cache' });
    } catch (cacheErr) {
        // ถ้าไม่มีใน Cache ค่อยดึงจาก Server จริง
        spentSnap = await query.get();
    }

    let spentCoins = 0;
    spentSnap.forEach((doc) => {
      spentCoins += doc.data().amount;
    });

    currentStudentCoins = Math.floor((student.total || 0) * 10) - spentCoins;
    document.getElementById("shop-student-name").textContent =
      student.student_name;
    document.getElementById("shop-coins").textContent =
      currentStudentCoins.toLocaleString();

    const equipSnap = await db
      .collection("student_equipped_titles")
      .doc(id)
      .get();
    if (equipSnap.exists) {
      document.getElementById("shop-equipped-title").innerHTML =
        `<span class="bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 border border-yellow-300 px-3 py-1 rounded-xl text-xs ml-2 shadow-sm font-black">"${equipSnap.data().title_name}"</span>`;
    } else {
      document.getElementById("shop-equipped-title").innerHTML = "";
    }

    document
      .getElementById("shop-balance-container")
      .classList.remove("hidden");
    await loadMyInventory(id);

    const titlesSnap = await db.collection("gacha_titles").get();
    if (!titlesSnap.empty)
      availableTitles = titlesSnap.docs.map((d) => d.data());
    else availableTitles = [{ name: "นักดองงานมือฉมัง", rarity: "common" }];

    showToast("โหลดข้อมูลสำเร็จ", "success");
  } catch (e) {
    showToast("คำนวณเหรียญผิดพลาด", "error");
  }
}

// ==========================================
// 🌟 ฟังก์ชันสุ่มกาชา (เพิ่มระบบล็อคปุ่ม + ดีเลย์ 3 วินาที + ป้องกันเด็กกดย้ำ)
// ==========================================
let isRollingGacha = false; // ตัวแปรป้องกันการกดรัว

// ==========================================
// 🌟 แอนิเมชัน 4 วินาทีสำหรับตู้กาชา (ธีมสีม่วงเวทมนตร์)
// ==========================================
window.playGachaLoading = async function () {
  let modal = document.getElementById("gacha-loading-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "gacha-loading-modal";
    modal.className =
      "fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[9999] hidden flex flex-col items-center justify-center p-4 transition-opacity opacity-0 duration-500";
    modal.innerHTML = `
            <style>
                @keyframes gacha-spin { 100% { transform: rotate(360deg); } }
                @keyframes gacha-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
                .animate-gacha-spin { animation: gacha-spin 3s linear infinite; }
                .animate-gacha-pulse { animation: gacha-pulse 1s ease-in-out infinite; }
            </style>
            <div class="relative w-48 h-48 flex items-center justify-center mb-8 scale-125">
                <div class="absolute inset-0 border-[6px] border-purple-500/30 rounded-full animate-gacha-spin"></div>
                <div class="absolute inset-4 border-[4px] border-dashed border-fuchsia-400/80 rounded-full animate-gacha-spin" style="animation-direction: reverse; animation-duration: 2.5s;"></div>
                <div class="absolute inset-0 bg-gradient-to-tr from-purple-600/30 to-fuchsia-500/30 rounded-full blur-2xl animate-pulse"></div>
                <div class="text-7xl animate-gacha-pulse drop-shadow-[0_0_25px_rgba(217,70,239,0.8)] relative z-10">🎁</div>
            </div>

            <h3 id="gacha-loading-text" class="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 via-purple-400 to-fuchsia-300 tracking-wider drop-shadow-[0_2px_10px_rgba(192,132,252,0.5)] text-center transition-transform duration-300">
                กำลังเตรียมวงแหวนเวทมนตร์...
            </h3>

            <div class="mt-8 w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <div id="gacha-progress-bar" class="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-1000 ease-linear" style="width: 0%"></div>
            </div>
            <p class="text-purple-400/50 text-xs mt-4 font-bold tracking-[0.3em] uppercase">Gacha Extraction Protocol</p>
        `;
    document.body.appendChild(modal);
  }

  const textEl = document.getElementById("gacha-loading-text");
  const barEl = document.getElementById("gacha-progress-bar");

  barEl.style.width = "0%";
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.remove("opacity-0"), 10);

  // 🌟 ข้อความที่จะสลับโชว์ตอนสุ่มกาชา
  const messages = [
    "จ่ายเหรียญทองเพื่อบูชายัญ...",
    "อัญเชิญพลังแห่งเกลือและทองคำ...",
    "กล่องสมบัติกำลังตอบสนอง...",
    "แสงสว่างวาบขึ้นมาแล้ว!",
  ];

  for (let i = 0; i < messages.length; i++) {
    textEl.textContent = messages[i];
    textEl.style.transform = "scale(1.1)";
    setTimeout(() => (textEl.style.transform = "scale(1)"), 200);
    barEl.style.width = `${((i + 1) / messages.length) * 100}%`;
    await new Promise((r) => setTimeout(r, 1000));
  }
};

window.closeGachaLoading = function () {
  const modal = document.getElementById("gacha-loading-modal");
  if (modal) {
    modal.classList.add("opacity-0");
    setTimeout(() => modal.classList.add("hidden"), 500);
  }
};

// ==========================================
// 🌟 ฟังก์ชันสุ่มกาชาหลัก (อัปเกรดใส่แอนิเมชัน 4 วิ)
// ==========================================

// ==========================================
// 🎲 สุ่มความหายากจาก gachaSettings.rates
// ==========================================
function getRandomRarity() {
  const rates = (gachaSettings && gachaSettings.rates)
    ? gachaSettings.rates
    : { common: 50, rare: 30, epic: 15, legendary: 5 };

  const pool = [];
  for (const [rarity, weight] of Object.entries(rates)) {
    for (let i = 0; i < weight; i++) pool.push(rarity);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ==========================================
// 🎲 สุ่มฉายาจาก availableTitles ตาม rarity
// ==========================================
function getRandomTitle(rarity) {
  const pool = availableTitles.filter((t) => t.rarity === rarity);
  // ถ้าไม่มีฉายาใน rarity นั้น ให้ fallback เป็น common
  const fallback = availableTitles.filter((t) => t.rarity === "common");
  const source = pool.length > 0 ? pool : fallback;
  if (source.length === 0) return null;
  return source[Math.floor(Math.random() * source.length)];
}

async function pullGacha() {
  if (isRollingGacha) return;
  if (!loggedInUser || !loggedInUser.id) {
    showToast("กรุณาเข้าสู่ระบบก่อนสุ่มฉายา", "error");
    return;
  }

  const price = gachaSettings.price || 1000;
  if (currentStudentCoins < price) {
    showToast(`เหรียญไม่พอครับ! (ต้องการ ${price} เหรียญ)`, "error");
    return;
  }

  isRollingGacha = true;
  try {
    currentStudentCoins -= price; // หักเงินเบื้องต้น

    const rarity = getRandomRarity();
    const pulledTitle = getRandomTitle(rarity);

    if (!pulledTitle) throw new Error("ไม่มีฉายาในระดับ " + rarity);

    // 🔍 ตรวจสอบของซ้ำใน Collection student_unlocked_titles
    const inventorySnap = await db.collection("student_unlocked_titles")
      .where("student_id", "==", String(loggedInUser.id))
      .where("title_name", "==", pulledTitle.name)
      .get();

    let isDuplicate = !inventorySnap.empty;
    let refundAmount = 0;

    if (isDuplicate) {
      // 💰 กรณีได้ซ้ำ: คืนเงิน 50%
      refundAmount = Math.floor(price * 0.5);
      currentStudentCoins += refundAmount;
    } else {
      // ✅ กรณีได้ใหม่: บันทึกลงกระเป๋า (student_unlocked_titles)
      await db.collection("student_unlocked_titles").add({
        student_id: String(loggedInUser.id),
        title_name: pulledTitle.name,
        rarity: pulledTitle.rarity,
        unlocked_at: new Date().toISOString()
      });
    }

    // 📝 อัปเดตเหรียญล่าสุดลงใน Firestore
    const studentQuery = await db.collection("students")
      .where("student_id", "==", String(loggedInUser.id)).get();
    
    if (!studentQuery.empty) {
      await db.collection("students").doc(studentQuery.docs[0].id).update({
        coins: currentStudentCoins
      });
    }

    // 🏆 สวมใส่ฉายาที่สุ่มได้ทันที
    await equipTitle(String(loggedInUser.id), pulledTitle.name, pulledTitle.rarity);

    // แสดงผล Modal และอัปเดตหน้าจอ
    if (typeof showGachaResult === "function") {
      showGachaResult(pulledTitle, isDuplicate, refundAmount);
    }
    
    await syncProfileWithGachaData();
    await loadMyInventory(String(loggedInUser.id));

  } catch (error) {
    console.error("Gacha Error:", error);
    showToast("เกิดข้อผิดพลาดในการสุ่ม", "error");
  } finally {
    isRollingGacha = false;
  }
}

function showGachaResult(title, isDuplicate, refundCoins) {
  const modal = document.getElementById("gacha-result-modal");
  const card = document.getElementById("gacha-result-card");
  const bgGlow = document.getElementById("gacha-bg-glow");
  const badge = document.getElementById("gacha-rarity-badge");
  const titleText = document.getElementById("gacha-title-name");

  // 🌟 สร้างข้อความแจ้งเตือนเมื่อได้ของซ้ำ
  const duplicateHtml = isDuplicate
    ? `<div class="bg-white/20 border border-white/50 text-white rounded-xl py-2 px-4 mb-4 relative z-10 inline-block text-sm"><i data-lucide="refresh-cw" class="w-4 h-4 inline mr-1"></i> ได้ฉายาซ้ำ! รับเงินคืน +${refundCoins} เหรียญ</div><br>`
    : "";

  const themes = {
    common: {
      bg: "bg-slate-800",
      glow: "bg-slate-500",
      badgeText: "COMMON",
      badgeColor: "text-slate-300 border-slate-500",
    },
    rare: {
      bg: "bg-blue-900",
      glow: "bg-blue-500",
      badgeText: "RARE",
      badgeColor: "text-blue-300 border-blue-400 bg-blue-900/50",
    },
    epic: {
      bg: "bg-purple-900",
      glow: "bg-fuchsia-500",
      badgeText: "EPIC",
      badgeColor: "text-fuchsia-300 border-fuchsia-400 bg-fuchsia-900/50",
    },
    legendary: {
      bg: "bg-amber-900",
      glow: "bg-yellow-400",
      badgeText: "LEGENDARY!!",
      badgeColor:
        "text-yellow-200 border-yellow-400 bg-yellow-600/50 shadow-[0_0_15px_rgba(250,204,21,0.8)]",
    },
  };
  const t = themes[title.rarity] || themes["common"];

  card.className = `modal-box p-10 rounded-[3rem] w-full max-w-md text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-700 transform scale-100 opacity-100 ${t.bg}`;
  bgGlow.className = `absolute inset-0 opacity-50 blur-3xl ${t.glow}`;
  badge.className = `inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 relative z-10 border ${t.badgeColor}`;
  badge.textContent = t.badgeText;

  // แทรกข้อความซ้ำ (ถ้ามี) เหนือชื่อฉายา
  titleText.innerHTML = `${duplicateHtml}"${title.name}"`;

  modal.classList.add("active");
  lucide.createIcons(); // โหลดไอคอนซ้ำ
}

function closeGachaModal() {
  document.getElementById("gacha-result-modal").classList.remove("active");
  document
    .getElementById("gacha-result-card")
    .classList.replace("scale-100", "scale-50");
  document
    .getElementById("gacha-result-card")
    .classList.replace("opacity-100", "opacity-0");
}

async function loadMyInventory(stuId) {
  const list = document.getElementById("my-titles-list");
  try {
    const snap = await db
      .collection("student_unlocked_titles")
      .where("student_id", "==", stuId)
      .get();
    const equipSnap = await db
      .collection("student_equipped_titles")
      .doc(stuId)
      .get();
    let equippedTitle = equipSnap.exists ? equipSnap.data().title_name : null;

    if (snap.empty) {
      list.innerHTML =
        '<div class="col-span-full p-6 bg-slate-50 rounded-2xl text-center text-slate-400 font-bold border border-slate-200">ยังไม่มีฉายาในกระเป๋า ลองสุ่มกาชาดูสิ!</div>';
      document
        .getElementById("my-inventory-container")
        .classList.remove("hidden");
      return;
    }

    let uniqueTitles = [];
    let seen = new Set();
    snap.docs.forEach((doc) => {
      const d = doc.data();
      if (!seen.has(d.title_name)) {
        seen.add(d.title_name);
        uniqueTitles.push(d);
      }
    });
    const rarityStyles = {
      common: "from-slate-100 to-slate-200 text-slate-700",
      rare: "from-blue-100 to-cyan-100 text-blue-700",
      epic: "from-purple-100 to-fuchsia-200 text-purple-800",
      legendary: "from-yellow-200 to-amber-400 text-yellow-900 shadow-md",
    };

    list.innerHTML = uniqueTitles
      .map((t) => {
        const isEq = t.title_name === equippedTitle;
        const bgStyle = rarityStyles[t.rarity] || rarityStyles["common"];
        return `<div class="bg-gradient-to-br ${bgStyle} rounded-2xl p-4 border ${isEq ? "border-emerald-500 shadow-md ring-2 ring-emerald-200" : "border-white/50 shadow-sm"} relative flex flex-col"><span class="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">${t.rarity}</span><h4 class="font-black text-lg mb-4 leading-tight">"${t.title_name}"</h4><div class="mt-auto">${isEq ? `<button class="w-full py-2.5 bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-default shadow-sm"><i data-lucide="check-circle-2" class="w-4 h-4"></i> ใช้งานอยู่</button>` : `<button onclick="equipTitle('${stuId}', '${t.title_name}', '${t.rarity}')" class="w-full py-2.5 bg-white/60 hover:bg-white text-slate-800 font-bold rounded-xl text-sm transition-colors shadow-sm">สวมใส่</button>`}</div></div>`;
      })
      .join("");
    lucide.createIcons();
    document
      .getElementById("my-inventory-container")
      .classList.remove("hidden");
  } catch (e) {}
}

async function equipTitle(stuId, titleName, rarity) {
  try {
    const student = teacherDbStudents.find(
      (s) => String(s.student_id) === String(stuId),
    );
    const stuName = student ? student.student_name : loggedInUser.name;
    const cls = student ? student.classroom : "-";

    // 🌟 จำรูปภาพของตัวเองเอาไว้
    let avatarUrl = "";
    if (student) {
      avatarUrl =
        student.profileUrl ||
        student.profile_url ||
        student.url ||
        student.avatar ||
        student.profileLink ||
        student.pic ||
        student.image ||
        "";
    }

    await db.collection("student_equipped_titles").doc(stuId).set({
      student_id: stuId,
      student_name: stuName,
      class_section: cls,
      avatarUrl: avatarUrl, 
      title_name: titleName,
      rarity: rarity,
      updated_at: new Date().toISOString(),
    });

    showToast(`สวมใส่ "${titleName}" แล้ว!`, "success");
    checkShopCoins();
    // 💥 เพิ่มบรรทัดนี้ลงไป: สั่งระเบิด Cache ทิ้ง! เพื่อให้กระดานโหลดข้อมูลใหม่ล่าสุดทันที
    localStorage.removeItem("cache_gacha_showcase");
    loadGachaShowcase(); // อัปเดตกระดานทันที

    // 🟢 [เพิ่มบรรทัดนี้ครับ] สั่งซิงค์ข้อมูลใหม่ เพื่อให้ฉายาเด้งไปที่ Profile บ้านและคนออนไลน์ทันที
    syncProfileWithGachaData();

  } catch (e) {
    showToast("สวมใส่ไม่สำเร็จ", "error");
  }
}

// 🌟 โหลดทำเนียบฉายา (เวอร์ชันประหยัดโควต้า + Cache System)
async function loadGachaShowcase() {
  const container = document.getElementById("gacha-showcase-container");
  if (!container) return;

  try {
    // 🛡️ ใช้ระบบ Cache ดึงกระดานฉายา (เก็บไว้อ่านฟรี 2 นาที)
    const equippedTitles = await fetchWithCache("cache_gacha_showcase", db.collection("student_equipped_titles"), 2);

    if (equippedTitles.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">ยังไม่มีใครสวมใส่ฉายาเลย!</p>';
      return;
    }

    // 🛡️ ใช้ระบบ Cache ดึงรายชื่อนักเรียน (รายชื่อเด็กไม่ค่อยเปลี่ยน เก็บไว้อ่านฟรี 30 นาทีเลย!)
    const studentsList = await fetchWithCache("cache_all_students", db.collection("students"), 30);
    
    const activeStudentIds = [];
    studentsList.forEach(data => {
        activeStudentIds.push(String(data.student_id));
        if (!teacherDbStudents.find(s => String(s.student_id) === String(data.student_id))) {
            teacherDbStudents.push(data);
        }
    });

    // 🟢 กรองทำเนียบฉายา
    allUnlockedTitles = [];
    equippedTitles.forEach((d) => {
        const hasTitle = d.title_name && d.title_name.trim() !== "";
        const isStudentActive = activeStudentIds.includes(String(d.student_id));

        if (hasTitle && isStudentActive) {
            allUnlockedTitles.push(d);
        } else if (!isStudentActive && d.student_id) {
            // 🧹 ลบข้อมูลขยะ และสั่งลบ Cache ทิ้งเพื่อให้ดึงใหม่รอบหน้า
            db.collection("student_equipped_titles").doc(String(d.student_id)).delete().catch(()=>{});
            localStorage.removeItem("cache_gacha_showcase");
        }
    });

    if (allUnlockedTitles.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">ยังไม่มีใครสวมใส่ฉายาเลย!</p>';
      return;
    }

    // จัดเรียงตามความหายาก
    const rarityWeight = { legendary: 4, epic: 3, rare: 2, common: 1 };
    allUnlockedTitles.sort((a, b) => (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0));

    renderGachaShowcase();
    
  } catch (e) {
    console.error("Gacha Load Error:", e);
    container.innerHTML = '<p class="text-rose-500 text-sm text-center py-8">เกิดข้อผิดพลาดในการโหลดทำเนียบฉายา</p>';
  }
}

// 🌟 2. เรนเดอร์รายการฉายา (แบบตารางสีขาว สวยหรูระดับ Premium)
function renderGachaShowcase() {
  const container = document.getElementById("gacha-showcase-container");
  const itemsPerPageList = 5;
  const totalPages =
    Math.ceil(allUnlockedTitles.length / itemsPerPageList) || 1;

  if (showcasePage > totalPages) showcasePage = totalPages;
  if (showcasePage < 1) showcasePage = 1;

  const currentItems = allUnlockedTitles.slice(
    (showcasePage - 1) * itemsPerPageList,
    showcasePage * itemsPerPageList,
  );

  container.innerHTML = `
        <div class="w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                        <tr class="bg-slate-50/50 border-b border-slate-200">
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-16">อันดับ</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">นักเรียน</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ฉายาเกียรติยศ</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">ระดับ</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${currentItems.map((item, index) => generateListRowHTML(item, index + (showcasePage - 1) * itemsPerPageList)).join("")}
                    </tbody>
                </table>
            </div>
            
            <div class="bg-white px-6 py-4 flex items-center justify-between border-t border-slate-100 mt-auto">
                <button onclick="changeShowcasePage(-1)" class="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1" ${showcasePage === 1 ? "disabled" : ""}>
                    <i data-lucide="chevron-left" class="w-4 h-4"></i> ก่อนหน้า
                </button>
                <span class="text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    หน้า ${showcasePage} / ${totalPages}
                </span>
                <button onclick="changeShowcasePage(1)" class="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1" ${showcasePage === totalPages ? "disabled" : ""}>
                    ถัดไป <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;
  lucide.createIcons();
}

// 🌟 1. ฟังก์ชันสร้างแถวข้อมูลตาราง (แบบสีขาวสะอาด)
function generateListRowHTML(d, globalIndex) {
  // ปรับสไตล์ให้เข้ากับพื้นหลังสีขาวเน้นความ Minimal หรูหรา
  const rStyles = {
    common: {
      ring: "ring-slate-200",
      text: "text-slate-600",
      badge: "bg-slate-50 text-slate-500 border-slate-200",
      hover: "hover:bg-slate-50/50",
    },
    rare: {
      ring: "ring-blue-300",
      text: "text-blue-600",
      badge: "bg-blue-50 text-blue-600 border-blue-200",
      hover: "hover:bg-blue-50/30",
    },
    epic: {
      ring: "ring-purple-300",
      text: "text-purple-600",
      badge: "bg-purple-50 text-purple-600 border-purple-200",
      hover: "hover:bg-purple-50/30",
    },
    legendary: {
      ring: "ring-amber-400",
      text: "text-amber-600",
      badge:
        "bg-gradient-to-r from-amber-400 to-orange-400 text-white border-amber-500 shadow-sm",
      hover: "hover:bg-amber-50/20",
    },
  };

  const s = rStyles[d.rarity] || rStyles["common"];

  const studentInfo = teacherDbStudents.find(
    (stu) => String(stu.student_id) === String(d.student_id),
  );
  const safeName = (studentInfo ? studentInfo.student_name : d.student_name) || "นักเรียนลึกลับ";
  // 🌟 แก้ไขจุดนี้: ป้องกันชื่อถูกตัดจนเหลือแค่คำว่า "รหัส"
  let shortName = safeName.split(" ")[0];
  if (shortName === "รหัส") {
    shortName = safeName; // ถ้าเป็น "รหัส 12345" ให้ดึงมาแสดงแบบเต็มๆ เลย
  }

  const safeClass =
    d.class_section || (studentInfo ? studentInfo.classroom : "-");

  const isTop3 = globalIndex < 3;
  const rankMedals = ["🥇", "🥈", "🥉"];

  let defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(shortName)}&background=random&color=fff&bold=true`;
  let avatarUrl = d.avatarUrl || defaultAvatar;

  if (studentInfo) {
    let rawUrl =
      studentInfo.profileUrl ||
      studentInfo.profile_url ||
      studentInfo.url ||
      studentInfo.avatar ||
      studentInfo.profileLink ||
      studentInfo.pic ||
      studentInfo.image ||
      studentInfo.profile_pic ||
      studentInfo.photo ||
      studentInfo.picture ||
      studentInfo.img;
    if (!rawUrl) {
      for (let key in studentInfo) {
        let val = studentInfo[key];
        if (
          typeof val === "string" &&
          val.startsWith("http") &&
          (key.toLowerCase().includes("url") ||
            key.toLowerCase().includes("pic") ||
            key.toLowerCase().includes("img") ||
            key.toLowerCase().includes("profile"))
        ) {
          rawUrl = val;
          break;
        }
      }
    }
    if (rawUrl && typeof rawUrl === "string" && rawUrl.startsWith("http")) {
      const driveMatch = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      avatarUrl =
        driveMatch && driveMatch[1]
          ? `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w400`
          : rawUrl;
    }
  }

  return `
    <tr class="transition-colors duration-300 ${s.hover} bg-white group">
        
        <td class="px-6 py-4 whitespace-nowrap text-center">
            <div class="inline-flex items-center justify-center w-8 h-8 rounded-full ${isTop3 ? "bg-amber-50 text-xl shadow-sm border border-amber-100" : "bg-slate-50 text-slate-400 text-xs font-bold border border-slate-100"}">
                ${isTop3 ? rankMedals[globalIndex] : globalIndex + 1}
            </div>
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center gap-4">
                <div class="relative shrink-0">
                    <img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover ring-2 ring-offset-2 ${s.ring} shadow-sm group-hover:scale-105 transition-transform" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(shortName)}&background=random&color=fff&bold=true';">
                    </div>
                <div>
                    <h4 class="text-sm font-bold text-slate-800">${shortName}</h4>
                    <span class="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-100 mt-1 inline-block">ห้อง ${safeClass}</span>
                </div>
            </div>
        </td>
        
        <td class="px-6 py-4">
            <p class="text-sm font-bold ${s.text}">"${d.title_name}"</p>
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap text-right">
            <span class="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${s.badge}">
                ${d.rarity}
            </span>
        </td>
        
    </tr>`;
}

function changeShowcasePage(dir) {
  showcasePage += dir;
  renderGachaShowcase();
}

function renderBigCard() {
  const bigCardCol = document.getElementById("gacha-big-card-col");
  if (!bigCardCol) return;
  let itemToDisplay =
    legendaryTitles.length > 0
      ? legendaryTitles[legendarySlideIndex]
      : allUnlockedTitles.length > 0
        ? allUnlockedTitles[0]
        : null;
  if (itemToDisplay) {
    bigCardCol.innerHTML = `<div class="w-full flex justify-center animate-fade-in">${generateCardHTML(itemToDisplay, "large")}</div>`;
  }
}

// 🌟 2. ฟังก์ชันสร้างการ์ดทำเนียบฉายา (แก้บั๊ก "นักเรียนลึกลับ")
function generateCardHTML(d, size) {
  const rStyles = {
    common: {
      ring: "ring-slate-300",
      text: "text-slate-600",
      badgeBg: "bg-slate-100 text-slate-600 border-slate-200",
      border: "border-slate-200",
    },
    rare: {
      ring: "ring-blue-400",
      text: "text-blue-600",
      badgeBg: "bg-blue-50 text-blue-600 border-blue-200",
      border: "border-blue-200",
    },
    epic: {
      ring: "ring-purple-400",
      text: "text-purple-600",
      badgeBg: "bg-purple-50 text-purple-600 border-purple-200",
      border: "border-purple-200",
    },
    legendary: {
      ring: "ring-amber-400",
      text: "text-amber-600",
      badgeBg: "bg-amber-50 text-amber-600 border-amber-200",
      border: "border-amber-300",
      bgHighlight: "bg-gradient-to-b from-amber-50/50 to-white",
    },
  };

  const s = rStyles[d.rarity] || rStyles["common"];

  // 🎯 ดึงชื่อนักเรียนจากฐานข้อมูลหลัก
  const studentInfo = teacherDbStudents.find(
    (stu) => String(stu.student_id) === String(d.student_id),
  );
  const safeName = (studentInfo ? studentInfo.student_name : d.student_name) || "นักเรียนลึกลับ";
  const shortName = safeName.split(" ")[0];
  const safeClass =
    d.class_section || (studentInfo ? studentInfo.classroom : "-");

  let defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(shortName)}&background=random&color=fff&bold=true`;
  let avatarUrl = d.avatarUrl || defaultAvatar;

  if (studentInfo) {
    let rawUrl =
      studentInfo.profileUrl ||
      studentInfo.profile_url ||
      studentInfo.url ||
      studentInfo.avatar ||
      studentInfo.profileLink ||
      studentInfo.pic ||
      studentInfo.image ||
      studentInfo.profile_pic ||
      studentInfo.photo ||
      studentInfo.picture ||
      studentInfo.img;
    if (!rawUrl) {
      for (let key in studentInfo) {
        let val = studentInfo[key];
        if (
          typeof val === "string" &&
          val.startsWith("http") &&
          (key.toLowerCase().includes("url") ||
            key.toLowerCase().includes("pic") ||
            key.toLowerCase().includes("img") ||
            key.toLowerCase().includes("profile"))
        ) {
          rawUrl = val;
          break;
        }
      }
    }
    if (rawUrl && typeof rawUrl === "string" && rawUrl.startsWith("http")) {
      const driveMatch = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch && driveMatch[1]) {
        avatarUrl = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w400`;
      } else {
        avatarUrl = rawUrl;
      }
    }
  }

  if (size === "large") {
    return `
        <div class="relative bg-white rounded-3xl p-4 flex flex-col items-center justify-center w-full max-w-[150px] mx-auto border-2 ${s.border} shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden ${s.bgHighlight || ""}">
            
            <span class="absolute top-2 right-3 text-[9px] font-bold text-slate-400">ห้อง ${safeClass}</span>

            <div class="relative w-16 h-16 mt-3 mb-3">
                <img src="${avatarUrl}" class="w-full h-full object-cover rounded-full ring-4 ring-offset-2 ${s.ring}" onerror="this.src='${defaultAvatar}'">
                <div class="absolute -bottom-1 -right-1 bg-amber-400 text-white rounded-full p-1 shadow-sm border-2 border-white">
                    <i data-lucide="crown" class="w-3 h-3"></i>
                </div>
            </div>

            <div class="text-center w-full">
                <div class="inline-block px-2 py-0.5 rounded-md border ${s.badgeBg} text-[8px] font-black uppercase tracking-widest mb-1.5">
                    ${d.rarity}
                </div>
                <h4 class="text-sm font-bold text-slate-800  w-full">${shortName}</h4>
                <p class="text-[10px] font-bold ${s.text}  w-full mt-0.5">"${d.title_name}"</p>
            </div>
        </div>`;
  } else {
    return `
        <div class="relative bg-white rounded-2xl p-2.5 flex items-center gap-3 w-full border ${s.border} shadow-sm hover:shadow-md transition-shadow duration-300">
            
            <div class="relative shrink-0 ml-1">
                <img src="${avatarUrl}" class="w-10 h-10 object-cover rounded-full ring-2 ring-offset-1 ${s.ring}" onerror="this.src='${defaultAvatar}'">
                <div class="absolute -bottom-1 -right-2 border ${s.badgeBg} text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-white">
                    ${d.rarity}
                </div>
            </div>

            <div class="flex-1 min-w-0 py-0.5 pr-2">
                 <div class="flex items-center justify-between mb-0.5">
                    <h4 class="text-sm font-bold text-slate-800 ">${shortName}</h4>
                    <span class="text-[9px] font-bold text-slate-400 ml-2 shrink-0">ห้อง ${safeClass}</span>
                 </div>
                 <p class="text-[10px] font-bold ${s.text} ">"${d.title_name}"</p>
            </div>
        </div>`;
  }
}

// ========================================================
// 🌟 7. ระบบเปิดปิดคู่มือการใช้งาน (Info Modal)
// ========================================================
function openInfoModal() {
  document.getElementById("info-modal").classList.add("active");
  lucide.createIcons();
}
function closeInfoModal() {
  document.getElementById("info-modal").classList.remove("active");
}

// ========================================================
// 🌟 8. ระบบเช็คชื่อเข้าเรียนด้วยพิกัด GPS (Geofencing)
// ========================================================

function syncStudentNameAtt() {
  const id = document.getElementById("att-student-id").value.trim();
  const nameField = document.getElementById("att-student-name");
  const classField = document.getElementById("att-classroom");

  if (!id) {
    nameField.value = "";
    classField.value = "";
    return;
  }

  const student = teacherDbStudents.find(
    (s) => String(s.student_id) === String(id),
  );
  if (student) {
    nameField.value = student.student_name + ` (${student.classroom})`;
    classField.value = student.classroom; // เก็บห้องเรียนไว้ส่งให้แอดมิน
    loadAttHistory(id);
  } else {
    nameField.value = "ไม่พบรหัสในระบบ";
    classField.value = "";
  }
}

// สูตรคำนวณระยะทางระหว่างพิกัด 2 จุด (Haversine formula)
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // รัศมีโลก (เมตร)
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // ระยะทางเป็นเมตร
}

// 🌟 1. ฟังก์ชันบันทึกพิกัด (อัปเดตเพิ่มการแสดงพิกัดให้นักเรียนเห็น)
async function submitAttendance() {
  const inputId = document.getElementById("att-student-id").value.trim();
  const stuNameRaw = document.getElementById("att-student-name").value.trim();
  const stuClass = document.getElementById("att-classroom").value.trim();
  const period = document.getElementById("att-period").value;

  const stuName = stuNameRaw.split(" (")[0];

  if (!inputId || stuName === "ไม่พบรหัสในระบบ" || !stuName)
    return showToast("กรุณากรอกรหัสนักเรียนให้ถูกต้องก่อนครับ", "error");

  const studentInfo = teacherDbStudents.find(
    (s) => String(s.student_id) === String(inputId),
  );
  const dbStudentId = studentInfo ? studentInfo.student_id : inputId;

  const btn = document.getElementById("btn-submit-att");
  const statusBox = document.getElementById("att-status-box");
  const origHtml = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML =
    '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> กำลังสแกนหาตัวคุณอยู่ 📡...';
  lucide.createIcons();

  try {
    const sysSnap = await db.collection("settings").doc("system").get();
    if (
      !sysSnap.exists ||
      !sysSnap.data().schoolLat ||
      !sysSnap.data().schoolLng ||
      !sysSnap.data().schoolRadius
    ) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
      lucide.createIcons();
      return showToast(
        "คุณครูยังไม่ได้ตั้งค่าพิกัดโรงเรียนในระบบหลังบ้านครับ",
        "error",
      );
    }

    const sysData = sysSnap.data();
    const SCHOOL_LAT = sysData.schoolLat;
    const SCHOOL_LNG = sysData.schoolLng;
    const MAX_RADIUS_METERS = sysData.schoolRadius;

    const now = new Date();
    const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];

    const checkSnap = await db
      .collection("att_records")
      .where("student_id", "==", dbStudentId)
      .where("date", "==", todayStr)
      .where("period", "==", String(period))
      .get();

    if (!checkSnap.empty) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
      statusBox.className =
        "mb-6 p-4 rounded-2xl text-center font-bold text-sm flex flex-col items-center justify-center gap-2 relative z-10 border bg-yellow-50 text-yellow-600 border-yellow-200 shadow-sm";
      statusBox.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="alert-circle" class="w-5 h-5"></i> วันนี้คุณเช็คชื่อคาบที่ ${period} ไปแล้วครับ!</div>`;
      statusBox.classList.remove("hidden");
      lucide.createIcons();
      return;
    }

    btn.innerHTML =
      '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> กำลังเชื่อมต่อดาวเทียม 🛰️...';

    const getPosition = () => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation)
          reject(new Error("เบราว์เซอร์ไม่รองรับ GPS"));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
    };

    const position = await getPosition();
    const studentLat = position.coords.latitude;
    const studentLng = position.coords.longitude;

    const distance = getDistanceFromLatLonInM(
      studentLat,
      studentLng,
      SCHOOL_LAT,
      SCHOOL_LNG,
    );

    let dbStatus = "absent";
    let displayStatus = "ขาดเรียน";

    if (distance <= MAX_RADIUS_METERS) {
      dbStatus = "present";
      displayStatus = "มาเรียน";
    }

    btn.innerHTML =
      '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> กำลังบันทึกข้อมูล...';

    await db.collection("att_records").add({
      room_id: stuClass,
      student_id: dbStudentId,
      date: todayStr,
      period: String(period),
      status: dbStatus,
      remark: `(ระยะทาง) ห่างเป้าหมาย ${Math.round(distance)} เมตร 🏃`,
      timestamp: new Date().toISOString(),
    });

    // 🌟 ส่วนที่ปรับปรุง: เพิ่มพิกัดลงในกล่องข้อความ
    if (dbStatus === "present") {
      statusBox.className =
        "mb-6 p-4 rounded-2xl text-center font-bold text-sm flex flex-col items-center justify-center gap-2 relative z-10 border bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm";
      statusBox.innerHTML = `
                <div class="flex items-center gap-2"><i data-lucide="check-circle-2" class="w-5 h-5"></i> เช็คชื่อสำเร็จ! (ห่าง ${Math.round(distance)} เมตร)</div>
                <div class="w-full mt-1 pt-2 border-t border-emerald-200/60 text-[10px] flex justify-between items-center opacity-90">
                    <span><i data-lucide="navigation" class="w-3 h-3 inline"></i> พิกัดของคุณ:</span>
                    <span class="font-mono font-black">${studentLat.toFixed(5)}, ${studentLng.toFixed(5)}</span>
                </div>
            `;
    } else {
      statusBox.className =
        "mb-6 p-4 rounded-2xl text-center font-bold text-sm flex flex-col items-center justify-center gap-2 relative z-10 border bg-rose-50 text-rose-600 border-rose-200 shadow-sm";
      statusBox.innerHTML = `
                <div class="flex items-center gap-2"><i data-lucide="x-circle" class="w-5 h-5"></i> นอกพื้นที่! ห่าง ${Math.round(distance)} เมตร (บันทึกเป็น ขาด)</div>
                <div class="w-full mt-1 pt-2 border-t border-rose-200/60 text-[10px] flex justify-between items-center opacity-90">
                    <span><i data-lucide="navigation" class="w-3 h-3 inline"></i> พิกัดของคุณ:</span>
                    <span class="font-mono font-black">${studentLat.toFixed(5)}, ${studentLng.toFixed(5)}</span>
                </div>
            `;
    }

    statusBox.classList.remove("hidden");
    await loadAttHistory(inputId);
    showToast(`บันทึกสถานะ "${displayStatus}" สำเร็จ!`, "success");
  } catch (e) {
    if (e.code === 1)
      showToast('ระบบถูกบล็อก! กรุณากด "อนุญาต" (Allow) GPS ก่อน', "error");
    else if (e.code === 2)
      showToast("ไม่สามารถค้นหาสัญญาณ GPS ได้ ลองขยับไปที่โล่งๆ", "error");
    else if (e.code === 3)
      showToast("ค้นหาพิกัดนานเกินไป เน็ตอาจจะช้า กรุณาลองใหม่", "error");
    else showToast("เกิดข้อผิดพลาด: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
    lucide.createIcons();
  }
}

// 🌟 2. โหลดประวัติ (ดึงจาก att_records อัปเดตให้แสดงแค่ 3 รายการล่าสุด)
async function loadAttHistory(studentId) {
  const container = document.getElementById("att-history-list");
  try {
    const studentInfo = teacherDbStudents.find(
      (s) => String(s.student_id) === String(studentId),
    );
    const dbStudentId = studentInfo ? studentInfo.student_id : studentId;

    const snap = await db
      .collection("att_records")
      .where("student_id", "==", dbStudentId)
      .get();
    if (snap.empty) {
      container.innerHTML =
        '<div class="bg-white rounded-2xl p-6 text-center border border-slate-200 shadow-sm"><p class="text-sm text-slate-400 font-bold">ยังไม่มีประวัติการเข้าเรียน</p></div>';
      return;
    }

    // ✨ เปลี่ยนจาก slice(0, 5) เป็น slice(0, 3) ตรงนี้ครับ
    let records = snap.docs
      .map((d) => d.data())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 3);

    container.innerHTML = records
      .map((d) => {
        const dateStr = new Date(d.timestamp).toLocaleDateString("th-TH", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const isPresent = d.status === "present";
        let displayStatus = isPresent
          ? "มาเรียน"
          : d.status === "absent"
            ? "ขาดเรียน"
            : d.status === "leave"
              ? "ลา"
              : "สาย";

        const colorCls = isPresent
          ? "text-emerald-600 bg-emerald-50 border-emerald-200"
          : "text-rose-600 bg-rose-50 border-rose-200";
        const icon = isPresent ? "check-circle" : "x-circle";
        const distText = d.remark ? d.remark : "";

        return `
            <div class="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <p class="font-bold text-slate-700 text-sm">${dateStr}</p>
                        <span class="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md border border-slate-200">คาบ ${d.period}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${distText}</p>
                </div>
                <div class="px-3 py-1.5 rounded-xl border ${colorCls} text-xs font-bold flex items-center gap-1.5 shadow-sm">
                    <i data-lucide="${icon}" class="w-4 h-4"></i> ${displayStatus}
                </div>
            </div>`;
      })
      .join("");
    lucide.createIcons();
  } catch (e) {}
}

// ========================================================
// 🔐 ระบบ AUTHENTICATION (Login & PIN)
// ========================================================
let loggedInUser = null; // เก็บข้อมูลคนที่ล็อกอินอยู่

// 1. ตรวจสอบการล็อกอินอัตโนมัติเมื่อเปิดหน้าเว็บ (เวอร์ชันสมบูรณ์)
// แก้ไขฟังก์ชันนี้
async function checkAuthSession() {
  const savedSession = sessionStorage.getItem("student_session");
  
  if (savedSession) {
    try {
      const sessionData = JSON.parse(savedSession);
      const studentId = String(sessionData.id);

      const studentSnap = await db
        .collection("students")
        .where("student_id", "==", studentId)
        .get();

      if (studentSnap.empty) {
        console.warn("User not found in database. Clearing session...");
        sessionStorage.removeItem("student_session");
        document.getElementById("auth-login-screen").classList.remove("hidden");
        return;
      }

      const myData = studentSnap.docs[0].data();
      loggedInUser = { id: myData.student_id, name: myData.student_name };
      teacherDbStudents = [myData]; 
      // ==========================================
      // 🟢 [เพิ่มโค้ด Daily Quest ตรงนี้ครับ]
      // ==========================================
      if (typeof checkDailyQuestStatus === 'function') {
        checkDailyQuestStatus(loggedInUser.id);
      }
      // ==========================================
        
      if (typeof setupPresenceSystem === "function") {
        setupPresenceSystem(loggedInUser.id, loggedInUser.name);
      }

      updateAppUIWithUser();
      loadDataFromFirebase();
      fetchTodayMoods();
      loadGachaShowcase();

      document.getElementById("auth-login-screen").classList.add("hidden");
      console.log("Auto-login successful for:", loggedInUser.name);

      // 🌟 เช็คว่าเป็นมือถือหรือไม่
      if (isMobilePhone()) {
        // ถ้าเป็นมือถือ: ให้แสดง Popup เพื่อให้เด็กกดปุ่มเข้าสู่โหมด Fullscreen
        const welcomeModal = document.getElementById("welcome-fullscreen-modal");
        if (welcomeModal) {
          welcomeModal.classList.remove("hidden");
          setTimeout(() => welcomeModal.classList.add("active"), 50);
          if (typeof lucide !== "undefined") lucide.createIcons();
        }
      } else {
        // ถ้าเป็น แท็บเล็ต หรือ PC: ให้เข้าระบบได้เลย ไม่ต้องแสดง Popup
        console.log("Desktop/Tablet device detected: Skipped fullscreen prompt.");
      }

    } catch (e) {
      console.error("Session verification failed:", e);
      sessionStorage.removeItem("student_session");
      document.getElementById("auth-login-screen").classList.remove("hidden");
    }

  } else {
    document.getElementById("auth-login-screen").classList.remove("hidden");
  }
}

// 2. ฟังก์ชันล็อกอิน (เวอร์ชันประหยัดโควต้า)
async function handleLogin() {
  // 🌟 เช็คว่าเป็นมือถือหรือไม่ ถ้าใช่ ค่อยเรียก Fullscreen
  if (isMobilePhone()) {
    enterFullScreen(); 
  }
  const stuId = document.getElementById("login-stu-id").value.trim();
  const pin = document.getElementById("login-stu-pin").value.trim();

  if (!stuId || !pin) return showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error");

  const btn = document.getElementById("btn-login");
  const origText = btn.innerHTML;
  btn.innerHTML =
    '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> กำลังตรวจสอบ...';
  btn.disabled = true;

  try {
    // ก. วิ่งไปเช็คชื่อนักเรียน "แค่คนเดียว" จากฐานข้อมูล (เสียโควต้าแค่ 1 Read)
    const studentSnap = await db
      .collection("students")
      .where("student_id", "==", stuId)
      .get();
    if (studentSnap.empty) throw new Error("ไม่พบรหัสนักเรียนในระบบ");
    const student = studentSnap.docs[0].data();

    // ข. เอาข้อมูลนักเรียนมาเก็บไว้ในเครื่อง เผื่อใช้แสดงผล
    if (!teacherDbStudents.find((s) => s.student_id === stuId)) {
      teacherDbStudents.push(student);
    }

    // ค. ไปเช็ครหัสผ่าน
    const authDoc = await db.collection("student_auth").doc(stuId).get();
    let actualPin = "123456";
    if (authDoc.exists) actualPin = authDoc.data().pin;

    // ง. ตรวจสอบความถูกต้อง
    if (pin !== String(actualPin)) throw new Error("รหัสผ่านไม่ถูกต้อง");

    // จ. บังคับเปลี่ยนรหัสผ่าน
    // - !authDoc.exists  → เข้าครั้งแรก ยังไม่เคยตั้ง PIN
    // - reset_by_teacher → ครูรีเซ็ต PIN ให้แล้ว ต้องตั้งใหม่
    const isTeacherReset = authDoc.exists && authDoc.data().reset_by_teacher === true;
    if (pin === "123456" && (!authDoc.exists || isTeacherReset)) {
      document.getElementById("change-pin-stu-id").value = stuId;
      document
        .getElementById("auth-change-pin-modal")
        .classList.remove("hidden");
      setTimeout(
        () =>
          document
            .getElementById("auth-change-pin-modal")
            .classList.add("active"),
        10,
      );
      return;
    }

    // ฉ. เข้าสู่ระบบ
    loginSuccess(student);
  } catch (e) {
    // 🌟 เปลี่ยนจาก showToast มาเรียกใช้ Popup แทน
    showLoginErrorModal(e.message);
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
    lucide.createIcons();
  }
}

// ฟังก์ชันสำหรับเปิด Popup แจ้งเตือนรหัสผิด
function showLoginErrorModal(message) {
  const modal = document.getElementById("login-error-modal");
  const textEl = document.getElementById("login-error-text");

  if (textEl) textEl.textContent = message; // ดึงข้อความ Error มาแสดง

  if (modal) {
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.add("active"), 10);
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

// ฟังก์ชันสำหรับปิด Popup และล้างช่องรหัสผ่าน
function closeLoginErrorModal() {
  const modal = document.getElementById("login-error-modal");
  if (modal) {
    modal.classList.remove("active");
    setTimeout(() => modal.classList.add("hidden"), 300);
  }
  // ล้างช่องรหัสผ่านให้ว่าง และเอาเมาส์ไปวางรอให้พิมพ์ใหม่เลย
  const pinInput = document.getElementById("login-stu-pin");
  if (pinInput) {
    pinInput.value = "";
    pinInput.focus();
  }
}

// 3. ฟังก์ชันบันทึกการเปลี่ยน PIN ครั้งแรก
async function confirmChangePin() {
  const stuId = document.getElementById("change-pin-stu-id").value;
  const pin1 = document.getElementById("new-pin-1").value.trim();
  const pin2 = document.getElementById("new-pin-2").value.trim();

  if (pin1.length !== 6)
    return showToast("กรุณาตั้งรหัส PIN ให้ครบ 6 หลัก", "error");
  if (pin1 !== pin2) return showToast("รหัสผ่านทั้ง 2 ช่องไม่ตรงกัน", "error");

  const btn = document.getElementById("btn-confirm-pin");
  const origText = btn.innerHTML;
  btn.innerHTML =
    '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> กำลังบันทึก...';
  btn.disabled = true;

  try {
    // บันทึก PIN ลง Firebase พร้อมล้าง flag reset_by_teacher
    await db.collection("student_auth").doc(stuId).set({
      pin: pin1,
      updated_at: new Date().toISOString(),
      reset_by_teacher: false,
    });

    // ปิด Modal
    const modal = document.getElementById("auth-change-pin-modal");
    modal.classList.remove("active");
    setTimeout(() => modal.classList.add("hidden"), 300);

    // เข้าสู่ระบบทันที
    const student = teacherDbStudents.find(
      (s) => String(s.student_id) === String(stuId),
    );
    loginSuccess(student);
  } catch (e) {
    showToast("เกิดข้อผิดพลาด: " + e.message, "error");
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
    lucide.createIcons();
  }
}

// 4. เข้าสู่ระบบสำเร็จ (บันทึกลงเครื่อง)
function loginSuccess(student) {
  // 1. เก็บข้อมูลเบื้องต้นลง LocalStorage เพื่อจำการล็อกอิน
  loggedInUser = { id: student.student_id, name: student.student_name };
  notifyAdminIfEnabled(loggedInUser.name);
  sessionStorage.setItem("student_session", JSON.stringify(loggedInUser));

  // 2. เก็บข้อมูลเต็มของนักเรียนคนนี้ไว้ในคลังข้อมูลของระบบ
  teacherDbStudents = [student];

  // 3. ปิดหน้าต่าง Login และแสดงข้อความต้อนรับ
  document.getElementById("auth-login-screen").classList.add("hidden");
  showToast(`ยินดีต้อนรับ ${student.student_name}`, "success");

  // 🌟 4. เรียกใช้ระบบ Presence (ออนไลน์/ออฟไลน์) ทันทีที่รู้ตัวตนนักเรียน
  setupPresenceSystem(student.student_id, student.student_name);
  
  // 5. เริ่มโหลดข้อมูลส่วนตัวต่างๆ และอัปเดตหน้าจอให้พร้อมใช้งาน
  loadDataFromFirebase();
  fetchTodayMoods();
  loadGachaShowcase();
  
  updateAppUIWithUser();
}



// 6. อัปเดต UI เมื่อล็อกอินสำเร็จ (ล็อกรหัสทุกจุดอัตโนมัติและโหลดข้อมูลส่วนตัว)
function updateAppUIWithUser() {
  if (!loggedInUser) return;

  // --- อัปเดตข้อความทักทายหน้าแรก ---
  const greetingEl = document.getElementById("user-greeting");
  if (greetingEl) greetingEl.innerHTML = `Hi, ${loggedInUser.name}! 👋`;

  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) logoutBtn.classList.remove("hidden");

  // 🌟 1. ระบบเช็คชื่อเข้าเรียน (GPS) - ล็อกรหัสอัตโนมัติ
  const attIdInput = document.getElementById("att-student-id");
  if (attIdInput) {
    attIdInput.value = loggedInUser.id;
    attIdInput.readOnly = true;
    attIdInput.classList.add(
      "bg-slate-100",
      "text-slate-500",
      "cursor-not-allowed",
    );
    if (typeof syncStudentNameAtt === "function") syncStudentNameAtt();
  }

  // 🌟 2. ระบบส่งงาน / การบ้าน - ล็อกรหัสอัตโนมัติ
  const submitIdInput = document.getElementById("inp-student-id");
  if (submitIdInput) {
    submitIdInput.value = loggedInUser.id;
    submitIdInput.readOnly = true;
    submitIdInput.classList.add(
      "bg-slate-100",
      "text-slate-500",
      "cursor-not-allowed",
    );
    if (typeof searchStudentData === "function") searchStudentData();
  }

  // 🌟 3. ระบบเช็คอินความรู้สึกวันนี้ - ล็อกรหัสอัตโนมัติ
  const moodIdInput = document.getElementById("mood-student-id");
  if (moodIdInput) {
    moodIdInput.value = loggedInUser.id;
    moodIdInput.readOnly = true;
    moodIdInput.classList.add(
      "bg-slate-100",
      "text-slate-500",
      "cursor-not-allowed",
    );
    if (typeof syncStudentNameMood === "function") syncStudentNameMood();
  }

  // 🌟 4. ระบบ Reward Shop (เช็คเหรียญ/สุ่มฉายา) - ล็อกรหัสอัตโนมัติ
  const shopIdInput = document.getElementById("shop-student-id");
  if (shopIdInput) {
    shopIdInput.value = loggedInUser.id;
    shopIdInput.readOnly = true;
    shopIdInput.classList.add(
      "bg-slate-100",
      "text-slate-500",
      "cursor-not-allowed",
    );
    if (typeof checkShopCoins === "function") checkShopCoins();
  }

  // 🌟 5. ระบบตลาดนัด Logo (ตั้งขาย/ซื้อลิขสิทธิ์) - ล็อกรหัสอัตโนมัติ
  const logoIdInput = document.getElementById("logo-stu-id");
  if (logoIdInput) {
    logoIdInput.value = loggedInUser.id;
    logoIdInput.readOnly = true;
    logoIdInput.classList.add(
      "bg-slate-100",
      "text-slate-500",
      "cursor-not-allowed",
    );
    if (typeof syncStudentNameLogo === "function") syncStudentNameLogo();
  }

  // 🔔 เรียกใช้งานระบบแจ้งเตือนแบบ Real-time (กระดิ่ง)
  if (typeof listenForNotifications === "function") listenForNotifications();

  // 👤 โหลดรูปโปรไฟล์และกรอบฉายา (ระดับ Legendary/Epic/Rare)
  if (typeof loadUserAvatarWithTitle === "function") loadUserAvatarWithTitle();

  // 🌟 เพิ่มคำสั่งนี้ลงไปเพื่อสั่งให้โหลดโชว์เคสสมบัติ
  if (typeof loadTreasureShowcase === "function") loadTreasureShowcase();

  // 👉 เพิ่มคำสั่งนี้ลงไปเพื่อสั่งให้ระบบดึงข่าวสารมาแสดง! 👈
  if (typeof loadAnnouncements === "function") loadAnnouncements();

  // 🌟 เพิ่มคำสั่งนี้เพื่อดึงเหรียญและฉายาทันทีที่ล็อกอินเสร็จ
  if (typeof syncProfileWithGachaData === "function")
    syncProfileWithGachaData();
  // ⬇️ เพิ่มบรรทัดนี้ลงไปเพื่อสั่งให้ Popup ตรวจสอบการทำงาน ⬇️
  if (typeof checkDailyMoodPopup === "function") checkDailyMoodPopup();

  // 🟢 [เพิ่มใหม่]: สตาร์ทระบบ "ดักฟังคนออนไลน์" ตรงนี้เลย!
  if (typeof listenToOnlineUsers === "function") listenToOnlineUsers();
}

// 🌟 เปิดหน้าต่างยืนยันการออกจากระบบ (ใช้ Modal สไตล์ 2.5D ของระบบหลัก)
function logout() {
  const modal = document.getElementById("logout-confirm-modal");
  if (modal) {
    modal.classList.remove("hidden");
    // หน่วงเวลาเล็กน้อยเพื่อให้ CSS Transition แอนิเมชันเด้งขึ้นมาทำงาน
    setTimeout(() => {
      modal.classList.add("active");
    }, 10);
  }
}

// 7.2 ปิดหน้าต่างยืนยัน Logout
function closeLogoutModal() {
  const modal = document.getElementById("logout-confirm-modal");
  if (modal) {
    modal.classList.remove("active");
    setTimeout(() => modal.classList.add("hidden"), 300);
  }
}

// 7.3 ดำเนินการออกจากระบบจริง
function executeLogout() {
  sessionStorage.removeItem("student_session"); // ลบประวัติล็อกอิน

  // โชว์แจ้งเตือนสวยๆ ก่อนไป
  showToast("กำลังออกจากระบบ...", "success");

  setTimeout(() => {
    location.reload(); // รีเฟรชหน้าเพื่อกลับไปหน้า Login
  }, 800);
}

// ========================================================
// 🔔 ระบบกระดิ่งแจ้งเตือน (Notification Center)
// ========================================================

// 1. ฟังก์ชันเปิด/ปิด หน้าต่างแจ้งเตือน
function toggleNotifications() {
  const dropdown = document.getElementById("notification-dropdown");
  dropdown.classList.toggle("hidden");

  // ถ้าผู้ใช้กดเปิดดูแล้ว ให้ซ่อนจุดสีแดง
  if (!dropdown.classList.contains("hidden")) {
    document.getElementById("notif-badge").classList.add("hidden");
  }
}

// 🌟 ฟังก์ชันตัวแปรสำหรับเก็บสถานะ Listener (เพื่อปิดท่อเวลาออกจากระบบ)
let notificationListener = null;

// 1. ระบบกระดิ่ง (แก้ไขให้ Query เรียบง่ายที่สุดเพื่อเลี่ยง Error Index)
function listenForNotifications() {
  if (!loggedInUser) return;
  const stuId = loggedInUser.id;
  const notifList = document.getElementById("notification-list");
  const badge = document.getElementById("notif-badge");

  if (notificationListener) notificationListener();

  // ถอด orderBy และ inequality ออกทั้งหมดเพื่อให้ Query ผ่านฉลุยโดยไม่ต้องสร้าง Index
  notificationListener = db
    .collection("shop_transactions")
    .where("student_id", "==", stuId)
    .limit(10)
    .onSnapshot((transSnap) => {
      let alerts = [];
      transSnap.forEach((doc) => {
        const d = doc.data();
        if (d.amount > 0 && d.item && d.item.includes("ขายโลโก้")) {
          alerts.push({
            title: "โลโก้ของคุณถูกซื้อแล้ว! 🎉",
            desc: `ได้รับรายได้ +${d.amount} เหรียญ จาก${d.item.replace("ขายโลโก้ให้", "")}`,
            time: d.timestamp,
            icon: "coins",
            color: "text-amber-500",
            bg: "bg-amber-50",
          });
        }
      });

      // เรียงลำดับด้วย JS แทน
      alerts.sort((a, b) => new Date(b.time) - new Date(a.time));

      if (alerts.length === 0) {
        notifList.innerHTML =
          '<div class="p-8 text-center text-slate-400 text-xs font-bold flex flex-col items-center"><i data-lucide="bell-off" class="w-6 h-6 mb-2 opacity-50"></i> ไม่มีการแจ้งเตือนใหม่</div>';
      } else {
        notifList.innerHTML = alerts
          .map(
            (a) => `
                    <div class="p-4 hover:bg-slate-50 transition-colors flex items-start gap-3 border-b border-slate-50 last:border-0">
                        <div class="w-9 h-9 rounded-full ${a.bg} flex items-center justify-center shrink-0 mt-0.5 border border-white shadow-sm"><i data-lucide="${a.icon}" class="w-4 h-4 ${a.color}"></i></div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-slate-800 leading-tight mb-0.5">${a.title}</p>
                            <p class="text-xs text-slate-500 leading-snug">${a.desc}</p>
                        </div>
                    </div>`,
          )
          .join("");
        if (badge) badge.classList.remove("hidden");
      }
      lucide.createIcons();
    });
}

// 3. ฟังก์ชันแปลงเวลาให้น่าอ่าน (เช่น "5 นาทีที่แล้ว")
function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " ปีที่แล้ว";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " เดือนที่แล้ว";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " วันที่แล้ว";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " ชั่วโมงที่แล้ว";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " นาทีที่แล้ว";
  return "เมื่อสักครู่";
}

async function loadUserAvatarWithTitle() {
  if (!loggedInUser) return;
  const stuId = String(loggedInUser.id);

  // หาข้อมูลจากคลังที่โหลดไว้ในข้อ 1
  let student = teacherDbStudents.find((s) => String(s.student_id) === stuId);

  let shortName = student
    ? student.student_name.split(" ")[0]
    : loggedInUser.name
      ? loggedInUser.name.split(" ")[0]
      : "U";
  let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(shortName)}&background=random&color=fff&bold=true`;

  if (student) {
    let rawUrl =
      student.profileUrl ||
      student.profile_url ||
      student.url ||
      student.avatar ||
      student.pic ||
      student.image;
    if (rawUrl && typeof rawUrl === "string" && rawUrl.startsWith("http")) {
      const driveMatch = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      avatarUrl = driveMatch
        ? `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=400`
        : rawUrl;
    }
  }

  // ดึงระดับความแรร์มาวาดกรอบ
  let rarity = "none";
  try {
    const eqSnap = await db
      .collection("student_equipped_titles")
      .doc(stuId)
      .get();
    if (eqSnap.exists) rarity = eqSnap.data().rarity;
  } catch (e) {}

  // เรียกฟังก์ชันวาดสไตล์ (ถ้าไม่มีให้สร้างไว้ล่างสุดของไฟล์ครับ)
  if (typeof applyAvatarStyles === "function")
    applyAvatarStyles(shortName, avatarUrl, rarity);
}



// 🚨 วาง Web App URL ที่ได้จาก Google Apps Script (อันเดียวกับข้างบน) ตรงนี้ครับ
const TREASURE_GAS_URL =
  "https://script.google.com/macros/s/AKfycbw300p4oJDcOkKoVBz3IjXd3jNdoPatiPyjfXSnVJofJQs-DT9jQN5htOxc2CpSny-ueQ/exec";

// ========================================================
// 🌟 ระบบทำเนียบนักล่าสมบัติ (Treasure Hunt Showcase - ดึงจาก Google Sheets)
// ========================================================
let allTreasureHunters = [];
let treasureShowcasePage = 1;
const treasureItemsPerPage = 5;

// ========================================================
// 🌟 โหลดข้อมูลทำเนียบสมบัติ (Migrated to Supabase)
// ========================================================
async function loadTreasureShowcase() {
  const showcaseEl = document.getElementById("treasure-hunters-showcase");
  if (!showcaseEl) return;

  try {
    // 1. ดึงนักเรียนที่ยังมีตัวตนอยู่จริงในระบบ (เช็คจาก Firebase Cache เพื่อความไว)
    const studentsSnap = await db.collection("students").get();
    const activeStudentIds = new Set();
    studentsSnap.docs.forEach(doc => activeStudentIds.add(String(doc.data().student_id)));

    // 2. ดึงข้อมูลภารกิจสมบัติทั้งหมด จาก Supabase (Table: treasure_quests)
    const { data: questsData, error: questError } = await supabase1
      .from('treasure_quests')
      .select('*');
    
    if (questError) throw questError;

    const questsMap = {};
    questsData.forEach(q => questsMap[q.id] = q);

    // 3. ดึงข้อมูลประวัติว่าใครได้อะไรบ้าง จาก Supabase (Table: student_treasures)
    const { data: studentTreasures, error: stError } = await supabase1
      .from('student_treasures')
      .select('*');
      
    if (stError) throw stError;

    if (!studentTreasures || studentTreasures.length === 0) {
      showcaseEl.innerHTML = '<div class="text-slate-400 text-sm font-bold text-center py-10">ยังไม่มีใครรวบรวมสมบัติสำเร็จเลย</div>';
      return;
    }

    // 4. จัดกลุ่มและกรองข้อมูล
    let studentTreasuresMap = {};

    studentTreasures.forEach((data) => {
      const stuId = String(data.student_id);
      
      // กรองเฉพาะนักเรียนที่ยังมีตัวตน
      if (activeStudentIds.has(stuId)) {
        if (!studentTreasuresMap[stuId]) studentTreasuresMap[stuId] = [];
        if (questsMap[data.quest_id]) {
            studentTreasuresMap[stuId].push(questsMap[data.quest_id]);
        }
      }
    });

    // 5. แปลงข้อมูลเตรียมโชว์หน้าจอ
    allTreasureHunters = [];
    for (let stuId in studentTreasuresMap) {
      const treasures = studentTreasuresMap[stuId];
      const studentInfo = teacherDbStudents.find(s => String(s.student_id) === String(stuId));
      
      if (!studentInfo) continue;

      const stuName = studentInfo.student_name.split(" ")[0];
      const avatarUrl = studentInfo.profile_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(stuName)}&background=random&color=fff&bold=true`;

      allTreasureHunters.push({
        student_id: stuId,
        student_name: stuName,
        full_name: studentInfo.student_name,
        classroom: studentInfo.classroom || "-",
        avatarUrl: avatarUrl,
        treasures: treasures,
        treasureCount: treasures.length,
      });
    }

    allTreasureHunters.sort((a, b) => b.treasureCount - a.treasureCount);
    treasureShowcasePage = 1;
    
    // โยนข้อมูลให้ฟังก์ชันวาดการ์ด (ใช้ฟังก์ชันเดิมของคุณครูได้เลย)
    renderTreasureShowcase();

  } catch (error) {
    console.error("Supabase Treasure Showcase Error:", error);
    showcaseEl.innerHTML = '<div class="text-rose-500 text-sm font-bold text-center py-8">เกิดข้อผิดพลาดในการโหลดข้อมูลขุมทรัพย์</div>';
  }
}

function renderTreasureShowcase() {
  const showcaseEl = document.getElementById("treasure-hunters-showcase");
  const searchInput = document.getElementById("search-treasure-hunter");
  const paginationEl = document.getElementById("treasure-pagination");
  if (!showcaseEl) return;

  let searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";
  let filteredHunters = allTreasureHunters;
  if (searchTerm) {
    filteredHunters = allTreasureHunters.filter(
      (h) =>
        h.student_name.toLowerCase().includes(searchTerm) ||
        h.full_name.toLowerCase().includes(searchTerm) ||
        h.student_id.toLowerCase().includes(searchTerm) ||
        h.classroom.toLowerCase().includes(searchTerm),
    );
  }

  const totalPages =
    Math.ceil(filteredHunters.length / treasureItemsPerPage) || 1;
  if (treasureShowcasePage > totalPages) treasureShowcasePage = totalPages;
  if (treasureShowcasePage < 1) treasureShowcasePage = 1;

  const currentHunters = filteredHunters.slice(
    (treasureShowcasePage - 1) * treasureItemsPerPage,
    (treasureShowcasePage - 1) * treasureItemsPerPage + treasureItemsPerPage,
  );

  if (currentHunters.length === 0) {
    showcaseEl.innerHTML =
      '<div class="text-slate-400 text-sm font-bold text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 mt-4">ไม่พบนักล่าสมบัติที่ค้นหา 🕵️‍♂️</div>';
    if (paginationEl) paginationEl.classList.add("hidden");
    return;
  }

  showcaseEl.innerHTML = currentHunters
    .map((h) => {
      // ---------------------------------------------------------------------
      // 1. ส่วนสร้างรูปไอคอนสมบัติ (Treasure Icons) ของแต่ละคน
      // ---------------------------------------------------------------------
      let treasureIcons = h.treasures
        .map((t) => {
          const encTitle = encodeURIComponent(
            t.title ? t.title : "สมบัติลึกลับ",
          );
          const encDesc = encodeURIComponent(
            t.description ? t.description : "",
          );

          let rawCover =
            t.cover_url || t.coverUrl || t.image_url || t.image || "";
          let displayCover = rawCover;
          const coverDriveMatch =
            displayCover.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
            displayCover.match(/id=([a-zA-Z0-9_-]+)/);
          if (coverDriveMatch && coverDriveMatch[1]) {
            displayCover = `https://drive.google.com/thumbnail?id=${coverDriveMatch[1]}&sz=w400`;
          }
          const encImg = encodeURIComponent(displayCover);

          let pieceUrls = [];
          let rawPieces =
            t.piece_images ||
            t.piece_urls ||
            t.pieces ||
            t.images ||
            t.pieceUrls ||
            t.parts ||
            [];
          if (typeof rawPieces === "string") {
            try {
              rawPieces = JSON.parse(rawPieces);
            } catch (e) {
              rawPieces = [];
            }
          }
          const total = parseInt(
            t.total_pieces ||
              t.total ||
              (Array.isArray(rawPieces) && rawPieces.length > 0
                ? rawPieces.length
                : 9),
          );

          if (Array.isArray(rawPieces) && rawPieces.length > 0) {
            pieceUrls = rawPieces.map((p) => {
              if (!p) return "";
              if (typeof p === "string") return p;
              return (
                p.image_url ||
                p.imageUrl ||
                p.url ||
                p.piece_url ||
                p.pieceUrl ||
                p.image ||
                p.cover ||
                p.img ||
                ""
              );
            });
          } else {
            for (let i = 1; i <= total; i++) {
              let pUrl =
                t[`piece${i}_url`] ||
                t[`piece_${i}_url`] ||
                t[`piece_${i}`] ||
                t[`piece${i}`] ||
                t[`img${i}`] ||
                t[`image${i}`] ||
                "";
              pieceUrls.push(pUrl);
            }
          }
          const encPieces = encodeURIComponent(JSON.stringify(pieceUrls));

          // การ์ดไอเทมสมบัติชิ้นเล็กๆ
          return `
            <div onclick="showTreasureDetailModal('${encTitle}', '${encImg}', '${encDesc}', '${encPieces}', ${total})" 
                 class="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative group/icon cursor-pointer border-2 border-slate-200 hover:border-amber-400 hover:-translate-y-1 transition-all duration-300 shadow-sm bg-white">
                
                <img src="${displayCover || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.title)}&background=fef3c7&color=d97706`}" class="w-full h-full object-cover group-hover/icon:scale-110 transition-transform duration-300">
                
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover/icon:opacity-100 transition-opacity duration-300"></div>
                <div class="absolute bottom-1 left-0 right-0 text-center opacity-0 group-hover/icon:opacity-100 transition-opacity duration-300 z-10">
                    <span class="text-[8px] text-white font-bold tracking-wider drop-shadow-md">ดูข้อมูล</span>
                </div>
            </div>`;
        })
        .join("");

      // ---------------------------------------------------------------------
      // 2. ส่วนสร้างการ์ดของนักล่าสมบัติแต่ละคน (Hunter Card)
      // ---------------------------------------------------------------------
      return `
        <div class="relative bg-white rounded-[2rem] p-5 border-2 border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(245,158,11,0.15)] hover:border-amber-200 transition-all duration-300 group flex flex-col md:flex-row gap-5 items-center overflow-hidden shrink-0">
            
            <div class="absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-amber-100/60 to-transparent rounded-bl-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div class="flex items-center gap-4 w-full md:w-[220px] shrink-0 relative z-10">
                <div class="relative shrink-0">
                    <img src="${h.avatarUrl}" class="w-16 h-16 rounded-[1.25rem] object-cover ring-2 ring-offset-2 ring-slate-100 group-hover:ring-amber-400 transition-colors duration-300 shadow-sm">
                    <div class="absolute -bottom-2 -right-2 bg-gradient-to-br from-amber-400 to-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                        <i data-lucide="crown" class="w-3.5 h-3.5"></i>
                    </div>
                </div>
                
                <div class="flex-1 min-w-0">
                    <h4 class="font-black text-slate-800 text-base truncate group-hover:text-amber-600 transition-colors">${h.student_name}</h4>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md border border-slate-200">ห้อง ${h.classroom}</span>
                    </div>
                    <p class="text-xs font-black text-amber-500 mt-1.5 flex items-center gap-1.5 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 w-fit">
                        <i data-lucide="gem" class="w-3.5 h-3.5"></i> สมบัติ ${h.treasureCount} ชิ้น
                    </p>
                </div>
            </div>

            <div class="flex-1 w-full bg-slate-50 rounded-2xl border border-slate-100 p-3.5 relative z-10 shadow-inner">
                <div class="flex gap-3 overflow-x-auto custom-scrollbar pb-2 pt-1 pl-1 pr-4">
                    ${treasureIcons}
                </div>
            </div>
            
        </div>`;

      
    })
    .join("");

  if (paginationEl) {
    paginationEl.classList.remove("hidden");
    document.getElementById("text-page-treasure").textContent =
      `หน้า ${treasureShowcasePage} / ${totalPages}`;

    const btnPrev = document.getElementById("btn-prev-treasure");
    const btnNext = document.getElementById("btn-next-treasure");
    if (btnPrev) btnPrev.disabled = treasureShowcasePage === 1;
    if (btnNext) btnNext.disabled = treasureShowcasePage === totalPages;
  }
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function changeTreasurePage(dir) {
  treasureShowcasePage += dir;
  renderTreasureShowcase();
}

// ========================================================
// 📢 ระบบกระดานข่าวสาร (Slider แบบทีละ 1 ข่าว)
// ========================================================
let allNewsList = [];
let currentNewsIndex = 0;

async function loadAnnouncements() {
  const container = document.getElementById("news-feed-container");
  const list = document.getElementById("news-feed-list");
  if (!container || !list) return;

  try {
    // ดึงข่าวมาเก็บไว้ในเครื่อง
    const snap = await db
      .collection("announcements")
      .orderBy("timestamp", "desc")
      .get();

    if (snap.empty) {
      container.classList.add("hidden");
      return;
    }

    allNewsList = snap.docs.map((doc) => doc.data());
    currentNewsIndex = 0;

    renderCurrentNews(); // สั่งวาดข่าวแรก

    container.classList.remove("hidden");
  } catch (e) {
    console.error("Error loading news:", e);
  }
}

function renderCurrentNews() {
  const list = document.getElementById("news-feed-list");
  const pagination = document.getElementById("news-pagination");

  if (allNewsList.length === 0) return;

  const news = allNewsList[currentNewsIndex];
  const dateStr = new Date(news.timestamp).toLocaleDateString("th-TH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // 🌟 จัดการรูปภาพ ให้พอดีกรอบ ไม่ถูกตัดทิ้ง
  let coverHtml = "";
  if (news.cover_url || news.coverUrl) {
    let displayImgUrl = news.cover_url || news.coverUrl;

    // แปลงลิงก์ Google Drive ให้แสดงผลได้
    if (displayImgUrl.includes("drive.google.com")) {
      const match =
        displayImgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
        displayImgUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1])
        displayImgUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
    }

    coverHtml = `
            <div class="w-full bg-slate-100 rounded-[1.5rem] mb-4 flex justify-center items-center overflow-hidden border border-slate-200">
                <img src="${displayImgUrl}" class="w-full h-auto max-h-[40vh] md:max-h-[50vh] object-contain transition-transform duration-500 hover:scale-[1.02]">
            </div>
        `;
  }

  let attachmentHtml = "";
  if (news.file_url) {
    attachmentHtml = `<a href="${news.file_url}" target="_blank" class="mt-4 py-3 px-5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 border border-indigo-200 shadow-sm"><i data-lucide="download" class="w-4 h-4"></i> ดาวน์โหลดเอกสารแนบ</a>`;
  }

  // สร้างเนื้อหาข่าว 1 ชิ้น
  list.innerHTML = `
        <div class="w-full news-fade-in">
            ${coverHtml}
            <div class="flex flex-col">
                <span class="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-3 bg-rose-50 px-3 py-1.5 rounded-lg self-start border border-rose-100"><i data-lucide="calendar" class="w-3.5 h-3.5 inline"></i> ประกาศเมื่อ ${dateStr}</span>
                <h4 class="font-bold text-slate-800 text-xl md:text-2xl leading-snug mb-3">${news.title}</h4>
                <p class="text-sm text-slate-600 leading-relaxed">${news.content}</p>
                ${attachmentHtml}
            </div>
        </div>
    `;

  // 🌟 วาดปุ่มควบคุมซ้าย-ขวา แบบน่าสนใจ
  const totalNews = allNewsList.length;
  if (totalNews > 1) {
    pagination.classList.remove("hidden");
    pagination.className =
      "mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4";

    const hasPrev = currentNewsIndex > 0;
    const hasNext = currentNewsIndex < totalNews - 1;

    // คลาสของปุ่มแบบ Modern
    const btnPrevClass = hasPrev
      ? "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm hover:-translate-x-1"
      : "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed opacity-50";

    const btnNextClass = hasNext
      ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-indigo-200 hover:translate-x-1"
      : "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed opacity-50";

    pagination.innerHTML = `
            <div class="flex items-center justify-center bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 order-2 sm:order-1">
                ข่าวที่ <span class="text-indigo-600 text-sm mx-1.5">${currentNewsIndex + 1}</span> จาก ${totalNews}
            </div>
            
            <div class="flex gap-3 w-full sm:w-auto order-1 sm:order-2">
                <button onclick="changeNewsSlider(-1)" ${!hasPrev ? "disabled" : ""} class="flex-1 sm:flex-none px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${btnPrevClass}">
                    <i data-lucide="chevron-left" class="w-4 h-4"></i> ก่อนหน้า
                </button>
                <button onclick="changeNewsSlider(1)" ${!hasNext ? "disabled" : ""} class="flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${btnNextClass}">
                    ถัดไป <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>
        `;
  } else {
    pagination.classList.add("hidden");
  }

  if (typeof lucide !== "undefined") lucide.createIcons();
}

// ฟังก์ชันสั่งเปลี่ยนข่าว
window.changeNewsSlider = function (step) {
  currentNewsIndex += step;

  // ป้องกัน index ทะลุ
  if (currentNewsIndex < 0) currentNewsIndex = 0;
  if (currentNewsIndex >= allNewsList.length)
    currentNewsIndex = allNewsList.length - 1;

  renderCurrentNews();
};

function openSchoolArena() {
  // ตรวจสอบว่าระบบเกม 2D เปิดอยู่หรือไม่
  if (currentSystemSettings["toggle_2dgame"] === false) {
    showDisabledModal();
    return;
  }

  if (!loggedInUser || !loggedInUser.id) {
    return showToast("กรุณาเข้าสู่ระบบก่อนเข้าสู่สนามประลองครับ", "error");
  }
  window.open("student-game.html", "_blank");
}

// ⚔️ ฟังก์ชันปิดหน้าลานประลอง
function closeArenaModal() {
  const modal = document.getElementById("arena-dev-modal");
  if (modal) {
    modal.querySelector(".modal-box").classList.remove("scale-100");
    modal.querySelector(".modal-box").classList.add("scale-95");
    setTimeout(() => {
      modal.classList.add("hidden");
    }, 300);
  }
}

window.showTreasureDetailModal = function (
  encodedTitle,
  encodedImg,
  encodedDesc,
  encodedPiecesArray,
  totalPieces,
) {
  const title = decodeURIComponent(encodedTitle || "");
  const imgUrl = decodeURIComponent(encodedImg || "");
  const desc =
    decodeURIComponent(encodedDesc || "") ||
    "ไอเทมระดับตำนานที่ถูกค้นพบโดยนักล่าสมบัติผู้กล้าหาญ";
  const total = parseInt(totalPieces) || 9;

  let piecesArray = [];
  try {
    piecesArray = JSON.parse(decodeURIComponent(encodedPiecesArray || "[]"));
  } catch (e) {
    piecesArray = [];
  }

  document.getElementById("detail-modal-title").textContent = title;
  document.getElementById("detail-modal-img").src =
    imgUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=fef3c7&color=d97706`;
  document.getElementById("detail-modal-desc").textContent = desc;
  document.getElementById("detail-modal-piece-count").textContent =
    `${piecesArray.length}/${total}`;

  const piecesGrid = document.getElementById("detail-modal-pieces-grid");
  const cols = Math.ceil(Math.sqrt(total));

  piecesGrid.className =
    "grid gap-1 p-2 bg-slate-800/80 rounded-xl border border-slate-700 mx-auto w-fit shadow-inner";
  piecesGrid.style.gridTemplateColumns = `repeat(${cols > 0 ? cols : 3}, minmax(0, 1fr))`;

  let piecesHtml = "";
  for (let i = 0; i < total; i++) {
    let pieceImg = piecesArray[i];

    if (pieceImg && pieceImg.trim() !== "") {
      // 🎯 แปลงลิงก์ Google Drive ให้เป็นภาพที่แสดงผลได้
      let displayImg = pieceImg;
      const driveMatch =
        displayImg.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
        displayImg.match(/id=([a-zA-Z0-9_-]+)/);
      if (driveMatch && driveMatch[1]) {
        displayImg = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w800`;
      }

      piecesHtml += `
            <div class="w-16 h-16 sm:w-20 sm:h-20 bg-slate-900 overflow-hidden relative group cursor-pointer border border-slate-700/50 hover:z-10 hover:shadow-lg hover:border-amber-400 transition-all">
                
                <img src="${displayImg}" class="w-full h-full object-cover hover:scale-110 transition-transform duration-300" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                
                <div class="absolute inset-0 hidden flex-col items-center justify-center text-rose-400 bg-slate-900/90 z-10">
                    <i data-lucide="image-off" class="w-5 h-5 mb-1"></i>
                    <span class="text-[7px] font-bold">ลิงก์เสีย</span>
                </div>

                <div class="absolute bottom-0.5 right-0.5 bg-emerald-500 w-4 h-4 rounded-full border border-slate-900 z-20 flex items-center justify-center shadow-md drop-shadow">
                    <i data-lucide="check" class="w-3 h-3 text-white stroke-[3px]"></i>
                </div>
            </div>`;
    } else {
      // ❌ กรณีไม่มีรูปลายแทงโชว์หน้ากากสัญลักษณ์ไว้
      piecesHtml += `
            <div class="w-16 h-16 sm:w-20 sm:h-20 bg-slate-900/50 border border-dashed border-slate-600 flex flex-col items-center justify-center text-slate-500 relative opacity-60">
                <i data-lucide="puzzle" class="w-5 h-5 mb-1 opacity-50"></i>
                <span class="text-[8px] font-bold">${i + 1}</span>
            </div>`;
    }
  }
  piecesGrid.innerHTML = piecesHtml;

  const modal = document.getElementById("treasure-detail-modal");
  modal.classList.remove("hidden");

  setTimeout(() => {
    modal.classList.remove("opacity-0");
    modal.querySelector(".transform").classList.remove("scale-90");
    modal.querySelector(".transform").classList.add("scale-100");
  }, 10);

  if (typeof lucide !== "undefined") lucide.createIcons();
};

window.closeTreasureDetailModal = function () {
  const modal = document.getElementById("treasure-detail-modal");
  modal.classList.add("opacity-0");
  modal.querySelector(".transform").classList.remove("scale-100");
  modal.querySelector(".transform").classList.add("scale-90");

  setTimeout(() => {
    modal.classList.add("hidden");
  }, 300); // รอแอนิเมชันจบค่อยซ่อน
};

// ========================================================
// 🌟 ฟังก์ชันเปิดลิงก์แผนที่สมบัติ (ดึงจาก Backend ครู)
// ========================================================
window.openTreasureMapLink = async function () {
  try {
    showToast("กำลังค้นหาลายแทง...", "info");

    // ไปดึงข้อมูลจาก Document 'system' ใน Collection 'settings'
    const doc = await db.collection("settings").doc("system").get();

    if (doc.exists && doc.data().treasureMapUrl) {
      // ถ้ามีลิงก์ ให้เปิดหน้าต่างใหม่
      window.open(doc.data().treasureMapUrl, "_blank");
    } else {
      // ถ้าครูยังไม่ได้ใส่ลิงก์
      showToast("คุณครูยังไม่ได้อัปเดตลิงก์แผนที่สมบัติครับ", "error");
    }
  } catch (e) {
    console.error(e);
    showToast("เกิดข้อผิดพลาดในการดึงข้อมูลแผนที่", "error");
  }
};

// ========================================================
// 📚 ระบบดึงรหัสนักเรียนเข้าสู่คลังความรู้และห้องสอบ Auto
// ========================================================

function openKnowledgeBase() {
  // เช็คก่อนว่ามีเด็กล็อกอินอยู่ไหม
  if (!loggedInUser || !loggedInUser.id) {
    return showToast("กรุณาเข้าสู่ระบบก่อนใช้งานคลังความรู้ครับ", "error");
  }

  // 🔗 วางลิงก์ "คลังความรู้" ของครูตรงนี้ (ไม่ต้องใส่ ?id= เดี๋ยวระบบเติมให้)
  const baseUrl = "https://sites.google.com/view/your-site-url";

  // สั่งเปิดแท็บใหม่ พร้อมพ่วงรหัสนักเรียนไปที่ท้าย URL อัตโนมัติ (เช่น ?id=12345)
  window.location.href = `${baseUrl}?id=${loggedInUser.id}`;
}

function openExamRoom() {
  // เช็คก่อนว่ามีเด็กล็อกอินอยู่ไหม
  if (!loggedInUser || !loggedInUser.id) {
    return showToast("กรุณาเข้าสู่ระบบก่อนเข้าห้องสอบครับ", "error");
  }

  // 🔗 วางลิงก์ "ห้องสอบ (Web App)" ของครูตรงนี้
  const baseUrl = "https://script.google.com/macros/s/AKfyc.../exec";

  // สั่งเปิดแท็บใหม่ พร้อมพ่วงรหัสนักเรียนไปที่ท้าย URL อัตโนมัติ
  window.location.href = `${baseUrl}?id=${loggedInUser.id}`;
}

// ==========================================
// 🌟 ระบบเลื่อนจอขึ้นบนสุดอัตโนมัติ (เวอร์ชันแก้บั๊กสำหรับกล่อง #app)
// ==========================================
document.addEventListener("click", function (e) {
  // ดักจับว่าสิ่งที่กดคือปุ่มเมนู (footbar หรือเมนูอื่นๆ)
  const isNavBtn =
    e.target.closest('button[onclick^="switchTab"]') ||
    e.target.closest('button[onclick^="goToHome"]');

  if (isNavBtn) {
    setTimeout(() => {
      // 🟢 เปลี่ยนมาสั่งเลื่อนที่กล่อง id="app" แทน window 🟢
      const appContainer = document.getElementById("app");
      if (appContainer) {
        appContainer.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 50);
  }
});

// ========================================================
// 🌟 ระบบ Daily Mood Auto-Popup (เด้งวันละ 1 ครั้ง)
// ========================================================

function checkDailyMoodPopup() {
  if (!loggedInUser || !loggedInUser.id) return;

  // ดึงวันที่ปัจจุบัน
  const today = new Date().toLocaleDateString("th-TH");
  const storageKey = `mood_seen_date_${loggedInUser.id}`;
  const lastSeenDate = localStorage.getItem(storageKey);

  // ถ้ายังไม่เคยเห็น หรือเป็นวันใหม่แล้ว ให้แสดง Popup
  if (lastSeenDate !== today) {
    setTimeout(() => {
      const modal = document.getElementById("daily-mood-modal");
      if (modal) {
        modal.classList.remove("hidden");
        setTimeout(() => modal.classList.add("active"), 50);
        if (typeof lucide !== "undefined") lucide.createIcons();
      }

      // บันทึกวันที่ลงเครื่องไว้เลยว่าวันนี้โชว์ไปแล้ว (เข้ามารอบหน้าจะได้ไม่เด้งกวนใจ)
      localStorage.setItem(storageKey, today);
    }, 1200); // หน่วงเวลา 1.2 วินาทีให้โหลดหน้าเว็บเสร็จก่อนค่อยเด้ง
  }
}

// ฟังก์ชันปิด Popup
function closeDailyMoodModal() {
  const modal = document.getElementById("daily-mood-modal");
  if (modal) {
    modal.classList.remove("active");
    setTimeout(() => modal.classList.add("hidden"), 300);
  }
}

// ฟังก์ชันส่งอารมณ์จาก Popup โดยตรง
async function submitDailyMood(moodValue) {
  // ปิด Popup ทันทีให้เด็กรู้สึกว่าทำงานไว
  closeDailyMoodModal();
  showToast("กำลังส่งความรู้สึกขึ้นกระดาน...", "info");

  try {
    const stuId = loggedInUser.id;
    const stuName = loggedInUser.name;

    let currentEquipped = "";
    const equipSnap = await db
      .collection("student_equipped_titles")
      .doc(stuId)
      .get();
    if (equipSnap.exists) currentEquipped = equipSnap.data().title_name;

    // โยนขึ้น Firebase
    await db.collection("mood_checkins").add({
      student_id: stuId,
      student_name: stuName,
      mood: moodValue,
      note: "", // จาก Popup ไม่มีกล่องให้พิมพ์ข้อความ
      equipped_title: currentEquipped,
      timestamp: new Date().toISOString(),
    });

    // โชว์หน้าต่าง Success แบบเดียวกับเมนูหลัก
    const emojiMap = { happy: "🥰", calm: "😌", tired: "😩", sick: "🤒" };
    document.getElementById("mood-success-emoji").textContent =
      emojiMap[moodValue];
    document.getElementById("mood-success-modal").classList.add("active");

    // รีเฟรชกระดานข่าว
    loadMoodHistory(stuId);
    fetchTodayMoods();
  } catch (e) {
    showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
  }
}

// ========================================================
// 📸 ฟังก์ชันอัปโหลดรูปโปรไฟล์ (เปลี่ยนมาใช้ Supabase)
// ========================================================
async function handleProfileUpload(event) {
  const file = event.target.files[0];
  if (!file || !loggedInUser || !loggedInUser.id) return;

  try {
    showToast("กำลังเตรียมรูปภาพ...", "info");

    // บีบอัดรูปภาพให้เล็กลงก่อน
    const options = {
      maxSizeMB: 0.15,
      maxWidthOrHeight: 500,
      useWebWorker: true,
    };
    const compressedFile = await imageCompression(file, options);

    showToast("กำลังอัปโหลดรูปโปรไฟล์...", "info");

    // 🚀 อัปโหลดเข้า Supabase โดยส่ง file object ไปเลย
    const fileData = await uploadToSupabase(compressedFile, `Profile_${loggedInUser.id}`);
    const newProfileUrl = fileData.url;

    // บันทึกลง Firestore
    const snapshot = await db
      .collection("students")
      .where("student_id", "==", String(loggedInUser.id))
      .get();
      
    if (!snapshot.empty) {
      await db.collection("students").doc(snapshot.docs[0].id).update({
        profile_url: newProfileUrl,
      });
    }

    // อัปเดตหน้าจอทันที
    const avatarImg = document.querySelector("#main-profile-avatar img");
    if (avatarImg) avatarImg.src = newProfileUrl;
    else
      document.getElementById("main-profile-avatar").innerHTML =
        `<img src="${newProfileUrl}" class="w-full h-full rounded-full object-cover">`;

    // เรียกให้ซิงค์ข้อมูลกับบ้าน Profile
    if (typeof syncProfileWithGachaData === "function") syncProfileWithGachaData();

    showToast("เปลี่ยนรูปโปรไฟล์สำเร็จ!", "success");
  } catch (error) {
    console.error(error);
    showToast("อัปโหลดไม่สำเร็จ: " + error.message, "error");
  }
}
// =================================================================
// 🌤️ ระบบข้อความต้อนรับแบบ "รู้ใจ" (Contextual Greetings)
// =================================================================
function generateGreeting(studentName) {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = อาทิตย์, 1 = จันทร์, ..., 6 = เสาร์

  let greetings = [];

  // 🌟 ดักวันพิเศษก่อน (เช่น วันจันทร์, วันศุกร์, เสาร์-อาทิตย์)
  if (day === 1 && hour < 12) {
    greetings = [
      "วันจันทร์อีกแล้วหรอเนี่ย... สู้ๆ นะวัยรุ่น เริ่มต้นสัปดาห์ใหม่ด้วยความสดใส! 💛",
      "เช้าวันจันทร์มันช่างโหดร้าย... แวะมากินกาแฟทิพย์ตรงนี้ก่อนได้นะ ☕",
      "เปิดสัปดาห์ใหม่ โอกาสใหม่... โอกาสที่จะส่งงานให้ตรงเวลาไงล่ะ! หยอกๆ 🤣",
    ];
  } else if (day === 3 && hour > 12) {
    greetings = [
      "วันพุธกลางสัปดาห์แล้ว! อีกนิดเดียวก็จะได้พักแล้ว ฮึบ! 💚",
      "มาถึงครึ่งทางของสัปดาห์แล้ว เก่งมากวัยรุ่น!",
    ];
  } else if (day === 5 && hour >= 15) {
    greetings = [
      "TGIF! วันศุกร์สุดหรรษา พรุ่งนี้ได้นอนตื่นสายแล้วโว้ยยย 💙",
      "เย็นวันศุกร์แบบนี้... ปั่นงานเสร็จแล้วไปตี้ที่ไหนต่อ (ตี้ในเกมนะ) 🎮",
      "รอดชีวิตมาถึงวันศุกร์ได้... เธอคือผู้แข็งแกร่ง!",
    ];
  } else if (day === 0 || day === 6) {
    greetings = [
      "วันหยุดทั้งที... เข้ามาปั่นงานหรอเนี่ย น้ำตาจะไหล ครูภูมิใจมาก 😭",
      "เสาร์อาทิตย์ก็ไม่พักผ่อน สุดยอดคนขยัน 2026!",
      "พักผ่อนบ้างนะวัยรุ่น อย่าหักโหมปั่นงานจนลืมดูซีรีส์ล่ะ 🍿",
    ];
  }
  // 🌟 ถ้าไม่ตรงกับวันพิเศษ ให้เช็คตามช่วงเวลา
  else {
    if (hour >= 0 && hour < 4) {
      // ดึกมาก (00:00 - 03:59)
      greetings = [
        "ดึกป่านนี้แล้ว... ทำไมยังไม่นอนอีก พรุ่งนี้ระวังตื่นสายนะ! 🦉",
        "ตีสองตีสามแล้ววัยรุ่น! ตับไตไส้พุงประท้วงขอพักผ่อนแล้วนะ",
        "ขอบตาคล้ำเป็นแพนด้าแล้วมั้งนั่น ไปนอนได้แล้ว 🐼",
        "แอบปั่นงานดึกขนาดนี้ คุณครูต้องให้เกรด 4 แล้วแหละ 🚀",
        "ผีไม่หลอกหรอก... มีแต่งานนี่แหละที่หลอกหลอน ไปนอนเถอะ!",
      ];
    } else if (hour >= 4 && hour < 7) {
      // เช้าตรู่ (04:00 - 06:59)
      greetings = [
        "ตื่นเช้าขนาดนี้... นกที่ตื่นเช้าคือนกที่ง่วงนอนนะ 🥱",
        "อรุณสวัสดิ์! วันนี้ตื่นมาสูดอากาศ หรือตื่นมาปั่นงานไฟลนก้น? 🌅",
        "ไก่ยังไม่ทันขันเลยวัยรุ่น ฟิตจัด!",
        "เช้าอันสดใส... พร้อมรับแรงกระแทกของวันนี้หรือยัง! ☀️",
      ];
    } else if (hour >= 7 && hour < 12) {
      // สายๆ (07:00 - 11:59)
      greetings = [
        "สวัสดีตอนเช้า! กินข้าวเช้าด้วยนะ เดี๋ยวสมองไม่มีแรงคิดเลข 🍳",
        "พร้อมลุยคาบเรียนหรือยัง? สูดหายใจลึกๆ แล้วไปกันเลย!",
        "เช้านี้หน้าตาสดใส... หรือว่าลอกการบ้านเพื่อนเสร็จแล้ว? หยอกๆ 🤣",
        "อย่าลืมยิ้มรับวันใหม่นะ ยิ้มให้ครู ยิ้มให้กระดานดำด้วย ✨",
      ];
    } else if (hour >= 12 && hour < 13) {
      // เที่ยง (12:00 - 12:59)
      greetings = [
        "พักเที่ยงแล้ว! กองทัพต้องเดินด้วยท้อง ไปหาของอร่อยกินกัน 🍱",
        "กินข้าวให้อิ่มนะ จะได้มีแรงง่วงในคาบบ่าย 😴",
        "มื้อเที่ยงกินอะไรดี? ถ้าคิดไม่ออก... กะเพราหมูกรอบคือคำตอบ!",
      ];
    } else if (hour >= 13 && hour < 17) {
      // บ่าย (13:00 - 16:59)
      greetings = [
        "คาบบ่ายมันช่างง่วงนอน... ฮึบไว้! อย่าเพิ่งหลับคาจอ ☕",
        "แดดบ่ายมันร้อน แต่ก็ไม่ฮอตเท่าความขยันของเธอหรอกนะ 🔥",
        "ช่วงบ่ายสมองเริ่มเบลอ... ดื่มน้ำเยอะๆ ช่วยได้นะวัยรุ่น 💧",
        "ใกล้เลิกเรียนแล้ว อดทนอีกนิด! ฮึบๆ",
      ];
    } else if (hour >= 17 && hour < 20) {
      // เย็น (17:00 - 19:59)
      greetings = [
        "เลิกเรียนแล้ว! ได้เวลากลับไปนอน... หรือว่าต้องปั่นการบ้านต่อ? 🌇",
        "เย็นแล้วๆ รถติดไหมวันนี้? เดินทางกลับบ้านปลอดภัยนะ",
        "ทำงานมาทั้งวัน ให้รางวัลตัวเองด้วยของอร่อยๆ สักมื้อสิ 🧋",
        "แสงเย็นสวยจังเลยนะวันนี้ พักสายตาไปมองท้องฟ้าบ้างสิ",
      ];
    } else {
      // ค่ำ (20:00 - 23:59)
      greetings = [
        "ทำการบ้านเสร็จหรือยัง? อย่าดองไว้นะ เดี๋ยวเป็นดินพอกหางหมู 🐷",
        "ดึกแล้ว พักสายตาจากหน้าจอบ้างนะวัยรุ่น 📱",
        "เตรียมจัดตารางสอนพรุ่งนี้ด้วยนะ จะได้ไม่ลืมหยิบสมุดมา 🎒",
        "อากาศเย็นๆ แบบนี้... น่านอนกว่านั่งปั่นงานเนอะ ว่าไหม? 🌙",
      ];
    }
  }

  // สุ่มข้อความจาก Array
  const randomMsg = greetings[Math.floor(Math.random() * greetings.length)];

  // คืนค่าข้อความพร้อมแทรกชื่อนักเรียน (ถ้ามี)
  if (studentName) {
    return `สวัสดี ${studentName.split(" ")[0]} 👋 <br><span class="text-xs text-indigo-200 font-normal mt-1 inline-block">${randomMsg}</span>`;
  } else {
    return `สวัสดีวัยรุ่น 👋 <br><span class="text-xs text-indigo-200 font-normal mt-1 inline-block">${randomMsg}</span>`;
  }
}


// ==========================================
// 🌟 ฟังก์ชันจัดการ Fullscreen
// ==========================================
function enterFullScreen() {
  const docElm = document.documentElement;
  // เช็คว่าหน้าจอยังไม่ได้อยู่ในโหมด Fullscreen
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (docElm.requestFullscreen) {
      docElm.requestFullscreen().catch((err) => console.log(err));
    } else if (docElm.webkitRequestFullscreen) { /* Safari */
      docElm.webkitRequestFullscreen().catch((err) => console.log(err));
    } else if (docElm.msRequestFullscreen) { /* IE11 */
      docElm.msRequestFullscreen().catch((err) => console.log(err));
    }
  }
}

// ฟังก์ชันเมื่อกดปุ่ม "ตกลง และเข้าเรียน" บน Popup
window.acceptWelcomeFullscreen = function () {
  enterFullScreen(); // เรียก Fullscreen ทันทีที่กดปุ่ม
  const modal = document.getElementById("welcome-fullscreen-modal");
  if (modal) {
    modal.classList.remove("active");
    setTimeout(() => modal.classList.add("hidden"), 300);
  }
};



// 🟢 ระบบ Presence (แสดงสถานะออนไลน์/ออฟไลน์ + Heartbeat)
// ==========================================
let heartbeatInterval = null; // ตัวแปรเก็บรอบการเต้นของหัวใจ

function setupPresenceSystem(studentId, studentName) {
  // เช็คเพื่อป้องกัน Error กรณีโหลด Firebase โหมด Realtime DB ไม่ทัน
  if (typeof firebase === 'undefined' || typeof firebase.database !== 'function') {
    console.warn("Firebase Realtime DB is not loaded yet.");
    return; 
  }
  
  try {
    const rtdb = firebase.database();
    const myStatusRef = rtdb.ref('/onlineUsers/' + studentId);

    // ตรวจสอบการเชื่อมต่อกับเซิร์ฟเวอร์
    rtdb.ref('.info/connected').on('value', (snapshot) => {
      if (snapshot.val() === true) {
        // 🌟 สั่งให้ลบสถานะทิ้งอัตโนมัติ เมื่อนักเรียนปิดหน้าเว็บ
        myStatusRef.onDisconnect().remove();

        // 🚨 ใช้ .update() แทนเพื่อไม่ให้ลบทับรูปภาพและข้อมูลการตกแต่งบ้าน
        myStatusRef.update({
          name: studentName,
          status: "online",
          last_active: Date.now()
        });

        // 🟢 เริ่มระบบ Heartbeat (อัปเดตเวลาทุกๆ 1 นาที เพื่อบอกว่ายังใช้งานเว็บอยู่)
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            myStatusRef.update({ last_active: Date.now() });
        }, 60000);

      } else {
         // ถ้าเน็ตหลุด ให้หยุด Heartbeat
         if (heartbeatInterval) clearInterval(heartbeatInterval);
      }
    });
  } catch (error) {
    console.error("Presence System Error:", error);
  }
}


// ==========================================
// 🎨 ฟังก์ชันช่วยวาดสไตล์กรอบรูปโปรไฟล์ (Avatar Styles)
// ==========================================
function applyAvatarStyles(shortName, avatarUrl, rarity) {
  const greetingEl = document.getElementById("user-greeting");
  const avatarEl = document.getElementById("main-profile-avatar");
  let frameCSS = "bg-slate-200", nameCSS = "text-slate-800";

  if (rarity === "legendary") {
    frameCSS = "bg-gradient-to-b from-yellow-300 via-amber-500 to-yellow-600 p-[4px] shadow-[0_0_20px_rgba(251,191,36,0.8)] ring-2 ring-yellow-200 ring-offset-1 animate-pulse";
    nameCSS = "text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500 drop-shadow-sm";
  } else if (rarity === "epic") {
    frameCSS = "bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 p-[3px] shadow-[0_0_15px_rgba(168,85,247,0.6)]";
    nameCSS = "text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-500";
  } else if (rarity === "rare") {
    frameCSS = "bg-cyan-400 p-[3px] shadow-[0_0_10px_rgba(34,211,238,0.6)]";
    nameCSS = "text-cyan-600";
  }

  if (greetingEl) {
    greetingEl.className = `text-2xl font-bold transition-all duration-300 ${nameCSS}`;
    greetingEl.innerHTML = `Hi, ${shortName}! 👋`;
  }
  if (avatarEl) {
    avatarEl.className = `relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-[250px] lg:h-[250px] shrink-0 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl ${frameCSS}`;
    avatarEl.innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover rounded-full border-2 border-white/90 shadow-sm">`;
  }
}

// =================================================================
// 💾 ระบบ Cache Manager (โล่ป้องกันโควต้า Firebase ทะลุ!)
// =================================================================
async function fetchWithCache(cacheKey, queryRef, expireMinutes = 5) {
  const cacheData = localStorage.getItem(cacheKey);
  const cacheTime = localStorage.getItem(cacheKey + "_time");
  const now = new Date().getTime();

  // 1. ถ้ามี Cache และยังไม่หมดอายุ ให้ดึงจากเครื่องเลย (ฟรี! ไม่เสียโควต้า)
  if (cacheData && cacheTime && (now - parseInt(cacheTime)) < (expireMinutes * 60 * 1000)) {
    console.log(`⚡ โหลดข้อมูล [${cacheKey}] จาก Cache (ฟรี!)`);
    return JSON.parse(cacheData);
  }

  // 2. ถ้าไม่มี Cache หรือหมดอายุแล้ว ค่อยไปดึงจาก Firebase (เสียโควต้า)
  console.log(`☁️ โหลดข้อมูล [${cacheKey}] จาก Firebase...`);
  const snap = await queryRef.get();
  
  // แปลงข้อมูลให้อยู่ในรูป Array ปกติ
  const results = snap.docs.map(doc => doc.data());

  // 3. เซฟเก็บไว้ในเครื่อง เพื่อใช้ฟรีๆ ในรอบถัดไป
  localStorage.setItem(cacheKey, JSON.stringify(results));
  localStorage.setItem(cacheKey + "_time", now.toString());

  return results;
}


// ==========================================
// 🚨 ฟังก์ชันสำหรับหน้าต่าง งานที่ค้างส่ง (Missing Assignments)
// ==========================================
function openMissingAssignmentsModal() {
    const modal = document.getElementById("missing-assignments-modal");
    const listEl = document.getElementById("missing-assignments-list");
    
    if (globalMissingAssignments.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-8 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <i data-lucide="check-circle" class="w-8 h-8 text-emerald-500"></i>
                </div>
                <p class="font-bold text-emerald-700 text-lg">ยอดเยี่ยมมาก!</p>
                <p class="text-xs text-emerald-600 font-medium">คุณไม่มีงานค้างส่งเลยในตอนนี้ 🎉</p>
            </div>
        `;
    } else {
        listEl.innerHTML = globalMissingAssignments.map(task => {
            let actionHtml = "";
            const taskName = task.name || "";

            // 1. ตรวจสอบว่าเป็น สอบกลางภาค หรือ สอบปลายภาค
            if (taskName.includes("สอบกลางภาค") || taskName.includes("สอบปลายภาค")) {
                actionHtml = `
                    <div class="shrink-0 bg-slate-100 text-slate-500 px-3 py-2.5 rounded-xl text-[10px] font-bold border border-slate-200 flex items-center gap-1.5 uppercase tracking-widest cursor-not-allowed">
                        <i data-lucide="x-circle" class="w-3 h-3 text-slate-400"></i> ยังไม่ได้สอบ
                    </div>
                `;
            } 
            // 2. งานจาก Hub: เพิ่มคำว่า "ใบงาน" เข้าไปด้วย
            else if (taskName.includes("แบบฝึกหัด") || taskName.includes("งานที่") || taskName.includes("แบบทดสอบ") || taskName.includes("บทเรียน") || taskName.includes("ใบงาน")) {
                const targetUrl = taskName.includes("แบบทดสอบ") ? 'quiz-student.html' : 'materials-student.html';
                
                actionHtml = `
                    <button onclick="goToClass('${targetUrl}')" class="shrink-0 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all shadow-sm hover:-translate-y-0.5 flex items-center gap-1.5 uppercase tracking-widest">
                        ทำใน HUB <i data-lucide="external-link" class="w-3 h-3"></i>
                    </button>
                `;
            }
            // 3. งานปกติอื่นๆ (ให้แนบไฟล์ส่งผ่านระบบเหมือนเดิม)
            else {
                actionHtml = `
                    <button onclick="goToSubmitMissingTask('${task.name}')" class="shrink-0 bg-rose-500 hover:bg-rose-600 text-white px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all shadow-sm hover:-translate-y-0.5 flex items-center gap-1.5 uppercase tracking-widest">
                        ส่งงาน <i data-lucide="arrow-right" class="w-3 h-3"></i>
                    </button>
                `;
            }

            return `
            <div class="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-rose-200 hover:shadow-md transition-all group">
                <div class="flex gap-3 items-center min-w-0 flex-1 pr-2">
                    <div class="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                        <i data-lucide="file-clock" class="w-5 h-5"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-bold text-slate-800 truncate leading-tight">${task.name}</p>
                        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">คะแนนเต็ม: <span class="text-rose-500">${task.max || 0}</span></p>
                    </div>
                </div>
                ${actionHtml}
            </div>
            `;
        }).join("");
    }
    
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.add("active"), 10);
    if (typeof lucide !== "undefined") lucide.createIcons();
}

function closeMissingAssignmentsModal() {
    const modal = document.getElementById("missing-assignments-modal");
    modal.classList.remove("active");
    setTimeout(() => modal.classList.add("hidden"), 300);
}

// นำทางไปหน้าส่งงานพร้อมเลือกวิชาและงานให้เลย
function goToSubmitMissingTask(taskName) {
    closeMissingAssignmentsModal();
    switchTab('submit');
    switchSubTab('form');
    
    showToast("กรุณาเลือกวิชาและแนบไฟล์ได้เลยครับ", "info");

    // หน่วงเวลาให้โครงสร้าง Dropdown Render เสร็จ แล้ว Auto-Select ให้
    setTimeout(() => {
        const titleSelect = document.getElementById("inp-title");
        if (titleSelect) {
            for(let i = 0; i < titleSelect.options.length; i++) {
                if (titleSelect.options[i].value === taskName) {
                    titleSelect.selectedIndex = i;
                    checkDuplicateSubmission();
                    break;
                }
            }
        }
    }, 600);
}


// 1. 🐾 แผนผังรหัสสัตว์เลี้ยง (รหัสไอเทม : ลิงก์รูป/GIF)
const PET_LIBRARY = {
    "none": "",
    // เปลี่ยนมาใช้รูป Animated 3D สวยๆ ที่โฮสต์บน GitHub (เสถียร ไม่โดนบล็อกแน่นอน)
    "pet_01": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Cat.png", // แมว
    "pet_02": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Dog.png", // หมาน้อย
    "pet_03": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Rabbit.png", // กระต่ายสุดน่ารัก
    "pet_04": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Panda.png", // แพนด้าอ้วนกลม
    "pet_05": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Bear.png", // หมีสีน้ำตาล
    "pet_06": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Fox.png", // สุนัขจิ้งจอก
    "pet_07": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Tiger.png", // เสือน้อยจอมซน
    "pet_08": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Lion.png", // เจ้าป่าสิงโต
    "pet_09": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Monkey.png", // ลิงจอมแก่น
    "pet_10": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Penguin.png", // เพนกวินเดินเตาะแตะ
    "pet_11": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Turtle.png", // เต่าต้วมเตี้ยม
    "pet_12": "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Frog.png" // กบอ๊บๆ
};

// 2. 🟢 ฟังก์ชันอัปเดตรายชื่อคนออนไลน์จาก RTDB
function listenToOnlineUsers() {
    const onlineRef = firebase.database().ref("onlineUsers");
    onlineRef.on("value", (snapshot) => {
        const users = snapshot.val() || {};
        const onlineListEl = document.getElementById("online-list");
        const countEl = document.getElementById("online-count");
        
        let html = "";
        let count = 0;

        Object.keys(users).forEach(uid => {
            const u = users[uid];
            // ตรวจสอบว่ายัง Online อยู่จริง (ไม่เกิน 3 นาที)
            const isReallyOnline = (Date.now() - u.last_active) < 180000;
            if (isReallyOnline) {
                count++;
                html += `
                    <div onclick="openPersonalHome('${uid}')" class="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group pt-2">
                        <div class="relative">
                            <div class="absolute inset-0 bg-gradient-to-tr from-emerald-400 to-sky-400 rounded-full blur opacity-0 group-hover:opacity-60 transition-opacity duration-300"></div>
                            
                            <div class="absolute -top-7 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] px-2.5 py-1 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md shadow-indigo-200 whitespace-nowrap z-30 pointer-events-none group-hover:-translate-y-1">
                                ดูโปรไฟล์เราสิ!
                                <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-indigo-600"></div>
                            </div>

                            <img src="${u.avatar || 'https://via.placeholder.com/100'}" class="w-16 h-16 rounded-full border-2 border-white shadow-md relative z-10 object-cover bg-white group-hover:-translate-y-1 transition-transform duration-300">
                            
                            <div class="absolute -top-1 -left-1 bg-white border border-slate-200 w-6 h-6 flex items-center justify-center rounded-full shadow-sm z-30 group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300">
                                <span class="text-[11px]">👀</span>
                            </div>

                            <div class="absolute bottom-0 right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full z-20 group-hover:-translate-y-1 transition-transform duration-300"></div>
                        </div>
                        
                        <span class="text-[10px] font-bold text-slate-700 truncate w-20 text-center">${u.name}</span>
                    </div>
                `;
            }
        });

        onlineListEl.innerHTML = html || `<p class="text-slate-400 text-xs w-full text-center py-4">ไม่มีใครออนไลน์ในขณะนี้</p>`;
        countEl.innerText = `${count} คน`;
        if (typeof lucide !== "undefined") lucide.createIcons();
    });
}

// 3. 🏠 ฟังก์ชันเปิดหน้าต่างบ้านส่วนตัว
async function openPersonalHome(uid) {
    const modal = document.getElementById("home-modal");
    const content = document.getElementById("home-modal-content");
    
    // ดึงข้อมูลเพื่อนจาก RTDB (หรือ Firestore)
    const snapshot = await firebase.database().ref(`onlineUsers/${uid}`).once("value");
    const data = snapshot.val();
    
    if (!data) return;

    // อัปเดตข้อมูลใน UI
    // อัปเดตข้อมูลใน UI
    document.getElementById("home-name").innerText = data.name || "นักเรียน";
    document.getElementById("home-bio").innerText = data.bio || "ยินดีที่ได้รู้จัก! แวะมาดูบ้านเราได้นะ";
    
    // ✨ จัดการสีของฉายา (Rank / Title)
    const rankEl = document.getElementById("home-rank");
    const titleName = data.rank || 'ผู้เริ่มต้น';
    const titleRarity = data.rarity || 'common';

    let rankClass = "inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3 shadow-sm border ";
    
    if (titleRarity === "legendary") {
        rankClass += "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.3)]";
    } else if (titleRarity === "epic") {
        rankClass += "bg-purple-50 text-purple-600 border-purple-200";
    } else if (titleRarity === "rare") {
        rankClass += "bg-blue-50 text-blue-600 border-blue-200";
    } else {
        rankClass += "bg-slate-100 text-slate-500 border-slate-200"; // common
    }

    rankEl.className = rankClass;
    rankEl.innerHTML = `<i data-lucide="award" class="w-3 h-3 inline pb-0.5"></i> ${titleName}`;
    document.getElementById("home-avatar").src = data.avatar || "https://via.placeholder.com/150";
    
   
    // ========================================================
    // 🟢 [เพิ่มใหม่]: จัดการแสดงผล ชื่อเล่น และ งานอดิเรก
    // ========================================================
    const nickEl = document.getElementById("home-nickname");
    const hobbyEl = document.getElementById("home-hobby");

    if (nickEl) {
        if (data.nickname && data.nickname !== "ยังไม่มีชื่อเล่น") {
            nickEl.innerHTML = `<i data-lucide="user-circle" class="w-3.5 h-3.5"></i> ${data.nickname}`;
            nickEl.classList.remove("hidden");
        } else {
            nickEl.classList.add("hidden"); 
        }
    }

    if (hobbyEl) {
        if (data.hobby && data.hobby !== "ยังไม่ได้ระบุงานอดิเรก") {
            hobbyEl.innerHTML = `<i data-lucide="gamepad-2" class="w-3.5 h-3.5"></i> ${data.hobby}`;
            hobbyEl.classList.remove("hidden");
        } else {
            hobbyEl.classList.add("hidden"); 
        }
    }
    // ========================================================

    // ตั้งค่าธีมสีและแสงฉายา
    const themeColor = data.theme_color || "#94a3b8"; 
    document.getElementById("home-header").style.backgroundColor = themeColor;
    document.getElementById("home-avatar-ring").style.backgroundColor = themeColor;
    content.style.borderColor = themeColor;

    // ตั้งค่าสัตว์เลี้ยง
    const petContainer = document.getElementById("home-pet-container");
    const petImg = PET_LIBRARY[data.equipped_pet || "none"];
    if (petImg) {
        petContainer.innerHTML = `<img src="${petImg}" class="w-14 h-14 object-contain drop-shadow-md">`;
    } else {
        petContainer.innerHTML = "";
    }

    // แสดง Modal
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.add("active"), 10);
    if (typeof lucide !== "undefined") lucide.createIcons();
}

function closeHomeModal() {
    const modal = document.getElementById("home-modal");
    modal.classList.remove("active");
    setTimeout(() => modal.classList.add("hidden"), 300);
}

function syncMyPresence(userProfile) {
    const myUid = userProfile.uid; 
    const myRef = firebase.database().ref(`onlineUsers/${myUid}`);
    
    // 🚨 แก้ไขจาก .set() เป็น .update() เพื่อป้องกันการลบข้อมูล Heartbeat ทิ้ง
    myRef.update({
        name: userProfile.name,
        avatar: userProfile.avatar,
        bio: userProfile.bio || "ใจดี สปอร์ต เชียงราย",
        theme_color: userProfile.theme_color || "#4f46e5",
        equipped_pet: userProfile.equipped_pet || "none",
        rank: userProfile.rank || "นศ. ใหม่",
        rarity: userProfile.rarity || "common", // ✨ เพิ่มบรรทัดนี้
        nickname: userProfile.nickname || "",
        hobby: userProfile.hobby || "",
        last_active: Date.now()
    });
    
    myRef.onDisconnect().remove();
}



async function openEditProfileModal() {
    if (!loggedInUser) {
        if(typeof showToast === 'function') showToast("กรุณาเข้าสู่ระบบก่อน", "error");
        return;
    }
    
    // 🟢 [เพิ่มใหม่]: สั่งวาดไอเทมในกระเป๋าก่อน
    renderInventoryItems();

    const modal = document.getElementById("edit-profile-modal");
    
    try {
        const snap = await db.collection("students").where("student_id", "==", String(loggedInUser.id)).get();
        if (!snap.empty) {
            const data = snap.docs[0].data();
            
            if (document.getElementById("edit-nickname")) document.getElementById("edit-nickname").value = data.nickname || "";
            if (document.getElementById("edit-hobby")) document.getElementById("edit-hobby").value = data.hobby || "";
            document.getElementById("edit-bio").value = data.bio || "";
            
            // 🟢 [เพิ่มใหม่]: สั่งให้รูปในช่องสวมใส่อัปเดตตามข้อมูลฐานข้อมูล (ใส่ true เพื่อไม่ให้มีแอนิเมชันตอนโหลดหน้า)
            if (typeof equipItem === 'function') {
                equipItem('color', data.theme_color || "#94a3b8", true);
                equipItem('pet', data.equipped_pet || "none", true);
            }
        }
    } catch(e) {
        console.error("ดึงข้อมูลโปรไฟล์ไม่สำเร็จ:", e);
    }
    
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.add("active"), 10);
    if (typeof lucide !== "undefined") lucide.createIcons();
}

function closeEditProfileModal() {
    const modal = document.getElementById("edit-profile-modal");
    modal.classList.remove("active");
    setTimeout(() => modal.classList.add("hidden"), 300);
}




// ==========================================
// 💡 ฟังก์ชันเปิด/ปิด หน้าต่างอธิบายระบบตกแต่ง
// ==========================================
function openDecorationInfoModal() {
    const modal = document.getElementById("decoration-info-modal");
    if (modal) {
        modal.classList.remove("hidden");
        // สั่งให้ Lucide วาดไอคอนใหม่ (เผื่อมีไอคอนใน Modal)
        if (typeof lucide !== "undefined") lucide.createIcons();
        setTimeout(() => modal.classList.add("active"), 10);
    }
}

function closeDecorationInfoModal() {
    const modal = document.getElementById("decoration-info-modal");
    if (modal) {
        modal.classList.remove("active");
        setTimeout(() => modal.classList.add("hidden"), 300);
    }
}

// =================================================================
// 🌟 ฟังก์ชันซิงค์ข้อมูลโปรไฟล์ และ คำนวณเหรียญจากการส่งงานอัตโนมัติ
// =================================================================
async function syncProfileWithGachaData() {
  if (typeof loggedInUser === "undefined" || !loggedInUser) return;
  const studentId = loggedInUser.id || loggedInUser.student_id;
  if (!studentId) return;

  try {
    // 1. ดึงข้อมูลนักเรียนด้วย where (ป้องกันบั๊ก Document ID)
    const studentSnap = await db.collection("students").where("student_id", "==", String(loggedInUser.id)).get();
    let data = {};
    if (!studentSnap.empty) {
      data = studentSnap.docs[0].data();
    }

    // --- 1. ระบบคำนวณคะแนนรวมและสถานะการส่งงานอัตโนมัติ ---
    let totalCalculatedScore = 0;
    let submittedCount = 0;
    let submittedTitles = new Set();

    try {
      const subSnap = await db.collection("submissions").where("student_id", "==", String(loggedInUser.id)).get();
      subSnap.forEach((subDoc) => {
        const subData = subDoc.data();
        if (subData.score && !isNaN(subData.score)) {
          totalCalculatedScore += Number(subData.score);
        }
        if (subData.title) {
          submittedTitles.add(subData.title);
        }
      });
      submittedCount = submittedTitles.size;
    } catch (err) {
      console.log("ยังไม่มีประวัติการส่งงาน");
    }

    // --- คำนวณงานที่ค้างส่ง ---
    let totalAssignments = 0;
    globalMissingAssignments = [];
    if (data.course_id && typeof teacherDbCourses !== "undefined" && teacherDbCourses.length > 0) {
      const course = teacherDbCourses.find((c) => String(c.course_id) === String(data.course_id));
      if (course && course.score_categories) {
        try {
          const cats = JSON.parse(course.score_categories);
          totalAssignments = cats.length;
          cats.forEach(cat => {
            if (!submittedTitles.has(cat.name)) {
                globalMissingAssignments.push(cat);
            }
          });
        } catch (e) {}
      }
    }

    let missingCount = totalAssignments - submittedCount;
    if (missingCount < 0) missingCount = 0;

    const statSubEl = document.getElementById("stat-submitted");
    const statMisEl = document.getElementById("stat-missing");
    if (statSubEl) statSubEl.innerText = submittedCount;
    if (statMisEl) statMisEl.innerText = totalAssignments > 0 ? missingCount : "0";

    // --- 2. คำนวณเหรียญ ---
    let coins = data.coins !== undefined ? data.coins : totalCalculatedScore * 10;
    try {
      let spentSnap;
      const query = db.collection("shop_transactions").where("student_id", "==", String(loggedInUser.id));
      try {
          spentSnap = await query.get({ source: 'cache' });
      } catch (cacheErr) {
          spentSnap = await query.get();
      }
      let spentCoins = 0;
      spentSnap.forEach((sDoc) => { spentCoins += sDoc.data().amount; });
      coins -= spentCoins;
    } catch (err) {}

    const formattedCoins = coins.toLocaleString();
    if (document.getElementById("user-coins")) document.getElementById("user-coins").innerText = formattedCoins;
    if (document.getElementById("shop-coins")) document.getElementById("shop-coins").innerText = formattedCoins;
    currentStudentCoins = coins;

    // --- 3. จัดการฉายาและสไตล์ Rarity ---
    let titleName = "นักเรียนเริ่มต้น";
    let rarity = "common";
    try {
      const equipSnap = await db.collection("student_equipped_titles").doc(String(loggedInUser.id)).get();
      if (equipSnap.exists) {
        titleName = equipSnap.data().title_name;
        rarity = equipSnap.data().rarity;
      } else if (data.equipped_title) {
        titleName = data.equipped_title;
        rarity = data.title_rarity || "common";
      }
    } catch (e) {}

    const titleEl = document.getElementById("user-title");
    const shopTitleEl = document.getElementById("shop-equipped-title");
    const cardEl = document.getElementById("user-title-card");
    const iconBg = document.getElementById("user-title-icon-bg");

    if (titleEl) titleEl.innerText = titleName;
    if (shopTitleEl) shopTitleEl.innerHTML = `<span class="bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 border border-yellow-300 px-3 py-1 rounded-xl text-xs ml-2 shadow-sm font-black">"${titleName}"</span>`;

    if (cardEl) {
      cardEl.className = "bg-white p-6 rounded-[2.5rem] border-2 shadow-sm flex items-center gap-6 group/stat transition-all duration-500 relative overflow-hidden";
      if (rarity === "legendary") {
        cardEl.classList.add("border-amber-400", "shadow-[0_0_25px_rgba(245,158,11,0.3)]");
        titleEl.className = "text-xl font-black text-amber-600 animate-pulse";
        if (iconBg) iconBg.className = "relative z-10 w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 shadow-inner";
      } else if (rarity === "epic") {
        cardEl.classList.add("border-purple-400", "shadow-[0_0_20px_rgba(168,85,247,0.2)]");
        titleEl.className = "text-xl font-black text-purple-600";
        if (iconBg) iconBg.className = "relative z-10 w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 shrink-0 shadow-inner";
      } else if (rarity === "rare") {
        cardEl.classList.add("border-blue-400");
        titleEl.className = "text-xl font-black text-blue-600";
        if (iconBg) iconBg.className = "relative z-10 w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0 shadow-inner";
      } else {
        cardEl.classList.add("border-slate-100");
        titleEl.className = "text-xl font-black text-slate-700";
        if (iconBg) iconBg.className = "relative z-10 w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 shadow-inner";
      }
    }

    // --- 4. อัปเดตรูปและชื่อทักทาย พร้อมกรอบตามระดับความหายาก (Rarity) ---
    const fullName = data.student_name || data.name || loggedInUser.name || "นักเรียน"; 
    const shortName = fullName.split(" ")[0];
    const avatarUrl = data.avatar_url || data.profile_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(shortName)}&background=random&size=256`;

    const greetingEl = document.getElementById("user-greeting");
    const avatarEl = document.getElementById("main-profile-avatar");

    let frameCSS = "bg-slate-200";
    let nameCSS = "text-slate-800";

    if (rarity === "legendary") {
      frameCSS = "bg-gradient-to-b from-yellow-300 via-amber-500 to-yellow-600 p-[4px] shadow-[0_0_20px_rgba(251,191,36,0.8)] ring-2 ring-yellow-200 animate-pulse";
      nameCSS = "text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500 font-black drop-shadow-sm";
    } else if (rarity === "epic") {
      frameCSS = "bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 p-[3px] shadow-[0_0_15px_rgba(168,85,247,0.6)]";
      nameCSS = "text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-500 font-black";
    } else if (rarity === "rare") {
      frameCSS = "bg-cyan-400 p-[3px] shadow-[0_0_10px_rgba(34,211,238,0.6)]";
      nameCSS = "text-cyan-600 font-black";
    }

    if (greetingEl) {
      greetingEl.className = `text-2xl font-bold transition-all duration-300 ${nameCSS}`;
      greetingEl.innerHTML = `Hi, ${shortName}! 👋`;
    }

    if (avatarEl) {
      avatarEl.className = `relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-[250px] lg:h-[250px] shrink-0 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl ${frameCSS}`;
      avatarEl.innerHTML = `
        <img src="${avatarUrl}" class="w-full h-full object-cover rounded-full border-4 border-white/90 shadow-sm relative z-10">
        <button onclick="openEditProfileModal()" title="ตกแต่งโปรไฟล์และสัตว์เลี้ยง"
                class="absolute bottom-2 left-2 md:bottom-4 md:left-4 w-12 h-12 md:w-14 md:h-14 bg-slate-800 hover:bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-emerald-500/50 hover:-translate-y-1 hover:scale-110 transition-all duration-300 z-20 border-4 border-white group cursor-pointer">
            <i data-lucide="palette" class="w-5 h-5 md:w-6 md:h-6 group-hover:rotate-12 transition-transform"></i>
        </button>
      `;
      setTimeout(() => { if (typeof lucide !== "undefined") lucide.createIcons(); }, 50);
    }
    // =================================================================
// 🟢 ส่งข้อมูลเข้าระบบ Real-time แสดงผลคนออนไลน์และตกแต่งบ้าน
// =================================================================
if (data) {
    // แปลงลิงก์ Google Drive ให้เป็น Thumbnail ก่อนส่งขึ้น Realtime DB (ป้องกันรูปไม่ขึ้น)
    let finalAvatarUrl = avatarUrl;
    if (finalAvatarUrl && finalAvatarUrl.includes("drive.google.com")) {
        const driveMatch = finalAvatarUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || finalAvatarUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (driveMatch && driveMatch[1]) {
            finalAvatarUrl = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w400`;
        }
    }

    const presenceData = {
        uid: String(loggedInUser.id),
        name: shortName,
        avatar: finalAvatarUrl,
        bio: data.bio || "แวะมาดูบ้านเราได้นะ!",
        theme_color: data.theme_color || "#94a3b8",
        equipped_pet: data.equipped_pet || "none",
        rank: titleName,
        rarity: rarity, // ✨ เพิ่มบรรทัดนี้ เพื่อส่งระดับความหายากไปด้วย
        nickname: data.nickname || "", 
        hobby: data.hobby || ""        
    };
    if (typeof syncMyPresence === "function") {
        syncMyPresence(presenceData);
    }
}
  } catch (error) {
    console.error("Sync Profile Error:", error);
  }
}


// ==========================================
// 🎒 ระบบ Inventory (Drag & Drop + Click to Equip)
// ==========================================

// ชุดสีสำหรับให้เด็กเลือก
const INVENTORY_COLORS = [
    "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#10b981", 
    "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", 
    "#f43f5e", "#64748b", "#334155", "#0f172a", "#475569", "#94a3b8"
];

function renderInventoryItems() {
    // 1. วาดคลังสี
    const colorGrid = document.getElementById('inv-grid-color');
    if(colorGrid) {
        colorGrid.innerHTML = INVENTORY_COLORS.map(c => `
            <div draggable="true" ondragstart="dragItem(event, 'color', '${c}')" onclick="equipItem('color', '${c}')" 
                 class="w-full aspect-square rounded-xl cursor-pointer shadow-sm hover:scale-110 hover:shadow-md transition-all border-2 border-white" 
                 style="background-color: ${c};">
            </div>
        `).join('');
    }

    // 2. วาดคลังสัตว์เลี้ยง (ดึงจาก PET_LIBRARY ที่อาจารย์มีอยู่แล้ว)
    const petGrid = document.getElementById('inv-grid-pet');
    if(petGrid && typeof PET_LIBRARY !== 'undefined') {
        let petHtml = `<div draggable="true" ondragstart="dragItem(event, 'pet', 'none')" onclick="equipItem('pet', 'none')" 
                            class="w-full aspect-square bg-rose-50 rounded-xl flex items-center justify-center cursor-pointer hover:bg-rose-100 border-2 border-rose-200 transition-colors text-[10px] font-black text-rose-500 shadow-sm hover:-translate-y-1">
                            ถอดออก
                       </div>`;

        for (const [key, url] of Object.entries(PET_LIBRARY)) {
            if(key === 'none') continue;
            petHtml += `
            <div draggable="true" ondragstart="dragItem(event, 'pet', '${key}')" onclick="equipItem('pet', '${key}')"
                 class="w-full aspect-square bg-slate-50 rounded-xl flex items-center justify-center cursor-pointer shadow-sm hover:-translate-y-1 hover:shadow-md hover:border-indigo-300 border-2 border-transparent transition-all p-2 relative group bg-white">
                 <img src="${url}" class="w-full h-full object-contain pointer-events-none group-hover:scale-110 transition-transform">
            </div>
            `;
        }
        petGrid.innerHTML = petHtml;
    }
}

// สลับ Tab กระเป๋า
function switchInventoryTab(tab) {
    document.getElementById('inv-grid-color').classList.toggle('hidden', tab !== 'color');
    document.getElementById('inv-grid-pet').classList.toggle('hidden', tab !== 'pet');
    
    document.getElementById('tab-btn-color').className = tab === 'color' 
        ? "flex-1 py-1.5 text-[10px] font-black rounded-lg bg-indigo-50 text-indigo-600 transition-colors uppercase tracking-widest border border-indigo-100"
        : "flex-1 py-1.5 text-[10px] font-black rounded-lg text-slate-500 hover:bg-slate-50 transition-colors uppercase tracking-widest border border-transparent";
        
    document.getElementById('tab-btn-pet').className = tab === 'pet' 
        ? "flex-1 py-1.5 text-[10px] font-black rounded-lg bg-indigo-50 text-indigo-600 transition-colors uppercase tracking-widest border border-indigo-100"
        : "flex-1 py-1.5 text-[10px] font-black rounded-lg text-slate-500 hover:bg-slate-50 transition-colors uppercase tracking-widest border border-transparent";
}

// ฟังก์ชันลาก-วาง (Drag & Drop)
function dragItem(ev, type, value) {
    ev.dataTransfer.setData("type", type);
    ev.dataTransfer.setData("value", value);
}

function allowDrop(ev) {
    ev.preventDefault();
}

function dropItem(ev, targetType) {
    ev.preventDefault();
    const type = ev.dataTransfer.getData("type");
    const value = ev.dataTransfer.getData("value");
    
    if (type === targetType) {
        equipItem(type, value);
    } else {
        if(typeof showToast === 'function') showToast("ยัดไอเทมผิดช่องครับผม! 😅", "error");
    }
}

// ฟังก์ชันหลัก: สวมใส่ไอเทม (อัปเดต UI ทันที)
function equipItem(type, value, skipAnimation = false) {
    if (type === 'color') {
        document.getElementById('edit-color').value = value;
        document.getElementById('equipped-color-visual').style.backgroundColor = value;
        
        if(!skipAnimation) {
            const slot = document.getElementById('equip-slot-color');
            slot.classList.add('ring-4', 'ring-indigo-400', 'scale-110', 'border-transparent');
            setTimeout(() => slot.classList.remove('ring-4', 'ring-indigo-400', 'scale-110', 'border-transparent'), 300);
        }
    } 
    else if (type === 'pet') {
        document.getElementById('edit-pet').value = value;
        const petImg = document.getElementById('equipped-pet-visual');
        
        if (value === 'none' || !PET_LIBRARY[value]) {
            petImg.classList.add('hidden');
        } else {
            petImg.src = PET_LIBRARY[value];
            petImg.classList.remove('hidden');
        }
        
        if(!skipAnimation) {
            const slot = document.getElementById('equip-slot-pet');
            slot.classList.add('ring-4', 'ring-indigo-400', 'scale-110', 'border-transparent');
            setTimeout(() => slot.classList.remove('ring-4', 'ring-indigo-400', 'scale-110', 'border-transparent'), 300);
        }
    }
}


// =================================================================
// 🏫 ระบบ LIVE CLASSROOM (Gamified Attendance)
// =================================================================
const TOTAL_DESKS = 30; // จำนวนโต๊ะทั้งหมดในห้อง
let currentLiveRoomId = "CLASS_01"; // ตั้งเป็นค่าเริ่มต้น หรือดึงจากห้องเรียนเด็ก
let liveClassListener = null;
let amISitting = false;

// 1. ฟังก์ชันเปิดหน้าห้องเรียน และเริ่มดักฟังข้อมูล
function openLiveClassroom() {
    if (!loggedInUser || !loggedInUser.id) {
        return showToast("กรุณาเข้าสู่ระบบก่อนเข้าห้องเรียนครับ", "error");
    }

    switchTab('live-class'); 
    const classPanel = document.getElementById("panel-live-class");
    classPanel.classList.remove("hidden");
    
    // 🌟 [ส่วนที่เพิ่มใหม่] สั่งให้เลื่อนหน้าจอไปที่จุดบนสุดของห้องเรียนแบบนุ่มนวล
    setTimeout(() => {
        classPanel.scrollIntoView({ 
            behavior: 'smooth', // เลื่อนแบบสมูท
            block: 'start'      // ให้ขอบบนของห้องเรียนอยู่ชิดขอบจอบนพอดี
        });
    }, 100); // ใส่ดีเลย์ 0.1 วินาที ให้เบราว์เซอร์วาดกล่องเสร็จก่อนค่อยเลื่อน
    
    const studentInfo = teacherDbStudents.find(s => String(s.student_id) === String(loggedInUser.id));
    if (studentInfo && studentInfo.classroom) {
        const safeRoomName = studentInfo.classroom.replace(/[\/\.]/g, "_");
        currentLiveRoomId = "CLASS_" + safeRoomName; 
        document.getElementById("live-class-title").textContent = `ห้องเรียน ${studentInfo.classroom}`;
    }

    startListeningToDesks();
    startListeningToStatus(); 
}


// 2. ดักฟัง RTDB วาดโต๊ะเรียลไทม์
function startListeningToDesks() {
    const roomRef = firebase.database().ref(`live_classrooms/${currentLiveRoomId}/seats`);
    const teacherRef = firebase.database().ref(`live_classrooms/${currentLiveRoomId}/teacher`);
    
    // ดักฟังสถานะครู
    teacherRef.on("value", (snapshot) => {
        const data = snapshot.val();
        const avatarImg = document.getElementById("live-teacher-avatar");
        const container = document.getElementById("live-teacher-avatar-container");
        const subtitle = document.getElementById("live-class-subtitle");
        const nameTag = document.getElementById("live-teacher-name"); // ตัวแปรสำหรับป้ายชื่อ

        if (data && data.online) {
            avatarImg.src = data.avatar;
            container.classList.add("ring-4", "ring-amber-400", "animate-pulse"); 
            subtitle.innerHTML = `<span class="text-white bg-emerald-500 px-2 py-0.5 rounded-full animate-bounce inline-block mr-1">●</span> ครูประจำวิชาออนไลน์อยู่`;
            
            // อัปเดตชื่อครูบนแท่น
            if (nameTag) {
                const shortName = data.name.split(" ")[0]; // เอาแค่ชื่อหน้า
                nameTag.textContent = `ครู${shortName}`; 
                nameTag.classList.remove("bg-amber-500");
                nameTag.classList.add("bg-emerald-500"); // เปลี่ยนสีป้ายให้ดู Active สีเขียว
            }
        } else {
            avatarImg.src = "https://ui-avatars.com/api/?name=Teacher&background=f59e0b&color=fff";
            container.classList.remove("ring-4", "ring-amber-400", "animate-pulse");
            subtitle.textContent = "คุณครูกำลังรออยู่ เลือกที่นั่งได้เลย!";
            
            // คืนค่าป้ายชื่อกลับเป็นสถานะรอ
            if (nameTag) {
                nameTag.textContent = "ครูผู้สอน";
                nameTag.classList.remove("bg-emerald-500");
                nameTag.classList.add("bg-amber-500");
            }
        }
    });

    // ดักฟังที่นั่งเด็ก (โค้ดเดิม)
    roomRef.on("value", (snapshot) => {
        const seatsData = snapshot.val() || {};
        renderDesks(seatsData);
    });
}
// 3. วาดโต๊ะ 30 ตัว
function renderDesks(seatsData) {
    const container = document.getElementById("live-desks-container");
    let html = "";
    let occupiedCount = 0;
    amISitting = false;

    // หาว่าเรานั่งอยู่ช่องไหน
    for (const key in seatsData) {
        if (seatsData[key].student_id === String(loggedInUser.id)) {
            amISitting = true;
        }
    }

    for (let i = 1; i <= TOTAL_DESKS; i++) {
        // หาว่าโต๊ะเบอร์นี้มีคนนั่งไหม
        let occupant = null;
        for (const key in seatsData) {
            if (seatsData[key].seat_index === i) {
                occupant = seatsData[key];
                occupiedCount++;
                break;
            }
        }

        if (occupant) {
            // โต๊ะมีคนนั่ง
            const isMe = occupant.student_id === String(loggedInUser.id);
            const myBorder = isMe ? "border-emerald-400 ring-4 ring-emerald-200" : "border-white";
            
            html += `
                <div class="desk-25d relative z-0">
                    <img src="${occupant.avatar}" class="avatar-sit ${myBorder}">
                    <div class="student-name-tag ${isMe ? 'text-emerald-600' : ''}">${occupant.name}</div>
                </div>
            `;
        } else {
            // โต๊ะว่าง
            html += `
                <div class="desk-25d relative z-0">
                    <div onclick="claimSeat(${i})" class="seat-empty" title="จองที่นั่งนี้">?</div>
                </div>
            `;
        }
    }

    container.innerHTML = html;
    document.getElementById("live-seat-count").textContent = occupiedCount;
}

// 4. ฟังก์ชันกดจองที่นั่ง
async function claimSeat(seatIndex) {
    if (amISitting) {
        return showToast("คุณนั่งโต๊ะอื่นไปแล้วจ้า! ลุกก่อนถึงจะย้ายได้", "error");
    }

    const studentInfo = teacherDbStudents.find(s => String(s.student_id) === String(loggedInUser.id));
    const shortName = loggedInUser.name.split(" ")[0];
    const avatarUrl = studentInfo?.profile_url || `https://ui-avatars.com/api/?name=${shortName}&background=random`;

    const mySeatRef = firebase.database().ref(`live_classrooms/${currentLiveRoomId}/seats/${loggedInUser.id}`);
    
    // ตั้งค่าให้ลบตัวเองออกอัตโนมัติเมื่อปิดแท็บ (กันผี)
    mySeatRef.onDisconnect().remove();

    await mySeatRef.set({
        student_id: String(loggedInUser.id),
        name: shortName,
        avatar: avatarUrl,
        seat_index: seatIndex,
        timestamp: Date.now()
    });

    showToast("ได้ที่นั่งแล้ว! 🎉", "success");
}

// 5. ลุกออกจากโต๊ะ / ออกจากห้อง
function leaveLiveClass() {
    // ถ้าคนกดออกคือครู ให้ลบสถานะครูด้วย
    if (isLiveTeacher) {
        firebase.database().ref(`live_classrooms/${currentLiveRoomId}/teacher`).remove();
        isLiveTeacher = false;
    }

    const mySeatRef = firebase.database().ref(`live_classrooms/${currentLiveRoomId}/seats/${loggedInUser.id}`);
    mySeatRef.remove();
    
    // ปิดการดักฟัง
    firebase.database().ref(`live_classrooms/${currentLiveRoomId}/seats`).off();
    firebase.database().ref(`live_classrooms/${currentLiveRoomId}/teacher`).off();
    firebase.database().ref(`live_classrooms/${currentLiveRoomId}/status`).off();
    
    document.getElementById("panel-live-class").classList.add("hidden");
    goToHome();
}

// =================================================================
// 👨‍🏫 ระบบควบคุมของครู (Teacher Live Control)
// =================================================================
let isLiveTeacher = false;

// 1. เปิดหน้าต่างใส่รหัส
function openTeacherLogin() {
    if (isLiveTeacher) {
        // ถ้าล็อกอินแล้ว กดอีกทีจะเป็นการซ่อน/โชว์แผงควบคุม
        document.getElementById('live-teacher-controls').classList.toggle('hidden');
        return;
    }
    const modal = document.getElementById('live-teacher-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);
    document.getElementById('live-teacher-pwd').value = "";
    document.getElementById('live-teacher-pwd').focus();
}

function closeTeacherLogin() {
    const modal = document.getElementById('live-teacher-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// 2. ตรวจสอบรหัสผ่าน
// 2. ตรวจสอบรหัสผ่าน
function verifyLiveTeacher(e) {
    e.preventDefault();
    const pwd = document.getElementById('live-teacher-pwd').value;
    
    if (btoa(pwd) === 'YmVlcg==') { // รหัส beer
        isLiveTeacher = true;
        closeTeacherLogin();
        
        // ค้นหารูปโปรไฟล์ของคนที่ล็อกอินอยู่
        const userInfo = teacherDbStudents.find(s => String(s.student_id) === String(loggedInUser.id));
        let myAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(loggedInUser.name)}&background=f59e0b&color=fff`;
        if (userInfo && (userInfo.profile_url || userInfo.avatar_url || userInfo.url)) {
             myAvatar = userInfo.profile_url || userInfo.avatar_url || userInfo.url;
        }

        // 🚩 ส่งสถานะครูออนไลน์ไปที่ RTDB พร้อมรูปจริงและชื่อจริง
        const teacherRef = firebase.database().ref(`live_classrooms/${currentLiveRoomId}/teacher`);
        teacherRef.onDisconnect().remove(); 
        
        teacherRef.set({
            online: true,
            name: loggedInUser.name,
            avatar: myAvatar, // ใช้รูปจริงของครูที่ดึงมา
            last_active: Date.now()
        });

        document.getElementById('live-teacher-controls').classList.remove('hidden');
        showToast("เข้าสู่โหมดครูผู้สอนเรียบร้อย!", "success");
    } else {
        showToast("รหัสผ่านไม่ถูกต้อง!", "error");
    }
}

// 3. ฟังก์ชันกวาดเด็กเข้า Database
async function teacherSaveLiveAttendance() {
    const period = document.getElementById('live-class-period').value;
    if (!period) return showToast("กรุณาเลือกคาบเรียนก่อนกดเช็คชื่อครับ", "error");

    const btn = document.getElementById('btn-teacher-save-att');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> บันทึก...';
    lucide.createIcons();

    try {
        // 1. ดึงข้อมูลนักเรียนที่กำลังนั่งโต๊ะอยู่ "ณ เสี้ยววินาทีนี้" จาก RTDB
        const snapshot = await firebase.database().ref(`live_classrooms/${currentLiveRoomId}/seats`).once('value');
        const seatsData = snapshot.val() || {};
        const seatedStudents = Object.values(seatsData);

        if (seatedStudents.length === 0) {
            throw new Error("ยังไม่มีนักเรียนนั่งที่โต๊ะเลยครับ");
        }

        // 2. ตั้งค่าเวลาและวันที่ให้ตรงกับระบบหลัก (ดึง Date ของวันนี้)
        const now = new Date();
        const todayISO = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        let savedCount = 0;
        let duplicateCount = 0;

        // 3. วนลูปเช็คชื่อเด็กทีละคน
        for (const student of seatedStudents) {
            // หาข้อมูลห้องจากฐานข้อมูลหลัก
            const stuInfo = teacherDbStudents.find(s => String(s.student_id) === String(student.student_id));
            const roomId = stuInfo ? stuInfo.classroom : "ไม่ระบุ";

            // ตรวจสอบว่าเด็กคนนี้ถูกเช็คชื่อใน "วันที่" และ "คาบ" นี้ไปแล้วหรือยัง (ป้องกันเบิ้ล)
            const checkSnap = await db.collection("att_records")
                .where("student_id", "==", String(student.student_id))
                .where("date", "==", todayISO)
                .where("period", "==", String(period))
                .get();

            if (checkSnap.empty) {
                // ถ้ายังไม่เช็ค ให้บันทึกลง Firestore
                await db.collection("att_records").add({
                    room_id: roomId,
                    student_id: String(student.student_id),
                    date: todayISO,
                    period: String(period),
                    status: "present",
                    remark: "✅ เช็คชื่อโดยครู (Live Class)", // หมายเหตุชัดเจนว่าครูเป็นคนกดให้
                    timestamp: new Date().toISOString()
                });
                savedCount++;
            } else {
                duplicateCount++; // นับยอดคนซ้ำ
            }
        }

        // 4. รายงานผล
        if (savedCount > 0) {
            showToast(`แชะ! บันทึกสำเร็จ ${savedCount} คน (ข้ามคนซ้ำ ${duplicateCount} คน)`, "success");
            // จุดพลุฉลองให้นักเรียนในห้องทุกคนตกใจ
            confetti({ particleCount: 150, spread: 100, origin: { y: 0.3 }, colors: ['#10b981', '#f59e0b', '#3b82f6'] });
            // 🚩 ส่วนที่เพิ่มใหม่: ส่งสัญญาณ Kick ไปที่ RTDB
            firebase.database().ref(`live_classrooms/${currentLiveRoomId}/status`).set({
                action: "kick",
                timestamp: Date.now()
            });
          } else {
            showToast(`นักเรียนที่นั่งอยู่ (${duplicateCount} คน) ถูกเช็คชื่อคาบนี้ไปหมดแล้วครับ`, "info");
        }

    } catch (e) {
        showToast(e.message || "เกิดข้อผิดพลาดในการบันทึก", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="camera" class="w-4 h-4"></i> แชะ! เช็คชื่อ';
        lucide.createIcons();
    }
}


// ฟังก์ชันดักฟังคำสั่งจากครู (วางไว้ต่อจาก startListeningToDesks)
function startListeningToStatus() {
    const statusRef = firebase.database().ref(`live_classrooms/${currentLiveRoomId}/status`);
    
    statusRef.on("value", (snapshot) => {
        const data = snapshot.val();
        if (data && data.action === "kick") {
            // ป้องกันการทำงานซ้ำ ถ้าเพิ่ง Kick ไปไม่เกิน 10 วินาที
            if (Date.now() - data.timestamp < 10000) {
                runKickCountdown();
            }
        }
    });
}

// ฟังก์ชันนับถอยหลังและเตะออก
function runKickCountdown() {
    const overlay = document.getElementById('kick-overlay');
    const numDisplay = document.getElementById('kick-number');
    overlay.classList.remove('hidden');
    
    let count = 3;
    numDisplay.textContent = count;

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            numDisplay.textContent = count;
            // ใส่เสียงคลิกสั้นๆ หรือเล่นแอนิเมชันเพิ่มได้ที่นี่
        } else {
            clearInterval(interval);
            numDisplay.textContent = "GO!";
            
            setTimeout(() => {
                overlay.classList.add('hidden');
                leaveLiveClass(); // ฟังก์ชันเดิมที่เราทำไว้ (ลุกจากที่นั่ง + กลับหน้าแรก)
                
                // ล้างสถานะใน DB (เฉพาะครูเป็นคนล้าง หรือจะปล่อยให้มันค้างไว้ก็ได้)
                if(isLiveTeacher) {
                    firebase.database().ref(`live_classrooms/${currentLiveRoomId}/status`).remove();
                }
            }, 500);
        }
    }, 1000);
}

// ========================================================
// 🌟 Daily Quest Status Checker (Fallback)
// ========================================================
window.checkDailyQuestStatus = function(studentId) {
  // หากมีไฟล์ daily-quest.js ทำงานซ้อนอยู่ มันจะข้ามฟังก์ชันนี้ไป
  if(document.getElementById('daily-mascot-container')) {
     const today = new Date().toLocaleDateString("th-TH");
     const questDone = localStorage.getItem(`quest_done_${studentId}_${today}`);
     
     if(!questDone) {
         document.getElementById('daily-mascot-container').style.display = 'flex';
     } else {
         document.getElementById('daily-mascot-container').style.display = 'none';
     }
  }
}

window.openDailyQuest = function() {
  const modal = document.getElementById('quest-modal');
  if(modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      // Logic ของเควสต์สามารถปรับปรุงเพิ่มเติมได้ที่ daily-quest.js
  }
}

window.closeQuestModal = function() {
  const modal = document.getElementById('quest-modal');
  if(modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
  }
}


// =======================================================
// 🟢 ระบบแจ้งเตือน LINE เมื่อนักเรียนออนไลน์
// =======================================================
function notifyAdminIfEnabled(studentName) {
    // 1. เช็คสวิตช์ใน Firebase ก่อนว่า Admin เปิดไว้ไหม
    firebase.database().ref('settings/line_notify_enabled').once('value').then((snapshot) => {
        const isNotifyEnabled = snapshot.val();
        
        if (isNotifyEnabled === true) {
            // 2. ถ้าเปิดอยู่ ให้ยิงข้อมูลไปที่ Web App URL ของ GAS
            // 🔴 เปลี่ยน URL ด้านล่างนี้ให้เป็น UPLOAD_GAS_URL หรือวาง URL ของคุณแทน xxxxxxxxxxxxx
            const GAS_LINE_NOTIFY_URL = "https://script.google.com/macros/s/AKfycbymeU8a4wRH2FPJC-Q7bsPvxpM_jsi8qjNAW0GzEh43Ao7CQXx7FPJoow9zMGwY8Z7G/exec"; 
            
            fetch(GAS_LINE_NOTIFY_URL, {
                method: "POST",
                body: JSON.stringify({
                    action: "notify_online",
                    studentName: studentName
                })
            }).catch(err => console.log("Line Notify Error: ", err));
        }
    });
}


// =================================================================
// 🎟️ ระบบบัตรขูดรายวัน (Daily Scratch Card)
// =================================================================
let scratchCanvas, scratchCtx;
let isScratching = false;
let scratchRewardCoins = 0;
let hasClaimedScratchToday = false;
let scratchCompletionPercent = 0;

function openDailyScratchCard() {
    if (!loggedInUser || !loggedInUser.id) {
        return showToast("กรุณาเข้าสู่ระบบก่อนร่วมกิจกรรมครับ", "error");
    }

    // ตรวจสอบว่าวันนี้ขูดไปหรือยัง
    const today = new Date().toLocaleDateString("th-TH");
    const storageKey = `scratched_${loggedInUser.id}_${today}`;
    if (localStorage.getItem(storageKey)) {
        return showToast("คุณรับเหรียญฟรีของวันนี้ไปแล้ว พรุ่งนี้มาใหม่นะ! ⏳", "info");
    }

    const modal = document.getElementById("scratch-card-modal");
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.add("active"), 10);

    // รีเซ็ตปุ่มรับรางวัล
    document.getElementById("scratch-success-btn").classList.add("hidden");
    
    // สุ่มเหรียญ 50 - 100 G
    scratchRewardCoins = Math.floor(Math.random() * (100 - 50 + 1)) + 50;
    document.getElementById("scratch-reward-text").textContent = scratchRewardCoins;

    initScratchCanvas();
    if (typeof lucide !== "undefined") lucide.createIcons();
}

function closeDailyScratchCard() {
    const modal = document.getElementById("scratch-card-modal");
    modal.classList.remove("active");
    setTimeout(() => modal.classList.add("hidden"), 300);
}

function initScratchCanvas() {
    scratchCanvas = document.getElementById("scratch-canvas");
    scratchCtx = scratchCanvas.getContext("2d", { willReadFrequently: true });
    
    // ปรับขนาด Canvas ให้ตรงกับ CSS
    const rect = scratchCanvas.parentElement.getBoundingClientRect();
    scratchCanvas.width = rect.width;
    scratchCanvas.height = rect.height;

    // เติมสีเทาเงิน (ฟอยล์บัตรขูด)
    scratchCtx.fillStyle = "#cbd5e1"; // slate-300
    scratchCtx.fillRect(0, 0, scratchCanvas.width, scratchCanvas.height);
    
    // วาดลายให้ดูเหมือนบัตรขูด
    scratchCtx.fillStyle = "#94a3b8"; // slate-400
    scratchCtx.font = "bold 20px Prompt";
    scratchCtx.textAlign = "center";
    scratchCtx.fillText("ถูที่นี่เพื่อลุ้นโชค!", scratchCanvas.width / 2, scratchCanvas.height / 2 + 5);

    // ตั้งค่าหัวแปรงสำหรับลบ
    scratchCtx.globalCompositeOperation = "destination-out";
    scratchCtx.lineJoin = "round";
    scratchCtx.lineCap = "round";
    scratchCtx.lineWidth = 30; // ขนาดนิ้วมือ/เมาส์ ที่ขูด

    scratchCompletionPercent = 0;

    // ลบ Event เดิมก่อน (ป้องกันซ้อนทับ)
    scratchCanvas.onmousedown = null;
    scratchCanvas.ontouchstart = null;

    // เพิ่ม Event Listeners
    scratchCanvas.addEventListener("mousedown", handleScratchStart);
    scratchCanvas.addEventListener("mousemove", handleScratchMove);
    window.addEventListener("mouseup", handleScratchEnd);

    scratchCanvas.addEventListener("touchstart", handleScratchStart, { passive: false });
    scratchCanvas.addEventListener("touchmove", handleScratchMove, { passive: false });
    window.addEventListener("touchend", handleScratchEnd);
}

function getScratchPos(e) {
    const rect = scratchCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function handleScratchStart(e) {
    if(scratchCompletionPercent > 50) return;
    if (e.cancelable) e.preventDefault();
    isScratching = true;
    const pos = getScratchPos(e);
    scratchCtx.beginPath();
    scratchCtx.moveTo(pos.x, pos.y);
}

function handleScratchMove(e) {
    if (!isScratching || scratchCompletionPercent > 50) return;
    if (e.cancelable) e.preventDefault();
    const pos = getScratchPos(e);
    scratchCtx.lineTo(pos.x, pos.y);
    scratchCtx.stroke();
}

function handleScratchEnd() {
    if (!isScratching) return;
    isScratching = false;
    checkScratchCompletion();
}

// ตรวจสอบว่าขูดไปกี่เปอร์เซ็นต์แล้ว
function checkScratchCompletion() {
    if(scratchCompletionPercent > 50) return;

    const pixels = scratchCtx.getImageData(0, 0, scratchCanvas.width, scratchCanvas.height).data;
    let clearPixels = 0;
    
    // ตรวจสอบค่า Alpha (ช่องที่ 4)
    for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) clearPixels++;
    }

    const totalPixels = pixels.length / 4;
    scratchCompletionPercent = (clearPixels / totalPixels) * 100;

    // ถ้าขูดไปเกิน 50% ให้เปิดทั้งหมดและแสดงปุ่มรับรางวัล
    if (scratchCompletionPercent > 50) {
        scratchCtx.clearRect(0, 0, scratchCanvas.width, scratchCanvas.height);
        document.getElementById("scratch-success-btn").classList.remove("hidden");
        // ยิงพลุเบาๆ
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    }
}

// ฟังก์ชันรับเหรียญเข้า Firebase
async function claimScratchReward() {
    const btn = document.querySelector("#scratch-success-btn button");
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> กำลังบันทึก...';
    lucide.createIcons();

    try {
        const stuId = String(loggedInUser.id);
        const studentSnap = await db.collection("students").where("student_id", "==", stuId).get();
        
        if (!studentSnap.empty) {
            const docId = studentSnap.docs[0].id;
            
            // อัปเดตเงินฝั่ง UI ทันที
            currentStudentCoins += scratchRewardCoins;
            const formattedCoins = currentStudentCoins.toLocaleString();
            if (document.getElementById("user-coins")) document.getElementById("user-coins").innerText = formattedCoins;
            if (document.getElementById("shop-coins")) document.getElementById("shop-coins").innerText = formattedCoins;

            // บันทึกลง Firestore
            await db.collection("students").doc(docId).update({
                coins: currentStudentCoins
            });

            // บันทึกสถานะว่าวันนี้รับไปแล้ว
            const today = new Date().toLocaleDateString("th-TH");
            localStorage.setItem(`scratched_${stuId}_${today}`, "true");

            showToast(`ได้รับ ${scratchRewardCoins} เหรียญทองเรียบร้อย! 🎉`, "success");
            closeDailyScratchCard();
        }
    } catch (e) {
        console.error("Scratch error:", e);
        showToast("เกิดข้อผิดพลาดในการรับเหรียญ", "error");
        btn.disabled = false;
        btn.innerHTML = origHtml;
        lucide.createIcons();
    }
}


// ฟังก์ชันดึงรูปพื้นหลังแต่ละ Block จาก Firebase Realtime Database
function listenToBackgrounds() {
    firebase.database().ref('settings/backgrounds').on('value', (snapshot) => {
        const bgs = snapshot.val();
        if (bgs) {
            for (let i = 1; i <= 5; i++) {
                const block = document.getElementById(`block-${i}`);
                if (block && bgs[`block${i}`]) {
                    block.style.backgroundImage = `url('${bgs[`block${i}`]}')`;
                }
            }
        }
    });
}

// [บัค #5 แก้แล้ว] ย้ายการเรียก listenToBackgrounds() ไปไว้ใน window.onload
// เพื่อให้แน่ใจว่า Firebase พร้อมใช้งานแล้วก่อนเรียก


// =================================================================
// 📸 ระบบสุ่มรูปภาพบรรยากาศห้องเรียน (Memory Flashbacks) - 🚀 อัปเกรด
// =================================================================
let memoryArray = [];
let flashbackInterval = null;

async function startMemoryFlashback() {
    try {
        // 🛡️ ระบบ Cache: ป้องกัน Firebase Quota ทะลุ! (ประหยัดโควต้า)
        // เก็บข้อมูลไว้ในเครื่อง 5 นาที ถ้าเปิดใหม่ในช่วงนี้จะไม่ดึงจาก Firebase ซ้ำ
        const cacheKey = "cache_memory_flashbacks";
        const cacheTimeKey = "cache_memory_flashbacks_time";
        const now = new Date().getTime();
        
        const cacheData = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(cacheTimeKey);
        
        let data = null;
        
        if (cacheData && cacheTime && (now - parseInt(cacheTime)) < (5 * 60 * 1000)) {
            console.log("⚡ โหลดภาพ Memory จาก Cache (ประหยัดโควต้า!)");
            data = JSON.parse(cacheData);
        } else {
            console.log("☁️ โหลดภาพ Memory จาก Firebase...");
            const snapshot = await firebase.database().ref('settings/memory_flashbacks').once('value');
            data = snapshot.val();
            if (data) {
                localStorage.setItem(cacheKey, JSON.stringify(data));
                localStorage.setItem(cacheTimeKey, now.toString());
            }
        }

        const container = document.getElementById('flashback-gallery-container');
        if (!container) return;

        if (!data || Object.keys(data).length === 0) {
            container.innerHTML = `<p class="text-white/50 text-sm col-span-full">ยังไม่มีความทรงจำถูกบันทึกไว้ 📸</p>`;
            return;
        }

        // แปลง Object เป็น Array เฉพาะรูปที่ไม่ได้ถูกซ่อน (isVisible !== false)
        memoryArray = Object.values(data)
            .filter(item => item.isVisible !== false)
            .sort((a, b) => b.timestamp - a.timestamp);

        if (memoryArray.length === 0) {
            container.innerHTML = `<p class="text-white/50 text-sm col-span-full">ยังไม่มีความทรงจำถูกบันทึกไว้ 📸</p>`;
            return;
        }

        // วาดภาพครั้งแรก
        renderFlashbackGrid();

        // เคลียร์ Interval เก่า ป้องกันบัคกระตุกและโหลดซ้อน
        if (flashbackInterval) clearInterval(flashbackInterval);

        // สลับภาพทุกๆ 6 วินาที
        flashbackInterval = setInterval(() => {
            renderFlashbackGrid();
        }, 6000);

    } catch (error) {
        console.error("Error loading memory flashbacks:", error);
    }
}

// 🎨 ฟังก์ชันวาดกรอบโพลารอยด์
function renderFlashbackGrid() {
    const container = document.getElementById('flashback-gallery-container');
    if (!container) return;

    // Responsive: เช็คขนาดจอเพื่อกำหนดจำนวนภาพที่จะโชว์
    let displayCount = 1; // มือถือ 1 ภาพ
    if (window.innerWidth >= 1280) { 
        displayCount = 5; // PC 5 ภาพ
    } else if (window.innerWidth >= 768) { 
        displayCount = 3; // แท็บเล็ต 3 ภาพ
    }

    let selectedMemories = [];
    
    // สุ่มภาพ (ถ้ามีน้อยกว่าจำนวนช่อง ก็อนุญาตให้สุ่มซ้ำได้อัตโนมัติ)
    for (let i = 0; i < displayCount; i++) {
        // ให้รูปตรงกลาง (Index ศูนย์กลาง) มีโอกาสดึงรูปล่าสุดมาโชว์ 50%
        if (i === Math.floor(displayCount / 2) && memoryArray.length > 0 && Math.random() > 0.5) {
            selectedMemories.push(memoryArray[0]); 
        } else {
            const randomIndex = Math.floor(Math.random() * memoryArray.length);
            selectedMemories.push(memoryArray[randomIndex]);
        }
    }

    // สร้าง HTML กรอบโพลารอยด์
    const html = selectedMemories.map((mem, index) => {
        // สุ่มองศาเอียงเล็กน้อย (-3 ถึง 3 องศา) ให้ดูธรรมชาติเหมือนวางรูปบนโต๊ะ
        const rotation = (Math.random() * 6 - 3).toFixed(1);
        
        // รูปที่อยู่ตรงกลางให้เด่นที่สุด ขยายขนาดเล็กน้อย
        const isCenter = index === Math.floor(displayCount / 2);
        const zIndex = isCenter ? 20 : 10;
        const scale = isCenter ? 'scale-105' : 'scale-95 sm:scale-100';

        return `
        <div class="bg-white/95 backdrop-blur-sm p-3 pb-8 rounded-lg shadow-xl border border-white/80 transition-all duration-700 w-full max-w-[220px] mx-auto relative overflow-hidden group ${scale} hover:z-30 hover:scale-110" style="transform: rotate(${rotation}deg); z-index: ${zIndex};">
            <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-5 bg-white/40 backdrop-blur-md rotate-[-4deg] z-10 shadow-sm rounded-sm"></div>
            
            <div class="w-full aspect-[4/5] bg-slate-200 rounded overflow-hidden relative border border-slate-100">
                <img src="${mem.url}" class="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-700 group-hover:scale-110" loading="lazy" onerror="this.style.display='none'">
            </div>
            
            <p class="text-center font-bold text-slate-700 text-[11px] sm:text-xs mt-3 absolute w-full left-0 px-3 line-clamp-2 leading-tight">
                ${mem.caption || "ความทรงจำห้องเรียน ✨"}
            </p>
        </div>
        `;
    }).join("");

    // Animation ค่อยๆ จางเปลี่ยนภาพ ไม่ให้กระตุกเฟรมเรตตก
    container.style.opacity = 0;
    setTimeout(() => {
        container.innerHTML = html;
        container.style.opacity = 1;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 300); // 300ms ให้สอดคล้องกับ css transition
}

// อัปเดตทันทีเมื่อผู้ใช้หมุนจอหรือย่อขยายเบราว์เซอร์
window.addEventListener('resize', () => {
    // ใช้เทคนิค Debounce ป้องกันการคำนวณซ้ำซ้อนขณะลากหน้าจอ
    clearTimeout(window.resizeFlashbackTimer);
    window.resizeFlashbackTimer = setTimeout(() => {
        if (memoryArray.length > 0) renderFlashbackGrid();
    }, 250);
});


// ==========================================
// 🗺️ ระบบ Quest Map ฝั่งนักเรียน (Horizontal + Modal Toy Style)
// ==========================================
// ค้นหาฟังก์ชัน initStudentQuestMap
function initStudentQuestMap() {
    if (typeof firebase === 'undefined') return;
    
    // ต้องรู้ก่อนว่านักเรียนอยู่ห้องไหน 
    let rawStudentRoomId = 'all'; 
    if (loggedInUser && loggedInUser.id) {
        const studentInfo = teacherDbStudents.find(s => String(s.student_id) === String(loggedInUser.id));
        if (studentInfo && studentInfo.classroom) {
            rawStudentRoomId = studentInfo.classroom;
        }
    }

    // 🌟 แปลงชื่อห้องให้ปลอดภัยสำหรับ Firebase
    const studentRoomId = rawStudentRoomId === 'all' ? 'all' : rawStudentRoomId.replace(/[\/\.]/g, "_");

    // ฟังก์ชันย่อยสำหรับโหลดข้อมูล และแสดงผล
    const loadAndRenderQuests = (roomId) => {
        const dbRef = firebase.database().ref(`quest_map/quests/${roomId}`);
        
        dbRef.once('value').then((snapshot) => {
            const data = snapshot.val();
            const listEl = document.getElementById('learning-map-list');
            const modalListEl = document.getElementById('learning-modal-list');
            const viewMoreBtn = document.getElementById('learning-view-more-container');
            if (!listEl) return;
            
            // ถ้าดึงข้อมูลห้องเฉพาะแล้วไม่เจอ ลองดึงของ 'all' (Global) เป็น fallback
            if (!data && roomId !== 'all') {
                console.log(`ไม่พบเควสต์ของห้อง ${roomId} กำลังดึงเควสต์รวม (all)`);
                loadAndRenderQuests('all');
                return;
            }

            if (!data) {
                listEl.innerHTML = '<div class="text-center w-full py-6 text-slate-400 font-black text-[10px] uppercase">ยังไม่มีภารกิจ 🚩</div>';
                if(modalListEl) modalListEl.innerHTML = '';
                return;
            }

            // แปลงข้อมูลและเรียงลำดับ
            const quests = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            quests.sort((a, b) => a.timestamp - b.timestamp);

            let horizontalHtml = '';
            let verticalHtml = '';

            quests.forEach((q, index) => {
                let isCompleted = q.status === 'completed';
                let isActive = q.status === 'active';
                let bgBox = isCompleted ? 'bg-[#10b981]' : (isActive ? 'bg-[#ffd200]' : 'bg-white');
                let icon = isCompleted ? 'check' : (isActive ? 'play' : 'lock');
                let iconColor = isCompleted ? 'text-white' : (isActive ? 'text-black' : 'text-slate-300');
                let textColor = isCompleted ? 'text-emerald-700' : (isActive ? 'text-amber-700' : 'text-slate-400');
                let pulseClass = isActive ? 'animate-pulse' : '';
                let botSeed = `BotLevel${index + 1}`;

                // --- วาดแนวนอน (ย่อขนาดลง) ---
                if (index < 5) {
                    horizontalHtml += `
                    <div class="flex items-end shrink-0 relative mt-10">
                        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${botSeed}" class="absolute -top-10 left-1/2 -translate-x-1/2 w-10 h-10 sm:w-12 sm:h-12 drop-shadow-sm z-10 pointer-events-none">

                        <div onclick="openLearningMapModal()" class="flex flex-col items-center w-20 sm:w-24 group relative z-0 cursor-pointer">
                            <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-[3px] border-black ${bgBox} flex items-center justify-center shadow-[3px_3px_0_#000] transition-transform group-hover:-translate-y-1 ${pulseClass}">
                                <i data-lucide="${icon}" class="w-5 h-5 sm:w-6 sm:h-6 ${iconColor}"></i>
                            </div>
                            <p class="text-[9px] sm:text-[10px] font-black text-center mt-2 leading-tight line-clamp-2 px-1 ${textColor}">
                                ${q.title}
                            </p>
                        </div>
                        
                        ${(index < 4 && index < quests.length - 1) ? `
                        <div class="w-4 sm:w-6 flex items-center justify-center pb-8 shrink-0">
                            <i data-lucide="chevron-right" class="w-4 h-4 text-black opacity-20"></i>
                        </div>` : ''}
                    </div>`;
                }

                // --- วาดแนวตั้ง (สำหรับ Popup) ---
                if (modalListEl) {
                    let vStatusClass = isCompleted ? 'quest-completed' : (isActive ? 'quest-active' : 'quest-locked opacity-70');
                    let vDotColor = isCompleted ? 'bg-[#10b981]' : (isActive ? 'bg-[#ffd200]' : 'bg-slate-300');
                    verticalHtml += `
                    <div class="quest-node ${vStatusClass} relative mt-4">
                        <div class="absolute -top-6 left-2 z-10 w-8 h-8">
                           <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${botSeed}" class="w-full h-full drop-shadow-sm">
                        </div>
                        <div class="quest-circle w-10 h-10 border-[3px] border-black rounded-xl transform hover:scale-110 transition-transform bg-white relative z-0 mt-2">
                           <div class="w-full h-full rounded-[0.5rem] flex items-center justify-center ${bgBox}">
                              <i data-lucide="${icon}" class="w-4 h-4 ${iconColor}"></i>
                           </div>
                        </div>
                        <div class="quest-content group mt-2 p-3 border-[3px] border-black rounded-2xl bg-white shadow-sm flex-1 flex items-center justify-between">
                            <span class="font-black text-[11px] sm:text-xs uppercase tracking-widest line-clamp-1 group-hover:text-[#009de0]">
                                ${index + 1}. ${q.title}
                            </span>
                            <div class="w-3 h-3 rounded-full border-2 border-black ${vDotColor} shadow-[1px_1px_0_#000] shrink-0"></div>
                        </div>
                    </div>`;
                }
            });

            listEl.innerHTML = horizontalHtml;
            if (modalListEl) modalListEl.innerHTML = verticalHtml;
            if (quests.length > 5 && viewMoreBtn) viewMoreBtn.classList.remove('hidden');
            else if (viewMoreBtn) viewMoreBtn.classList.add('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
            
            // ดักฟังการเปลี่ยนแปลงหลังจากโหลดสำเร็จแล้ว (อัปเดตแบบ Realtime)
            // เช็คและอัปเดตใหม่เมื่อมีข้อมูลเข้า
            firebase.database().ref(`quest_map/quests/${roomId}`).on('value', (rtSnapshot) => {
                // หลีกเลี่ยง loop ซ้อน
                if(!rtSnapshot.exists()) return;
                // โค้ดเรนเดอร์ซ้ำ หรือใช้วิธีดึงเฉพาะสถานะอัปเดต (แต่เพื่อความง่าย วาดใหม่ทั้งหมดก็เพียงพอในกรณีข้อมูลน้อย)
            });
            
        }).catch(e => console.error("Error loading quests:", e));
    };

    // โหลดเควสต์สำหรับห้องของนักเรียน (จะ fallback เป็น 'all' ถ้าไม่มี)
    loadAndRenderQuests(studentRoomId);
}

function openLearningMapModal() {
    const modal = document.getElementById('learning-map-modal');
    if(modal) modal.classList.remove('hidden');
}

function closeLearningMapModal() {
    const modal = document.getElementById('learning-map-modal');
    if(modal) modal.classList.add('hidden');
}

// รอให้ไฟล์และ Firebase โหลดเสร็จก่อนค่อยดึงข้อมูลด่าน
setTimeout(() => {
    initStudentQuestMap();
}, 1500);




      // ========================================================
      // 🎲 ระบบสุ่มคำคมปลุกใจในหน้า Login
      // ========================================================
      const classroomQuotes = [
        "เรียนรู้ให้เหมือนเล่นเกม แล้วทุกด่านจะมีความหมาย 🎮",
        "วันนี้ก็คือ Level ใหม่ เริ่มต้นลุยกันเลย! 🚀",
        "ไม่มีคำว่าล้มเหลว มีแต่คำว่าเรียนรู้และเติบโต 🌱",
        "ทุกความพยายามคือ EXP ที่ทำให้เราเก่งขึ้น 💯",
        "อย่ากลัวที่จะทำผิด เพราะมันคือบอสที่เราต้องผ่านไปให้ได้ 👾",
        "ห้องเรียนนี้คือพื้นที่ปล่อยของ โชว์พลังกันหน่อย! ⚡",
        "ก้าวเล็กๆ ในวันนี้ คือก้าวกระโดดในวันหน้า 🏃‍♂️",
        "รอยยิ้มและเสียงหัวเราะ คือพลังงานชั้นดีในการเรียน 😄",
        "เตรียมตัวให้พร้อม แล้วมารับความสนุกในห้องเรียนกันเถอะ 🎢",
        "ไม่มีใครเก่งมาตั้งแต่เกิด แต่เราเก่งขึ้นได้ทุกวัน 💪",
        "เปิดรับสิ่งใหม่ แล้วโลกจะกว้างขึ้นกว่าเดิม 🌍",
        "จินตนาการสำคัญพอๆ กับความรู้ มาระเบิดไอเดียกัน! 💥",
        "การเรียนไม่ใช่การแข่งขัน แต่คือการท้าทายตัวเอง 🏆",
        "เหนื่อยก็พัก แต่อย่าเพิ่งหยุดเดินนะ 🏕️",
        "เชื่อมั่นในตัวเอง คุณทำได้มากกว่าที่คิด! ✨",
        "ความผิดพลาดคือบทเรียนที่ไม่มีในหนังสือ 📖",
        "พร้อมที่จะ Level Up หรือยัง? ล็อกอินเข้ามาเลย! 🔋",
        "ห้องเรียนของเราคือเซฟโซน ปลอดภัย อบอุ่น และสนุก 🏡",
        "อย่าลืมพกความมั่นใจและรอยยิ้มมาด้วยนะ 😁",
        "ทุกวันคือโอกาสใหม่ในการสร้างผลงานชิ้นเอก 🎨"
      ];

      function setRandomQuote() {
        const quoteEl = document.getElementById("random-quote-text");
        if (quoteEl) {
          const randomIdx = Math.floor(Math.random() * classroomQuotes.length);
          quoteEl.textContent = classroomQuotes[randomIdx];
        }
      }

      // สุ่มคำคมทันทีที่หน้าเว็บโหลดเสร็จ
      window.addEventListener('DOMContentLoaded', setRandomQuote);
    