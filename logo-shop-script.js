// ========================================================
// 🌟 ระบบ Auction House (ประมูลผลงาน 24 ชั่วโมง)
// ========================================================

let currentAuctionFile = null;
let auctionTimerInterval = null;

// 🌟 นำทางระหว่างแท็บ (หน้าตลาด / หน้าคลัง)
function switchAuctionTab(tab) {
    document.getElementById('auction-market-list').classList.add('hidden');
    document.getElementById('auction-inventory-list').classList.add('hidden');
    
    if (tab === 'market') {
        document.getElementById('auction-market-list').classList.remove('hidden');
        loadAuctions();
    } else {
        document.getElementById('auction-inventory-list').classList.remove('hidden');
        loadAuctionInventory();
    }
}

// 🌟 โหลดรายการประมูลที่กำลังเปิดอยู่
async function loadAuctions() {
    const list = document.getElementById('auction-market-list');
    list.innerHTML = '<div class="col-span-full text-center py-10 text-slate-400"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-2"></i> กำลังโหลดลานประมูล...</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const snap = await db.collection('auctions').where('status', '==', 'active').get();
        if (snap.empty) {
            list.innerHTML = '<div class="col-span-full bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] p-10 text-center"><i data-lucide="gavel" class="w-12 h-12 mx-auto mb-3 text-slate-300"></i><p class="font-bold text-slate-500">ยังไม่มีการเปิดประมูลในขณะนี้</p></div>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const auctions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.innerHTML = auctions.map(a => generateAuctionCard(a)).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        startAuctionTimers(); // เริ่มนับถอยหลัง

    } catch (e) {
        list.innerHTML = '<div class="col-span-full text-center py-10 text-rose-500 font-bold">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
    }
}

// 🌟 อัปเดต Card ประมูล: เพิ่มระบบแปลงลิงก์ Google Drive ให้โชว์รูปได้
function generateAuctionCard(a) {
    const isMe = loggedInUser && String(a.seller_id) === String(loggedInUser.id);
    const hasBidder = a.highest_bidder_id !== null;
    const currentPrice = a.current_bid || a.start_price;
    
    // 📍 ระบบแปลงลิงก์ Google Drive ให้เป็น Direct Image
    let displayImgUrl = a.image_url;
    if (displayImgUrl && displayImgUrl.includes('drive.google.com')) {
        const match = displayImgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || displayImgUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) displayImgUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
    }
    
    return `
    <div class="bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden relative group">
        
        <div class="auction-timer hidden" data-endtime="${a.end_time}" data-id="${a.id}"></div>
        
        <div class="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest flex items-center gap-1.5 z-10 border border-white/20 shadow-lg">
            <i data-lucide="shield-question" class="w-3 h-3 text-amber-400"></i> เปิดการประมูลแบบสุ่มปิด
        </div>
        
        <div class="w-full aspect-square bg-slate-100 relative overflow-hidden group-hover:scale-105 transition-transform duration-500 flex items-center justify-center">
            <img src="${displayImgUrl}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/400x400/f8fafc/94a3b8?text=Image+Error'">
        </div>
        
        <div class="p-5 flex-1 flex flex-col bg-white relative z-20">
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex justify-between">
                <span>ผู้ตั้งประมูล: <b class="text-rose-500">${a.seller_name}</b></span>
            </p>
            
            <div class="bg-blue-50/50 rounded-xl p-3 mb-4 border border-blue-100">
                <p class="text-[10px] text-slate-500 font-bold mb-1">สถานะปัจจุบัน:</p>
                <div class="flex items-center justify-between">
                    <span class="text-xl font-black text-blue-600 drop-shadow-sm">${currentPrice} <i data-lucide="coins" class="w-4 h-4 inline text-yellow-500 fill-yellow-500 mb-1"></i></span>
                </div>
                <p class="text-[10px] font-bold text-slate-400 mt-1 truncate">
                    ผู้นำ: <span class="text-blue-500">${hasBidder ? a.highest_bidder_name : 'ยังไม่มีคนบิด'}</span>
                </p>
            </div>

            <div class="mt-auto card-action-area">
                ${isMe 
                    ? `<button disabled class="w-full py-3 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold uppercase tracking-widest cursor-not-allowed">คุณเป็นเจ้าของ</button>`
                    : `<button onclick="openBidModal('${a.id}', ${currentPrice})" class="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"><i data-lucide="gavel" class="w-4 h-4"></i> เสนอราคา</button>`
                }
            </div>
        </div>
    </div>`;
}

// 🌟 อัปเดต Timer หลังบ้าน: ไม่โชว์เวลา และเช็คทุกๆ 5 วินาทีแทนเพื่อไม่หน่วงเครื่อง
function startAuctionTimers() {
    if (auctionTimerInterval) clearInterval(auctionTimerInterval);
    
    auctionTimerInterval = setInterval(() => {
        document.querySelectorAll('.auction-timer').forEach(el => {
            const endTime = new Date(el.dataset.endtime).getTime();
            const now = new Date().getTime();
            const dist = endTime - now;
            
            if (dist < 0) {
                // แอบส่งให้ระบบไปปิดประมูลและแจกของหลังฉาก
                const card = el.closest('.bg-white.rounded-\\[2rem\\]');
                if(card) {
                    const btn = card.querySelector('.card-action-area button');
                    if(btn && !btn.disabled) {
                        btn.disabled = true;
                        btn.className = "w-full py-3 bg-slate-100 text-rose-500 rounded-xl text-xs font-bold uppercase tracking-widest cursor-not-allowed";
                        btn.innerHTML = "การประมูลสิ้นสุดแล้ว";
                        claimExpiredAuction(el.dataset.id); 
                    }
                }
            }
        });
    }, 5000); 
}

// ==========================================
// 🌟 ระบบตั้งประมูล (เช็คกฎ 1 คน 1 ชิ้น)
// ==========================================
async function openAuctionUploadModal() {
    if(!loggedInUser) return showToast('กรุณาล็อกอินก่อน', 'error');
    
    // 🚨 เช็คกฎ 1 คน 1 ชิ้น!
    const checkSnap = await db.collection('auctions')
        .where('seller_id', '==', String(loggedInUser.id))
        .where('status', '==', 'active')
        .get();
        
    if (!checkSnap.empty) {
        return showToast('คุณมีการประมูลที่กำลังเปิดอยู่! ต้องรอให้หมดเวลา 24 ชม. ก่อนจึงจะตั้งใหม่ได้ครับ', 'error');
    }

    document.getElementById('auction-stu-name').value = loggedInUser.name;
    document.getElementById('auction-start-price').value = 50;
    currentAuctionFile = null;
    document.getElementById('auction-preview').innerHTML = '<div class="text-center text-slate-400 group-hover:text-rose-500 transition-colors"><i data-lucide="image" class="w-10 h-10 mx-auto mb-2 opacity-50"></i><p class="text-xs font-bold">แนะนำขนาดภาพ 1:1</p></div>';
    
    const modal = document.getElementById('auction-upload-modal');
    modal.classList.remove('hidden'); setTimeout(() => modal.classList.add('active'), 10);
    lucide.createIcons();
}

function closeAuctionUploadModal() {
    const modal = document.getElementById('auction-upload-modal');
    modal.classList.remove('active'); setTimeout(() => modal.classList.add('hidden'), 300);
}

async function previewAuctionFile(e) {
    const file = e.target.files[0]; if(!file) return;
    if(file.size > 2 * 1024 * 1024) return showToast('รูปต้องขนาดไม่เกิน 2MB', 'error');
    
    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
    try {
        const compressedFile = await imageCompression(file, options);
        currentAuctionFile = { 
            name: compressedFile.name, 
            type: compressedFile.type, 
            base64: await readFileAsBase64(compressedFile),
            file: compressedFile // 🟢 เพิ่มบรรทัดนี้ เพื่อเก็บไฟล์ไปส่งให้ Supabase
        };
        document.getElementById('auction-preview').innerHTML = `<img src="${currentAuctionFile.base64}" class="w-full h-full object-cover">`;
    } catch (err) { showToast('บีบอัดรูปไม่สำเร็จ', 'error'); }
}

// 🟢 [อัปเดตใหม่]: เพิ่ม Fallback ป้องกันค่าว่าง (undefined) ที่ทำให้บันทึก Firestore ไม่ได้
async function uploadAndCreateAuction() {
    if(!currentAuctionFile) return showToast('กรุณาเลือกรูปภาพ', 'error');
    const startPrice = parseInt(document.getElementById('auction-start-price').value);
    if(isNaN(startPrice) || startPrice < 10) return showToast('ราคาเริ่มต้นขั้นต่ำ 10 เหรียญ', 'error');

    const btn = document.getElementById('btn-create-auction'); 
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> กำลังอัปโหลด...'; 
    btn.disabled = true; 
    if(typeof lucide !== 'undefined') lucide.createIcons();

    try {
       
        // 🚀 1. อัปโหลดภาพเข้า Supabase
        const fileData = await uploadToSupabase(currentAuctionFile.file, `Auction_${loggedInUser.id}`);
        const imageUrl = fileData.url;

        // 2. คำนวณเวลาประมูล + 24 ชั่วโมง
        const endTime = new Date();
        endTime.setHours(endTime.getHours() + 24);

        // 3. บันทึกข้อมูลลง Firestore (ใส่ || "" เพื่อป้องกัน undefined)
        await db.collection('auctions').add({
            seller_id: String(loggedInUser.id || "unknown"),
            seller_name: loggedInUser.name || "นักเรียนลึกลับ",
            image_url: imageUrl || "",
            start_price: startPrice || 10,
            current_bid: startPrice || 10,
            highest_bidder_id: null,
            highest_bidder_name: null,
            end_time: endTime.toISOString(),
            status: 'active',
            created_at: new Date().toISOString()
        });

        showToast('เปิดประมูลสำเร็จ! ขอให้โชคดีนะ', 'success');
        closeAuctionUploadModal();
        loadAuctions();

    } catch (e) {
        console.error("Auction Error:", e); // พิมพ์ Error ลง Console เพื่อให้หาสาเหตุง่ายขึ้น
        showToast('เกิดข้อผิดพลาด: ' + (e.message || "ระบบไม่ตอบสนอง"), 'error');
    } finally {
        btn.innerHTML = origHtml; 
        btn.disabled = false; 
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ==========================================
// 🌟 ระบบเสนอราคา (Bidding & Escrow)
// ==========================================
function openBidModal(auctionId, currentPrice) {
    if(!loggedInUser) return showToast('กรุณาล็อกอินก่อน', 'error');
    
    // รีเฟรชเหรียญให้ชัวร์ก่อนประมูล
    checkShopCoinsQuietly(loggedInUser.id);
    
    document.getElementById('bid-auction-id').value = auctionId;
    document.getElementById('bid-current-price').textContent = currentPrice;
    
    const input = document.getElementById('bid-amount-input');
    input.value = currentPrice + 10; // แนะนำบิดเพิ่ม 10 เหรียญ
    input.min = currentPrice + 1;

    const modal = document.getElementById('bid-modal');
    modal.classList.remove('hidden'); setTimeout(() => modal.classList.add('active'), 10);
}

function closeBidModal() {
    const modal = document.getElementById('bid-modal');
    modal.classList.remove('active'); setTimeout(() => modal.classList.add('hidden'), 300);
}

async function confirmBid() {
    const auctionId = document.getElementById('bid-auction-id').value;
    const bidAmount = parseInt(document.getElementById('bid-amount-input').value);
    const currentPrice = parseInt(document.getElementById('bid-current-price').textContent);

    if(isNaN(bidAmount) || bidAmount <= currentPrice) return showToast('ต้องเสนอราคาให้มากกว่าปัจจุบัน!', 'error');
    if(currentStudentCoins < bidAmount) return showToast('เหรียญของคุณไม่พอสู้ราคา!', 'error');

    const btn = document.getElementById('btn-confirm-bid'); const origHtml = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> กำลังสู้ราคา...'; btn.disabled = true; lucide.createIcons();

    try {
        // ดึงข้อมูลประมูลล่าสุด
        const auctionRef = db.collection('auctions').doc(auctionId);
        const doc = await auctionRef.get();
        if(!doc.exists || doc.data().status !== 'active') throw new Error("การประมูลนี้ถูกปิดไปแล้ว");
        
        const aData = doc.data();
        if (bidAmount <= aData.current_bid) throw new Error("มีคนปาดหน้าบิดราคาสูงกว่าคุณไปแล้ว! ลองใหม่");

        // 🌟 ถอนเหรียญคืนให้คนเก่าที่แพ้ประมูล (ถ้ามี)
        if (aData.highest_bidder_id) {
            await db.collection('shop_transactions').add({
                student_id: aData.highest_bidder_id,
                amount: aData.current_bid,
                item: `รับเงินคืน (โดนปาดหน้าประมูล: โลโก้ของ ${aData.seller_name})`,
                timestamp: new Date().toISOString()
            });
        }

        // 🌟 หักเหรียญคนใหม่ (เรา)
        await db.collection('shop_transactions').add({
            student_id: String(loggedInUser.id),
            amount: -bidAmount,
            item: `วางเงินประกันประมูล (โลโก้ของ ${aData.seller_name})`,
            timestamp: new Date().toISOString()
        });

        // 🌟 อัปเดตราคาใหม่
        await auctionRef.update({
            current_bid: bidAmount,
            highest_bidder_id: String(loggedInUser.id),
            highest_bidder_name: loggedInUser.name
        });

        showToast('สู้ราคาสำเร็จ! คุณคือผู้นำตอนนี้', 'success');
        closeBidModal();
        loadAuctions(); 
        checkShopCoinsQuietly(loggedInUser.id); // อัปเดตเหรียญตัวเอง

    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.innerHTML = origHtml; btn.disabled = false; lucide.createIcons();
    }
}

// ==========================================
// 🌟 ระบบแจกของเมื่อประมูลจบ (Claim Expired)
// ==========================================
let processingAuctions = new Set(); // ป้องกันการรันซ้ำ

async function claimExpiredAuction(auctionId) {
    if(processingAuctions.has(auctionId)) return;
    processingAuctions.add(auctionId);

    try {
        const auctionRef = db.collection('auctions').doc(auctionId);
        const doc = await auctionRef.get();
        if(!doc.exists) return;
        const aData = doc.data();
        if(aData.status !== 'active') return; // จบไปแล้ว

        // เช็คอีกรอบให้ชัวร์ว่าเวลาหมดจริง
        if(new Date(aData.end_time).getTime() > new Date().getTime()) return;

        // 🌟 ปิดสถานะ
        await auctionRef.update({ status: 'completed' });

        if (aData.highest_bidder_id) {
            // 🌟 มีคนชนะ: โอนเงินให้ผู้ขาย
            await db.collection('shop_transactions').add({
                student_id: aData.seller_id,
                amount: aData.current_bid,
                item: `รายได้จากการประมูลโลโก้ (ขายให้ ${aData.highest_bidder_name})`,
                timestamp: new Date().toISOString()
            });
            
            // 🌟 ให้ของกับผู้ซื้อ (บันทึกลงคลัง)
            await db.collection('student_inventory').add({
                student_id: aData.highest_bidder_id,
                image_url: aData.image_url,
                acquired_from: 'auction',
                timestamp: new Date().toISOString()
            });
            
            console.log(`Auction ${auctionId} completed successfully.`);
        } else {
            console.log(`Auction ${auctionId} closed with no bids.`);
        }

    } catch(e) {
        console.error("Error closing auction:", e);
    } finally {
        processingAuctions.delete(auctionId);
    }
}

// 🌟 ระบบคลังผลงานที่ประมูลชนะมาได้ (แก้ภาพแตกแล้ว)
async function loadAuctionInventory() {
    if(!loggedInUser) return;
    const list = document.getElementById('auction-inventory-list');
    list.innerHTML = '<div class="col-span-full text-center py-10 text-slate-400"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-2"></i> กำลังโหลดคลัง...</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const snap = await db.collection('student_inventory').where('student_id', '==', String(loggedInUser.id)).get();
        if (snap.empty) {
            list.innerHTML = '<div class="col-span-full bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] p-10 text-center"><i data-lucide="folder-open" class="w-12 h-12 mx-auto mb-3 text-slate-300"></i><p class="font-bold text-slate-500">คุณยังไม่เคยประมูลชนะผลงานชิ้นใดเลย</p></div>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const items = snap.docs.map(d => d.data());
        list.innerHTML = items.map(item => {
            // 📍 ระบบแปลงลิงก์ Google Drive
            let displayImgUrl = item.image_url;
            if (displayImgUrl && displayImgUrl.includes('drive.google.com')) {
                const match = displayImgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || displayImgUrl.match(/id=([a-zA-Z0-9_-]+)/);
                if (match && match[1]) displayImgUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
            }

            return `
            <div class="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-4 text-center">
                <div class="w-full aspect-square bg-slate-100 rounded-[1.5rem] mb-4 overflow-hidden border border-slate-200 flex items-center justify-center">
                    <img src="${displayImgUrl}" class="w-full h-full object-cover hover:scale-110 transition-transform" onerror="this.src='https://placehold.co/400x400/f8fafc/94a3b8?text=Image+Error'">
                </div>
                <h4 class="font-bold text-slate-700 text-sm">ลิขสิทธิ์ของคุณ</h4>
                <p class="text-[10px] text-slate-400">ได้มาจากการประมูล</p>
                <a href="${item.image_url}" target="_blank" class="w-full mt-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-colors inline-block">ดาวน์โหลดภาพเต็ม</a>
            </div>
            `;
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch(e) {
        list.innerHTML = '<div class="col-span-full text-center py-10 text-rose-500 font-bold">เกิดข้อผิดพลาด</div>';
    }
}

// 🌟 Helper: อัปเดตเหรียญเงียบๆ ไว้หลังฉาก
async function checkShopCoinsQuietly(stuId) {
    try {
        const student = teacherDbStudents.find(s => String(s.student_id) === String(stuId));
        if(!student) return;
        const spentSnap = await db.collection('shop_transactions').where('student_id', '==', stuId).get();
        let spentCoins = 0; spentSnap.forEach(doc => { spentCoins += doc.data().amount; });
        currentStudentCoins = Math.floor((student.total || 0) * 10) - spentCoins;
    } catch(e) {}
}

// เรียกตอนโหลดหน้าเว็บ
window.addEventListener('load', () => {
    switchAuctionTab('market');
});