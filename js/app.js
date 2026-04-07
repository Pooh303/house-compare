/* ============================================
   APP — initialization & event wiring
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ---- Init ----
    initCustomSelects();
    populateSelectors();

    // Auto-select sample data if available
    if (typeof window.getAllHouses === 'function') {
        const houses = window.getAllHouses();
        if (houses.length >= 2) {
            document.getElementById('select-left').value = houses[0].id;
            document.getElementById('select-right').value = houses[1].id;
            if (typeof window.renderComparison === 'function') window.renderComparison();
        }
    }

    // ---- Nav buttons ----
    document.getElementById('btn-manage').addEventListener('click', () => {
        if (typeof window.renderHouseList === 'function') window.renderHouseList();
        document.getElementById('modal-manage').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });


    // ---- Admin Hidden Login (Triple Click Logo) ----
    const logoBtn = document.querySelector('.topnav-logo');
    let logoClickCount = 0;
    logoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logoClickCount++;
        if (logoClickCount >= 3) {
            logoClickCount = 0;
            if(!window.isAdmin) {
                document.getElementById('modal-login').style.display = 'flex';
            }
        }
        setTimeout(() => { logoClickCount = 0; }, 1500);
    });

    // ---- Admin Login Submit ----
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const err = document.getElementById('login-err');
        err.style.display = 'none';
        try {
            await window.adminLogin(email, pass);
            closeModal('modal-login');
            showToast('เข้าสู่ระบบ Admin สำเร็จ');
            document.getElementById('login-form').reset();
        } catch(error) {
            console.error(error);
            err.style.display = 'block';
            err.textContent = 'เข้าสู่ระบบล้มเหลว';
        }
    });

    // ---- Admin Logout ----
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await window.adminLogout();
        showToast('ออกจากระบบเรียบร้อย');
    });

    // ---- Mobile Dropdown Menu ----
    const mobileMenuBtn = document.getElementById('btn-mobile-menu');
    const topnavActions = document.getElementById('topnav-actions');
    
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        topnavActions.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!topnavActions.contains(e.target)) {
            topnavActions.classList.remove('show');
        }
    });
    // ---- Theme toggle ----
    const themeBtn = document.getElementById('btn-theme');
    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light');
        themeBtn.textContent = '☀️';
    }
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light');
        const isLight = document.body.classList.contains('light');
        themeBtn.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
    // ---- Close modals (ทั้ง .modal-close และ [data-close]) ----
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    // ---- Add house button (in manage modal) ----
    document.getElementById('btn-add-house').addEventListener('click', () => {
        openEditModal(null);
    });

    // ---- Add dynamic field ----
    document.getElementById('btn-add-field').addEventListener('click', () => {
        addDynFieldRow('', '');
    });

    // ---- Image Upload Handling ----
    document.getElementById('f-image-upload').addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files.length) return;
        
        const textarea = document.getElementById('f-images');
        const currentVals = textarea.value ? textarea.value.split('\n').filter(Boolean) : [];
        
        showToast('กำลังประมวลผลรูปภาพ...', 3000);
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;
            
            try {
                const base64 = await compressImage(file);
                currentVals.push(base64);
            } catch (err) {
                console.error("Scale error", err);
            }
        }
        
        textarea.value = currentVals.join('\n');
        e.target.value = ''; // Reset input
        showToast('เตรียมรูปภาพเรียบร้อยแล้ว');
    });

    // Helper: Compress image to avoid hitting localStorage limit
    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const scaleSize = MAX_WIDTH / img.width;
                    const width = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
                    const height = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }

    // ---- House form submit ----
    document.getElementById('house-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('f-id').value;
        const data = {
            name: document.getElementById('f-name').value.trim(),
            type: document.getElementById('f-type').value,
            images: document.getElementById('f-images').value.split('\n').map(s => s.trim()).filter(Boolean),
            fields: collectDynFields(),
            pros: document.getElementById('f-pros').value,
            cons: document.getElementById('f-cons').value,
            notes: document.getElementById('f-notes').value,
            rating: parseFloat(document.getElementById('f-rating').value) || 0
        };

        if (id) {
            updateHouse(id, data);
            showToast('อัปเดตเรียบร้อย');
        } else {
            addHouse(data);
            showToast('เพิ่มที่พักเรียบร้อย');
        }

        closeModal('modal-edit');
        populateSelectors();
        renderComparison();
        renderHouseList();
    });

    // ---- Lightbox ----
    document.querySelector('.lb-close').addEventListener('click', closeLightbox);
    document.querySelector('.lb-prev').addEventListener('click', () => {
        lbIdx = (lbIdx - 1 + lbImages.length) % lbImages.length;
        updateLightbox();
    });
    document.querySelector('.lb-next').addEventListener('click', () => {
        lbIdx = (lbIdx + 1) % lbImages.length;
        updateLightbox();
    });
    document.getElementById('lightbox').addEventListener('click', (e) => {
        if (e.target.id === 'lightbox') closeLightbox();
    });

    // Keyboard navigation for lightbox
    document.addEventListener('keydown', (e) => {
        const lb = document.getElementById('lightbox');
        if (lb.style.display === 'none') return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') {
            lbIdx = (lbIdx - 1 + lbImages.length) % lbImages.length;
            updateLightbox();
        }
        if (e.key === 'ArrowRight') {
            lbIdx = (lbIdx + 1) % lbImages.length;
            updateLightbox();
        }
    });

});
