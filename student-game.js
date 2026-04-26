const sessionData = localStorage.getItem("student_session");
if (!sessionData) {
  // 🌟 Popup เตือนตอนยังไม่ล็อกอินแบบสวยๆ
  Swal.fire({
    title: "🛑 หยุดก่อน!",
    text: "กรุณาเข้าสู่ระบบผ่านหน้าเว็บหลักก่อนเข้าเล่นเกมนะ",
    icon: "warning",
    confirmButtonColor: "#6366f1",
    background: "rgba(255, 255, 255, 0.95)",
    customClass: {
      popup:
        "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-xl p-4",
    },
  }).then(() => (window.location.href = "index.html"));
}
const loggedInUser = JSON.parse(sessionData);

document.getElementById("player-name").textContent = loggedInUser.name;
lucide.createIcons();

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let hasUnsavedChanges = false;
let isSaving = false;
let lastSaveTime = 0;
let assets = {
  bg: new Image(),
  ground: new Image(),
  boardImg: new Image(),
  npcs: [],
  monsters: [],
  portals: [],
  objects: [],
  playerSprite: new Image(),
};

let gameSettings = { potionPrice: 50, expTable: [] };
let playerStats = {
  hp: 100,
  maxHp: 100,
  level: 1,
  exp: 0,
  coins: 0,
  potions: 0,
};
let playerScores = {};
let defeatedMonsters = {};

// ==========================================
// 🌟 แก้ระบบซิงค์เงิน: ให้ Firebase เป็นคนคุม 100% ป้องกันบั๊กเงินเด้งไปมา
// ==========================================
let baseCoins = 0;
let spentCoins = 0;

db.collection("students")
  .where("student_id", "==", String(loggedInUser.id))
  .onSnapshot((snap) => {
    if (!snap.empty) {
      baseCoins = Math.floor((snap.docs[0].data().total || 0) * 10);
      syncGlobalCoins();
    }
  });

db.collection("shop_transactions")
  .where("student_id", "==", String(loggedInUser.id))
  .onSnapshot((snap) => {
    let spent = 0;
    snap.forEach((doc) => (spent += doc.data().amount));
    spentCoins = spent;
    syncGlobalCoins();
  });

function syncGlobalCoins() {
  playerStats.coins = baseCoins - spentCoins; // คำนวณใหม่เสมอ!
  updateHUD();
  const shopCoinsEl = document.getElementById("shop-coins");
  if (shopCoinsEl) shopCoinsEl.innerText = playerStats.coins.toLocaleString();
}
// ==========================================

let allMaps = [];
let currentMapId = "main";
let activeInteractable = null;
const isMobile = window.innerWidth < 768;
const playerSize = isMobile ? 90 : 110;
let player = {
  x: 200,
  y: 0,
  width: playerSize,
  height: playerSize,
  dx: 0,
  dy: 0,
  gravity: 0.8,
  jumpPower: -16,
  speed: isMobile ? 2 : 3,
  grounded: false,
  direction: 1,
  isMoving: false,
  isWarping: false,
};
let camera = { x: 0 };
const boardX = 100;

// 🌟 เพิ่มฟังก์ชันกลับหน้าแรกแบบสวยๆ
window.returnToMainMenu = function () {
  Swal.fire({
    title: "🏠 กลับหน้าหลัก?",
    text: "ระบบได้ทำการเซฟความคืบหน้าให้คุณแล้ว คุณต้องการกลับไปที่หน้าศูนย์รวมการเรียนรู้ใช่หรือไม่?",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#6366f1",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "กลับหน้าหลัก",
    cancelButtonText: "เล่นต่อ",
    background: "rgba(255, 255, 255, 0.95)",
    backdrop: `rgba(15, 23, 42, 0.8)`,
    customClass: {
      popup:
        "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-[0_30px_60px_rgba(0,0,0,0.2)] p-4",
      confirmButton:
        "rounded-xl font-bold px-6 py-3 shadow-[0_6px_0_0_#4338ca] active:translate-y-[6px] active:shadow-none transition-all",
      cancelButton:
        "rounded-xl font-bold px-6 py-3 shadow-[0_6px_0_0_#64748b] active:translate-y-[6px] active:shadow-none transition-all",
    },
  }).then((result) => {
    if (result.isConfirmed) {
      manualSave().then(() => {
        window.location.href = "index.html";
      });
    }
  });
};

function getExpForNextLevel(lvl) {
  if (lvl >= 20) return 999999;
  const e = gameSettings.expTable[lvl];
  return e !== undefined && e !== null && !isNaN(e) ? e : 9999;
}
function updateHUD() {
  document.getElementById("ui-level").innerText = playerStats.level;
  document.getElementById("ui-coins").innerText =
    playerStats.coins.toLocaleString();
  const hpPct = Math.max(0, (playerStats.hp / playerStats.maxHp) * 100);
  document.getElementById("hp-bar").style.width = `${hpPct}%`;
  document.getElementById("hp-text").innerText =
    `${Math.ceil(playerStats.hp)}/${playerStats.maxHp}`;
  const reqExp = getExpForNextLevel(playerStats.level);
  const expPct =
    playerStats.level >= 20
      ? 100
      : Math.min(100, (playerStats.exp / reqExp) * 100);
  document.getElementById("exp-bar").style.width = `${expPct}%`;
  document.getElementById("exp-text").innerText =
    playerStats.level >= 20
      ? "MAX"
      : `${Math.floor(playerStats.exp)}/${reqExp}`;
  const pBadge = document.getElementById("ui-potions-badge");
  if (playerStats.potions > 0) {
    pBadge.innerText = playerStats.potions;
    pBadge.classList.remove("hidden");
  } else {
    pBadge.classList.add("hidden");
  }
}
function checkLevelUp() {
  let leveledUp = false;
  let loopLimit = 0;
  while (
    playerStats.level < 20 &&
    playerStats.exp >= getExpForNextLevel(playerStats.level) &&
    loopLimit < 20
  ) {
    playerStats.exp -= getExpForNextLevel(playerStats.level);
    playerStats.level++;
    playerStats.maxHp += 20;
    playerStats.hp = playerStats.maxHp;
    leveledUp = true;
    loopLimit++;
  }
  if (leveledUp) {
    saveToLocal();
    Swal.fire({
      title: "LEVEL UP! 🎉",
      text: `เยี่ยมมาก! เลื่อนเป็นเลเวล ${playerStats.level} พลังชีวิตสูงสุดเพิ่มขึ้น!`,
      icon: "success",
      confirmButtonColor: "#10b981",
      background: "rgba(255, 255, 255, 0.95)",
      customClass: {
        popup:
          "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-xl p-4",
      },
    });
  }
  updateHUD();
}
function saveToLocal() {
  hasUnsavedChanges = true;
  const tempSave = {
    last_x: player.x,
    current_map: currentMapId,
    stats: playerStats,
    scores: playerScores,
    defeated_monsters: defeatedMonsters,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(
    `game_temp_${loggedInUser.id}`,
    JSON.stringify(tempSave),
  );
}

function loadMapAssets() {
  const mapData = allMaps.find((m) => m.id === currentMapId) || allMaps[0];
  if (!mapData) return;

  assets.bg = new Image();
  if (mapData.bg) assets.bg.src = mapData.bg;
  assets.ground = new Image();
  if (mapData.ground) assets.ground.src = mapData.ground;
  assets.boardImg = new Image();
  if (mapData.boardUrl) assets.boardImg.src = mapData.boardUrl;

  assets.npcs = (mapData.npcs || []).map((n) => {
    const img = new Image();
    if (n.url) img.src = n.url;
    return { ...n, img: img };
  });
  assets.monsters = (mapData.monsters || []).map((m) => {
    const img = new Image();
    if (m.url) img.src = m.url;
    return { ...m, img: img };
  });
  assets.objects = (mapData.objects || []).map((o) => {
    const img = new Image();
    if (o.url) img.src = o.url;
    return { ...o, img: img };
  });
  assets.portals = mapData.portals || [];
}

db.collection("settings")
  .doc("game_config")
  .onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      if (data.gameplay) {
        gameSettings.potionPrice = data.gameplay.potionPrice || 50;
        if (data.gameplay.expTable && data.gameplay.expTable.length > 0)
          gameSettings.expTable = data.gameplay.expTable;
      }
      if (data.characters && data.characters.length > 0) {
        document.getElementById("player-gif").src = data.characters[0].url;
        assets.playerSprite.src = data.characters[0].url;
      }
      if (data.maps && data.maps.length > 0) allMaps = data.maps;
      else {
        allMaps = [
          {
            id: "main",
            name: "หมู่บ้านเริ่มต้น",
            bg: data.environment?.bg || "",
            ground: data.environment?.ground || "",
            boardUrl: data.environment?.boardUrl || "",
            npcs: data.npcs || [],
            monsters: data.monsters || [],
            portals: [],
            objects: [],
          },
        ];
      }
      loadMapAssets();
      updateHUD();
    }
  });

db.collection("student_game_progress")
  .doc(loggedInUser.id)
  .get()
  .then((doc) => {
    if (doc.exists) {
      const data = doc.data();
      player.x = data.last_x || 200;
      currentMapId = data.current_map || "main";
      if (data.stats) {
        playerStats.hp = data.stats.hp ?? playerStats.hp;
        playerStats.maxHp = data.stats.maxHp ?? playerStats.maxHp;
        playerStats.level = data.stats.level ?? playerStats.level;
        playerStats.exp = data.stats.exp ?? playerStats.exp;
        playerStats.potions = data.stats.potions ?? playerStats.potions;
        // 🌟 ลบการดึง Coins ออก ให้เชื่อมต่อจาก Firebase กลางอย่างเดียว!
      }
      if (data.scores) playerScores = data.scores;
      if (data.defeated_monsters) defeatedMonsters = data.defeated_monsters;
    }
    const tempSaveStr = localStorage.getItem(`game_temp_${loggedInUser.id}`);
    if (tempSaveStr) {
      try {
        const tempSave = JSON.parse(tempSaveStr);
        const fbTime =
          doc.exists && doc.data().updated_at
            ? new Date(doc.data().updated_at).getTime()
            : 0;
        const localTime = new Date(tempSave.updated_at).getTime();
        if (localTime > fbTime) {
          player.x = tempSave.last_x || player.x;
          currentMapId = tempSave.current_map || currentMapId;
          if (tempSave.stats) {
            playerStats.hp = tempSave.stats.hp ?? playerStats.hp;
            playerStats.maxHp = tempSave.stats.maxHp ?? playerStats.maxHp;
            playerStats.level = tempSave.stats.level ?? playerStats.level;
            playerStats.exp = tempSave.stats.exp ?? playerStats.exp;
            playerStats.potions = tempSave.stats.potions ?? playerStats.potions;
          }
          playerScores = tempSave.scores || playerScores;
          defeatedMonsters = tempSave.defeated_monsters || defeatedMonsters;
          hasUnsavedChanges = true;
        }
      } catch (e) {}
    }
    loadMapAssets();
    camera.x = player.x - canvas.width / 2;
    checkLevelUp();
    updateHUD();
  });

const keys = { right: false, left: false };
window.addEventListener("keydown", (e) => {
  if (!player.isWarping) {
    if (e.code === "ArrowRight") keys.right = true;
    if (e.code === "ArrowLeft") keys.left = true;
    if (e.code === "Space" && player.grounded) {
      player.dy = player.jumpPower;
      player.grounded = false;
    }
    if (e.code === "KeyE" && activeInteractable) handleInteraction();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowRight") keys.right = false;
  if (e.code === "ArrowLeft") keys.left = false;
});

const bindTouch = (id, k) => {
  const b = document.getElementById(id);
  if (!b) return;
  b.style.touchAction = "none";
  b.style.userSelect = "none";
  b.style.webkitUserSelect = "none";
  b.addEventListener("contextmenu", (e) => e.preventDefault());
  const p = (e) => {
    if (player.isWarping) return;
    if (e && e.cancelable) e.preventDefault();
    if (k === "jump") {
      if (player.grounded) {
        player.dy = player.jumpPower;
        player.grounded = false;
      }
    } else {
      keys[k] = true;
    }
  };
  const r = (e) => {
    if (e && e.cancelable) e.preventDefault();
    if (k !== "jump") keys[k] = false;
  };
  b.addEventListener("pointerdown", p);
  b.addEventListener("pointerup", r);
  b.addEventListener("pointercancel", r);
  b.addEventListener("pointerout", r);
  b.addEventListener("pointerleave", r);
};
bindTouch("btn-left", "left");
bindTouch("btn-right", "right");
bindTouch("btn-jump", "jump");
window.addEventListener("touchend", (e) => {
  if (e.touches.length === 0) {
    keys.left = false;
    keys.right = false;
  }
});
window.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse") {
    keys.left = false;
    keys.right = false;
  }
});

function drawSpotlight(ctx, x, y, size, colorBase) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
  g.addColorStop(0, `rgba(${colorBase}, 0.5)`);
  g.addColorStop(1, `rgba(${colorBase}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawBubble(ctx, x, y, text, customColor = "rgba(0,0,0,0.6)") {
  if (!text) return;
  ctx.font = "bold 14px Sarabun";
  const w = ctx.measureText(text).width + 24;
  ctx.save();
  ctx.fillStyle = customColor;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 30, w, 24, 12);
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y - 13);
  ctx.restore();
}

function update() {
  if (player.isWarping) {
    player.dx = 0;
    player.isMoving = false;
    keys.left = false;
    keys.right = false;
  } else if (keys.right) {
    player.dx = player.speed;
    player.direction = 1;
    hasUnsavedChanges = true;
    player.isMoving = true;
  } else if (keys.left) {
    player.dx = -player.speed;
    player.direction = -1;
    hasUnsavedChanges = true;
    player.isMoving = true;
  } else {
    player.dx = 0;
    player.isMoving = false;
  }

  player.dy += player.gravity;
  player.x += player.dx;
  player.y += player.dy;
  if (player.x < 0) player.x = 0;
  const groundY = canvas.height - (isMobile ? 80 : 100);
  if (player.y + player.height >= groundY) {
    player.y = groundY - player.height;
    player.dy = 0;
    player.grounded = true;
  }
  camera.x +=
    (Math.max(0, player.x - canvas.width / 2 + player.width / 2) - camera.x) *
    0.1;

  activeInteractable = null;
  const pCenter = player.x + player.width / 2;
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  if (!player.isWarping) {
    const isMainMap =
      (allMaps.length > 0 && currentMapId === allMaps[0].id) ||
      currentMapId === "main";
    if (isMainMap && Math.abs(pCenter - boardX) < 100)
      activeInteractable = { type: "board" };
    else {
      assets.portals.forEach((p) => {
        if (Math.abs(pCenter - p.x) < 80)
          activeInteractable = { type: "portal", data: p };
      });
      if (!activeInteractable)
        assets.npcs.forEach((npc) => {
          if (Math.abs(pCenter - (npc.x + 40)) < 120)
            activeInteractable = { type: "npc", data: npc };
        });
      if (!activeInteractable)
        assets.objects.forEach((obj) => {
          if (Math.abs(pCenter - (obj.x + 40)) < 120)
            activeInteractable = { type: "object", data: obj };
        });
      if (!activeInteractable)
        assets.monsters.forEach((mon) => {
          if (defeatedMonsters[mon.id]) {
            if (now - defeatedMonsters[mon.id] > TWO_HOURS)
              delete defeatedMonsters[mon.id];
            else return;
          }
          if (Math.abs(pCenter - (mon.x + 40)) < 120)
            activeInteractable = { type: "monster", data: mon };
        });
    }
  }

  const overlay = document.getElementById("action-overlay");
  const btn = document.getElementById("btn-interact");
  const iconWrap = document.getElementById("interact-icon-wrapper");
  const textWrap = document.getElementById("interact-text");

  if (activeInteractable && !player.isWarping) {
    overlay.classList.remove("opacity-0", "scale-90");
    const baseClass =
      "panel-25d px-6 py-3 md:px-8 md:py-4 flex items-center gap-3 font-bold rounded-full text-white cursor-pointer transition-all active:translate-y-[6px] active:shadow-none pointer-events-auto border-2";

    if (activeInteractable.type === "portal") {
      iconWrap.innerHTML = `<i data-lucide="door-open" class="w-5 h-5 md:w-6 md:h-6 animate-pulse"></i>`;
      textWrap.innerText = activeInteractable.data.name || `เข้าสู่ประตูวาร์ป`;
      btn.className = `${baseClass} bg-cyan-600/90 border-cyan-300 shadow-[0_8px_0_0_#0891b2]`;
    } else if (activeInteractable.type === "board") {
      iconWrap.innerHTML = `<i data-lucide="clipboard-list" class="w-5 h-5 md:w-6 md:h-6"></i>`;
      textWrap.innerText = `ดูกระดานคะแนน`;
      btn.className = `${baseClass} bg-indigo-500/90 border-indigo-300 shadow-[0_8px_0_0_#4338ca]`;
    } else if (activeInteractable.type === "monster") {
      iconWrap.innerHTML = `<i data-lucide="swords" class="w-5 h-5 md:w-6 md:h-6 animate-pulse"></i>`;
      textWrap.innerText = `ต่อสู้ (HP ${activeInteractable.data.hp})`;
      btn.className = `${baseClass} bg-rose-600/90 border-rose-400 shadow-[0_8px_0_0_#9f1239]`;
    } else if (activeInteractable.type === "object") {
      iconWrap.innerHTML = `<i data-lucide="search" class="w-5 h-5 md:w-6 md:h-6"></i>`;
      textWrap.innerText = `สำรวจ ${activeInteractable.data.name || "วัตถุ"}`;
      btn.className = `${baseClass} bg-emerald-500/90 border-emerald-300 shadow-[0_8px_0_0_#059669]`;
    } else {
      const npcNameDisplay = activeInteractable.data.name || "ชาวบ้าน";
      const isCompleted =
        playerScores[activeInteractable.data.id] &&
        playerScores[activeInteractable.data.id].completed;
      iconWrap.innerHTML = `<i data-lucide="message-circle" class="w-5 h-5 md:w-6 md:h-6"></i>`;
      textWrap.innerText =
        activeInteractable.data.hasQuiz && !isCompleted
          ? `ทำภารกิจของ ${npcNameDisplay}`
          : `คุยกับ ${npcNameDisplay}`;
      btn.className = `${baseClass} bg-orange-500/90 border-orange-300 shadow-[0_8px_0_0_#c2410c]`;
    }
    lucide.createIcons();
  } else overlay.classList.add("opacity-0", "scale-90");
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const groundH = isMobile ? 80 : 100;
  if (assets.bg.complete && assets.bg.naturalWidth > 0) {
    const bgRatio = assets.bg.naturalWidth / assets.bg.naturalHeight;
    const bgH = canvas.height;
    const bgW = bgH * bgRatio;
    let px = (-camera.x * 0.2) % bgW;
    if (px > 0) px -= bgW;
    const cols = Math.ceil(canvas.width / bgW) + 1;
    for (let i = 0; i < cols; i++)
      ctx.drawImage(
        assets.bg,
        Math.floor(px + i * bgW),
        0,
        Math.ceil(bgW) + 1,
        bgH,
      );
  } else {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawSpotlight(
    ctx,
    player.x - camera.x + player.width / 2,
    player.y + player.height / 2,
    player.width * 1.5,
    "255,255,255",
  );
  ctx.save();
  ctx.translate(-camera.x, 0);

  if (assets.ground.complete && assets.ground.naturalWidth > 0) {
    const grRatio = assets.ground.naturalWidth / assets.ground.naturalHeight;
    const grW = groundH * grRatio;
    const startX = Math.floor(camera.x / grW) * grW;
    const cols = Math.ceil(canvas.width / grW) + 2;
    for (let i = 0; i < cols; i++)
      ctx.drawImage(
        assets.ground,
        startX + i * grW,
        canvas.height - groundH,
        grW,
        groundH,
      );
  } else {
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(0, canvas.height - groundH, 10000, groundH);
  }

  const isMainMap =
    (allMaps.length > 0 && currentMapId === allMaps[0].id) ||
    currentMapId === "main";
  if (isMainMap) {
    const boardY = canvas.height - groundH - 120;
    if (
      assets.boardImg &&
      assets.boardImg.complete &&
      assets.boardImg.naturalWidth > 0
    ) {
      ctx.drawImage(
        assets.boardImg,
        boardX - 50,
        canvas.height - groundH - 140,
        100,
        140,
      );
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(boardX - 40, boardY, 80, 120);
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.font = "bold 16px Sarabun";
      ctx.fillText("🏆", boardX, boardY + 40);
    }
    if (Math.abs(player.x + player.width / 2 - boardX) < 100)
      drawBubble(ctx, boardX, boardY - 15, "📊 กระดานคะแนน");
  }

  assets.portals.forEach((p) => {
    const py = canvas.height - groundH - 60;
    ctx.save();
    ctx.fillStyle = "rgba(6, 182, 212, 0.4)";
    ctx.beginPath();
    ctx.ellipse(p.x, py + 40, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    const glowSize = 60 + Math.sin(Date.now() / 200) * 10;
    const g = ctx.createRadialGradient(p.x, py, 10, p.x, py, glowSize);
    g.addColorStop(0, "rgba(103, 232, 249, 1)");
    g.addColorStop(0.5, "rgba(6, 182, 212, 0.5)");
    g.addColorStop(1, "rgba(8, 145, 178, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(p.x, py, 30, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawBubble(ctx, p.x, py - 40, p.name || "จุดวาร์ป", "rgba(8,145,178,0.8)");
  });

  assets.objects.forEach((obj) => {
    const s = isMobile ? 64 : 80;
    const y = canvas.height - groundH - s;
    drawSpotlight(ctx, obj.x + s / 2, y + s / 2, s * 1.3, "255,255,255");
    if (obj.img && obj.img.complete && obj.img.naturalWidth > 0) {
      ctx.drawImage(obj.img, obj.x, y, s, s);
    } else {
      ctx.fillStyle = "rgba(16, 185, 129, 0.8)";
      ctx.beginPath();
      ctx.roundRect(obj.x, y, s, s, 16);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Sarabun";
      ctx.textAlign = "center";
      ctx.fillText("OBJ", obj.x + s / 2, y + s / 2);
    }
    drawBubble(
      ctx,
      obj.x + s / 2,
      y - 10,
      "🔍 " + (obj.name || "วัตถุ"),
      "rgba(16,185,129,0.8)",
    );
  });

  assets.npcs.forEach((npc) => {
    const s = isMobile ? 64 : 80;
    const y = canvas.height - groundH - s;
    const isCompleted = playerScores[npc.id] && playerScores[npc.id].completed;
    const glowColor =
      npc.hasQuiz && !isCompleted ? "250, 204, 21" : "255, 255, 255";
    drawSpotlight(ctx, npc.x + s / 2, y + s / 2, s * 1.5, glowColor);

    if (npc.img && npc.img.complete && npc.img.naturalWidth > 0) {
      ctx.drawImage(npc.img, npc.x, y, s, s);
    } else {
      ctx.fillStyle = "rgba(249, 115, 22, 0.8)";
      ctx.beginPath();
      ctx.roundRect(npc.x, y, s, s, 16);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Sarabun";
      ctx.textAlign = "center";
      ctx.fillText("NPC", npc.x + s / 2, y + s / 2);
    }
    const prefix = npc.hasQuiz && !isCompleted ? "❗ " : "💬 ";
    drawBubble(ctx, npc.x + s / 2, y - 10, prefix + (npc.name || "ชาวบ้าน"));
  });

  assets.monsters.forEach((mon) => {
    if (defeatedMonsters[mon.id]) return;
    const s = isMobile ? 70 : 90;
    const y = canvas.height - groundH - s;
    drawSpotlight(ctx, mon.x + s / 2, y + s / 2, s * 1.5, "225,29,72");
    if (mon.img && mon.img.complete && mon.img.naturalWidth > 0) {
      ctx.drawImage(mon.img, mon.x, y, s, s);
    } else {
      ctx.fillStyle = "rgba(225, 29, 72, 0.8)";
      ctx.beginPath();
      ctx.roundRect(mon.x, y, s, s, 16);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Sarabun";
      ctx.textAlign = "center";
      ctx.fillText("BOSS", mon.x + s / 2, y + s / 2);
    }
    drawBubble(
      ctx,
      mon.x + s / 2,
      y - 10,
      `⚔️ HP ${mon.hp}`,
      "rgba(225,29,72,0.8)",
    );
  });

  const pGif = document.getElementById("player-gif");
  if (pGif && pGif.src && !player.isWarping) {
    if (!player.isMoving && player.grounded && assets.playerSprite.complete) {
      pGif.style.display = "none";
      if (player.direction === -1) {
        ctx.save();
        ctx.translate(player.x + player.width, player.y);
        ctx.scale(-1, 1);
        ctx.drawImage(assets.playerSprite, 0, 0, player.width, player.height);
        ctx.restore();
      } else
        ctx.drawImage(
          assets.playerSprite,
          player.x,
          player.y,
          player.width,
          player.height,
        );
    } else pGif.style.display = "block";
  } else if (player.isWarping) {
    pGif.style.display = "none";
  }
  ctx.restore();
  if (pGif && pGif.style.display === "block") {
    pGif.style.width = player.width + "px";
    pGif.style.height = player.height + "px";
    pGif.style.left = player.x - camera.x + "px";
    pGif.style.top = player.y + "px";
    pGif.style.transform = `scaleX(${player.direction})`;
  }
}
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();

function warpToMap(targetMapId, targetX) {
  if (player.isWarping) return;
  const targetMap = allMaps.find((m) => m.id === targetMapId);
  if (!targetMap) {
    Swal.fire("ข้อผิดพลาด", "ไม่พบแผนที่ปลายทาง!", "error");
    return;
  }
  player.isWarping = true;
  let fade = document.getElementById("fade-overlay");
  if (!fade) {
    fade = document.createElement("div");
    fade.id = "fade-overlay";
    fade.className =
      "fixed inset-0 bg-slate-950 z-[200] opacity-0 pointer-events-none transition-opacity duration-1000 flex flex-col items-center justify-center";
    fade.innerHTML = `<h1 id="map-title-display" class="text-4xl md:text-6xl font-black text-white tracking-widest drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] translate-y-10 opacity-0 transition-all duration-700"></h1><div class="mt-4 w-24 h-1 bg-white/20 rounded-full overflow-hidden"><div class="h-full bg-white animate-[pulse_1s_ease-in-out_infinite]"></div></div>`;
    document.body.appendChild(fade);
  }
  const titleDisp = document.getElementById("map-title-display");
  fade.classList.remove("opacity-0", "pointer-events-none");
  setTimeout(() => {
    currentMapId = targetMapId;
    player.x = targetX;
    camera.x = player.x - canvas.width / 2;
    loadMapAssets();
    saveToLocal();
    manualSave();
    titleDisp.innerText = targetMap.name || "แผนที่ลึกลับ";
    titleDisp.classList.remove("translate-y-10", "opacity-0");
    setTimeout(() => {
      titleDisp.classList.add("translate-y-10", "opacity-0");
      fade.classList.add("opacity-0", "pointer-events-none");
      player.isWarping = false;
    }, 2000);
  }, 1000);
}

window.handleInteraction = function () {
  if (!activeInteractable) return;
  keys.left = false;
  keys.right = false;
  if (activeInteractable.type === "portal") {
    warpToMap(
      activeInteractable.data.targetMapId,
      activeInteractable.data.targetX,
    );
  } else if (activeInteractable.type === "board") {
    let scoreHtml = '<div class="text-left space-y-3 mt-4">';
    let grandTotal = 0;
    let grandMax = 0;
    allMaps.forEach((m) => {
      (m.npcs || []).forEach((n) => {
        if (n.hasQuiz && n.quizzes.length > 0) {
          grandMax += n.quizzes.length;
          const s = playerScores[n.id];
          let stat =
            s && s.completed
              ? `<span class="text-emerald-500 font-bold">ได้ ${s.score}/${s.total}</span>`
              : `<span class="text-slate-400">ยังไม่ทำ</span>`;
          if (s) grandTotal += s.score;
          scoreHtml += `<div class="p-3 bg-slate-50 border rounded-xl flex justify-between shadow-sm"><span class="font-bold">ภารกิจของ ${n.name || "NPC"}</span> ${stat}</div>`;
        }
      });
    });
    scoreHtml += `</div><div class="mt-6 text-xl font-black text-indigo-600 bg-indigo-50 p-4 rounded-xl">คะแนนรวม: <span class="text-3xl">${grandTotal}</span> / ${grandMax}</div>`;
    Swal.fire({
      title: "🏆 กระดานคะแนน",
      html: scoreHtml,
      confirmButtonColor: "#6366f1",
      background: "rgba(255, 255, 255, 0.95)",
      customClass: {
        popup:
          "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-[0_30px_60px_rgba(0,0,0,0.15)] p-4",
      },
    });
  } else if (activeInteractable.type === "object")
    showObjectDialog(activeInteractable.data.id, 0);
  else if (activeInteractable.type === "npc")
    showNpcDialog(activeInteractable.data.id, 0);
  else if (activeInteractable.type === "monster")
    startCombatDialog(activeInteractable.data.id);
};

window.showObjectDialog = function (objId, index) {
  const obj = assets.objects.find((o) => o.id === objId);
  if (!obj) return;
  const rawText =
    obj.message || obj.msg || "ป้ายเก่าๆ เขียนข้อความที่อ่านไม่ออก...";
  const dialogLines = rawText.split("\n").filter((line) => line.trim() !== "");
  const isLast = index >= dialogLines.length - 1;
  const currentText = dialogLines[index] || "...";
  let buttonsHtml = "";
  if (isLast) {
    buttonsHtml = `<div class="flex gap-3 justify-center w-full mt-6"><button onclick="Swal.close()" class="w-full bg-white text-slate-700 font-bold py-4 px-6 rounded-2xl border-2 border-slate-200 shadow-[0_6px_0_0_#e2e8f0] active:translate-y-[6px] active:shadow-none transition-all text-lg">ปิดหน้าต่าง</button></div>`;
  } else {
    buttonsHtml = `<div class="flex gap-3 justify-center w-full mt-6"><button onclick="showObjectDialog('${obj.id}', ${index + 1})" class="w-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold py-4 px-6 rounded-2xl shadow-[0_6px_0_0_#047857] active:translate-y-[6px] active:shadow-none transition-all text-lg flex items-center justify-center gap-2">อ่านต่อ <i data-lucide="arrow-right" class="w-6 h-6"></i></button></div>`;
  }
  const objNameDisplay = obj.name || "วัตถุ";
  const html = `<div class="text-center relative"><div class="flex flex-col items-center pb-4 mt-2"><div class="w-28 h-28 rounded-[2rem] border-4 border-white shadow-[0_10px_25px_rgba(16,185,129,0.2)] bg-gradient-to-br from-emerald-100 to-teal-100 p-1.5 mb-3 z-10 rotate-3 hover:rotate-0 transition-all"><img src="${obj.img && obj.img.src ? obj.img.src : "https://ui-avatars.com/api/?name=OBJ&background=d1fae5&color=047857"}" class="w-full h-full object-cover rounded-[1.5rem]" onerror="this.style.display='none'"></div><h3 class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 drop-shadow-sm">${objNameDisplay}</h3></div><div class="relative bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border-2 border-white/80 shadow-sm min-h-[120px] flex items-center justify-center mt-2"><div class="absolute -top-4 -left-2 text-5xl text-emerald-200 font-serif leading-none">"</div><p class="text-xl text-slate-700 font-bold leading-relaxed relative z-10 px-2">${currentText}</p><div class="absolute -bottom-8 -right-2 text-5xl text-emerald-200 font-serif leading-none rotate-180">"</div></div>${buttonsHtml}</div>`;
  Swal.fire({
    html: html,
    showConfirmButton: false,
    background: "rgba(244, 246, 248, 0.95)",
    customClass: {
      popup:
        "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-[0_30px_60px_rgba(0,0,0,0.15)] p-2 md:p-6",
    },
    didOpen: () => lucide.createIcons(),
  });
};

window.showNpcDialog = function (npcId, index) {
  const npc = assets.npcs.find((n) => n.id === npcId);
  if (!npc) return;
  const rawText = npc.message || npc.msg || "สวัสดี!";
  const dialogLines = rawText.split("\n").filter((line) => line.trim() !== "");
  const isLast = index >= dialogLines.length - 1;
  const currentText = dialogLines[index] || "...";
  const isCompleted = playerScores[npc.id] && playerScores[npc.id].completed;
  let badgeHtml = "";
  if (npc.hasQuiz) {
    if (isCompleted) {
      const s = playerScores[npc.id];
      badgeHtml = `<div class="absolute top-0 right-0 -mt-2 -mr-2 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-md flex items-center gap-1 border-2 border-white z-20"><i data-lucide="check-circle" class="w-3 h-3"></i> ทำแล้ว (${s.score}/${s.total})</div>`;
    } else {
      badgeHtml = `<div class="absolute top-0 right-0 -mt-2 -mr-2 bg-gradient-to-r from-orange-400 to-amber-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-md flex items-center gap-1 border-2 border-white z-20"><i data-lucide="alert-circle" class="w-3 h-3"></i> มีภารกิจ</div>`;
    }
  }
  let buttonsHtml = "";
  if (isLast) {
    if (npc.hasQuiz && !isCompleted) {
      buttonsHtml = `<div class="flex gap-3 justify-center w-full mt-6"><button onclick="startQuizLoop('${npc.id}', 0, 0, 'npc')" class="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold py-4 px-6 rounded-2xl shadow-[0_6px_0_0_#4338ca] active:translate-y-[6px] active:shadow-none transition-all text-lg flex items-center justify-center gap-2"><i data-lucide="edit-3" class="w-6 h-6"></i> เริ่มทำภารกิจ</button></div><button onclick="Swal.close()" class="mt-4 text-slate-400 font-bold hover:text-slate-600 underline decoration-slate-300 underline-offset-4">ไว้ทีหลัง</button>`;
    } else {
      buttonsHtml = `<div class="flex gap-3 justify-center w-full mt-6"><button onclick="Swal.close()" class="w-full bg-white text-slate-700 font-bold py-4 px-6 rounded-2xl border-2 border-slate-200 shadow-[0_6px_0_0_#e2e8f0] active:translate-y-[6px] active:shadow-none transition-all text-lg">จบการสนทนา</button></div>`;
    }
  } else {
    buttonsHtml = `<div class="flex gap-3 justify-center w-full mt-6"><button onclick="showNpcDialog('${npc.id}', ${index + 1})" class="w-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold py-4 px-6 rounded-2xl shadow-[0_6px_0_0_#047857] active:translate-y-[6px] active:shadow-none transition-all text-lg flex items-center justify-center gap-2">ถัดไป <i data-lucide="arrow-right" class="w-6 h-6"></i></button></div>`;
  }

  const html = `<div class="text-center relative">${badgeHtml}<div class="flex flex-col items-center pb-4 mt-2"><div class="w-28 h-28 rounded-[2rem] border-4 border-white shadow-[0_10px_25px_rgba(99,102,241,0.2)] bg-gradient-to-br from-indigo-100 to-purple-100 p-1.5 mb-3 z-10 rotate-3 hover:rotate-0 transition-all"><img src="${npc.img && npc.img.src ? npc.img.src : "https://ui-avatars.com/api/?name=NPC&background=cbd5e1"}" class="w-full h-full object-cover rounded-[1.5rem]" onerror="this.style.display='none'"></div><h3 class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 drop-shadow-sm">${npc.name || "ชาวบ้าน"}</h3></div><div class="relative bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border-2 border-white/80 shadow-sm min-h-[120px] flex items-center justify-center mt-2"><div class="absolute -top-4 -left-2 text-5xl text-indigo-200 font-serif leading-none">"</div><p class="text-xl text-slate-700 font-bold leading-relaxed relative z-10 px-2">${currentText}</p><div class="absolute -bottom-8 -right-2 text-5xl text-indigo-200 font-serif leading-none rotate-180">"</div></div>${buttonsHtml}</div>`;
  Swal.fire({
    html: html,
    showConfirmButton: false,
    background: "rgba(244, 246, 248, 0.95)",
    customClass: {
      popup:
        "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-[0_30px_60px_rgba(0,0,0,0.15)] p-2 md:p-6",
    },
    didOpen: () => lucide.createIcons(),
  });
};

window.startCombatDialog = function (monId) {
  const mon = assets.monsters.find((m) => m.id === monId);
  if (!mon) return;
  const html = `<div class="text-center relative mt-2"><div class="absolute top-0 right-0 -mt-2 -mr-2 bg-rose-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-md border-2 border-white flex items-center gap-1 animate-pulse z-20"><i data-lucide="flame" class="w-3 h-3"></i> อันตราย!</div><div class="flex flex-col items-center pb-4"><div class="w-32 h-32 rounded-[2rem] border-4 border-white shadow-[0_10px_25px_rgba(225,29,72,0.3)] bg-gradient-to-br from-rose-100 to-red-100 p-1.5 mb-3 z-10 hover:scale-105 transition-all"><img src="${mon.img && mon.img.src ? mon.img.src : "https://ui-avatars.com/api/?name=BOSS&background=fecdd3&color=be123c"}" class="w-full h-full object-cover rounded-[1.5rem]" onerror="this.style.display='none'"></div><h2 class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-red-600 drop-shadow-sm">มอนสเตอร์ปรากฏตัว!</h2></div><div class="mb-6 bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl p-4 rounded-[1.5rem] border-2 border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.05)] w-full max-w-sm mx-auto"><div class="flex justify-between items-end mb-2"><span class="text-sm font-bold text-rose-600 flex items-center gap-1.5"><i data-lucide="heart" class="w-4 h-4 text-rose-500 fill-rose-500"></i> พลังชีวิตมอนสเตอร์</span><span class="text-lg font-black text-rose-700 leading-none">${mon.hp} <span class="text-xs text-rose-400">/ ${mon.hp}</span></span></div><div class="w-full bg-slate-100 rounded-full h-4 border border-slate-200 overflow-hidden shadow-inner p-0.5"><div class="bg-gradient-to-r from-rose-400 to-rose-600 h-full rounded-full transition-all duration-500 relative" style="width: 100%"><div class="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-t-full"></div></div></div></div><p class="text-slate-600 font-medium mb-6 text-lg">ตอบคำถามให้ถูก เพื่อสร้างดาเมจโจมตี!</p><div class="flex gap-3 justify-center w-full"><button onclick="startQuizLoop('${mon.id}', 0, 0, 'monster')" class="flex-1 bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold py-4 px-6 rounded-2xl shadow-[0_6px_0_0_#9f1239] active:translate-y-[6px] active:shadow-none transition-all text-xl flex items-center justify-center gap-2"><i data-lucide="swords" class="w-6 h-6"></i> โจมตีเลย!</button></div><button onclick="Swal.close()" class="mt-4 text-slate-400 font-bold hover:text-slate-600 underline decoration-slate-300 underline-offset-4">หนีไปตั้งหลัก</button></div>`;
  Swal.fire({
    html: html,
    showConfirmButton: false,
    background: "rgba(255, 241, 242, 0.95)",
    customClass: {
      popup:
        "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-[0_30px_60px_rgba(225,29,72,0.15)] p-2 md:p-6",
    },
    didOpen: () => lucide.createIcons(),
  });
};

window.openBackpack = function () {
  keys.left = false;
  keys.right = false;
  const html = `<div class="flex flex-col gap-6 text-left p-2"><div class="bg-indigo-50 p-5 rounded-2xl border-2 border-indigo-200"><h4 class="font-black text-indigo-700 mb-2 flex items-center gap-2"><i data-lucide="backpack"></i> กระเป๋าเก็บของ</h4><div class="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-indigo-100"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center text-rose-500"><i data-lucide="flask-conical"></i></div><div><p class="font-bold text-slate-700 text-sm">น้ำยาฟื้นฟู (Potion)</p><p class="text-[10px] font-bold text-slate-400 uppercase">ฟื้นฟู HP 50 หน่วย</p></div></div><div class="flex items-center gap-3"><span class="font-black text-lg text-slate-700">x${playerStats.potions}</span><button onclick="usePotion()" class="bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-600 shadow-sm ${playerStats.potions > 0 ? "" : "opacity-50 cursor-not-allowed"}">ใช้</button></div></div></div><div class="bg-amber-50 p-5 rounded-2xl border-2 border-amber-200"><h4 class="font-black text-amber-700 mb-2 flex items-center gap-2"><i data-lucide="store"></i> ร้านค้าไอเทม</h4><p class="text-sm font-bold text-amber-600 mb-3">เหรียญของคุณ: <span id="shop-coins" class="text-lg">${playerStats.coins.toLocaleString()}</span> 🪙</p><div class="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-amber-100"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center text-rose-500"><i data-lucide="flask-conical"></i></div><div><p class="font-bold text-slate-700 text-sm">น้ำยาฟื้นฟู</p></div></div><button onclick="buyPotion()" class="bg-amber-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-amber-600 flex items-center gap-1 shadow-sm"><i data-lucide="coins" class="w-4 h-4"></i> ${gameSettings.potionPrice}</button></div></div></div>`;
  Swal.fire({
    title: "เมนูผู้เล่น",
    html: html,
    showConfirmButton: false,
    showCloseButton: true,
    customClass: {
      popup:
        "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-xl p-4",
    },
    didOpen: () => lucide.createIcons(),
  });
};

window.usePotion = function () {
  if (playerStats.potions <= 0) return;
  if (playerStats.hp >= playerStats.maxHp) {
    Swal.showValidationMessage("เลือดคุณเต็มอยู่แล้ว!");
    return;
  }
  playerStats.potions--;
  playerStats.hp = Math.min(playerStats.maxHp, playerStats.hp + 50);
  saveToLocal();
  updateHUD();
  openBackpack();
  Swal.fire({
    toast: true,
    position: "top",
    icon: "success",
    title: "ฟื้นฟู HP 50 หน่วย! 💚",
    showConfirmButton: false,
    timer: 1500,
    customClass: { popup: "rounded-[2rem] shadow-lg" },
  });
};

// 🌟 ระบบซื้อของ: ไม่บวก/ลบเงินเองแล้ว ให้ Firebase จัดการ
window.buyPotion = async function () {
  if (playerStats.coins < gameSettings.potionPrice) {
    Swal.showValidationMessage("เหรียญไม่พอครับ!");
    return;
  }
  const btnText = document.getElementById("shop-coins");
  if (btnText)
    btnText.innerHTML =
      '<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline"></i>';
  try {
    await db
      .collection("shop_transactions")
      .add({
        student_id: String(loggedInUser.id),
        amount: gameSettings.potionPrice,
        item: `ซื้อ Potion ฟื้นฟูเลือด (เกม RPG)`,
        timestamp: new Date().toISOString(),
      });
    playerStats.potions++;
    saveToLocal();
    updateHUD();
    openBackpack();
    Swal.fire({
      toast: true,
      position: "top",
      icon: "success",
      title: "ซื้อ Potion สำเร็จ! 🛍️",
      showConfirmButton: false,
      timer: 1500,
      customClass: { popup: "rounded-[2rem] shadow-lg" },
    });
  } catch (e) {
    Swal.fire({
      toast: true,
      position: "top",
      icon: "error",
      title: "ระบบขัดข้อง",
      showConfirmButton: false,
      timer: 1500,
    });
  }
};

window.playerTakeDamage = function (damage) {
  playerStats.hp -= damage;
  saveToLocal();
  canvas.style.transform = "translate(10px, 10px)";
  setTimeout(() => (canvas.style.transform = "translate(-10px, -10px)"), 50);
  setTimeout(() => (canvas.style.transform = "translate(10px, -10px)"), 100);
  setTimeout(() => (canvas.style.transform = "translate(0, 0)"), 150);
  updateHUD();
  if (playerStats.hp <= 0) {
    playerStats.hp = playerStats.maxHp;
    player.x = 200;
    saveToLocal();
    Swal.fire({
      title: "คุณหมดสติ...",
      text: "อย่าเพิ่งท้อ! คุณถูกพามาพักฟื้นที่จุดเริ่มต้นแล้ว",
      icon: "info",
      confirmButtonColor: "#6366f1",
      background: "rgba(255, 255, 255, 0.95)",
      backdrop: `rgba(15, 23, 42, 0.8)`,
      customClass: {
        popup:
          "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-xl p-4",
      },
    });
    return true;
  }
  return false;
};

window.startQuizLoop = function (entityId, qIndex, currentDamageOrScore, type) {
  const isMonster = type === "monster";
  const entity = isMonster
    ? assets.monsters.find((m) => m.id === entityId)
    : assets.npcs.find((n) => n.id === entityId);
  if (qIndex >= entity.quizzes.length) {
    if (isMonster) {
      if (currentDamageOrScore >= entity.hp) {
        defeatedMonsters[entityId] = Date.now();
        const expReward = parseInt(entity.rewardExp) || 0;
        const coinsReward = parseInt(entity.rewardCoins) || 0;
        playerStats.exp += expReward;
        // 🌟 ดรอปเงินจากการตีมอนสเตอร์ (ค่าติดลบแปลว่าได้เงินเพิ่ม)
        if (coinsReward > 0) {
          db.collection("shop_transactions").add({
            student_id: String(loggedInUser.id),
            amount: -coinsReward,
            item: `ล่ามอนสเตอร์: ${entity.name || "ศัตรูใน RPG"}`,
            timestamp: new Date().toISOString(),
          });
        }
        saveToLocal();
        Swal.fire({
          title: "🎉 ปราบสำเร็จ!",
          html: `<div class="bg-amber-50 p-4 rounded-xl border border-amber-200 mt-4"><p class="text-slate-700 font-bold mb-2">ของรางวัลที่ได้รับ:</p><p class="text-emerald-600 font-black">+${expReward} EXP 🌟</p><p class="text-amber-500 font-black">+${coinsReward} เหรียญ 🪙</p></div>`,
          icon: "success",
          confirmButtonColor: "#10b981",
          background: "rgba(255, 255, 255, 0.95)",
          customClass: {
            popup:
              "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-xl p-4",
          },
        }).then(() => checkLevelUp());
      } else {
        saveToLocal();
        Swal.fire({
          title: "มันหนีไปได้!",
          text: `ดาเมจไป ${currentDamageOrScore} แต่ยังไม่พอ ลองมาสู้ใหม่นะ!`,
          icon: "error",
          confirmButtonColor: "#f43f5e",
          background: "rgba(255, 255, 255, 0.95)",
          customClass: {
            popup:
              "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-xl p-4",
          },
        });
      }
    } else {
      playerScores[entityId] = {
        score: currentDamageOrScore,
        total: entity.quizzes.length,
        completed: true,
      };
      playerStats.exp += 20;
      saveToLocal();
      Swal.fire({
        title: "เยี่ยมมาก!",
        text: `คุณตอบถูก ${currentDamageOrScore} ข้อ ได้รับ 20 EXP เป็นรางวัล`,
        icon: "success",
        confirmButtonColor: "#6366f1",
        background: "rgba(255, 255, 255, 0.95)",
        customClass: {
          popup:
            "rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-xl p-4",
        },
      }).then(() => checkLevelUp());
    }
    return;
  }
  const qData = entity.quizzes[qIndex];
  const theme = isMonster ? "rose" : "indigo";
  let monsterHpBarHtml = "";
  if (isMonster) {
    const maxHp = entity.hp;
    const currentHp = Math.max(0, maxHp - currentDamageOrScore);
    const hpPercent = (currentHp / maxHp) * 100;
    monsterHpBarHtml = `<div class="mb-4 bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl p-3 md:p-4 rounded-[1.5rem] border-2 border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.05)]"><div class="flex justify-between items-end mb-2"><span class="text-xs md:text-sm font-bold text-rose-600 flex items-center gap-1.5"><i data-lucide="swords" class="w-4 h-4 text-rose-500"></i> พลังชีวิตมอนสเตอร์</span><span class="text-base md:text-lg font-black text-rose-700 leading-none">${currentHp} <span class="text-xs text-rose-400">/ ${maxHp}</span></span></div><div class="w-full bg-slate-100 rounded-full h-3 md:h-4 border border-slate-200 overflow-hidden shadow-inner p-0.5"><div class="bg-gradient-to-r from-rose-400 to-rose-600 h-full rounded-full transition-all duration-500 relative" style="width: ${hpPercent}%"><div class="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-t-full"></div></div></div></div>`;
  }
  const quizHtml = `<div class="px-2 pb-2">${monsterHpBarHtml}<div class="mb-6 mt-2 text-lg md:text-xl font-black text-slate-800 bg-white/70 p-5 md:p-8 rounded-[2rem] border-2 border-white shadow-sm text-left leading-relaxed">${qData.q}</div><div class="grid grid-cols-1 gap-4"><button onclick="submitQuizAnswer('${entityId}', 1, ${qData.ans}, ${qIndex}, ${currentDamageOrScore}, '${type}')" class="w-full text-left bg-${theme}-50 text-${theme}-700 font-bold py-4 px-6 rounded-2xl border-2 border-${theme}-200 active:translate-y-1 transition-all"><span class="bg-${theme}-200 px-3 py-1 rounded-xl mr-2">1</span> ${qData.c1}</button><button onclick="submitQuizAnswer('${entityId}', 2, ${qData.ans}, ${qIndex}, ${currentDamageOrScore}, '${type}')" class="w-full text-left bg-${theme}-50 text-${theme}-700 font-bold py-4 px-6 rounded-2xl border-2 border-${theme}-200 active:translate-y-1 transition-all"><span class="bg-${theme}-200 px-3 py-1 rounded-xl mr-2">2</span> ${qData.c2}</button><button onclick="submitQuizAnswer('${entityId}', 3, ${qData.ans}, ${qIndex}, ${currentDamageOrScore}, '${type}')" class="w-full text-left bg-${theme}-50 text-${theme}-700 font-bold py-4 px-6 rounded-2xl border-2 border-${theme}-200 active:translate-y-1 transition-all"><span class="bg-${theme}-200 px-3 py-1 rounded-xl mr-2">3</span> ${qData.c3}</button><button onclick="submitQuizAnswer('${entityId}', 4, ${qData.ans}, ${qIndex}, ${currentDamageOrScore}, '${type}')" class="w-full text-left bg-${theme}-50 text-${theme}-700 font-bold py-4 px-6 rounded-2xl border-2 border-${theme}-200 active:translate-y-1 transition-all"><span class="bg-${theme}-200 px-3 py-1 rounded-xl mr-2">4</span> ${qData.c4}</button></div></div>`;
  Swal.fire({
    title: `<span class="text-${theme}-500 font-black">${isMonster ? "สู้! คำถามที่" : "คำถามที่"} ${qIndex + 1}/5</span>`,
    html: quizHtml,
    showConfirmButton: false,
    showCloseButton: true,
    allowOutsideClick: false,
    background: "rgba(244, 246, 248, 0.95)",
    customClass: {
      popup: `rounded-[3rem] border-[4px] border-white backdrop-blur-2xl shadow-[0_30px_60px_rgba(0,0,0,0.15)] p-2 md:p-6`,
    },
  });
};

window.submitQuizAnswer = function (
  entityId,
  selectedChoice,
  correctAns,
  qIndex,
  currentDamageOrScore,
  type,
) {
  Swal.close();
  if (selectedChoice == correctAns) {
    Swal.fire({
      toast: true,
      position: "top",
      showConfirmButton: false,
      timer: 1200,
      icon: "success",
      title: type === "monster" ? "โจมตีเข้าเป้า! (20 DMG)" : "ถูกต้อง!",
      customClass: { popup: "rounded-[2rem] shadow-lg" },
    }).then(() => {
      startQuizLoop(
        entityId,
        qIndex + 1,
        currentDamageOrScore + (type === "monster" ? 20 : 1),
        type,
      );
    });
  } else {
    if (type === "monster") {
      const dmg = 15;
      if (!playerTakeDamage(dmg)) {
        Swal.fire({
          toast: true,
          position: "top",
          showConfirmButton: false,
          timer: 1500,
          icon: "error",
          title: `พลาด! คุณถูกโจมตีเสีย ${dmg} HP 💔`,
          customClass: { popup: "rounded-[2rem] shadow-lg" },
        }).then(() => {
          startQuizLoop(entityId, qIndex + 1, currentDamageOrScore, type);
        });
      }
    } else {
      Swal.fire({
        toast: true,
        position: "top",
        showConfirmButton: false,
        timer: 1200,
        icon: "error",
        title: `ตอบผิด! ลองข้อถัดไปนะ`,
        customClass: { popup: "rounded-[2rem] shadow-lg" },
      }).then(() => {
        startQuizLoop(entityId, qIndex + 1, currentDamageOrScore, type);
      });
    }
  }
};

async function manualSave() {
  const now = Date.now();
  if (isSaving) return;
  if (now - lastSaveTime < 5000) {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "warning",
      title: "เซฟบ่อยเกินไป! รอแป๊บนึงนะ",
      showConfirmButton: false,
      timer: 1500,
      customClass: { popup: "rounded-[2rem] shadow-lg" },
    });
    return;
  }
  isSaving = true;
  const btn = document.getElementById("btn-save-game");
  const orig = btn.innerHTML;
  btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> บันทึก...`;
  lucide.createIcons();
  try {
    await db
      .collection("student_game_progress")
      .doc(loggedInUser.id)
      .set(
        {
          last_x: player.x,
          current_map: currentMapId,
          stats: playerStats,
          scores: playerScores,
          defeated_monsters: defeatedMonsters,
          updated_at: new Date().toISOString(),
        },
        { merge: true },
      );
    hasUnsavedChanges = false;
    lastSaveTime = Date.now();
    localStorage.removeItem(`game_temp_${loggedInUser.id}`);
    Swal.fire({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 2000,
      icon: "success",
      title: "บันทึกข้อมูลสำเร็จ! 💾",
      customClass: { popup: "rounded-[2rem] shadow-lg" },
    });
  } catch (e) {
    Swal.fire({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 2000,
      icon: "error",
      title: "การเชื่อมต่อขัดข้อง",
      customClass: { popup: "rounded-[2rem] shadow-lg" },
    });
  } finally {
    btn.innerHTML = orig;
    lucide.createIcons();
    isSaving = false;
  }
}

window.addEventListener("beforeunload", (e) => {
  if (hasUnsavedChanges) {
    saveToLocal();
    e.preventDefault();
    e.returnValue = "";
  }
});
