/* ============================================
   DATA LAYER — Firebase Realtime Database
   ============================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app-check.js";
import { getDatabase, ref, onValue, push, set, remove } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDxpf3fgTwDfy82JwCdcWfjE96IT-fBuIY",
    authDomain: "house-compare-2c711.firebaseapp.com",
    projectId: "house-compare-2c711",
    storageBucket: "house-compare-2c711.firebasestorage.app",
    messagingSenderId: "633697902885",
    appId: "1:633697902885:web:d7e048ad3a03001e317acc",
    // รองรับกรณีเซิร์ฟเวอร์อยู่สิงคโปร์ (asia-southeast1) หรือเมกา (firebaseio.com)
    databaseURL: "https://house-compare-2c711-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase & App Check (Bot Protection)
const app = initializeApp(firebaseConfig);

// สำหรับตอนเทสเว็บในเครื่อง (localhost) ให้สร้าง Debug Token แทนการเช็ค reCAPTCHA ป้องกันบั๊ก
if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    // ใส่ Token ตรงๆ ลงไปเลย เพื่อดับข้อความแจ้งเตือน "App Check debug token: ..." บน Console
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = false;
}

const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LdQiKssAAAAAJutnNPrtfOuX9uS_cngYeS45T9F'),
    isTokenAutoRefreshEnabled: true // จำเป็นต้องเป็น true ตามมาตรฐาน reCAPTCHA v3 เพื่อสร้าง Token ทันที
});
const db = getDatabase(app);
const auth = getAuth(app);

// Data structure to hold houses memory
window.globalHouses = [];
window.isAdmin = false;

// Watch Database Changes (Real-time listener)
onValue(ref(db, 'houses'), (snapshot) => {
    const data = snapshot.val() || {};

    // แปลง Object จาก Firebase เป็น Array
    const housesArray = Object.keys(data).map(key => ({
        ...data[key],
        id: key
    }));

    window.globalHouses = housesArray;

    // สั่งให้ UI อัปเดตเมื่อมีข้อมูลใหม่เข้ามา (Realtime)
    if (window.populateSelectors) window.populateSelectors();
    if (window.renderComparison) window.renderComparison();
    if (window.renderHouseList && document.getElementById('modal-manage').style.display === 'flex') {
        window.renderHouseList();
    }
}, (error) => {
    console.error("Firebase Database Error:", error);
    // หากล้มเหลวเพราะ URL ผิด ให้ลอง Fallback ไปหา URL กลางของเมกา
    if (error.message.includes("Client is offline") || error.message.includes("databaseURL")) {
        console.warn("กำลังลองสลับ Database URL fallback...");
    }
});

// Watch Auth Changes
onAuthStateChanged(auth, (user) => {
    window.isAdmin = !!user;
    // แสดง/ซ่อน ปุ่มแอดมิน
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = user ? 'block' : 'none';
    });
    // สั่งวาด UI ตารางเปรียบเทียบใหม่ เพื่อเพิ่ม/ลบปุ่มแก้ไขด่วน
    if (window.renderComparison) window.renderComparison();
});

// ==== Data Access Functions ====

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

// ==== Admin Login Functions ====

window.adminLogin = async function (email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

window.adminLogout = async function () {
    return signOut(auth);
}

// ---- Dummy Export/Import functions (เพื่อไม่ให้หน้า UI เก่าพัง) ----
window.exportData = function () {
    alert("ปิดการใช้งาน Export เนื่องจากเปลี่ยนไปใช้ Firebase แบบ Real-time แล้ว");
}
window.importData = async function (file) {
    alert("ปิดการใช้งาน Import ปัจจุบันข้อมูลดึงจาก Firebase ตรงๆ ครับ");
}
