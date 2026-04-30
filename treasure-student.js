// =================================================================
// 📍 ระบบจำลองพิกัด GPS (Safe Version - สำหรับฝั่งนักเรียน)
// =================================================================
if (typeof window.CUSTOM_GPS === 'undefined') {
    window.CUSTOM_GPS = {
        enable: false,     // 🟢 ปิดระบบจำลอง เพื่อดึงพิกัด GPS จากดาวเทียมมือถือจริง
        lat: 20.266000,
        lng: 99.988000
    };
}

(function() {
    if (window.CUSTOM_GPS.enable) {
        const mockGeo = {
            getCurrentPosition: function(success, error, options) {
                setTimeout(() => {
                    success({
                        coords: { latitude: window.CUSTOM_GPS.lat, longitude: window.CUSTOM_GPS.lng, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                        timestamp: Date.now()
                    });
                }, 100);
            },
            watchPosition: function(success, error, options) {
                const id = Math.floor(Math.random() * 1000);
                setTimeout(() => {
                    success({
                        coords: { latitude: window.CUSTOM_GPS.lat, longitude: window.CUSTOM_GPS.lng, accuracy: 10 },
                        timestamp: Date.now()
                    });
                }, 100);
                // จำลองให้ขยับเล็กน้อยเพื่อให้เรดาร์อัปเดต (ถ้าต้องการให้เด็กเดินอัตโนมัติ)
                return id;
            },
            clearWatch: function(id) {}
        };

        try {
            Object.defineProperty(navigator, 'geolocation', {
                value: mockGeo,
                configurable: true,
                writable: true
            });
            console.warn("⚠️ บังคับใช้พิกัดจำลอง (Mock GPS) ฝั่งนักเรียนเรียบร้อยแล้ว");
        } catch (e) {
            console.error("❌ ไม่สามารถ Override Geolocation ได้:", e);
        }
    }
})();
// =================================================================

// 🚨 เปลี่ยนชื่อตัวแปรเป็น TRS_GAS_URL เพื่อป้องกันการชนกับไฟล์ submit-script.js
var TRS_GAS_URL = 'https://script.google.com/macros/s/AKfycbw300p4oJDcOkKoVBz3IjXd3jNdoPatiPyjfXSnVJofJQs-DT9jQN5htOxc2CpSny-ueQ/exec';

var trs_user = null;
var trs_quests = [];
var trs_myTreasures = [];
var trs_scanner = null;

// 👇 เพิ่มตัวแปรเช็คสถานะไว้ด้านนอก
let isTreasureLoaded = false; 

window.initTreasureHunt = async function() {
    // 👇 ถ้าเคยโหลดภารกิจมาแล้ว ให้ข้ามไปเลย ไม่ต้องร่ายเวทย์ 4 วินาทีซ้ำ
    if (isTreasureLoaded) return; 

    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    if(!document.getElementById('trs-style')) {
        const style = document.createElement('style'); style.id = 'trs-style';
        style.innerHTML = `@keyframes legendaryShine { 0% { left: -150%; } 20% { left: 150%; } 100% { left: 150%; } } .animate-legendary-shine { animation: legendaryShine 2.5s ease-in-out infinite; }`; 
        document.head.appendChild(style);
    }

    const session = localStorage.getItem('student_session');
    if (!session) { 
        trs_showAlert('ยังไม่ได้ล็อกอิน', 'กรุณาล็อกอินเข้าสู่ Student Portal ก่อนใช้งานระบบนี้ครับ', 'error'); 
        setTimeout(() => { window.location.href = 'index.html'; }, 2000); 
        return; 
    }
    trs_user = JSON.parse(session);
    await trs_loadData();

    // 👇 บันทึกว่าโหลดเสร็จเรียบร้อยแล้ว
    isTreasureLoaded = true; 
};

async function trs_loadData() {
    const activeContainer = document.getElementById('active-quests');
    if(activeContainer) activeContainer.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">กำลังจัดเตรียมพื้นที่ล่าสมบัติ...</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // 🌟 1. สั่งเปิด Popup เวทมนตร์ทันที! (ดึงความสนใจเด็กไว้)
    let loadingAnim = playLegendaryLoading(); 

    // 🌟 2. ให้ระบบแอบดึงข้อมูลเงียบๆ หลังฉาก ในขณะที่เด็กกำลังดูแอนิเมชัน
    try {
        const qSnap = await db.collection('treasure_quests').get();
        trs_quests = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { 
        console.error("Firebase Error: ", e); 
    }

    try {
        const res = await fetch(TRS_GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_my_treasures', student_id: String(trs_user.id) })
        });
        const json = await res.json();
        
        if (json.status === 'success') {
            trs_myTreasures = json.data.map(d => ({
                quest_id: d.quest_id,
                collected_pieces: d.collected_pieces ? String(d.collected_pieces).split(',').map(Number) : [],
                is_completed: String(d.is_completed).toLowerCase() === 'true'
            }));
        } else { trs_myTreasures = []; }
    } catch(e) { 
        console.error("GAS Error: ", e); 
        trs_myTreasures = []; 
    }

    // 🌟 3. รอจนกว่าแอนิเมชัน 4 วินาทีจะเล่นจบ (เพื่อความเท่) 
    // แม้เน็ตจะเร็วโหลดเสร็จใน 1 วิ ก็จะหน่วงเวลาให้ดูแอนิเมชันจบก่อนครับ
    await loadingAnim; 
    
    // 🌟 4. ปิด Popup และแสดงภารกิจทั้งหมดขึ้นมาทันที!
    closeLegendaryLoading();
    trs_renderUI();
}

// ==========================================
// 🌟 1.5 ตัวแปรเก็บสถานะการเลือกภารกิจ
// ==========================================
window.trs_currentSelectedQuestId = null;

window.trs_selectQuest = function(questId) {
    window.trs_currentSelectedQuestId = questId;
    trs_renderUI();
};

// ==========================================
// 🌟 2. ระบบวาด UI ล่าสมบัติ (Master-Detail 2.5D Layout)
// ==========================================
function trs_renderUI() {
    const container = document.getElementById('active-quests'); 
    const completedContainer = document.getElementById('completed-quests');
    
    // ซ่อนกล่อง "สมบัติในกระเป๋า" ด้านล่างทิ้งไปเลย เพราะเรารวมไว้ใน UI ใหม่แล้ว
    if (completedContainer && completedContainer.parentElement) {
        completedContainer.parentElement.style.display = 'none'; 
    }

    if (!container) return;

    if (trs_quests.length === 0) {
        container.className = "bg-white p-6 rounded-2xl border border-slate-200 w-full";
        container.innerHTML = '<div class="text-center py-10 text-slate-400 font-bold"><i data-lucide="map-x" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>ยังไม่มีภารกิจล่าสมบัติในขณะนี้ครับ</div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // กำหนดค่าเริ่มต้นถ้ายังไม่ได้เลือกภารกิจไหนเลย
    if (!window.trs_currentSelectedQuestId || !trs_quests.find(q => q.id === window.trs_currentSelectedQuestId)) {
        window.trs_currentSelectedQuestId = trs_quests[0].id;
    }

    const selectedQuest = trs_quests.find(q => q.id === window.trs_currentSelectedQuestId);
    const mySelectedData = trs_myTreasures.find(t => t.quest_id === selectedQuest.id);
    const collectedPieces = mySelectedData ? mySelectedData.collected_pieces : [];
    const isCompleted = mySelectedData ? mySelectedData.is_completed : false;

    // -------------------------------------------------------------
    // 🗂️ ส่วนที่ 1: แถบเมนูด้านซ้าย (Left Master Menu)
    // -------------------------------------------------------------
    let menuHtml = `<div class="w-full md:w-[35%] bg-gradient-to-b from-indigo-500 to-purple-600 p-4 md:p-6 flex flex-row md:flex-col gap-3 md:gap-4 overflow-x-auto md:overflow-y-auto custom-scrollbar shrink-0 z-0">`;
    
    trs_quests.forEach(quest => {
        const isActive = quest.id === window.trs_currentSelectedQuestId;
        const myData = trs_myTreasures.find(t => t.quest_id === quest.id);
        const isDone = myData ? myData.is_completed : false;
        
        // CSS สร้างมิติเวลาถูกเลือก (นูนออกมาและสว่างขึ้น)
        const activeClass = isActive 
            ? "bg-white/20 border-white/50 shadow-lg md:translate-x-3 translate-y-0" 
            : "border-transparent hover:bg-white/10 hover:translate-x-1";
            
        const ringClass = isActive 
            ? "ring-4 ring-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" 
            : "ring-2 ring-white/30";
        
        let coverImg = quest.cover_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(quest.title)}&background=random`;

        menuHtml += `
        <div onclick="trs_selectQuest('${quest.id}')" class="flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-2xl cursor-pointer transition-all duration-300 border ${activeClass} group min-w-[160px] md:min-w-0">
            <div class="relative shrink-0">
                <img src="${coverImg}" class="w-10 h-10 md:w-14 md:h-14 rounded-full object-cover ${ringClass} transition-all duration-300 group-hover:scale-110 bg-white">
                ${isDone ? `<div class="absolute -bottom-1 -right-1 bg-amber-400 rounded-full p-0.5 border-2 border-indigo-600"><i data-lucide="check" class="w-3 h-3 text-white"></i></div>` : ''}
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="text-white font-bold text-sm md:text-base truncate drop-shadow-sm">${quest.title}</h4>
                <p class="text-indigo-200 text-[10px] md:text-xs font-medium truncate">${isDone ? '✨ สะสมสมบัติสำเร็จแล้ว' : '🔍 กำลังค้นหาชิ้นส่วน...'}</p>
            </div>
        </div>`;
    });
    menuHtml += `</div>`;

    // -------------------------------------------------------------
    // 📄 ส่วนที่ 2: แผงรายละเอียดด้านขวา (Right Content Panel)
    // -------------------------------------------------------------
    // สังเกต md:-ml-6 คือการทำ CSS Overlap ให้ขอบขาวเกยทับขอบม่วงแบบในรูปครับ
    let contentHtml = `<div class="w-full md:w-[65%] bg-white md:-ml-6 md:my-4 md:rounded-[2rem] rounded-b-[2rem] md:rounded-b-[2rem] shadow-[-15px_0_30px_rgba(0,0,0,0.15)] p-6 md:p-8 relative overflow-hidden flex flex-col z-10 min-h-[420px]">`;

    // ภาพพื้นหลังตกแต่งลายเส้น
    contentHtml += `
        <div class="absolute -top-10 -right-10 w-48 h-48 bg-amber-100 rounded-full blur-[50px] opacity-60 pointer-events-none"></div>
        <div class="absolute top-10 right-10 opacity-10 pointer-events-none transform rotate-12"><i data-lucide="map" class="w-32 h-32 text-indigo-500"></i></div>
    `;

    if (isCompleted) {
        // --- สถานะ: ภารกิจสำเร็จแล้ว ---
        contentHtml += `
            <div class="inline-flex items-center gap-1.5 text-[10px] font-black text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full uppercase tracking-widest border border-amber-200 w-fit mb-4 relative z-10 shadow-sm">
                <i data-lucide="award" class="w-3.5 h-3.5"></i> ภารกิจสำเร็จระดับตำนาน
            </div>
            <h2 class="text-3xl md:text-4xl font-black text-indigo-800 font-outfit tracking-tight mb-4 drop-shadow-sm relative z-10 pr-10">${selectedQuest.title}</h2>
            <p class="text-sm text-slate-500 mb-8 leading-relaxed max-w-[90%] relative z-10">${selectedQuest.desc || 'คุณได้ครอบครองสมบัติชิ้นนี้ไปเรียบร้อยแล้ว ถูกบันทึกไว้ในคลังสมบัติของคุณ!'}</p>
            
            <div class="mt-auto flex flex-col items-center justify-center p-8 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-3xl border border-amber-200 shadow-inner text-center relative z-10">
                <div class="w-24 h-24 bg-gradient-to-br from-yellow-300 to-amber-500 rounded-full flex items-center justify-center mb-4 shadow-[0_10px_25px_rgba(245,158,11,0.5)] animate-bounce">
                    <i data-lucide="crown" class="w-12 h-12 text-white"></i>
                </div>
                <h4 class="font-black text-amber-700 text-xl tracking-wide">สมบัตินี้เป็นของคุณ!</h4>
            </div>
        `;
    } else {
        // --- สถานะ: กำลังล่าสมบัติ ---
        const pct = Math.round((collectedPieces.length / selectedQuest.total_pieces) * 100);
        const rating = (Math.random() * (5.0 - 4.2) + 4.2).toFixed(1); // สุ่มเรตติ้งปลอมๆ ให้เหมือนในรูป
        
        contentHtml += `
            <div class="inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full uppercase tracking-widest border border-indigo-200 w-fit mb-4 relative z-10 shadow-sm">
                <i data-lucide="star" class="w-3 h-3 fill-indigo-500"></i> เรตติ้ง ${rating}
            </div>
            <h2 class="text-3xl md:text-4xl font-black text-indigo-800 font-outfit tracking-tight mb-3 drop-shadow-sm relative z-10 pr-10">${selectedQuest.title}</h2>
            <p class="text-sm text-slate-500 mb-6 leading-relaxed max-w-[90%] min-h-[40px] relative z-10">${selectedQuest.desc || 'ตามหาชิ้นส่วนที่หายไปให้ครบเพื่อรวมเป็นสมบัติและรับรางวัล!'}</p>
            
            <div class="mb-6 relative z-10">
                <div class="flex justify-between items-end mb-2 px-1">
                    <span class="text-xs font-bold text-slate-700">ความคืบหน้า</span>
                    <span class="text-[10px] font-black text-amber-600 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-200 shadow-sm">สะสม ${collectedPieces.length}/${selectedQuest.total_pieces}</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner border border-slate-200">
                    <div class="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-700 relative overflow-hidden" style="width: ${pct}%">
                        <div class="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shine_2s_infinite]"></div>
                    </div>
                </div>
            </div>
        `;

        // วาด Gallery ชิ้นส่วน 
        let galleryHtml = '<div class="flex flex-wrap gap-3 mt-2 overflow-y-auto max-h-[140px] custom-scrollbar p-1 relative z-10">';
        for(let i = 1; i <= selectedQuest.total_pieces; i++) { 
            let isFound = collectedPieces.includes(i); 
            let defaultImg = `https://ui-avatars.com/api/?name=${i}&background=fef3c7&color=d97706&size=128&font-size=0.5`; 
            
            let imgUrl = defaultImg;
            if (selectedQuest.piece_images && selectedQuest.piece_images[i-1]) {
                let piece = selectedQuest.piece_images[i-1];
                imgUrl = (typeof piece === 'object') ? (piece.url || defaultImg) : piece;
            }
            
            if(isFound) { 
                galleryHtml += `<div class="w-14 h-14 shrink-0 rounded-[14px] overflow-hidden border-2 border-amber-400 shadow-md relative group"><img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"><div class="absolute inset-0 bg-amber-500/10 mix-blend-overlay"></div></div>`; 
            } else { 
                galleryHtml += `<div class="w-14 h-14 shrink-0 rounded-[14px] bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center shadow-inner"><i data-lucide="lock" class="w-5 h-5 text-slate-300"></i></div>`; 
            } 
        } 
        galleryHtml += '</div>';

        contentHtml += galleryHtml;

        // ปุ่ม Action ด้านล่าง (รวมสมบัติ หรือ ค้นหา)
        if (collectedPieces.length === selectedQuest.total_pieces) { 
            contentHtml += `
                <div class="mt-auto pt-6 relative z-10">
                    <button onclick="combineTreasure('${selectedQuest.id}', '${selectedQuest.title.replace(/'/g, "\\'")}')" class="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-black py-4 rounded-2xl shadow-[0_8px_20px_rgba(245,158,11,0.4)] hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 uppercase tracking-widest text-sm border border-amber-300 animate-pulse">
                        <i data-lucide="sparkles" class="w-5 h-5"></i> รวมชิ้นส่วนเป็นสมบัติ!
                    </button>
                </div>`; 
        } else {
            contentHtml += `
                <div class="mt-auto pt-6 grid grid-cols-2 gap-3 relative z-10">
                    <button onclick="openGeoQuestMap()" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-3.5 sm:py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 text-[11px] sm:text-xs uppercase tracking-widest shadow-sm hover:-translate-y-0.5">
                        <i data-lucide="radar" class="w-4 h-4"></i> ค้นหาพิกัด
                    </button>
                    <button onclick="startScanner()" class="bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-bold py-3.5 sm:py-4 rounded-2xl shadow-md transition-all duration-300 flex items-center justify-center gap-2 text-[11px] sm:text-xs uppercase tracking-widest hover:-translate-y-0.5">
                        <i data-lucide="scan-line" class="w-4 h-4 text-white"></i> สแกน QR
                    </button>
                </div>`;
        }
    }
    contentHtml += `</div>`; 

    // -------------------------------------------------------------
    // 🌟 นำมารวมกัน แล้วใส่คลาส CSS เพื่อเปลี่ยนกรอบใหม่ทั้งหมด
    // -------------------------------------------------------------
    // override คลาสเก่าของ #active-quests ทั้งหมด เพื่อเคลียร์ขอบและตั้งค่า layout ซ้ายขวา
    container.className = "flex flex-col md:flex-row w-full max-w-5xl mx-auto rounded-[2rem] bg-indigo-500 shadow-2xl overflow-hidden relative border-[6px] border-white/80 backdrop-blur-sm";
    
    // ยัด HTML เข้าไป
    container.innerHTML = menuHtml + contentHtml;
    
    // เพิ่มอนิเมชันให้แถบหลอดพลัง (Shine Effect)
    if (!document.getElementById('shine-style-trs')) {
        const style = document.createElement('style');
        style.id = 'shine-style-trs';
        style.innerHTML = `@keyframes shine { 0% { left: -100%; } 20% { left: 100%; } 100% { left: 100%; } }`;
        document.head.appendChild(style);
    }
    
    // เรียกใช้ไอคอน
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 🌟 2. ระบบกล้อง และ สแกนรูปภาพ
// ==========================================
window.startScanner = function() {
    let modal = document.getElementById('scanner-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'scanner-modal';
        modal.className = 'fixed inset-0 bg-black/95 z-[9999] hidden flex flex-col backdrop-blur-sm';
        modal.innerHTML = `
            <div class="p-6 flex justify-between items-center text-white">
                <h3 class="font-bold text-lg flex items-center gap-2"><i data-lucide="scan-line" class="w-5 h-5 text-amber-500"></i> สแกน QR Code สมบัติ</h3>
                <button onclick="stopScanner()" class="bg-white/10 hover:bg-rose-500 hover:text-white p-2 rounded-full transition-colors"><i data-lucide="x" class="w-6 h-6"></i></button>
            </div>
            <div class="flex-1 flex flex-col items-center justify-center p-4">
                <div id="reader" class="w-full max-w-sm bg-black rounded-3xl overflow-hidden border-4 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)]"></div>
            </div>
        `;
        document.body.appendChild(modal);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        if (typeof Html5Qrcode === 'undefined') {
            return trs_showAlert('ติดตั้งกล้องไม่สมบูรณ์', 'ระบบไม่รู้จัก Html5Qrcode กรุณาตรวจสอบแท็ก script ในไฟล์ index.html ครับ', 'error');
        }

        if (!trs_scanner) trs_scanner = new Html5Qrcode("reader");
        if (trs_scanner.isScanning) return;
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        Html5Qrcode.getCameras().then(devices => {
            if (devices && devices.length > 0) {
                let cameraId = devices[0].id; 
                for (let i = 0; i < devices.length; i++) {
                    let label = devices[i].label.toLowerCase();
                    if (label.includes("back") || label.includes("environment") || label.includes("rear")) {
                        cameraId = devices[i].id; break;
                    }
                }
                trs_scanner.start(cameraId, config, trs_onSuccess, trs_onFail).catch(err => {
                    trs_showAlert("เปิดกล้องไม่สำเร็จ", "กรุณาใช้ปุ่มอัปโหลดรูปภาพแทนครับ", "warning");
                });
            } else {
                trs_showAlert("ไม่พบกล้อง", "ไม่พบกล้องในอุปกรณ์ กรุณาใช้ปุ่มอัปโหลดรูปภาพ", "warning");
            }
        }).catch(err => {
            trs_scanner.start({ facingMode: "environment" }, config, trs_onSuccess, trs_onFail).catch(e => {
                trs_scanner.start({ facingMode: "user" }, config, trs_onSuccess, trs_onFail).catch(e2 => {
                    trs_showAlert("สิทธิ์ใช้งานกล้องถูกบล็อก", "คุณสามารถใช้ปุ่ม 'เลือกรูปภาพ QR Code' แทนได้เลยครับ", "warning");
                });
            });
        });
    }, 500); 
};

window.stopScanner = function() {
    const modal = document.getElementById('scanner-modal');
    if (trs_scanner && trs_scanner.isScanning) {
        trs_scanner.stop().then(() => {
            trs_scanner.clear();
            if (modal) modal.classList.add('hidden');
        }).catch(err => {
            trs_scanner.clear();
            if (modal) modal.classList.add('hidden');
        });
    } else {
        if (modal) modal.classList.add('hidden');
    }
};

window.directScanImageFile = async function(event) {
    const file = event.target.files[0]; 
    if (!file) return;
    
    const btnUpload = document.getElementById('btn-direct-upload'); 
    const originalBtnHtml = btnUpload ? btnUpload.innerHTML : ''; 
    if (btnUpload) btnUpload.innerHTML = '<i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>'; 
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    let readerDiv = document.getElementById('reader');
    if (!readerDiv) {
        readerDiv = document.createElement('div');
        readerDiv.id = 'reader';
        readerDiv.style.display = 'none';
        document.body.appendChild(readerDiv);
    }

    try { 
        if (typeof Html5Qrcode === 'undefined') throw new Error("No Scanner Library");
        if (!trs_scanner) trs_scanner = new Html5Qrcode("reader"); 
        
        const decodedText = await trs_scanner.scanFile(file, true); 
        
        if (btnUpload) btnUpload.innerHTML = originalBtnHtml; 
        if (typeof lucide !== 'undefined') lucide.createIcons(); 
        
        trs_onSuccess(decodedText, null);
    } catch (err) { 
        if (btnUpload) btnUpload.innerHTML = originalBtnHtml; 
        if (typeof lucide !== 'undefined') lucide.createIcons(); 
        trs_showAlert('อ่านรหัสไม่สำเร็จ', 'สาเหตุที่เป็นไปได้:\n1. รูปภาพเบลอ ไม่ชัดเจน\n2. ไม่มี QR Code ในรูป\n3. ลองให้เด็กๆ ตัดรูป (Crop) ให้เห็นแค่ QR Code แล้วอัปโหลดใหม่ดูครับ', 'error'); 
    }
    event.target.value = ''; 
};

window.scanImageFile = window.directScanImageFile; 

function trs_onFail(error) {}

// ==========================================
// 🌟 3. ระบบจัดการผลลัพธ์ และ แอนิเมชันระดับตำนาน
// ==========================================

// 🌟 ฟังก์ชันสร้างหน้าจอโหลดสุดเทพ (4 วินาที)
window.playLegendaryLoading = async function() {
    let modal = document.getElementById('legendary-loading-modal');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'legendary-loading-modal';
        modal.className = 'fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[9999] hidden flex flex-col items-center justify-center p-4 transition-opacity opacity-0 duration-500';
        modal.innerHTML = `
            <style>
                @keyframes spin-slow { 100% { transform: rotate(360deg); } }
                @keyframes spin-reverse-slow { 100% { transform: rotate(-360deg); } }
                .animate-spin-slow { animation: spin-slow 4s linear infinite; }
                .animate-spin-reverse-slow { animation: spin-reverse-slow 3s linear infinite; }
            </style>
            <div class="relative w-40 h-40 flex items-center justify-center mb-10 scale-125">
                <div class="absolute inset-0 border-[4px] border-amber-500/30 rounded-full animate-spin-slow"></div>
                <div class="absolute inset-2 border-[4px] border-dashed border-amber-400/80 rounded-full animate-spin-reverse-slow shadow-[0_0_15px_rgba(251,191,36,0.5)]"></div>
                <div class="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 rounded-full blur-2xl animate-pulse"></div>
                <i data-lucide="compass" class="w-16 h-16 text-amber-300 animate-pulse drop-shadow-[0_0_20px_rgba(251,191,36,1)]"></i>
            </div>
            
            <h3 id="legendary-loading-text" class="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-200 tracking-wider drop-shadow-[0_2px_10px_rgba(251,191,36,0.5)] text-center transition-transform duration-300">
                กำลังเชื่อมต่อ...
            </h3>
            
            <div class="mt-6 w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <div id="legendary-progress-bar" class="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000 ease-linear" style="width: 0%"></div>
            </div>
            <p class="text-amber-500/50 text-xs mt-4 font-bold tracking-[0.3em] uppercase">Legendary Extraction Protocol</p>
        `;
        document.body.appendChild(modal);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    const textEl = document.getElementById('legendary-loading-text');
    const barEl = document.getElementById('legendary-progress-bar');
    
    // รีเซ็ตค่า
    barEl.style.width = '0%';
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);

    // 🌟 ชุดข้อความเท่ๆ ที่จะสลับโชว์ใน 4 วินาที
    const messages = [
        "ค้นหาพิกัดลายแทงเวทมนตร์...",
        "วิเคราะห์รหัสลับแห่งตำนาน...",
        "รวบรวมพลังงานสมบัติ...",
        "ปลดผนึกเสร็จสิ้น!"
    ];

    for (let i = 0; i < messages.length; i++) {
        textEl.textContent = messages[i];
        
        textEl.style.transform = 'scale(1.1)';
        setTimeout(() => textEl.style.transform = 'scale(1)', 200);
        
        barEl.style.width = `${((i + 1) / messages.length) * 100}%`;
        
        await new Promise(r => setTimeout(r, 1000)); 
    }
}

window.closeLegendaryLoading = function() {
    const modal = document.getElementById('legendary-loading-modal');
    if(modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 500); 
    }
}

async function trs_onSuccess(decodedText, decodedResult) {
    try { stopScanner(); } catch(e) {}
    if (!decodedText.startsWith('TREASURE:')) { return trs_showAlert('ไม่ใช่ลายแทงสมบัติ', 'QR Code ไม่ใช่ลายแทงของระบบนี้', 'error'); }
    
    const parts = decodedText.split(':'); const questId = parts[1]; const pieceNum = parseInt(parts[2]);
    const quest = trs_quests.find(q => q.id === questId);
    if (!quest) { return trs_showAlert('ไม่พบภารกิจนี้ในระบบ', 'ภารกิจนี้อาจถูกลบไปแล้ว', 'error'); }

    // เช็คซ้ำก่อนโชว์แอนิเมชัน จะได้ไม่เสียเวลาโหลด
    let myData = trs_myTreasures.find(t => t.quest_id === questId);
    if (myData && myData.is_completed) { closeCustomAlert(); return trs_showAlert('สำเร็จไปแล้ว!', 'คุณได้ครอบครองสมบัติชิ้นนี้ไปเรียบร้อยแล้ว 🏆', 'success'); }
    if (myData && myData.collected_pieces.includes(pieceNum)) { closeCustomAlert(); return trs_showAlert('สแกนซ้ำ', `คุณเคยสแกนชิ้นส่วนที่ ${pieceNum} ไปแล้ว ลองหาชิ้นอื่นนะ!`, 'warning'); }

    // 🌟 เรียกใช้หน้าจอโหลดสุดเทพ! (ระบบจะรอตรงนี้ 4 วินาทีเต็ม)
    await playLegendaryLoading();

    try {
        await fetch(TRS_GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'add_piece', student_id: String(trs_user.id), quest_id: questId, piece_num: pieceNum })
        });

        if (!myData) {
            trs_myTreasures.push({ quest_id: questId, collected_pieces: [pieceNum], is_completed: false });
        } else {
            myData.collected_pieces.push(pieceNum);
        }
        
        closeLegendaryLoading();
        closeCustomAlert();
        trs_showFoundModal(quest, pieceNum);
        trs_renderUI();
    } catch (e) { 
        closeLegendaryLoading();
        closeCustomAlert();
        trs_showAlert('เกิดข้อผิดพลาด', 'เชื่อมต่อฐานข้อมูลล้มเหลว กรุณาลองใหม่', 'error'); 
    }
}

window.combineTreasure = async function(questId, questTitle) {
    if (!trs_user || !trs_user.id) return;
    
    // 🌟 ตอนกดรวมร่างสมบัติ ก็เรียกใช้หน้าจอโหลดเทพๆ นี้ด้วย!
    await playLegendaryLoading();

    try {
        // 1. ตรวจสอบก่อนว่าเคยได้สมบัตินี้ไปแล้วหรือยัง (ป้องกันเด็กกดซ้ำ)
        const { data: existingData, error: checkError } = await supabase1
            .from('student_treasures')
            .select('*')
            .eq('student_id', String(trs_user.id))
            .eq('quest_id', questId);
            
        if (checkError) throw checkError;

        if (existingData && existingData.length > 0) {
            closeLegendaryLoading();
            return trs_showAlert("มีอยู่แล้ว!", "คุณมีสมบัตินี้ในครอบครองอยู่แล้ว!", "warning");
        }

        // 2. ถ้ายังไม่มี บันทึกลง Supabase
        const { data, error } = await supabase1
            .from('student_treasures')
            .insert([
                { 
                  student_id: String(trs_user.id), 
                  quest_id: questId 
                }
            ]);

        if (error) throw error;

        // อัปเดต UI ท้องถิ่นว่ารวมสมบัติสำเร็จแล้ว
        const myData = trs_myTreasures.find(t => t.quest_id === questId);
        if (myData) myData.is_completed = true;
        trs_renderUI();
        
        closeLegendaryLoading();
        
        // โชว์หน้าต่างยินดีด้วย! 
        document.getElementById('success-quest-name').textContent = questTitle;
        const modal = document.getElementById('success-modal'); 
        const box = document.getElementById('success-box');
        if(modal && box) {
            modal.classList.remove('hidden'); 
            setTimeout(() => { 
                modal.classList.remove('opacity-0'); 
                box.classList.replace('scale-50', 'scale-100'); 
            }, 10);
        }

        // โหลดข้อมูลกระดานทำเนียบใหม่ให้หน้าแรกอัปเดตทันที
        if (typeof loadTreasureShowcase === "function") {
            loadTreasureShowcase();
        }

    } catch (e) { 
        console.error("Error combining treasure:", e);
        closeLegendaryLoading();
        trs_showAlert('เกิดข้อผิดพลาด', 'รวมร่างสมบัติล้มเหลว', 'error'); 
    }
};

// ==========================================
// 🌟 4. UI Alerts
// ==========================================
function trs_showFoundModal(quest, pieceNum) { 
    document.getElementById('found-piece-num').textContent = pieceNum; 
    document.getElementById('found-quest-title').textContent = quest.title; 
    let defaultImg = `https://ui-avatars.com/api/?name=${pieceNum}&background=fef3c7&color=d97706&size=512&font-size=0.5`; 
    let modalImgUrl = defaultImg;
if (quest.piece_images && quest.piece_images[pieceNum-1]) {
    let piece = quest.piece_images[pieceNum-1];
    modalImgUrl = (typeof piece === 'object') ? (piece.url || defaultImg) : piece;
}
document.getElementById('found-piece-img').src = modalImgUrl;
    const modal = document.getElementById('piece-found-modal'); 
    const box = document.getElementById('piece-found-box'); 
    if(modal && box) {
        modal.classList.remove('hidden'); 
        setTimeout(() => { modal.classList.remove('opacity-0'); box.classList.replace('scale-50', 'scale-100'); }, 10); 
    }
}

window.closePieceModal = function() { 
    const modal = document.getElementById('piece-found-modal'); const box = document.getElementById('piece-found-box'); 
    if(modal && box) {
        modal.classList.add('opacity-0'); box.classList.replace('scale-100', 'scale-50'); 
        setTimeout(() => modal.classList.add('hidden'), 300); 
    }
};

window.closeSuccessModal = function() { 
    const modal = document.getElementById('success-modal'); const box = document.getElementById('success-box'); 
    if(modal && box) {
        modal.classList.add('opacity-0'); box.classList.replace('scale-100', 'scale-50'); 
        setTimeout(() => modal.classList.add('hidden'), 500); 
    }
};

function trs_showAlert(title, message, type = 'error') { 
    const modal = document.getElementById('custom-alert-modal'); 
    
    // 🌟 ถ้าไม่มี Modal สวยๆ ให้สลับไปใช้ Toast แบบ Popup มุมจอแทน
    if(!modal) {
        if (typeof showToast === 'function') {
            showToast(`${title} ${message}`, type);
        } else {
            alert(title + "\n" + message);
        }
        return;
    }

    const topBar = document.getElementById('alert-top-bar'); 
    const iconBg = document.getElementById('alert-icon-bg'); 
    const icon = document.getElementById('alert-icon'); 
    const titleEl = document.getElementById('alert-title'); 
    const msgEl = document.getElementById('alert-message'); 
    const btn = document.getElementById('alert-btn'); 
    
    titleEl.textContent = title; 
    msgEl.textContent = message; 
    
    if (type === 'error') { 
        topBar.className = "absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-red-600"; 
        iconBg.className = "w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 border-8 border-white shadow-[0_0_15px_rgba(225,29,72,0.2)]"; 
        icon.setAttribute('data-lucide', 'x-circle'); icon.className = "w-10 h-10 text-rose-500"; 
        btn.className = "w-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-rose-200 transition-all uppercase tracking-widest flex items-center justify-center gap-2"; 
    } else if (type === 'warning') { 
        topBar.className = "absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 to-orange-500"; 
        iconBg.className = "w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border-8 border-white shadow-[0_0_15px_rgba(245,158,11,0.2)]"; 
        icon.setAttribute('data-lucide', 'alert-triangle'); icon.className = "w-10 h-10 text-amber-500"; 
        btn.className = "w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-amber-200 transition-all uppercase tracking-widest flex items-center justify-center gap-2"; 
    } else if (type === 'success') { 
        topBar.className = "absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500"; 
        iconBg.className = "w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border-8 border-white shadow-[0_0_15px_rgba(16,185,129,0.2)]"; 
        icon.setAttribute('data-lucide', 'check-circle-2'); icon.className = "w-10 h-10 text-emerald-500"; 
        btn.className = "w-full bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-200 transition-all uppercase tracking-widest flex items-center justify-center gap-2"; 
    } 
    if (typeof lucide !== 'undefined') lucide.createIcons(); 
    modal.classList.remove('hidden'); 
    setTimeout(() => { modal.classList.remove('opacity-0'); modal.querySelector('div').classList.remove('scale-95'); }, 10); 
}

window.closeCustomAlert = function() { 
    const modal = document.getElementById('custom-alert-modal'); 
    if(modal) {
        modal.classList.add('opacity-0'); modal.querySelector('div').classList.add('scale-95'); 
        setTimeout(() => modal.classList.add('hidden'), 300); 
    }
};




// ==========================================
// 🌍 4. GEO-QUEST: ระบบแผนที่โลก (LIVE WORLD DROPS)
// ==========================================
let geoMap = null;
let geoUserMarker = null;
let geoWatchId = null;
let activeLiveDrops = []; 
let targetDropId = null;  
let liveDropUnsubscribe = null; 

window.openGeoQuestMap = async function() {
    if (!trs_user) {
        const session = localStorage.getItem('student_session');
        if (session) trs_user = JSON.parse(session);
        if (!trs_user) return trs_showAlert('ยังไม่ได้ล็อกอิน', 'กรุณาล็อกอินก่อนเปิดเรดาร์', 'error');
    }

    const modal = document.getElementById('geo-quest-modal');
    if(!modal) return trs_showAlert('ติดตั้งไม่สมบูรณ์', 'ไม่พบหน้าต่างแผนที่เรดาร์', 'error');
    
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (!geoMap) {
        geoMap = L.map('geo-map', { zoomControl: false }).setView([20.266, 99.988], 18);
       // ✅ เพิ่มโค้ดนี้เข้าไปแทน (ใช้ Google Maps Hybrid - ดาวเทียม + เส้นถนนจริง)
        L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { 
            maxZoom: 20,
            attribution: '© Google'
        }).addTo(geoMap);

        const userIcon = L.divIcon({
            className: 'custom-user-marker',
            html: `<div class="w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-[0_0_20px_#3b82f6] flex items-center justify-center"><div class="w-2 h-2 bg-white rounded-full animate-ping"></div></div>`,
            iconSize: [32, 32], iconAnchor: [16, 16]
        });

        // ตรวจสอบว่าเบราว์เซอร์รองรับ GPS หรือไม่
if ("geolocation" in navigator) {
    
    // ใช้ watchPosition เพื่อติดตามตำแหน่งตลอดเวลาที่เดิน
    navigator.geolocation.watchPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // ถ้ายังไม่มีหมุดผู้เล่น (geoUserMarker) ให้สร้างใหม่และซูมไปหา
            if (!geoUserMarker) {
                // เปลี่ยน geoMap เป็นตัวแปรแผนที่ของคุณ (เช่น map, radarMap)
                geoUserMarker = L.marker([lat, lng]).addTo(geoMap); 
                geoMap.setView([lat, lng], 17); // เลข 17 คือระดับการซูม (ยิ่งเยอะยิ่งใกล้)
            } else {
                // ถ้ามีหมุดแล้ว ให้อัปเดตตำแหน่งขยับตามการเดิน
                geoUserMarker.setLatLng([lat, lng]);
            }
            
            // เรียกฟังก์ชันเช็คระยะห่างกับกล่องสมบัติ (ถ้ามี)
            if (typeof checkProximity === 'function') {
                checkProximity(lat, lng);
            }
        },
        function(error) {
            // แจ้งเตือนเมื่อเกิดข้อผิดพลาดในการดึงตำแหน่ง
            console.warn('GPS Error: ', error.message);
            if (error.code === 1) {
                showToast('คุณยังไม่ได้อนุญาตให้เข้าถึงตำแหน่ง (GPS) ครับ', 'error');
            } else {
                showToast('ค้นหาตำแหน่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
            }
        },
        {
            enableHighAccuracy: true, // 🌟 บังคับใช้ GPS ความแม่นยำสูง (สำคัญมาก)
            maximumAge: 0,            // ไม่ใช้ตำแหน่งเดิมที่แคชไว้
            timeout: 10000            // รอสัญญาณสูงสุด 10 วินาที
        }
    );
} else {
    showToast('อุปกรณ์ของคุณไม่รองรับระบบ GPS', 'error');
}
    } else {
        // ถ้าเปิดซ้ำ ให้ดึงข้อมูลและบังคับอัปเดต GPS ใหม่
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const lat = pos.coords.latitude; const lng = pos.coords.longitude;
                if(geoUserMarker) geoUserMarker.setLatLng([lat, lng]);
                geoMap.setView([lat, lng], 19);
                checkProximity(lat, lng);
            });
        }
        fetchRealWorldDropsLive();
    }
}

function fetchRealWorldDropsLive() {
    if (liveDropUnsubscribe) liveDropUnsubscribe(); 

    const boxIcon = L.divIcon({
        className: 'custom-box-marker',
        html: `<div class="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center border-2 border-amber-400 shadow-[0_0_30px_#f59e0b] animate-bounce"><span class="text-2xl drop-shadow-md">🎁</span></div>`,
        iconSize: [48, 48], iconAnchor: [24, 24]
    });

    liveDropUnsubscribe = db.collection('live_drops').onSnapshot(snap => {
        activeLiveDrops.forEach(t => geoMap.removeLayer(t.marker));
        activeLiveDrops = [];

        snap.docs.forEach(doc => {
            const data = doc.data();
            const alreadyClaimed = data.claimed_by && trs_user && data.claimed_by.includes(String(trs_user.id));
            
            if (!alreadyClaimed) {
                const marker = L.marker([data.lat, data.lng], {icon: boxIcon}).addTo(geoMap);
                activeLiveDrops.push({ id: doc.id, lat: data.lat, lng: data.lng, reward: data.reward, marker: marker });
            }
        });
        
        if(geoUserMarker) checkProximity(geoUserMarker.getLatLng().lat, geoUserMarker.getLatLng().lng);
    });
}

function checkProximity(userLat, userLng) {
    let closestDist = Infinity;
    let closestDrop = null;

    activeLiveDrops.forEach(drop => {
        const dist = geoMap.distance([userLat, userLng], [drop.lat, drop.lng]);
        if (dist < closestDist) { closestDist = dist; closestDrop = drop; }
    });

    const statusText = document.getElementById('geo-status-text');
    const claimBtn = document.getElementById('btn-claim-geo');

    // 🌟 สร้างตัวแปรเก็บสีปุ่ม เพื่อให้เรียกใช้และรีเซ็ตได้ง่ายๆ
    const defaultBtnClass = "w-full py-4 rounded-2xl bg-slate-800 text-slate-500 font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-600 cursor-not-allowed";
    const activeBtnClass = "w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-lg uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(245,158,11,0.6)] cursor-pointer scale-105";

    if (closestDrop) {
        if (closestDist <= 20) { 
            statusText.innerHTML = `<i data-lucide="zap" class="w-5 h-5 text-amber-400 animate-pulse"></i> กล่องสมบัติอยู่ตรงหน้าแล้ว!`;
            claimBtn.disabled = false;
            claimBtn.className = activeBtnClass;
            claimBtn.innerHTML = `<i data-lucide="unlock" class="w-6 h-6"></i> เปิดรับ ${closestDrop.reward} เหรียญ!`;
            targetDropId = closestDrop.id;
        } else {
            statusText.innerHTML = `<i data-lucide="navigation" class="w-5 h-5 text-blue-400"></i> เดินไปที่กล่อง: อีก ${Math.round(closestDist)} เมตร`;
            claimBtn.disabled = true;
            claimBtn.className = defaultBtnClass;
            claimBtn.innerHTML = `<i data-lucide="lock" class="w-5 h-5"></i> เข้าใกล้กล่องในระยะ 20m`;
            targetDropId = null;
        }
    } else {
        statusText.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5 text-emerald-400"></i> โล่งโจ้ง! ไม่มีสมบัติบริเวณนี้เลย`;
        claimBtn.disabled = true;
        // ✅ พระเอกของเราอยู่บรรทัดนี้ครับ! สั่งรีเซ็ตปุ่มให้กลับเป็นสีเทาดำเมื่อไม่มีกล่อง
        claimBtn.className = defaultBtnClass; 
        claimBtn.innerHTML = `<i data-lucide="clock" class="w-5 h-5"></i> รอครูดรอปของ...`;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.claimGeoTreasure = async function() {
    if(!targetDropId) return;
    
    // ค้นหาข้อมูลกล่องที่กำลังจะเก็บ เพื่อเอาจำนวนเงิน (Reward) มาโชว์
    const drop = activeLiveDrops.find(d => d.id === targetDropId);
    if(!drop) return;

    const btn = document.getElementById('btn-claim-geo');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i> กำลังเก็บสมบัติ...`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        // 1. อัปเดตการเก็บใน Firebase
        await db.collection('live_drops').doc(drop.id).update({
            claimed_by: firebase.firestore.FieldValue.arrayUnion(String(trs_user.id))
        });

        // 2. ส่งข้อมูลไป Google Sheets (พร้อมแก้ CORS Error)
        try {
            await fetch(TRS_GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'add_coins', student_id: String(trs_user.id), amount: drop.reward })
            });
        } catch(gasErr) {
            console.log("บันทึกสำรองเงียบๆ:", gasErr);
        }

        // 3. ลบกล่องออกจากแผนที่
        geoMap.removeLayer(drop.marker);
        activeLiveDrops = activeLiveDrops.filter(d => d.id !== drop.id);

        // 🌟 4. แสดง Popup แจ้งยอดเงินที่ได้รับจริง (Toast) และยิงพลุ
        // เรียกใช้ฟังก์ชัน showToast ที่มีอยู่ในระบบหลัก
        if (typeof showToast === 'function') {
            showToast(`🎉 ยินดีด้วย! คุณได้รับสมบัติจำนวน ${drop.reward} G`, 'success');
        }

        // ยิงพลุกระดาษฉลอง (โทนสีทอง Amber ตามสไตล์ 2.5D ที่คุณครูชอบ)
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#fbbf24', '#f59e0b', '#f97316']
            });
        }

        // 5. รีเซ็ตสถานะปุ่มและข้อความบน Radar
        targetDropId = null;
        if(geoUserMarker) checkProximity(geoUserMarker.getLatLng().lat, geoUserMarker.getLatLng().lng);

    } catch (e) {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (typeof showToast === 'function') showToast('เกิดข้อผิดพลาดในการเก็บสมบัติ', 'error');
    }
}

window.closeGeoQuestMap = function() {
    document.getElementById('geo-quest-modal').classList.add('hidden');
    if(geoWatchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchId); 
        geoWatchId = null;
    }
    if (liveDropUnsubscribe) {
        liveDropUnsubscribe();
        liveDropUnsubscribe = null;
    }
}