/* ============================================
   UI LAYER — rendering & interactions
   ============================================ */

// ---- Toast ----
function showToast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

// ============================================
// AUTH UI — แสดง/ซ่อนปุ่มตาม login state
// ============================================

function updateAuthUI() {
    const profileArea = document.getElementById('user-profile-area');
    const btnManage = document.getElementById('btn-manage');
    const btnVote = document.getElementById('btn-vote-nav');
    const btnLogout = document.getElementById('btn-logout');

    if (window.currentUser) {
        // ====== ล็อกอินแล้ว ======
        const photoURL = window.currentUser.photoURL || '';
        const displayName = window.currentUser.displayName || window.currentUser.email || 'User';

        profileArea.innerHTML = `
            <img class="user-avatar" 
                 src="${escAttr(photoURL)}" 
                 alt="${escAttr(displayName)}"
                 title="${escAttr(displayName)}"
                 onerror="this.style.display='none'">
            <span class="user-name">${escHTML(displayName)}</span>`;
        profileArea.style.display = 'flex';
        btnLogout.style.display = '';

        if (window.isAdmin) {
            // ---- Admin — เห็นทั้ง จัดการ + โหวต ----
            btnManage.style.display = '';
            btnVote.style.display = '';
        } else {
            // ---- User ทั่วไป — เห็นแค่โหวต ----
            btnManage.style.display = 'none';
            btnVote.style.display = '';
        }
    } else {
        // ====== Guest (ไม่ล็อกอิน) ======
        profileArea.style.display = 'none';
        btnManage.style.display = 'none';
        btnVote.style.display = '';
        btnLogout.style.display = 'none';
    }
}

// ============================================
// VOTE MODAL
// ============================================

function renderVoteModal() {
    if (typeof window.getAllHouses !== 'function') return;
    const houses = window.getAllHouses();
    const votes = window.globalVotes || {};
    const currentVoteHouseId = window.getUserVote ? window.getUserVote() : null;
    const list = document.getElementById('vote-list');

    if (houses.length === 0) {
        list.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:20px;">ยังไม่มีที่พัก</p>';
        return;
    }

    // หา total votes สำหรับ progress bar
    let maxVotes = 0;
    houses.forEach(h => {
        const count = votes[h.id] ? Object.keys(votes[h.id]).length : 0;
        if (count > maxVotes) maxVotes = count;
    });

    list.innerHTML = houses.map(h => {
        const voteCount = votes[h.id] ? Object.keys(votes[h.id]).length : 0;
        const isVoted = h.id === currentVoteHouseId;
        const barPct = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;

        let avatarHtml = '';
        if (voteCount > 0) {
            const votersObj = votes[h.id];
            // กรองเอาเฉพาะข้อมูลที่มีรูปภาพ (ข้าม vote แบบ true แบบเก่า)
            const voterList = Object.values(votersObj).filter(v => v !== true && v.photoURL);

            // แสดงรูปสุดสุด 5 คน
            const displayList = voterList.slice(0, 5);
            const avatars = displayList.map(v => `<img class="voter-avatar" src="${escAttr(v.photoURL)}" title="${escAttr(v.displayName)}">`).join('');

            const moreCount = voteCount > 5 ? voteCount - 5 : 0;
            const moreBadge = moreCount > 0 ? `<div class="voter-more" title="และอีก ${moreCount} คน">+${moreCount}</div>` : '';

            if (avatars) {
                avatarHtml = `<div class="voter-avatars">${avatars}${moreBadge}</div>`;
            }
        }

        const thumb = h.images && h.images.length > 0
            ? `<img class="vote-item-thumb" src="${escAttr(h.images[0])}" alt="">`
            : `<div class="vote-item-thumb vote-item-thumb-empty">🏠</div>`;

        const loggedIn = !!window.currentUser;
        let btnText = 'โหวต';
        let btnClass = 'btn-vote';

        if (!loggedIn) {
            btnText = 'โหวต';
            btnClass += ' btn-vote-login';
        } else if (isVoted) {
            btnText = '✅ โหวตแล้ว';
            btnClass += ' voted';
        }

        return `<div class="vote-item ${isVoted ? 'voted' : ''}" data-house-id="${h.id}">
            ${thumb}
            <div class="vote-item-info">
                <div class="vote-item-name">${escHTML(h.name)}</div>
                <div class="vote-item-type">${escHTML(h.type)}</div>
                ${avatarHtml}
            </div>
            <div class="vote-item-right">
                <div class="vote-count">${voteCount}</div>
                <div class="vote-count-label">โหวต</div>
                <button class="${btnClass}" data-house-id="${h.id}">
                    ${btnText}
                </button>
            </div>
        </div>`;
    }).join('');

    // Bind vote buttons
    list.querySelectorAll('.btn-vote').forEach(btn => {
        btn.addEventListener('click', async () => {
            // กรณีไม่ล็อกอิน → เปิด login popup แล้วโหวตอัตโนมัติ
            if (btn.classList.contains('btn-vote-login')) {
                const houseId = btn.dataset.houseId;
                btn.disabled = true;
                btn.textContent = 'กำลังเข้าสู่ระบบ...';
                try {
                    const result = await window.userGoogleLogin();
                    if (result && result.user) {
                        // ล็อกอินสำเร็จ → โหวตให้เลย
                        await window.castVote(houseId);
                        showToast('เข้าสู่ระบบ & โหวตเรียบร้อย! 🎉');
                    }
                } catch (e) {
                    if (e.code !== 'auth/popup-closed-by-user') {
                        console.error('Login error:', e);
                        showToast('เข้าสู่ระบบล้มเหลว');
                    }
                }
                btn.disabled = false;
                // re-render modal ใหม่ (ไม่ว่า login สำเร็จหรือไม่)
                if (typeof window.renderVoteModal === 'function') window.renderVoteModal();
                return;
            }

            // ป้องกันการกดโหวตซ้ำที่เดิม (หลีกเลี่ยง UI กะพริบ)
            if (btn.classList.contains('voted')) return;

            btn.disabled = true;
            btn.textContent = '⏳...';
            try {
                await window.castVote(btn.dataset.houseId);
                showToast('โหวตเรียบร้อย! 🎉');
            } catch (e) {
                console.error(e);
                showToast(e.message || 'เกิดข้อผิดพลาด');
            }
            btn.disabled = false;
        });
    });
}

// ============================================
// POPULATE SELECTORS
// ============================================

function populateSelectors() {
    if (typeof window.getAllHouses !== 'function') return;
    const houses = window.getAllHouses();
    const leftVal = document.getElementById('select-left').value;
    const rightVal = document.getElementById('select-right').value;

    ['left', 'right'].forEach(side => {
        const csel = document.getElementById('csel-' + side);
        const hidden = document.getElementById('select-' + side);
        const menu = csel.querySelector('.cs-menu');
        const textEl = csel.querySelector('.cs-text');
        const currentVal = hidden.value;

        if (houses.length === 0) {
            menu.innerHTML = '<div class="cs-empty">ยังไม่มีที่พัก<br>กด "จัดการที่พัก" เพื่อเพิ่ม</div>';
        } else {
            menu.innerHTML = `<div class="cs-option" data-value="">
                <div class="cs-option-info"><div class="cs-option-name" style="color:var(--text-tertiary)">— ยกเลิกการเลือก —</div></div>
            </div>` + houses.map(h => {
                const thumb = h.images && h.images.length > 0
                    ? `<img class="cs-option-thumb" src="${escAttr(h.images[0])}" alt="">`
                    : `<div class="cs-option-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.1rem;">🏠</div>`;

                return `<div class="cs-option${h.id === currentVal ? ' active' : ''}" data-value="${h.id}">
                    ${thumb}
                    <div class="cs-option-info">
                        <div class="cs-option-name">${escHTML(h.name)}</div>
                        <div class="cs-option-type">${escHTML(h.type)}</div>
                    </div>
                </div>`;
            }).join('');
        }

        // Update display text and remove loading states
        const trigger = csel.querySelector('.cs-trigger');
        if (trigger) trigger.disabled = false;

        const label = csel.parentElement.querySelector('.selector-label');
        if (label) label.textContent = side === 'left' ? 'ที่พักหลังที่ 1' : 'ที่พักหลังที่ 2';

        const selected = houses.find(h => h.id === currentVal);
        if (selected) {
            textEl.textContent = selected.name;
            textEl.classList.remove('placeholder');
        } else {
            textEl.textContent = '— เลือกที่พัก —';
            textEl.classList.add('placeholder');
        }

        // Bind option clicks
        menu.querySelectorAll('.cs-option:not(.disabled)').forEach(opt => {
            opt.addEventListener('click', () => {
                const val = opt.dataset.value;
                hidden.value = val;
                csel.classList.remove('open');
                window.populateSelectors();
                window.renderComparison();
            });
        });
    });
}

// ---- Custom Select toggle ----
function initCustomSelects() {
    document.querySelectorAll('.custom-select').forEach(csel => {
        const trigger = csel.querySelector('.cs-trigger');
        if (!trigger) return;
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select.open').forEach(c => {
                if (c !== csel) c.classList.remove('open');
            });
            csel.classList.toggle('open');
        });
    });
    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select.open').forEach(c => c.classList.remove('open'));
    });
}

// ============================================
// COMPARISON RENDERING
// ============================================

function renderComparison() {
    const leftId = document.getElementById('select-left').value;
    const rightId = document.getElementById('select-right').value;
    const area = document.getElementById('comparison-area');
    const empty = document.getElementById('empty-state');

    if (!leftId && !rightId) {
        area.style.display = 'none';
        empty.style.display = '';
        return;
    }

    if (typeof window.getHouseById !== 'function') return;

    const emptyHouse = {
        id: '', name: '', type: '', images: [], fields: [],
        pros: '', cons: '', notes: '', rating: 0
    };

    const left = leftId ? (window.getHouseById(leftId) || emptyHouse) : emptyHouse;
    const right = rightId ? (window.getHouseById(rightId) || emptyHouse) : emptyHouse;

    area.style.display = '';
    empty.style.display = 'none';

    // Sticky header
    document.getElementById('sticky-left').innerHTML = stickyColHTML(left);
    document.getElementById('sticky-right').innerHTML = stickyColHTML(right);

    // Bind edit buttons (admin mode only)
    document.querySelectorAll('.btn-edit-quick').forEach(btn => {
        btn.addEventListener('click', () => {
            openEditModal(btn.dataset.id);
        });
    });

    // Body
    const body = document.getElementById('compare-body');
    body.innerHTML = '';

    // -- Images Section --
    body.innerHTML += sectionHTML('รูปภาพ', [
        rowGalleryHTML(left.images, 'left'),
        rowGalleryHTML(right.images, 'right')
    ]);

    // -- Merge all field labels from both houses --
    const allLabels = mergeFieldLabels(left.fields, right.fields);

    // -- Fields Section --
    let fieldRows = '';
    allLabels.forEach(label => {
        const lv = getFieldValue(left.fields, label);
        const rv = getFieldValue(right.fields, label);
        fieldRows += compareRowHTML(label, lv, rv);
    });
    body.innerHTML += sectionHTML('ข้อมูลเปรียบเทียบ', null, fieldRows);

    // -- Rating --
    if ((left.rating && left.rating > 0) || (right.rating && right.rating > 0)) {
        body.innerHTML += sectionHTML('คะแนนรวม', null,
            `<div class="compare-row">
                <div>${left.rating > 0 ? ratingHTML(left.rating) : '<span class="row-value empty">—</span>'}</div>
                <div>${right.rating > 0 ? ratingHTML(right.rating) : '<span class="row-value empty">—</span>'}</div>
            </div>`
        );
    }

    // -- Pros --
    body.innerHTML += sectionHTML('ข้อดี', null,
        `<div class="compare-row">
            <div>${prosConsHTML(left.pros, 'pros')}</div>
            <div>${prosConsHTML(right.pros, 'pros')}</div>
        </div>`
    );

    // -- Cons --
    body.innerHTML += sectionHTML('ข้อเสีย', null,
        `<div class="compare-row">
            <div>${prosConsHTML(left.cons, 'cons')}</div>
            <div>${prosConsHTML(right.cons, 'cons')}</div>
        </div>`
    );

    // -- Notes --
    body.innerHTML += sectionHTML('หมายเหตุ', null,
        `<div class="compare-row">
            <div class="row-value">${escHTML(left.notes) || '<span class="empty">—</span>'}</div>
            <div class="row-value">${escHTML(right.notes) || '<span class="empty">—</span>'}</div>
        </div>`
    );

    // Bind gallery clicks
    body.querySelectorAll('.compare-gallery img').forEach(img => {
        img.addEventListener('click', () => {
            const side = img.dataset.side;
            const idx = parseInt(img.dataset.idx);
            const house = side === 'left' ? left : right;
            openLightbox(house.images, idx);
        });
    });

    adjustStickyTop();
}

function adjustStickyTop() {
    const topnav = document.querySelector('.topnav');
    const stickyHeader = document.querySelector('.compare-sticky');
    if (topnav && stickyHeader) {
        stickyHeader.style.top = topnav.offsetHeight + 'px';
    }
}
window.addEventListener('resize', adjustStickyTop);

// ============================================
// HTML HELPERS
// ============================================

function stickyColHTML(house) {
    if (!house.id) {
        return `<div class="sticky-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:var(--bg-input);opacity:0.4;">?</div><div class="sticky-name" style="color:var(--text-tertiary)">— ยังไม่เลือก —</div><div class="sticky-type"></div>`;
    }
    const thumb = house.images && house.images.length > 0
        ? `<img class="sticky-thumb" src="${escAttr(house.images[0])}" alt="${escAttr(house.name)}">`
        : `<div class="sticky-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:var(--bg-input);">🏠</div>`;

    // แสดงปุ่มแก้ไขเฉพาะ admin mode
    const btnEdit = window.isAdmin ? `<button class="btn-edit-quick" data-id="${house.id}" title="แก้ไขข้อมูล">✏️</button>` : '';

    // แสดงจำนวน vote เป็นปุ่ม
    const voteCount = window.getVoteCount ? window.getVoteCount(house.id) : 0;
    const voteTag = `<button class="sticky-vote-count btn-vote-toggle" title="ดูผลโหวต / โหวตที่พัก">${voteCount} โหวต</button>`;

    return `${thumb}${btnEdit}<div class="sticky-name">${escHTML(house.name)}</div><div class="sticky-type">${escHTML(house.type)}</div>${voteTag}`;
}

function sectionHTML(title, galleryRows, innerHTML) {
    let content = '';
    if (galleryRows) {
        content = `<div class="compare-row">${galleryRows[0]}${galleryRows[1]}</div>`;
    } else if (innerHTML) {
        content = innerHTML;
    }
    return `<div class="compare-section">
        <div class="compare-section-title">${escHTML(title)}</div>
        ${content}
    </div>`;
}

function rowGalleryHTML(images, side) {
    if (!images || images.length === 0) return '<div class="row-value empty">ไม่มีรูปภาพ</div>';
    let html = '<div class="compare-gallery">';
    images.forEach((url, i) => {
        html += `<img src="${escAttr(url)}" alt="รูปที่ ${i + 1}" data-side="${side}" data-idx="${i}">`;
    });
    html += '</div>';
    return html;
}

function compareRowHTML(label, leftVal, rightVal) {
    const lv = leftVal ? escHTML(leftVal) : '<span class="empty">—</span>';
    const rv = rightVal ? escHTML(rightVal) : '<span class="empty">—</span>';
    return `<div class="compare-row">
        <div><div class="row-label">${escHTML(label)}</div><div class="row-value">${lv}</div></div>
        <div><div class="row-label">${escHTML(label)}</div><div class="row-value">${rv}</div></div>
    </div>`;
}

function ratingHTML(rating) {
    const r = parseFloat(rating) || 0;
    const pct = (r / 10) * 100;
    return `<div class="rating-bar">
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="bar-num">${r.toFixed(1)}</div>
    </div>`;
}

function prosConsHTML(text, type) {
    if (!text || !text.trim()) return '<div class="row-value empty">—</div>';
    const lines = text.split('\n').map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
    if (lines.length === 0) return '<div class="row-value empty">—</div>';
    return `<ul class="pros-cons-list ${type}">${lines.map(l => `<li>${escHTML(l)}</li>`).join('')}</ul>`;
}

function mergeFieldLabels(fieldsA, fieldsB) {
    const labels = [];
    const seen = new Set();
    [...(fieldsA || []), ...(fieldsB || [])].forEach(f => {
        if (!seen.has(f.label)) { seen.add(f.label); labels.push(f.label); }
    });
    return labels;
}

function getFieldValue(fields, label) {
    const f = (fields || []).find(x => x.label === label);
    return f ? f.value : '';
}

function escHTML(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { if (!s) return ''; return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/`/g, '&#96;'); }

// ============================================
// LIGHTBOX
// ============================================

let lbImages = [];
let lbIdx = 0;

function openLightbox(images, idx) {
    lbImages = images;
    lbIdx = idx;
    const lb = document.getElementById('lightbox');
    lb.style.display = 'flex';
    updateLightbox();
    document.body.style.overflow = 'hidden';
}
function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
    document.body.style.overflow = '';
}
function updateLightbox() {
    document.getElementById('lb-img').src = lbImages[lbIdx];
    document.getElementById('lb-counter').textContent = `${lbIdx + 1} / ${lbImages.length}`;
}

// ============================================
// MANAGE MODAL — house list (admin)
// ============================================

function renderHouseList() {
    if (typeof window.getAllHouses !== 'function') return;
    const houses = window.getAllHouses();
    const list = document.getElementById('house-list');
    if (houses.length === 0) {
        list.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:20px;">ยังไม่มีที่พัก กดปุ่มด้านบนเพื่อเพิ่ม</p>';
        return;
    }
    list.innerHTML = houses.map(h => {
        const thumb = h.images && h.images.length > 0
            ? `<img class="house-item-thumb" src="${escAttr(h.images[0])}" alt="">`
            : `<div class="house-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.3rem;">🏠</div>`;
        return `<div class="house-item" data-id="${h.id}">
            ${thumb}
            <div class="house-item-info">
                <div class="house-item-name">${escHTML(h.name)}</div>
                <div class="house-item-type">${escHTML(h.type)}</div>
            </div>
            <div class="house-item-actions">
                <button class="btn-icon btn-edit-house" title="แก้ไข">✏️</button>
                <button class="btn-icon btn-delete-house" title="ลบ">🗑️</button>
            </div>
        </div>`;
    }).join('');

    // Bind edit/delete
    list.querySelectorAll('.btn-edit-house').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.closest('.house-item').dataset.id;
            openEditModal(id);
        });
    });
    list.querySelectorAll('.btn-delete-house').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.closest('.house-item').dataset.id;
            if (confirm('ต้องการลบที่พักนี้?')) {
                deleteHouse(id);
                renderHouseList();
                populateSelectors();
                renderComparison();
                showToast('ลบแล้ว');
            }
        });
    });
}

// ============================================
// IMAGE CAPSULES
// ============================================

window.renderImageCapsules = function () {
    const container = document.getElementById('image-links-capsules');
    const textarea = document.getElementById('f-images');
    const links = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
    
    container.innerHTML = links.map((link, idx) => `
        <div class="capsule-item">
            <span class="capsule-link-text" title="${escAttr(link)}" onclick="editImageCapsule(${idx})">${escHTML(link)}</span>
            <button type="button" class="capsule-remove" title="ลบ" onclick="removeImageCapsule(${idx})">&times;</button>
        </div>
    `).join('');
}

window.addImageCapsule = function (url) {
    if (!url) return;
    const textarea = document.getElementById('f-images');
    const current = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
    current.push(url);
    textarea.value = current.join('\n');
    renderImageCapsules();
}

window.removeImageCapsule = function (idx) {
    const textarea = document.getElementById('f-images');
    const current = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
    current.splice(idx, 1);
    textarea.value = current.join('\n');
    renderImageCapsules();
}

window.editImageCapsule = function (idx) {
    const textarea = document.getElementById('f-images');
    const current = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
    const link = current[idx];
    
    // เอาลิงก์กลับไปใส่ใน input
    document.getElementById('f-image-input').value = link;
    
    // ลบออกจากรายการ
    current.splice(idx, 1);
    textarea.value = current.join('\n');
    renderImageCapsules();
    
    document.getElementById('f-image-input').focus();
}

// Setup input listeners for Capsules
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('f-image-input');
    const btn = document.getElementById('btn-add-image-link');
    
    if (input && btn) {
        btn.addEventListener('click', () => {
            const val = input.value.trim();
            if (val) {
                addImageCapsule(val);
                input.value = '';
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // ไม่ให้ฟอร์ม submit
                const val = input.value.trim();
                if (val) {
                    addImageCapsule(val);
                    input.value = '';
                }
            }
        });
    }
});

// ============================================
// ============================================
// MODALS
// ============================================

// Custom Select Initialization
document.addEventListener('DOMContentLoaded', () => {
    const customSelect = document.getElementById('type-custom-select');
    if (!customSelect) return;
    
    const trigger = customSelect.querySelector('.select-trigger');
    const options = customSelect.querySelectorAll('.select-option');
    const hiddenInput = document.getElementById('f-type');
    const triggerText = document.getElementById('select-trigger-text');

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        customSelect.classList.toggle('open');
    });

    options.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            
            const value = option.dataset.value;
            triggerText.textContent = option.textContent;
            hiddenInput.value = value;
            customSelect.classList.remove('open');
        });
    });

    // ปิด dropdown เมื่อคลิกที่อื่น
    document.addEventListener('click', () => {
        customSelect.classList.remove('open');
    });
});

window.updateCustomSelectUI = function(value) {
    const customSelect = document.getElementById('type-custom-select');
    if (!customSelect) return;
    const options = customSelect.querySelectorAll('.select-option');
    const triggerText = document.getElementById('select-trigger-text');
    
    let matched = false;
    options.forEach(option => {
        if (option.dataset.value === value) {
            option.classList.add('selected');
            triggerText.textContent = option.textContent;
            matched = true;
        } else {
            option.classList.remove('selected');
        }
    });

    if (!matched && options.length > 0) {
        options[0].classList.add('selected');
        triggerText.textContent = options[0].textContent;
        document.getElementById('f-type').value = options[0].dataset.value;
    }
}

window.openEditModal = function (id) {
    const modal = document.getElementById('modal-edit');
    const form = document.getElementById('house-form');
    const title = document.getElementById('edit-modal-title');

    form.reset();
    document.getElementById('f-image-input').value = ''; // เคลียร์ช่อง input link ล่าสุด

    if (id) {
        if (typeof window.getHouseById !== 'function') return;
        const h = window.getHouseById(id);
        if (!h) return;
        title.textContent = 'แก้ไขที่พัก';
        document.getElementById('f-id').value = h.id;
        document.getElementById('f-name').value = h.name;
        document.getElementById('f-type').value = h.type;
        if (window.updateCustomSelectUI) window.updateCustomSelectUI(h.type);
        document.getElementById('f-images').value = (h.images || []).join('\n');
        document.getElementById('f-pros').value = h.pros || '';
        document.getElementById('f-cons').value = h.cons || '';
        document.getElementById('f-notes').value = h.notes || '';
        document.getElementById('f-rating').value = h.rating || '';
        renderDynamicFields(h.fields || []);
    } else {
        title.textContent = 'เพิ่มที่พักใหม่';
        document.getElementById('f-id').value = '';
        document.getElementById('f-type').value = 'บ้านเดี่ยว';
        if (window.updateCustomSelectUI) window.updateCustomSelectUI('บ้านเดี่ยว');
        renderDynamicFields([
            { label: 'ราคา', value: '' },
            { label: 'พื้นที่ใช้สอย', value: '' },
            { label: 'ห้องนอน', value: '' },
            { label: 'ห้องน้ำ', value: '' },
            { label: 'ที่จอดรถ', value: '' }
        ]);
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
    if (!document.querySelector('.modal-overlay[style*="flex"]')) {
        document.body.style.overflow = '';
    }
}

// ============================================
// DYNAMIC FIELDS
// ============================================

function renderDynamicFields(fields) {
    const container = document.getElementById('dynamic-fields');
    container.innerHTML = '';
    fields.forEach((f, i) => addDynFieldRow(f.label, f.value));
}

function addDynFieldRow(label, value) {
    const container = document.getElementById('dynamic-fields');
    const row = document.createElement('div');
    row.className = 'dyn-row';
    row.draggable = false; // Default false so inputs can be selected
    row.innerHTML = `
        <div class="dyn-drag-handle" title="ลากเพื่อสลับลำดับ">☰</div>
        <input type="text" class="dyn-label" placeholder="ชื่อ field" value="${escAttr(label || '')}">
        <textarea class="dyn-value" rows="1" placeholder="ค่า" style="resize:none; overflow:hidden; display:block; padding: 10px 14px; line-height: 1.6;">${escHTML(value || '')}</textarea>
        <button type="button" class="btn-icon dyn-remove" title="ลบ">✕</button>
    `;

    // จัดการขนาด textarea ให้ขยายตามเนื้อหา
    const valueInput = row.querySelector('.dyn-value');
    valueInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // รองรับ Shift + Tab เพื่อขึ้นบรรทัดใหม่ตามที่ User ขอ
    valueInput.addEventListener('keydown', function(e) {
        if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + '\n' + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 1;
            this.dispatchEvent(new Event('input')); // อัปเดตความสูง
        }
        // ปกติกด Enter ใน textarea ก็จะขึ้นบรรทัดใหม่อยู่แล้ว
    });

    // เซ็ตความสูงเริ่มต้นถ้ามีเนื้อหาหลายบรรทัด
    setTimeout(() => {
        if (valueInput.value) {
            valueInput.style.height = 'auto';
            valueInput.style.height = (valueInput.scrollHeight) + 'px';
        }
    }, 0);

    // เฉพาะกดตรง handle ถึงจะลากได้
    const handle = row.querySelector('.dyn-drag-handle');
    handle.addEventListener('mousedown', () => row.draggable = true);
    handle.addEventListener('touchstart', () => row.draggable = true, { passive: true });

    row.addEventListener('dragstart', () => { row.classList.add('dragging'); });
    row.addEventListener('dragend', () => { 
        row.classList.remove('dragging'); 
        row.draggable = false; // Reset กลับเพื่อให้อินพุตใช้งานได้ปกติ
    });

    row.querySelector('.dyn-remove').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

function collectDynFields() {
    const rows = document.querySelectorAll('#dynamic-fields .dyn-row');
    const fields = [];
    rows.forEach(row => {
        const label = row.querySelector('.dyn-label').value.trim();
        const value = row.querySelector('.dyn-value').value.trim();
        if (label) fields.push({ label, value });
    });
    return fields;
}
