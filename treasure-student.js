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

// ==========================================
// 🌟 1. ระบบเริ่มต้น
// ==========================================
window.initTreasureHunt = async function() {
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

function trs_renderUI() {
    const activeContainer = document.getElementById('active-quests'); 
    const completedContainer = document.getElementById('completed-quests');
    if(!activeContainer || !completedContainer) return;
    
    let activeHTML = ''; let completedHTML = '';

    if (trs_quests.length === 0) {
        activeContainer.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm">ยังไม่มีภารกิจล่าสมบัติในขณะนี้ครับ</div>';
        completedContainer.innerHTML = '<div class="col-span-full text-center py-6 text-slate-400 text-sm">ยังไม่มีสมบัติในกระเป๋า ออกไปตามหาเลย!</div>';
        return;
    }

    trs_quests.forEach(quest => {
        const myData = trs_myTreasures.find(t => t.quest_id === quest.id);
        const collectedPieces = myData ? myData.collected_pieces : [];
        const isCompleted = myData ? myData.is_completed : false;

        if (isCompleted) {
            let coverBg = quest.cover_url ? `background-image: url('${quest.cover_url}'); background-size: cover; background-position: center;` : `background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%);`;
            completedHTML += `<div class="relative rounded-[2rem] overflow-hidden shadow-[0_10px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:-translate-y-2 transition-all duration-500 cursor-pointer group aspect-[4/5] border-2 border-amber-300/50 hover:border-amber-400 bg-slate-900"><div class="absolute inset-0 transition-transform duration-700 group-hover:scale-110 opacity-90" style="${coverBg}"></div><div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent opacity-90 group-hover:opacity-80 transition-opacity duration-500"></div><div class="absolute inset-0 overflow-hidden rounded-[2rem] z-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"><div class="absolute top-0 left-[-150%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 animate-legendary-shine"></div></div><div class="absolute inset-0 p-4 flex flex-col items-center justify-end text-center z-10 pb-5"><div class="absolute top-3 right-3 bg-black/40 backdrop-blur-md rounded-full p-2 border border-white/10 shadow-sm group-hover:rotate-12 transition-transform"><i data-lucide="gem" class="w-4 h-4 text-amber-300"></i></div>${!quest.cover_url ? `<div class="w-14 h-14 bg-gradient-to-br from-yellow-300 to-amber-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.6)] mb-auto mt-6 border-2 border-white/80 group-hover:scale-110 transition-transform duration-500"><i data-lucide="crown" class="w-7 h-7 text-white drop-shadow-md"></i></div>` : `<div class="mt-auto"></div>`}<div class="w-full transform group-hover:-translate-y-1 transition-transform duration-500"><h3 class="font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-500 text-lg leading-tight line-clamp-2 drop-shadow-[0_4px_4px_rgba(0,0,0,0.9)] mb-3">${quest.title}</h3><div class="inline-flex items-center gap-1.5 text-[9px] font-black text-amber-950 bg-gradient-to-r from-yellow-300 to-amber-500 px-3 py-1.5 rounded-full uppercase tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-yellow-200/50"><i data-lucide="sparkles" class="w-3 h-3"></i> สมบัติระดับตำนาน</div></div></div></div>`;
        } else {
            const pct = Math.round((collectedPieces.length / quest.total_pieces) * 100);
            let coverHtml = '';
            if (quest.cover_url) { coverHtml = `<div class="flex gap-4 items-center mb-4"><div class="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-[1rem] overflow-hidden shadow-sm border border-slate-100 relative"><img src="${quest.cover_url}" class="w-full h-full object-cover"><div class="absolute inset-0 bg-slate-900/5 mix-blend-overlay"></div></div><div class="flex-1 min-w-0"><h3 class="font-bold text-slate-800 text-lg sm:text-xl leading-tight line-clamp-2 mb-2">${quest.title}</h3><span class="inline-flex text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">สะสม ${collectedPieces.length}/${quest.total_pieces} ชิ้น</span></div></div>`; } else { coverHtml = `<div class="flex justify-between items-center mb-4"><h3 class="font-bold text-slate-800 text-lg sm:text-xl truncate pr-2">${quest.title}</h3><span class="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 shrink-0">สะสม ${collectedPieces.length}/${quest.total_pieces} ชิ้น</span></div>`; }
            let galleryHtml = '<div class="flex gap-3 mt-4 overflow-x-auto custom-scrollbar pb-3">';
            for(let i = 1; i <= quest.total_pieces; i++) { let isFound = collectedPieces.includes(i); let defaultImg = `https://ui-avatars.com/api/?name=${i}&background=fef3c7&color=d97706&size=128&font-size=0.5`; let imgUrl = (quest.piece_images && quest.piece_images[i-1]) ? quest.piece_images[i-1] : defaultImg; if(isFound) { galleryHtml += `<div class="w-14 h-14 shrink-0 rounded-[14px] overflow-hidden border-[3px] border-amber-400 shadow-md relative group"><img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-110 transition-transform"><div class="absolute inset-0 bg-amber-500/20 mix-blend-overlay"></div></div>`; } else { galleryHtml += `<div class="w-14 h-14 shrink-0 rounded-[14px] bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center shadow-inner"><i data-lucide="lock" class="w-5 h-5 text-slate-300"></i></div>`; } } galleryHtml += '</div>';
            let actionBtn = ''; if (collectedPieces.length === quest.total_pieces) { actionBtn = `<button onclick="combineTreasure('${quest.id}', '${quest.title}')" class="w-full mt-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-200 animate-pulse flex items-center justify-center gap-2 uppercase tracking-widest"><i data-lucide="sparkles" class="w-4 h-4"></i> รวมชิ้นส่วนเป็นสมบัติ!</button>`; }
            activeHTML += `<div class="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm relative group hover:border-amber-300 transition-colors">${coverHtml}<div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner mt-2 mb-2"><div class="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-700" style="width: ${pct}%"></div></div>${galleryHtml}${actionBtn}</div>`;
        }
    });

    activeContainer.innerHTML = activeHTML || '<div class="text-center py-6 text-slate-400 text-sm">ไม่มีภารกิจใหม่ในขณะนี้</div>';
    completedContainer.innerHTML = completedHTML || '<div class="col-span-full text-center py-6 text-slate-400 text-sm">ยังไม่มีสมบัติในกระเป๋า ออกไปตามหาเลย!</div>';
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
    // 🌟 ตอนกดรวมร่างสมบัติ ก็เรียกใช้หน้าจอโหลดเทพๆ นี้ด้วย!
    await playLegendaryLoading();

    try {
        await fetch(TRS_GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'complete_quest', student_id: String(trs_user.id), quest_id: questId })
        });

        const myData = trs_myTreasures.find(t => t.quest_id === questId);
        if (myData) myData.is_completed = true;
        trs_renderUI();
        
        closeLegendaryLoading();
        
        document.getElementById('success-quest-name').textContent = questTitle;
        const modal = document.getElementById('success-modal'); const box = document.getElementById('success-box');
        if(modal && box) {
            modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); box.classList.replace('scale-50', 'scale-100'); }, 10);
        }
    } catch (e) { 
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
    document.getElementById('found-piece-img').src = (quest.piece_images && quest.piece_images[pieceNum-1]) ? quest.piece_images[pieceNum-1] : defaultImg; 
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