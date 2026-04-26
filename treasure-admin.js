// =================================================================
// 📍 ระบบพิกัด GPS (ดึงตำแหน่งจริง)
// =================================================================
if (typeof window.CUSTOM_GPS === "undefined") {
  window.CUSTOM_GPS = {
    enable: true, // 🟢 ปิดจำลองพิกัด เพื่อใช้ GPS จริง
    lat: 20.104484306400153,
    lng: 100.4982370438722,
  };
}

// ฟังก์ชันสำหรับ Override Geolocation (ทำงานเฉพาะตอน enable เป็น true)
(function () {
  if (window.CUSTOM_GPS.enable) {
    const mockGeo = {
      getCurrentPosition: function (success, error, options) {
        setTimeout(() => {
          success({
            coords: {
              latitude: window.CUSTOM_GPS.lat,
              longitude: window.CUSTOM_GPS.lng,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          });
        }, 100);
      },
      watchPosition: function (success, error, options) {
        const id = Math.floor(Math.random() * 1000);
        setTimeout(() => {
          success({
            coords: {
              latitude: window.CUSTOM_GPS.lat,
              longitude: window.CUSTOM_GPS.lng,
              accuracy: 10,
            },
            timestamp: Date.now(),
          });
        }, 100);
        return id;
      },
      clearWatch: function (id) {},
    };

    try {
      Object.defineProperty(navigator, "geolocation", {
        value: mockGeo,
        configurable: true,
        writable: true,
      });
      console.warn("⚠️ บังคับใช้พิกัดจำลอง (Mock GPS) เรียบร้อยแล้ว");
    } catch (e) {
      console.error("❌ ไม่สามารถ Override Geolocation ได้:", e);
    }
  }
})();
// =================================================================

let quests = [];
let editingQuestId = null;
let questToDelete = null;

window.onload = () => {
  if (typeof lucide !== "undefined") lucide.createIcons();
  loadQuests();
};

async function loadQuests() {
  try {
    const snap = await db
      .collection("treasure_quests")
      .orderBy("created_at", "desc")
      .get();
    quests = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderQuests();
  } catch (error) {
    if (typeof showToast === "function")
      showToast("โหลดข้อมูลล้มเหลว", "error");
    console.error("Firebase Load Error:", error);
  }
}

// 🌟 ฟังก์ชันดึงกล่องสมบัติจากครูมาแสดงบนจอนักเรียน
function fetchLiveDropsForStudent() {
  db.collection("live_drops").onSnapshot((snap) => {
    for (let id in liveDropMarkers) {
      studentRadarMap.removeLayer(liveDropMarkers[id]);
    }
    liveDropMarkers = {};

    snap.docs.forEach((doc) => {
      const data = doc.data();
      const studentId =
        typeof loggedInUser !== "undefined" && loggedInUser
          ? String(loggedInUser.id)
          : null;

      if (data.claimed_by && studentId && data.claimed_by.includes(studentId)) {
        return;
      }

      const boxIcon = L.divIcon({
        className: "student-box-marker",
        html: `<div class="text-4xl animate-bounce drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">🎁</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([data.lat, data.lng], { icon: boxIcon }).addTo(
        studentRadarMap,
      );

      marker.on("click", () => {
        if (typeof attemptToCollectBox === "function") {
          attemptToCollectBox(doc.id, data.lat, data.lng, data.reward);
        } else {
          showToast(
            `กล่องนี้มี ${data.reward} เหรียญ! เดินเข้าไปใกล้ๆ เพื่อเก็บ!`,
            "info",
          );
        }
      });
      liveDropMarkers[doc.id] = marker;
    });
  });
}

function renderQuests() {
  const container = document.getElementById("quest-list");
  if (quests.length === 0) {
    container.innerHTML =
      '<div class="col-span-full text-center py-12 bg-white rounded-3xl border border-slate-200"><i data-lucide="map" class="w-12 h-12 mx-auto mb-3 text-slate-300"></i><p class="text-slate-500 font-bold">ยังไม่มีภารกิจล่าสมบัติ</p></div>';
    if (typeof lucide !== "undefined") lucide.createIcons();
    return;
  }

  container.innerHTML = quests
    .map((q) => {
      let coverHtml = q.cover_url
        ? `<div class="w-full h-32 mb-4 rounded-xl overflow-hidden shadow-inner"><img src="${q.cover_url}" class="w-full h-full object-cover"></div>`
        : `<div class="w-full h-32 mb-4 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200"><i data-lucide="image" class="w-8 h-8 text-slate-300"></i></div>`;

      return `
        <div class="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full relative overflow-hidden group">
            <div class="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
            
            <div class="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button onclick="editQuest('${q.id}')" class="p-2 bg-white/90 backdrop-blur rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all shadow-sm" title="แก้ไข"><i data-lucide="settings" class="w-4 h-4"></i></button>
                <button onclick="openDeleteModal('${q.id}')" class="p-2 bg-white/90 backdrop-blur rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-sm" title="ลบ"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>

            ${coverHtml}

            <div class="flex items-center justify-between mb-2 relative z-10">
                <span class="bg-amber-100 text-amber-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest">ชิ้นส่วน ${q.total_pieces} ชิ้น</span>
            </div>
            <h3 class="text-xl font-bold text-slate-800 mb-2 relative z-10 leading-tight">${q.title}</h3>
            <p class="text-sm text-slate-500 mb-6 flex-1 relative z-10 line-clamp-2">${q.desc || "ไม่มีคำอธิบาย"}</p>
            <button onclick="viewQRCodes('${q.id}', '${q.title}', ${q.total_pieces})" class="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all relative z-10"><i data-lucide="qr-code" class="w-4 h-4"></i> ดู QR Code ลายแทง</button>
        </div>`;
    })
    .join("");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function openCreateModal() {
  editingQuestId = null;
  document.getElementById("modal-title").innerHTML = `
        <div class="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 text-white">
            <i data-lucide="map-pin" class="w-6 h-6"></i>
        </div>
        <span>สร้างลายแทงสมบัติ</span>
    `;

  document.getElementById("quest-title").value = "";
  document.getElementById("quest-desc").value = "";
  document.getElementById("quest-cover").value = "";
  document.getElementById("quest-pieces").value = 3;

  previewCover("");
  generateImageInputs();

  const modal = document.getElementById("create-modal");
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.remove("opacity-0");
    modal.querySelector("div").classList.remove("scale-95");
  }, 10);
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function editQuest(id) {
  const q = quests.find((x) => x.id === id);
  if (!q) return;

  editingQuestId = id;
  document.getElementById("modal-title").innerHTML = `
        <div class="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white">
            <i data-lucide="settings" class="w-6 h-6"></i>
        </div>
        <span>แก้ไขภารกิจสมบัติ</span>
    `;

  document.getElementById("quest-title").value = q.title;
  document.getElementById("quest-desc").value = q.desc || "";
  document.getElementById("quest-cover").value = q.cover_url || "";
  document.getElementById("quest-pieces").value = q.total_pieces;

  previewCover(q.cover_url || "");
  generateImageInputs();

  if (q.piece_images && q.piece_images.length > 0) {
    for (let i = 1; i <= q.total_pieces; i++) {
      const pieceData = q.piece_images[i - 1];
      if (pieceData) {
        const isObject = typeof pieceData === "object";
        const imgInput = document.getElementById(`inp-piece-img-${i}`);
        if (imgInput)
          imgInput.value = isObject ? pieceData.url || "" : pieceData;

        if (isObject) {
          if (document.getElementById(`inp-piece-reward-${i}`))
            document.getElementById(`inp-piece-reward-${i}`).value =
              pieceData.reward || 100;
          if (document.getElementById(`inp-piece-lat-${i}`))
            document.getElementById(`inp-piece-lat-${i}`).value =
              pieceData.lat || "";
          if (document.getElementById(`inp-piece-lng-${i}`))
            document.getElementById(`inp-piece-lng-${i}`).value =
              pieceData.lng || "";

          if (pieceData.lat && pieceData.lng) {
            const btnText = document.getElementById(`text-map-${i}`);
            const btn = document.getElementById(`btn-map-${i}`);
            btnText.textContent = `พิกัด: ${parseFloat(pieceData.lat).toFixed(4)}, ${parseFloat(pieceData.lng).toFixed(4)}`;
            btn.classList.replace("bg-indigo-50", "bg-emerald-50");
            btn.classList.replace("text-indigo-600", "text-emerald-600");
            btn.classList.replace("border-indigo-200", "border-emerald-200");
          }
        }
      }
    }
  }

  const modal = document.getElementById("create-modal");
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.remove("opacity-0");
    modal.querySelector("div").classList.remove("scale-95");
  }, 10);
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function closeCreateModal() {
  const modal = document.getElementById("create-modal");
  modal.classList.add("opacity-0");
  modal.querySelector("div").classList.add("scale-95");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

function openDeleteModal(id) {
  const q = quests.find((x) => x.id === id);
  if (!q) return;

  questToDelete = id;
  document.getElementById("delete-target-name").textContent = `"${q.title}"`;

  const modal = document.getElementById("delete-confirm-modal");
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.remove("opacity-0");
    modal.querySelector("div").classList.remove("scale-95");
  }, 10);
}

function closeDeleteModal() {
  questToDelete = null;
  const modal = document.getElementById("delete-confirm-modal");
  modal.classList.add("opacity-0");
  modal.querySelector("div").classList.add("scale-95");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

async function confirmDeleteAction() {
  if (!questToDelete) return;

  const btn = document.getElementById("btn-confirm-delete");
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังลบ...';
  if (typeof lucide !== "undefined") lucide.createIcons();

  try {
    await db.collection("treasure_quests").doc(questToDelete).delete();
    showToast("ลบภารกิจเรียบร้อยแล้ว!");
    closeDeleteModal();
    await loadQuests();
  } catch (e) {
    showToast("ไม่สามารถลบข้อมูลได้", "error");
    btn.disabled = false;
    btn.innerHTML = origHtml;
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

let adminMap = null;
let currentSelectingPiece = null;

function openMapPicker(pieceIndex) {
  currentSelectingPiece = pieceIndex;
  const modal = document.getElementById("map-picker-modal");
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.remove("opacity-0"), 10);

  if (!adminMap) {
    adminMap = L.map("admin-map", { zoomControl: false }).setView(
      [20.266, 99.988],
      17,
    );

    // 🌟 เปลี่ยนเป็นแผนที่ภาพดาวเทียม (Esri World Imagery)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP",
      },
    ).addTo(adminMap);

    const locateControl = L.Control.extend({
      options: { position: "topright" },
      onAdd: function (map) {
        const container = L.DomUtil.create(
          "div",
          "leaflet-bar leaflet-control leaflet-control-custom",
        );
        container.style.backgroundColor = "white";
        container.style.width = "40px";
        container.style.height = "40px";
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.justifyContent = "center";
        container.style.cursor = "pointer";
        container.style.borderRadius = "12px";
        container.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
        container.innerHTML = "📍";
        container.title = "ดึงตำแหน่งปัจจุบัน";

        container.onclick = function (e) {
          e.stopPropagation();
          getCurrentAdminLocation();
        };
        return container;
      },
    });
    adminMap.addControl(new locateControl());

    adminMap.on("move", function () {
      const center = adminMap.getCenter();
      const coordDisplay = document.getElementById("map-coords-display");
      if (coordDisplay)
        coordDisplay.textContent = `Lat: ${center.lat.toFixed(5)}, Lng: ${center.lng.toFixed(5)}`;
    });
  }

  const lat = document.getElementById(`inp-piece-lat-${pieceIndex}`).value;
  const lng = document.getElementById(`inp-piece-lng-${pieceIndex}`).value;

  setTimeout(() => {
    adminMap.invalidateSize();
    if (lat && lng) {
      adminMap.setView([lat, lng], 19);
    } else {
      getCurrentAdminLocation();
    }
  }, 300);
}

function getCurrentAdminLocation() {
  if (!navigator.geolocation) {
    showToast("เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง", "error");
    return;
  }

  showToast("กำลังค้นหาตำแหน่งของคุณ...", "info");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (adminMap) adminMap.setView([lat, lng], 19); // ซูมเข้าใกล้ๆ ภาพดาวเทียมจะได้ชัด

      if (window.adminPointer) {
        window.adminPointer.setLatLng([lat, lng]);
      } else if (adminMap) {
        window.adminPointer = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: "#3b82f6",
          color: "white",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        })
          .addTo(adminMap)
          .bindPopup("คุณอยู่ที่นี่")
          .openPopup();
      }
      showToast("พบตำแหน่งแล้ว!", "success");
    },
    (error) => {
      console.error(error);
      showToast(
        "ไม่สามารถดึงตำแหน่งได้ (โปรดเช็ค HTTPS หรือสิทธิ์ GPS)",
        "error",
      );
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  );
}

function closeMapPicker() {
  const modal = document.getElementById("map-picker-modal");
  modal.classList.add("opacity-0");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

function confirmMapLocation() {
  const center = adminMap.getCenter();
  document.getElementById(`inp-piece-lat-${currentSelectingPiece}`).value =
    center.lat;
  document.getElementById(`inp-piece-lng-${currentSelectingPiece}`).value =
    center.lng;

  const btnText = document.getElementById(`text-map-${currentSelectingPiece}`);
  btnText.textContent = `พิกัด: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;

  const btn = document.getElementById(`btn-map-${currentSelectingPiece}`);
  btn.classList.replace("bg-indigo-50", "bg-emerald-50");
  btn.classList.replace("text-indigo-600", "text-emerald-600");
  btn.classList.replace("border-indigo-200", "border-emerald-200");

  closeMapPicker();
}

let liveMap = null;
let liveMarkers = [];
let pendingDropCoords = null;
let liveDropUnsubscribeAdmin = null;

function openLiveDropMap() {
  const modal = document.getElementById("live-drop-modal");
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.remove("opacity-0"), 10);

  if (!liveMap) {
    liveMap = L.map("live-admin-map").setView([20.266, 99.988], 18);

    // 🌟 เปลี่ยนเป็นแผนที่ภาพดาวเทียม (Esri World Imagery) ให้แผนที่เสกกล่องด้วย
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP",
      },
    ).addTo(liveMap);

    liveMap.on("click", function (e) {
      pendingDropCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
      openCoinPromptModal();
    });
  }

  // ดีเลย์นิดนึงเพื่อให้ DOM โหลดแผนที่เสร็จก่อน ค่อยดึงพิกัดครู
  setTimeout(() => {
    liveMap.invalidateSize();
    fetchLiveDropsAdmin();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          liveMap.setView([lat, lng], 19);

          if (!window.adminLocationMarker) {
            const adminIcon = L.divIcon({
              className: "admin-user-marker",
              html: `<div class="w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-md flex items-center justify-center"><div class="w-1.5 h-1.5 bg-white rounded-full"></div></div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            });
            window.adminLocationMarker = L.marker([lat, lng], {
              icon: adminIcon,
              interactive: false,
              zIndexOffset: 1000,
            }).addTo(liveMap);
          } else {
            window.adminLocationMarker.setLatLng([lat, lng]);
          }
        },
        (err) => {
          if (typeof showToast === "function")
            showToast("ไม่สามารถระบุพิกัดครูได้ (โปรดเปิด GPS)", "warning");
        },
        { enableHighAccuracy: true },
      );
    }
  }, 300);
}

function closeLiveDropMap() {
  const modal = document.getElementById("live-drop-modal");
  modal.classList.add("opacity-0");
  setTimeout(() => modal.classList.add("hidden"), 300);

  if (liveDropUnsubscribeAdmin) {
    liveDropUnsubscribeAdmin();
    liveDropUnsubscribeAdmin = null;
  }
}

function openCoinPromptModal() {
  const modal = document.getElementById("coin-prompt-modal");
  if (!modal) return alert("ไม่พบหน้าต่างกรอกเหรียญใน HTML");
  document.getElementById("live-drop-coin-amount").value = 500;
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.remove("opacity-0");
    modal.querySelector("div").classList.remove("scale-95");
  }, 10);
}

function closeCoinPromptModal() {
  const modal = document.getElementById("coin-prompt-modal");
  if (!modal) return;
  modal.classList.add("opacity-0");
  modal.querySelector("div").classList.add("scale-95");
  setTimeout(() => {
    modal.classList.add("hidden");
    pendingDropCoords = null;
  }, 300);
}

async function confirmLiveDrop() {
  if (!pendingDropCoords) return;
  const amountInput = document.getElementById("live-drop-coin-amount");
  const reward = parseInt(amountInput.value);

  if (!reward || isNaN(reward) || reward <= 0)
    return showToast("ระบุเหรียญให้ถูกต้อง", "error");

  const btn = document.getElementById("btn-confirm-drop");
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>';

  try {
    await db.collection("live_drops").add({
      lat: pendingDropCoords.lat,
      lng: pendingDropCoords.lng,
      reward: reward,
      claimed_by: [],
      created_at: new Date().toISOString(),
    });
    showToast(`เสกกล่องสมบัติ ${reward} เหรียญ เรียบร้อย!`);
    closeCoinPromptModal();
  } catch (err) {
    showToast("ดรอปของไม่สำเร็จ", "error");
  }

  btn.disabled = false;
  btn.innerHTML = origHtml;
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function fetchLiveDropsAdmin() {
  if (liveDropUnsubscribeAdmin) liveDropUnsubscribeAdmin();

  const boxIcon = L.divIcon({
    className: "admin-box-marker",
    html: `<div class="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg"><span class="text-xl drop-shadow-md">🎁</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  liveDropUnsubscribeAdmin = db.collection("live_drops").onSnapshot((snap) => {
    liveMarkers.forEach((m) => liveMap.removeLayer(m));
    liveMarkers = [];

    snap.docs.forEach((doc) => {
      const data = doc.data();
      const marker = L.marker([data.lat, data.lng], { icon: boxIcon }).addTo(
        liveMap,
      );

      marker.bindPopup(
        `<div class="text-center font-bold p-1"><p class="text-indigo-600 mb-2">รางวัล: ${data.reward} เหรียญ</p><p class="text-xs text-slate-500 mb-3 bg-slate-100 py-1 rounded">มีคนเก็บไปแล้ว: <span class="text-rose-500 text-sm">${data.claimed_by ? data.claimed_by.length : 0}</span> คน</p><button onclick="deleteLiveDrop('${doc.id}')" class="bg-rose-500 hover:bg-rose-600 text-white px-4 py-1.5 rounded-lg text-xs w-full shadow-sm">ลบกล่องนี้ทิ้ง</button></div>`,
      );
      liveMarkers.push(marker);
    });
  });
}

window.deleteLiveDrop = function (id) {
  let modal = document.getElementById("live-drop-delete-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "live-drop-delete-modal";
    modal.className =
      "fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[500] hidden flex items-center justify-center p-4 transition-all opacity-0 duration-300";
    modal.innerHTML = `
            <div class="bg-white rounded-[2.5rem] w-full max-w-sm shadow-[0_0_50px_rgba(225,29,72,0.3)] overflow-hidden transform scale-95 transition-transform duration-300 text-center relative border border-rose-100">
                <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-red-600"></div>
                <div class="p-8">
                    <div class="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-rose-100 shadow-[0_0_20px_rgba(225,29,72,0.2)]">
                        <i data-lucide="trash-2" class="w-10 h-10 text-rose-500"></i>
                    </div>
                    <h3 class="text-2xl font-black text-slate-800 mb-2 font-outfit">ยืนยันการลบกล่อง?</h3>
                    <p class="text-sm text-slate-500 mb-6 font-medium">เด็กที่ยังไม่เก็บ จะไม่เห็นกล่องนี้อีก<br>คุณแน่ใจหรือไม่ว่าต้องการลบทิ้ง?</p>
                    <div class="flex gap-4">
                        <button onclick="closeLiveDropDeleteModal()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3.5 rounded-2xl text-sm font-bold transition-all uppercase tracking-widest border border-slate-200 shadow-sm">ยกเลิก</button>
                        <button id="btn-confirm-delete-livedrop" class="flex-1 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-rose-200 transition-all uppercase tracking-widest flex items-center justify-center gap-2 border border-red-500">
                            <i data-lucide="trash-2" class="w-4 h-4 text-white"></i> ลบทิ้ง
                        </button>
                    </div>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  const confirmBtn = document.getElementById("btn-confirm-delete-livedrop");
  confirmBtn.onclick = async function () {
    const origHtml = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML =
      '<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-white"></i> กำลังลบ...';
    if (typeof lucide !== "undefined") lucide.createIcons();

    try {
      await db.collection("live_drops").doc(id).delete();
      if (typeof showToast === "function")
        showToast("ลบกล่องสมบัติออกจากแผนที่เรียบร้อย!", "success");
      closeLiveDropDeleteModal();
    } catch (e) {
      if (typeof showToast === "function") showToast("ลบกล่องล้มเหลว", "error");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = origHtml;
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
  };

  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.remove("opacity-0");
    modal.querySelector(".transform").classList.remove("scale-95");
    modal.querySelector(".transform").classList.add("scale-100");
  }, 10);
};

window.closeLiveDropDeleteModal = function () {
  const modal = document.getElementById("live-drop-delete-modal");
  if (modal) {
    modal.classList.add("opacity-0");
    modal.querySelector(".transform").classList.remove("scale-100");
    modal.querySelector(".transform").classList.add("scale-95");
    setTimeout(() => modal.classList.add("hidden"), 300);
  }
};

function adjustPieces(change) {
  const input = document.getElementById("quest-pieces");
  let currentVal = parseInt(input.value) || 2;
  let newVal = currentVal + change;

  if (newVal < 2) newVal = 2;
  if (newVal > 10) newVal = 10;

  input.value = newVal;
  generateImageInputs();
}

function previewCover(url) {
  const container = document.getElementById("cover-preview-container");
  const img = document.getElementById("cover-preview-img");

  if (url && url.startsWith("http")) {
    img.src = url;
    container.classList.remove("hidden");
  } else {
    img.src = "";
    container.classList.add("hidden");
  }
}

function generateImageInputs() {
  let num = parseInt(document.getElementById("quest-pieces").value) || 2;
  if (num > 10) num = 10;

  let html = `<p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">รายละเอียดแต่ละชิ้น (ของรางวัล & พิกัด GPS)</p>`;

  for (let i = 1; i <= num; i++) {
    html += `
        <div class="flex flex-col gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 group hover:border-amber-300 transition-colors mb-3 shadow-sm">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 shrink-0 bg-white rounded-lg flex items-center justify-center text-xs font-black text-amber-500 shadow-sm border border-amber-100">${i}</div>
                <input type="url" id="inp-piece-img-${i}" class="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-500" placeholder="ลิงก์รูปชิ้นส่วน (ถ้ามี)">
            </div>
            <div class="flex flex-col sm:flex-row items-center gap-3 pl-11">
                <div class="flex items-center w-full sm:w-1/3 relative">
                    <i data-lucide="coins" class="absolute left-3 w-4 h-4 text-amber-500"></i>
                    <input type="number" id="inp-piece-reward-${i}" class="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-amber-500 font-bold text-amber-600" placeholder="รางวัล (เหรียญ)" value="100">
                </div>
                <input type="hidden" id="inp-piece-lat-${i}">
                <input type="hidden" id="inp-piece-lng-${i}">
                <button type="button" id="btn-map-${i}" onclick="openMapPicker(${i})" class="w-full sm:w-2/3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                    <i data-lucide="map-pin" class="w-4 h-4"></i> <span id="text-map-${i}">คลิกเพื่อปักพิกัด (GPS)</span>
                </button>
            </div>
        </div>`;
  }
  document.getElementById("dynamic-image-inputs").innerHTML = html;
  if (typeof lucide !== "undefined") lucide.createIcons();
}

async function saveQuest() {
  const title = document.getElementById("quest-title").value.trim();
  const desc = document.getElementById("quest-desc").value.trim();
  const cover_url = document.getElementById("quest-cover").value.trim();
  const pieces = parseInt(document.getElementById("quest-pieces").value);

  if (!title || isNaN(pieces) || pieces < 2)
    return showToast(
      "กรุณากรอกข้อมูลให้ครบและถูกต้อง (ขั้นต่ำ 2 ชิ้น)",
      "error",
    );

  let pieceDataArray = [];
  for (let i = 1; i <= pieces; i++) {
    pieceDataArray.push({
      url: document.getElementById(`inp-piece-img-${i}`)
        ? document.getElementById(`inp-piece-img-${i}`).value.trim()
        : "",
      reward: document.getElementById(`inp-piece-reward-${i}`)
        ? parseInt(document.getElementById(`inp-piece-reward-${i}`).value) || 0
        : 0,
      lat: document.getElementById(`inp-piece-lat-${i}`)
        ? document.getElementById(`inp-piece-lat-${i}`).value
        : "",
      lng: document.getElementById(`inp-piece-lng-${i}`)
        ? document.getElementById(`inp-piece-lng-${i}`).value
        : "",
    });
  }

  const btn = document.getElementById("btn-save-quest");
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> กำลังบันทึก...';
  if (typeof lucide !== "undefined") lucide.createIcons();

  try {
    const payload = {
      title,
      desc,
      cover_url,
      total_pieces: pieces,
      piece_images: pieceDataArray,
    };

    if (editingQuestId) {
      payload.updated_at = new Date().toISOString();
      await db
        .collection("treasure_quests")
        .doc(editingQuestId)
        .update(payload);
      showToast("แก้ไขภารกิจสำเร็จ!");
    } else {
      payload.created_at = new Date().toISOString();
      await db.collection("treasure_quests").add(payload);
      showToast("สร้างภารกิจสำเร็จ!");
    }

    closeCreateModal();
    loadQuests();
  } catch (e) {
    showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
  }
  btn.disabled = false;
  btn.innerHTML = origHtml;
}

function viewQRCodes(questId, title, pieces) {
  const titleEl = document.getElementById("qr-modal-title");
  if (titleEl) titleEl.textContent = `ลายแทง: ${title}`;
  const container = document.getElementById("qr-codes-container");
  if (!container) return;
  container.innerHTML = "";

  for (let i = 1; i <= pieces; i++) {
    const qrData = `TREASURE:${questId}:${i}`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

    container.innerHTML += `
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center flex flex-col items-center">
                <img src="${qrImgUrl}" class="w-full max-w-[150px] aspect-square mb-3 border border-slate-100 p-2 rounded-xl">
                <span class="bg-amber-100 text-amber-600 px-3 py-1 rounded-lg text-xs font-bold w-full truncate">ชิ้นส่วนที่ ${i}/${pieces}</span>
            </div>
        `;
  }

  const modal = document.getElementById("qr-modal");
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.remove("opacity-0"), 10);
}

function closeQRModal() {
  const modal = document.getElementById("qr-modal");
  modal.classList.add("opacity-0");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

function showToast(msg, type = "success") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className = `bg-white rounded-xl px-5 py-3 border shadow-lg flex items-center gap-3 toast-show ${type === "success" ? "border-emerald-200 text-emerald-700" : "border-rose-200 text-rose-700"}`;
  t.innerHTML = `<i data-lucide="${type === "success" ? "check-circle-2" : "alert-triangle"}" class="w-5 h-5 shrink-0"></i><span class="text-sm font-bold">${msg}</span>`;
  c.appendChild(t);
  if (typeof lucide !== "undefined") lucide.createIcons({ nodes: [t] });
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 300);
  }, 3000);
}
