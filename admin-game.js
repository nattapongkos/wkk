lucide.createIcons();

let customExpTable = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 3800, 4700, 5700, 6800, 8000, 9300, 10700, 12200, 13800, 15500, 17500];
let gameMaps = [];
let currentMapId = null;

function toggleAccordion(headerEl) {
    const wrapper = headerEl.nextElementSibling;
    const icon = headerEl.querySelector('.chevron-icon');
    if (wrapper.style.maxHeight === '0px' || !wrapper.style.maxHeight) {
        wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
        icon.style.transform = 'rotate(180deg)';
        setTimeout(() => { wrapper.style.maxHeight = 'none'; }, 300);
    } else {
        wrapper.style.maxHeight = wrapper.scrollHeight + 'px'; 
        wrapper.offsetHeight; 
        wrapper.style.maxHeight = '0px';
        icon.style.transform = 'rotate(0deg)';
    }
}

function openExpSettings() {
    let html = '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-left p-2">';
    for(let i = 2; i <= 20; i++) {
        let expVal = customExpTable[i-1];
        if (expVal === undefined || expVal === null) expVal = 9999;
        html += `<div class="input-group"><label class="text-xs text-amber-700">LVL ${i-1} ➜ ${i}</label><input type="number" id="exp-lvl-${i}" value="${expVal}" class="border-amber-200 focus:border-amber-500 w-full rounded-xl px-3 py-2 text-sm font-bold bg-amber-50"></div>`;
    }
    html += '</div>';

    Swal.fire({
        title: '🌟 ตั้งค่าค่าประสบการณ์ (EXP)',
        html: html, width: '800px', showCancelButton: true, confirmButtonColor: '#f59e0b', confirmButtonText: 'พักข้อมูลไว้', cancelButtonText: 'ยกเลิก', customClass: { popup: 'rounded-[2rem]' }
    }).then((result) => {
        if(result.isConfirmed) {
            for(let i = 2; i <= 20; i++) {
                let val = parseInt(document.getElementById(`exp-lvl-${i}`).value);
                customExpTable[i-1] = isNaN(val) ? 9999 : val;
            }
            Swal.fire({toast: true, position: 'top', icon: 'success', title: 'จำค่า EXP แล้ว!', showConfirmButton: false, timer: 3000});
        }
    });
}

function generateId(prefix) { return prefix + '_' + Date.now() + Math.floor(Math.random() * 1000); }
function updateCurrentMapName(newName) { const sel = document.getElementById('map-selector'); if(sel && sel.options[sel.selectedIndex]) sel.options[sel.selectedIndex].text = newName || 'แผนที่ไม่มีชื่อ'; }

function renderMapSelector() {
    const sel = document.getElementById('map-selector'); if(!sel) return;
    sel.innerHTML = ''; gameMaps.forEach(m => { const opt = document.createElement('option'); opt.value = m.id; opt.text = m.name || 'แผนที่: ' + m.id; sel.appendChild(opt); });
    sel.value = currentMapId;
}

function createNewMap() {
    saveCurrentMapStateToMemory();
    const newMap = { id: generateId('map'), name: 'แผนที่ใหม่', bg: '', ground: '', boardUrl: '', npcs: [], monsters: [], portals: [], objects: [] };
    gameMaps.push(newMap); currentMapId = newMap.id; renderMapSelector(); loadMapEditor(newMap);
    Swal.fire({toast: true, position: 'top', icon: 'success', title: 'สร้างแผนที่ใหม่แล้ว!', showConfirmButton: false, timer: 1500});
}

function changeMap(mapId) { saveCurrentMapStateToMemory(); currentMapId = mapId; const map = gameMaps.find(m => m.id === mapId); loadMapEditor(map); }

function saveCurrentMapStateToMemory() {
    if (!currentMapId) return; const mapIndex = gameMaps.findIndex(m => m.id === currentMapId); if (mapIndex === -1) return;
    gameMaps[mapIndex].name = document.getElementById('map-name') ? document.getElementById('map-name').value : '';
    gameMaps[mapIndex].bg = document.getElementById('env-bg') ? document.getElementById('env-bg').value : '';
    gameMaps[mapIndex].ground = document.getElementById('env-ground') ? document.getElementById('env-ground').value : '';
    gameMaps[mapIndex].boardUrl = document.getElementById('env-board') ? document.getElementById('env-board').value : '';

    gameMaps[mapIndex].portals = Array.from(document.querySelectorAll('.portal-item')).map(el => ({
        id: el.querySelector('.portal-id').value, name: el.querySelector('.portal-name').value, x: parseFloat(el.querySelector('.portal-x').value), 
        targetMapId: el.querySelector('.portal-target-map').value, targetX: parseFloat(el.querySelector('.portal-target-x').value)
    }));

    gameMaps[mapIndex].objects = Array.from(document.querySelectorAll('.object-item')).map(el => ({
        id: el.querySelector('.obj-id').value, name: el.querySelector('.obj-name') ? el.querySelector('.obj-name').value : '', 
        url: el.querySelector('.obj-url').value, x: parseFloat(el.querySelector('.obj-x').value), message: el.querySelector('.obj-msg').value
    }));

    gameMaps[mapIndex].npcs = Array.from(document.querySelectorAll('.npc-item')).map(el => ({
        id: el.querySelector('.npc-id').value, name: el.querySelector('.npc-name') ? el.querySelector('.npc-name').value : '', 
        url: el.querySelector('.npc-url').value, x: parseFloat(el.querySelector('.npc-x').value), message: el.querySelector('.npc-msg').value, 
        hasQuiz: el.querySelector('.npc-has-quiz').checked, quizzes: el.querySelector('.npc-has-quiz').checked ? extractQuizzes(el) : []
    }));

    gameMaps[mapIndex].monsters = Array.from(document.querySelectorAll('.monster-item')).map(el => ({
        id: el.querySelector('.mon-id').value, url: el.querySelector('.mon-url').value, x: parseFloat(el.querySelector('.mon-x').value), hp: parseInt(el.querySelector('.mon-hp').value),
        rewardExp: parseInt(el.querySelector('.mon-exp').value), rewardCoins: parseInt(el.querySelector('.mon-coins').value), quizzes: extractQuizzes(el)
    }));
}

function loadMapEditor(map) {
    if(document.getElementById('map-name')) document.getElementById('map-name').value = map.name || '';
    if(document.getElementById('env-bg')) { document.getElementById('env-bg').value = map.bg || ''; document.getElementById('preview-bg').src = map.bg || ''; }
    if(document.getElementById('env-ground')) {
        document.getElementById('env-ground').value = map.ground || ''; const previewG = document.getElementById('preview-ground'); const boxG = document.getElementById('preview-ground-box');
        if(previewG && boxG) { previewG.src = map.ground || ''; map.ground ? boxG.classList.remove('hidden') : boxG.classList.add('hidden'); }
    }
    if(document.getElementById('env-board')) {
        document.getElementById('env-board').value = map.boardUrl || ''; const previewB = document.getElementById('preview-board'); const boxB = document.getElementById('preview-board-box');
        if(previewB && boxB) { previewB.src = map.boardUrl || ''; map.boardUrl ? boxB.classList.remove('hidden') : boxB.classList.add('hidden'); }
    }

    const portalList = document.getElementById('portal-list'); if(portalList) { portalList.innerHTML = ''; (map.portals || []).forEach(p => addPortalRow(p)); }
    const objList = document.getElementById('object-list'); if(objList) { objList.innerHTML = ''; (map.objects || []).forEach(obj => addObjectRow(obj)); }
    const npcList = document.getElementById('npc-list'); if(npcList) { npcList.innerHTML = ''; (map.npcs || []).forEach(npc => addNpcRow(npc)); }
    const monList = document.getElementById('monster-list'); if(monList) { monList.innerHTML = ''; (map.monsters || []).forEach(mon => addMonsterRow(mon)); }
}

function addPortalRow(data = {}) {
    const id = data.id || generateId('portal'); const x = data.x || 1000; const name = data.name || 'ประตูมิติ'; const targetMapId = data.targetMapId || ''; const targetX = data.targetX || 200;
    let mapOptions = ''; gameMaps.forEach(m => { mapOptions += `<option value="${m.id}" ${targetMapId===m.id?'selected':''}>${m.name || m.id}</option>`; });

    const html = `<div id="${id}" class="portal-item bg-white border-2 border-cyan-200 rounded-2xl p-5 flex flex-wrap gap-4 items-end shadow-sm transition-all hover:border-cyan-400"><input type="hidden" class="portal-id" value="${id}"><div class="flex-1 input-group"><label class="text-cyan-700">ข้อความบนจุดวาร์ป</label><input type="text" class="portal-name border-cyan-200 focus:border-cyan-500 bg-cyan-50" value="${name}" placeholder="เช่น ไปป่าปีศาจ"></div><div class="w-24 input-group"><label class="text-cyan-700">พิกัด X</label><input type="number" class="portal-x border-cyan-200 focus:border-cyan-500 bg-cyan-50" value="${x}"></div><div class="w-full md:w-auto flex-1 input-group"><label class="text-cyan-700">ปลายทาง: วาร์ปไปแผนที่</label><select class="portal-target-map border-cyan-200 focus:border-cyan-500 bg-cyan-50 font-bold text-cyan-800">${mapOptions}</select></div><div class="w-32 input-group"><label class="text-cyan-700">โผล่พิกัด X</label><input type="number" class="portal-target-x border-cyan-200 focus:border-cyan-500 bg-cyan-50" value="${targetX}"></div><button onclick="confirmRemove('${id}', 'จุดวาร์ป')" class="text-rose-400 hover:text-white hover:bg-rose-500 p-3 bg-white rounded-xl shadow-sm border border-rose-100 mb-1 transition-colors"><i data-lucide="trash-2"></i></button></div>`;
    if(document.getElementById('portal-list')) { document.getElementById('portal-list').insertAdjacentHTML('beforeend', html); lucide.createIcons(); }
}

function addObjectRow(data = {}) {
    const id = data.id || generateId('obj'); const url = data.url || ''; const name = data.name || ''; const x = data.x || 300; const msg = data.message || ''; 
    const html = `<div id="${id}" class="object-item bg-emerald-50/50 border-2 border-emerald-200 rounded-2xl overflow-hidden shadow-sm transition-all"><input type="hidden" class="obj-id" value="${id}"><div class="bg-emerald-100/50 p-4 cursor-pointer flex justify-between items-center hover:bg-emerald-100 transition-colors" onclick="toggleAccordion(this)"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-white rounded-lg border-2 border-emerald-200 flex items-center justify-center overflow-hidden"><img id="preview-obj-thumb-${id}" src="${url}" class="${url ? '' : 'hidden'} max-w-full max-h-full object-contain"><i data-lucide="tree-pine" class="w-5 h-5 text-emerald-400 ${url ? 'hidden' : ''}" id="icon-obj-thumb-${id}"></i></div><span class="font-bold text-emerald-700">วัตถุ: <span class="display-name text-emerald-600">${name || 'ป้ายประกาศ'}</span> (พิกัด X: <span class="display-x">${x}</span>)</span></div><div class="flex items-center gap-4"><button type="button" onclick="event.stopPropagation(); confirmRemove('${id}', 'วัตถุ')" class="text-rose-400 hover:text-rose-600 p-2"><i data-lucide="trash-2" class="w-5 h-5"></i></button><i data-lucide="chevron-down" class="chevron-icon w-5 h-5 text-emerald-500 transition-transform duration-300 transform rotate-180"></i></div></div><div class="accordion-wrapper overflow-hidden transition-all duration-300" style="max-height: 0px;"><div class="p-5 border-t-2 border-emerald-200 bg-white"><div class="flex flex-wrap gap-4 items-center mb-4"><div class="flex-1 input-group"><label class="text-emerald-600">URL รูปวัตถุ</label><input type="text" value="${url}" class="obj-url focus:border-emerald-500" oninput="document.getElementById('preview-obj-thumb-${id}').src=this.value; document.getElementById('preview-obj-thumb-${id}').classList.remove('hidden'); document.getElementById('icon-obj-thumb-${id}').classList.add('hidden');"></div><div class="w-40 input-group"><label class="text-emerald-600">ชื่อวัตถุ</label><input type="text" value="${name}" class="obj-name focus:border-emerald-500" placeholder="เช่น ป้ายหิน" oninput="this.closest('.object-item').querySelector('.display-name').innerText=this.value || 'ป้ายประกาศ'"></div><div class="w-24 input-group"><label class="text-emerald-600">พิกัด X</label><input type="number" value="${x}" class="obj-x focus:border-emerald-500" oninput="this.closest('.object-item').querySelector('.display-x').innerText=this.value"></div></div><div class="w-full input-group"><label class="text-emerald-600">รายละเอียด / เกร็ดความรู้ (กด Enter แบ่งหน้าได้)</label><textarea class="obj-msg w-full border-2 border-emerald-200 rounded-xl p-3 outline-none focus:border-emerald-500 font-bold text-slate-700 resize-y" rows="2">${msg}</textarea></div></div></div></div>`;
    if(document.getElementById('object-list')) { document.getElementById('object-list').insertAdjacentHTML('beforeend', html); lucide.createIcons(); }
}

function addNpcRow(data = {}) {
    const id = data.id || generateId('npc'); const url = data.url || ''; const name = data.name || ''; const x = data.x || 500; const msg = data.message || ''; const hasQuiz = data.hasQuiz || false;
    const html = `
    <div id="${id}" class="npc-item bg-slate-50 border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all">
        <input type="hidden" class="npc-id" value="${id}">
        <div class="bg-slate-100 p-4 cursor-pointer flex justify-between items-center hover:bg-slate-200 transition-colors" onclick="toggleAccordion(this)">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-white rounded-lg border-2 border-slate-200 flex items-center justify-center overflow-hidden">
                    <img id="preview-npc-thumb-${id}" src="${url}" class="${url ? '' : 'hidden'} max-w-full max-h-full object-contain">
                    <i data-lucide="bot" class="w-5 h-5 text-slate-400 ${url ? 'hidden' : ''}" id="icon-npc-thumb-${id}"></i>
                </div>
                <span class="font-bold text-slate-700">NPC: <span class="display-name text-indigo-600">${name || 'ชาวบ้าน'}</span> (พิกัด X: <span class="display-x">${x}</span>)</span>
            </div>
            <div class="flex items-center gap-4">
                <button type="button" onclick="event.stopPropagation(); confirmRemove('${id}', 'NPC')" class="text-rose-400 hover:text-rose-600 p-2"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                <i data-lucide="chevron-down" class="chevron-icon w-5 h-5 text-slate-500 transition-transform duration-300 transform rotate-180"></i>
            </div>
        </div>
        <div class="accordion-wrapper overflow-hidden transition-all duration-300" style="max-height: 0px;">
            <div class="p-5 border-t-2 border-slate-200 bg-white">
                <div class="flex flex-wrap gap-4 items-center mb-4">
                    <div class="flex-1 input-group"><label>URL รูป NPC</label><input type="text" value="${url}" class="npc-url" oninput="document.getElementById('preview-npc-thumb-${id}').src=this.value; document.getElementById('preview-npc-thumb-${id}').classList.remove('hidden'); document.getElementById('icon-npc-thumb-${id}').classList.add('hidden');"></div>
                    <div class="w-40 input-group"><label>ชื่อ NPC</label><input type="text" value="${name}" class="npc-name" placeholder="เช่น ผู้เฒ่าเต่า" oninput="this.closest('.npc-item').querySelector('.display-name').innerText=this.value || 'ชาวบ้าน'"></div>
                    <div class="w-24 input-group"><label>พิกัด X</label><input type="number" value="${x}" class="npc-x" oninput="this.closest('.npc-item').querySelector('.display-x').innerText=this.value"></div>
                </div>
                <div class="w-full input-group mb-4"><label class="text-indigo-600">บทสนทนา (กด Enter แบ่งหน้า)</label><textarea class="npc-msg w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold text-slate-700 resize-y" rows="2">${msg}</textarea></div>
                <div class="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <div class="flex justify-between items-center mb-3 border-b border-indigo-100 pb-3">
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="quiz-toggle-${id}" class="npc-has-quiz w-4 h-4 accent-indigo-600" ${hasQuiz ? 'checked' : ''} onchange="toggleQuizPanel('${id}')">
                            <label for="quiz-toggle-${id}" class="text-sm font-bold text-indigo-700 cursor-pointer">เปิดระบบคำถาม (ภารกิจ)</label>
                            <span class="text-xs text-slate-500 ml-2 hidden sm:inline">(ถ้าไม่ติ๊ก NPC จะแค่พูดคุยเฉยๆ)</span>
                        </div>
                        <button id="btn-add-q-${id}" onclick="addQuestionToContainer('quiz-container-${id}')" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 ${hasQuiz ? '' : 'hidden'}">+ เพิ่มคำถาม</button>
                    </div>
                    <div id="quiz-container-${id}" class="space-y-3 ${hasQuiz ? '' : 'hidden'}"></div>
                </div>
            </div>
        </div>
    </div>`;
    if(document.getElementById('npc-list')) { document.getElementById('npc-list').insertAdjacentHTML('beforeend', html); if (data.quizzes && data.quizzes.length > 0) data.quizzes.forEach(q => addQuestionToContainer(`quiz-container-${id}`, q)); else if (hasQuiz) addQuestionToContainer(`quiz-container-${id}`); lucide.createIcons(); }
}

function addMonsterRow(data = {}) {
    const id = data.id || generateId('mon'); const url = data.url || ''; const x = data.x || 800; const hp = data.hp || 60; const rewardExp = data.rewardExp || 50; const rewardCoins = data.rewardCoins || 20;
    const html = `
    <div id="${id}" class="monster-item bg-rose-50/30 border-2 border-rose-200 rounded-2xl overflow-hidden shadow-sm transition-all">
        <input type="hidden" class="mon-id" value="${id}">
        <div class="bg-rose-100/50 p-4 cursor-pointer flex justify-between items-center hover:bg-rose-100 transition-colors" onclick="toggleAccordion(this)">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-white rounded-lg border-2 border-rose-200 flex items-center justify-center overflow-hidden">
                    <img id="preview-mon-thumb-${id}" src="${url}" class="${url ? '' : 'hidden'} max-w-full max-h-full object-contain">
                    <i data-lucide="skull" class="w-5 h-5 text-rose-400 ${url ? 'hidden' : ''}" id="icon-mon-thumb-${id}"></i>
                </div>
                <span class="font-bold text-rose-700">มอนสเตอร์ (HP ${hp}) พิกัด: <span class="display-x">${x}</span></span>
            </div>
            <div class="flex items-center gap-4">
                <button type="button" onclick="event.stopPropagation(); confirmRemove('${id}', 'มอนสเตอร์')" class="text-rose-400 hover:text-rose-600 p-2"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                <i data-lucide="chevron-down" class="chevron-icon w-5 h-5 text-rose-500 transition-transform duration-300 transform rotate-180"></i>
            </div>
        </div>
        <div class="accordion-wrapper overflow-hidden transition-all duration-300" style="max-height: 0px;">
            <div class="p-5 border-t-2 border-rose-200 bg-white">
                <div class="flex flex-wrap gap-4 items-center mb-4">
                    <div class="flex-1 input-group"><label class="text-rose-600">URL รูปมอนสเตอร์</label><input type="text" value="${url}" class="mon-url border-rose-200 focus:border-rose-500" oninput="document.getElementById('preview-mon-thumb-${id}').src=this.value; document.getElementById('preview-mon-thumb-${id}').classList.remove('hidden'); document.getElementById('icon-mon-thumb-${id}').classList.add('hidden');"></div>
                    <div class="w-24 input-group"><label class="text-rose-600">พิกัด X</label><input type="number" value="${x}" class="mon-x border-rose-200 focus:border-rose-500" oninput="this.closest('.monster-item').querySelector('.display-x').innerText=this.value"></div>
                    <div class="w-32 input-group"><label class="text-rose-600">พลังชีวิต (HP)</label><select class="mon-hp border-rose-200 focus:border-rose-500 text-rose-700"><option value="40" ${hp == 40 ? 'selected' : ''}>40 (ง่าย)</option><option value="60" ${hp == 60 ? 'selected' : ''}>60 (กลาง)</option><option value="100" ${hp == 100 ? 'selected' : ''}>100 (บอส)</option></select></div>
                </div>
                <div class="flex gap-4 mb-4 bg-amber-50 p-3 rounded-xl border border-amber-200">
                    <div class="flex-1 input-group"><label class="text-amber-600"><i data-lucide="star" class="inline w-3 h-3"></i> EXP ที่ได้รับเมื่อชนะ</label><input type="number" value="${rewardExp}" class="mon-exp border-amber-200 focus:border-amber-500 text-amber-700"></div>
                    <div class="flex-1 input-group"><label class="text-amber-600"><i data-lucide="coins" class="inline w-3 h-3"></i> เงิน (Coins) ที่ได้รับ</label><input type="number" value="${rewardCoins}" class="mon-coins border-amber-200 focus:border-amber-500 text-amber-700"></div>
                </div>
                <div class="bg-rose-50 p-4 rounded-xl border border-rose-200">
                    <div class="mb-3 border-b border-rose-100 pb-3 flex items-center justify-between">
                        <div class="flex items-center gap-2"><i data-lucide="swords" class="w-5 h-5 text-rose-500"></i><span class="text-sm font-bold text-rose-700">ชุดคำถามโจมตี (อิสระ)</span></div>
                        <button onclick="addQuestionToContainer('quiz-container-${id}', {}, true)" class="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-700">+ เพิ่มคำถาม</button>
                    </div>
                    <div id="quiz-container-${id}" class="space-y-3"></div>
                </div>
            </div>
        </div>
    </div>`;
    if(document.getElementById('monster-list')) { 
        document.getElementById('monster-list').insertAdjacentHTML('beforeend', html); 
        const containerId = `quiz-container-${id}`; 
        if (data.quizzes && data.quizzes.length > 0) data.quizzes.forEach(q => addQuestionToContainer(containerId, q, true)); 
        else for(let i=0; i<3; i++) addQuestionToContainer(containerId, {}, true); // Default 3 ข้อ
        lucide.createIcons(); 
    }
}

// 🌟 ปรับ UI กล่องคำถามใหม่ให้สวยงาม มีปุ่มลบ และแสดงช้อยส์ครบ
function addQuestionToContainer(containerId, qData = {}, isMonster = false) {
    const qId = 'q_' + Date.now() + Math.floor(Math.random() * 1000); 
    const themeColor = isMonster ? 'rose' : 'indigo';
    
    const qHtml = `
        <div id="${qId}" class="quiz-item bg-white border-2 border-${themeColor}-200 p-5 rounded-2xl relative mb-3 shadow-sm group hover:border-${themeColor}-400 transition-colors">
            
            <button type="button" onclick="this.closest('.quiz-item').remove()" class="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="ลบคำถามนี้">
                <i data-lucide="trash-2" class="w-5 h-5"></i>
            </button>

            <div class="space-y-4 pr-8">
                <div class="input-group">
                    <label class="text-${themeColor}-600">คำถาม</label>
                    <input type="text" class="q-title border-${themeColor}-200 text-sm font-bold text-slate-700 w-full" value="${qData.q || ''}" placeholder="พิมพ์คำถามที่นี่...">
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="input-group"><label class="text-slate-500">ตัวเลือกที่ 1</label><input type="text" class="q-c1 text-xs w-full bg-slate-50" value="${qData.c1 || ''}" placeholder="ช้อยส์ 1"></div>
                    <div class="input-group"><label class="text-slate-500">ตัวเลือกที่ 2</label><input type="text" class="q-c2 text-xs w-full bg-slate-50" value="${qData.c2 || ''}" placeholder="ช้อยส์ 2"></div>
                    <div class="input-group"><label class="text-slate-500">ตัวเลือกที่ 3</label><input type="text" class="q-c3 text-xs w-full bg-slate-50" value="${qData.c3 || ''}" placeholder="ช้อยส์ 3"></div>
                    <div class="input-group"><label class="text-slate-500">ตัวเลือกที่ 4</label><input type="text" class="q-c4 text-xs w-full bg-slate-50" value="${qData.c4 || ''}" placeholder="ช้อยส์ 4"></div>
                </div>

                <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">เฉลยที่ถูกต้อง:</label>
                    <select class="q-ans border-2 border-emerald-200 rounded-xl px-4 py-2 outline-none font-bold text-emerald-700 text-xs bg-emerald-50 cursor-pointer shadow-sm">
                        <option value="1" ${qData.ans == '1' ? 'selected' : ''}>ข้อ 1</option>
                        <option value="2" ${qData.ans == '2' ? 'selected' : ''}>ข้อ 2</option>
                        <option value="3" ${qData.ans == '3' ? 'selected' : ''}>ข้อ 3</option>
                        <option value="4" ${qData.ans == '4' ? 'selected' : ''}>ข้อ 4</option>
                    </select>
                </div>
            </div>
        </div>`;
    document.getElementById(containerId).insertAdjacentHTML('beforeend', qHtml);
    lucide.createIcons();
}

function toggleQuizPanel(id) { const container = document.getElementById(`quiz-container-${id}`); const btn = document.getElementById(`btn-add-q-${id}`); if (document.getElementById(`quiz-toggle-${id}`).checked) { container.classList.remove('hidden'); btn.classList.remove('hidden'); if(container.children.length===0) addQuestionToContainer(`quiz-container-${id}`); } else { container.classList.add('hidden'); btn.classList.add('hidden'); } }
function confirmRemove(rowId, typeName) { Swal.fire({ title: `ลบ${typeName}?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', confirmButtonText: 'ลบเลย!' }).then((res) => { if (res.isConfirmed) document.getElementById(rowId).remove(); }); }
function extractQuizzes(element) { return Array.from(element.querySelectorAll('.quiz-item')).map(qEl => ({ q: qEl.querySelector('.q-title').value, c1: qEl.querySelector('.q-c1').value, c2: qEl.querySelector('.q-c2').value, c3: qEl.querySelector('.q-c3').value, c4: qEl.querySelector('.q-c4').value, ans: qEl.querySelector('.q-ans').value })); }

db.collection('settings').doc('game_config').get().then(doc => {
    if (doc.exists) {
        const data = doc.data();
        if (data.characters && data.characters.length > 0 && document.getElementById('char-url')) { const curl = data.characters[0].url; document.getElementById('char-url').value = curl; if(curl) { document.getElementById('preview-char').src = curl; document.getElementById('preview-char-box').classList.remove('hidden'); } }
        if (data.gameplay) { if(document.getElementById('sys-potion-price')) document.getElementById('sys-potion-price').value = data.gameplay.potionPrice || 50; if (data.gameplay.expTable) customExpTable = data.gameplay.expTable; }
        if (data.maps && data.maps.length > 0) { gameMaps = data.maps; } else { gameMaps = [{ id: 'main', name: 'หมู่บ้านเริ่มต้น', bg: data.environment?.bg || '', ground: data.environment?.ground || '', boardUrl: data.environment?.boardUrl || '', npcs: data.npcs || [], monsters: data.monsters || [], portals: [], objects: [] }]; }
        currentMapId = gameMaps[0].id; renderMapSelector(); loadMapEditor(gameMaps[0]);
    } else { createNewMap(); }
}).catch(e => console.error("Config Load Error:", e));

async function saveAdminData() {
    saveCurrentMapStateToMemory(); 
    const btn = document.getElementById('btn-save'); const orig = btn.innerHTML; btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> บันทึก...';
    const potionPrice = document.getElementById('sys-potion-price') ? parseInt(document.getElementById('sys-potion-price').value) : 50;
    const finalData = { gameplay: { potionPrice: potionPrice, expTable: customExpTable }, characters: [{ url: document.getElementById('char-url') ? document.getElementById('char-url').value : '' }], maps: gameMaps };
    try { await db.collection('settings').doc('game_config').set(finalData); Swal.fire({ title: 'บันทึกสำเร็จ!', icon: 'success', confirmButtonColor: '#6366f1' }); } 
    catch(e) { Swal.fire({ title: 'ผิดพลาด', text: e.message, icon: 'error' }); } finally { btn.innerHTML = orig; lucide.createIcons(); }
}