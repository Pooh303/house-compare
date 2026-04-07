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

// ---- Populate Custom Selectors ----
function populateSelectors() {
    if (typeof window.getAllHouses !== 'function') return; // Wait until data.js is loaded
    const houses = window.getAllHouses();
    const leftVal = document.getElementById('select-left').value;
    const rightVal = document.getElementById('select-right').value;

    ['left', 'right'].forEach(side => {
        const csel = document.getElementById('csel-' + side);
        const hidden = document.getElementById('select-' + side);
        const menu = csel.querySelector('.cs-menu');
        const textEl = csel.querySelector('.cs-text');
        const currentVal = hidden.value;
        const otherVal = side === 'left' ? rightVal : leftVal;

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
        if(trigger) trigger.disabled = false; // ปลดล็อคปุ่ม
        
        const label = csel.parentElement.querySelector('.selector-label');
        if(label) label.textContent = side === 'left' ? 'ที่พักหลังที่ 1' : 'ที่พักหลังที่ 2';

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

// ---- Custom Select toggle (called once from app.js) ----
function initCustomSelects() {
    document.querySelectorAll('.custom-select').forEach(csel => {
        const trigger = csel.querySelector('.cs-trigger');
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close others
            document.querySelectorAll('.custom-select.open').forEach(c => {
                if (c !== csel) c.classList.remove('open');
            });
            csel.classList.toggle('open');
        });
    });
    // Close on outside click
    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select.open').forEach(c => c.classList.remove('open'));
    });
}


// ---- Render Comparison ----
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

    // Bind edit buttons
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

    // -- Rating (optional) --
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
}

// ---- HTML Helpers ----
function stickyColHTML(house) {
    if (!house.id) {
        return `<div class="sticky-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:var(--bg-input);opacity:0.4;">?</div><div class="sticky-name" style="color:var(--text-tertiary)">— ยังไม่เลือก —</div><div class="sticky-type"></div>`;
    }
    const thumb = house.images && house.images.length > 0
        ? `<img class="sticky-thumb" src="${escAttr(house.images[0])}" alt="${escAttr(house.name)}">`
        : `<div class="sticky-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:var(--bg-input);">🏠</div>`;
        
    const btnEdit = window.isAdmin ? `<button class="btn-edit-quick admin-only" data-id="${house.id}" title="แก้ไขข้อมูล">✏️</button>` : '';

    return `${thumb}${btnEdit}<div class="sticky-name">${escHTML(house.name)}</div><div class="sticky-type">${escHTML(house.type)}</div>`;
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
function escAttr(s) { if (!s) return ''; return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ---- Lightbox ----
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

// ---- Manage Modal: render house list ----
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

// ---- Edit Modal ----
function openEditModal(id) {
    const modal = document.getElementById('modal-edit');
    const form = document.getElementById('house-form');
    const title = document.getElementById('edit-modal-title');
    form.reset();

    if (id) {
        if (typeof window.getHouseById !== 'function') return;
        const h = window.getHouseById(id);
        if (!h) return;
        title.textContent = 'แก้ไขที่พัก';
        document.getElementById('f-id').value = h.id;
        document.getElementById('f-name').value = h.name;
        document.getElementById('f-type').value = h.type;
        document.getElementById('f-images').value = (h.images || []).join('\n');
        document.getElementById('f-pros').value = h.pros || '';
        document.getElementById('f-cons').value = h.cons || '';
        document.getElementById('f-notes').value = h.notes || '';
        document.getElementById('f-rating').value = h.rating || '';
        renderDynamicFields(h.fields || []);
    } else {
        title.textContent = 'เพิ่มที่พักใหม่';
        document.getElementById('f-id').value = '';
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

// ---- Dynamic Fields ----
function renderDynamicFields(fields) {
    const container = document.getElementById('dynamic-fields');
    container.innerHTML = '';
    fields.forEach((f, i) => addDynFieldRow(f.label, f.value));
}

function addDynFieldRow(label, value) {
    const container = document.getElementById('dynamic-fields');
    const row = document.createElement('div');
    row.className = 'dyn-row';
    row.draggable = true;
    row.innerHTML = `
        <div class="dyn-drag-handle" title="ลากเพื่อสลับลำดับ">☰</div>
        <input type="text" class="dyn-label" placeholder="ชื่อ field" value="${escAttr(label || '')}">
        <input type="text" class="dyn-value" placeholder="ค่า" value="${escAttr(value || '')}">
        <button type="button" class="btn-icon dyn-remove" title="ลบ">✕</button>
    `;
    
    // Drag events
    row.addEventListener('dragstart', () => {
        row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
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
