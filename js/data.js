/* ============================================
   DATA LAYER — Firebase Realtime Database
   ============================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app-check.js";
import { getDatabase, ref, onValue, push, set, remove, get } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDxpf3fgTwDfy82JwCdcWfjE96IT-fBuIY",
    authDomain: "house-compare-2c711.firebaseapp.com",
    projectId: "house-compare-2c711",
    storageBucket: "house-compare-2c711.firebasestorage.app",
    messagingSenderId: "633697902885",
    appId: "1:633697902885:web:d7e048ad3a03001e317acc",
    databaseURL: "https://house-compare-2c711-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase & App Check (Bot Protection)
const app = initializeApp(firebaseConfig);

// Debug Token สำหรับ localhost
if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = false;
}

const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LdQiKssAAAAAJutnNPrtfOuX9uS_cngYeS45T9F'),
    isTokenAutoRefreshEnabled: true
});
const db = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ============================================
// STATE
// ============================================
window.globalHouses = [];
window.globalVotes = {};
window.currentUser = null;   // { uid, displayName, photoURL, email }
window.isAdmin = false;      // uid อยู่ใน /admins whitelist
window.isUser = false;       // ล็อกอินแล้ว (ไม่ว่า admin หรือ user)

// ============================================
// REALTIME LISTENERS
// ============================================

// Watch Database Changes (Houses — Real-time)
onValue(ref(db, 'houses'), (snapshot) => {
    const data = snapshot.val() || {};
    window.globalHouses = Object.keys(data).map(key => ({
        ...data[key],
        id: key
    }));

    if (window.populateSelectors) window.populateSelectors();
    if (window.renderComparison) window.renderComparison();
    if (window.renderHouseList && document.getElementById('modal-manage').style.display === 'flex') {
        window.renderHouseList();
    }
}, (error) => {
    console.error("Firebase Database Error:", error);
});

// Watch Votes (Real-time)
onValue(ref(db, 'votes'), (snapshot) => {
    window.globalVotes = snapshot.val() || {};
    // อัพเดท Vote Modal ถ้าเปิดอยู่
    if (window.renderVoteModal && document.getElementById('modal-vote').style.display === 'flex') {
        window.renderVoteModal();
    }
});

// ============================================
// AUTH — Google OAuth for everyone
// ============================================

onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.currentUser = {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            email: user.email
        };
        window.isUser = true;

        // เช็คว่า uid อยู่ใน /admins whitelist หรือไม่
        try {
            const adminSnap = await get(ref(db, `admins/${user.uid}`));
            window.isAdmin = adminSnap.exists();
        } catch (err) {
            // console.warn("ไม่สามารถเช็ค admin status:", err);
            window.isAdmin = false;
        }
    } else {
        window.currentUser = null;
        window.isAdmin = false;
        window.isUser = false;
    }

    // อัพเดท UI ทั้งหมด
    if (window.updateAuthUI) window.updateAuthUI();
    if (window.renderComparison) window.renderComparison();
});

// ============================================
// AUTH FUNCTIONS
// ============================================

window.userGoogleLogin = async function () {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result;
    } catch (err) {
        if (err.code !== 'auth/popup-closed-by-user') {
            console.error('Popup error:', err);
        }
        throw err;
    }
}

window.userLogout = function () {
    return signOut(auth);
}

// ============================================
// DATA ACCESS FUNCTIONS
// ============================================

window.getAllHouses = function () {
    return window.globalHouses;
}

window.getHouseById = function (id) {
    return window.globalHouses.find(h => h.id === id) || null;
}

window.addHouse = function (house) {
    const houseListRef = ref(db, 'houses');
    const newHouseRef = push(houseListRef);
    set(newHouseRef, house);
    return { ...house, id: newHouseRef.key };
}

window.updateHouse = function (id, updates) {
    const payload = { ...updates };
    delete payload.id;
    set(ref(db, 'houses/' + id), payload);
}

window.deleteHouse = function (id) {
    remove(ref(db, 'houses/' + id));
}

// ============================================
// VOTE FUNCTIONS
// ============================================

/**
 * โหวตที่พัก — 1 user ได้ 1 vote (เปลี่ยนได้)
 * ลบ vote เก่าออกก่อน แล้วเพิ่ม vote ใหม่
 */
let _lastVoteTime = 0;
window.castVote = async function (houseId) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not logged in');

    // Rate limiting — 3 วินาที cooldown
    const now = Date.now();
    if (now - _lastVoteTime < 3000) {
        throw new Error('กรุณารอสักครู่ก่อนโหวตอีกครั้ง');
    }
    _lastVoteTime = now;

    // ลบ vote เก่าของ user นี้ออก (ถ้ามี)
    const currentVotes = window.globalVotes || {};
    const removePromises = [];
    for (const [hid, voters] of Object.entries(currentVotes)) {
        if (voters && voters[user.uid]) {
            removePromises.push(remove(ref(db, `votes/${hid}/${user.uid}`)));
        }
    }
    await Promise.all(removePromises);

    // เพิ่ม vote ใหม่ (เก็บข้อมูลโปรไฟล์ด้วย)
    await set(ref(db, `votes/${houseId}/${user.uid}`), {
        displayName: user.displayName || 'User',
        photoURL: user.photoURL || ''
    });
}

/**
 * ดึงจำนวน vote ของที่พัก
 */
window.getVoteCount = function (houseId) {
    const voters = window.globalVotes[houseId];
    return voters ? Object.keys(voters).length : 0;
}

/**
 * ดึง houseId ที่ user นี้โหวตอยู่
 */
window.getUserVote = function () {
    if (!window.currentUser) return null;
    const uid = window.currentUser.uid;
    for (const [hid, voters] of Object.entries(window.globalVotes)) {
        if (voters && voters[uid]) return hid;
    }
    return null;
}

// ---- Dummy Export/Import functions ----
window.exportData = function () {
    alert("ปิดการใช้งาน Export เนื่องจากเปลี่ยนไปใช้ Firebase แบบ Real-time แล้ว");
}
window.importData = async function (file) {
    alert("ปิดการใช้งาน Import ปัจจุบันข้อมูลดึงจาก Firebase ตรงๆ ครับ");
}
