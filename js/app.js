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

    // ============================================
    // AUTH EVENTS
    // ============================================

    // ---- Logout ----
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await window.userLogout();
        showToast('ออกจากระบบเรียบร้อย');
    });

    // ---- Admin Mode Toggle ----
    document.getElementById('mode-toggle').addEventListener('click', (e) => {
        const btn = e.target.closest('.mode-btn');
        if (!btn) return;
        const toAdmin = btn.dataset.mode === 'admin';
        if (typeof window.switchMode === 'function') window.switchMode(toAdmin);
    });

    // ============================================
    // MANAGE (Admin) EVENTS
    // ============================================

    // ---- Manage button (admin mode) ----
    document.getElementById('btn-manage').addEventListener('click', () => {
        if (typeof window.renderHouseList === 'function') window.renderHouseList();
        document.getElementById('modal-manage').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });

    // ---- Add house button (in manage modal) ----
    document.getElementById('btn-add-house').addEventListener('click', () => {
        openEditModal(null);
    });

    // ============================================
    // VOTE EVENTS
    // ============================================

    // ---- Vote nav button (เปิด modal ได้ทุกคน — guest ดูผลโหวตได้) ----
    document.getElementById('btn-vote-nav').addEventListener('click', () => {
        if (typeof window.renderVoteModal === 'function') window.renderVoteModal();
        document.getElementById('modal-vote').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });

    // ---- Click Vote Count on Sticky Header (เปิด modal ได้ทุกคน) ----
    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-vote-toggle')) {
            if (typeof window.renderVoteModal === 'function') window.renderVoteModal();
            document.getElementById('modal-vote').style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    });

    // ============================================
    // THEME TOGGLE
    // ============================================

    const themeBtn = document.getElementById('btn-theme');
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

    // ============================================
    // MODAL CLOSE
    // ============================================

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    // Close modal when clicking outside on the overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(overlay.id);
            }
        });
    });

    // ============================================
    // DYNAMIC FIELDS
    // ============================================

    document.getElementById('btn-add-field').addEventListener('click', () => {
        addDynFieldRow('', '');
    });

    // Drag & drop reordering
    const fieldsContainer = document.getElementById('dynamic-fields');
    fieldsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(fieldsContainer, e.clientY);
        const draggingElement = document.querySelector('.dragging');
        if (draggingElement) {
            if (afterElement == null) {
                fieldsContainer.appendChild(draggingElement);
            } else {
                fieldsContainer.insertBefore(draggingElement, afterElement);
            }
        }
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.dyn-row:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // ============================================
    // IMAGE UPLOAD
    // ============================================

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
        e.target.value = '';
        showToast('เตรียมรูปภาพเรียบร้อยแล้ว');
    });

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

    // ============================================
    // HOUSE FORM SUBMIT
    // ============================================

    document.getElementById('house-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('f-id').value;
        const data = {
            name: document.getElementById('f-name').value.trim(),
            type: document.getElementById('f-type').value,
            images: document.getElementById('f-images').value.split('\n').map(s => s.trim()).filter(Boolean).filter(url => url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:image/')),
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

    // ============================================
    // LIGHTBOX
    // ============================================

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
