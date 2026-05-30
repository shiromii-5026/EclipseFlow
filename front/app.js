document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 配置和全局状态
    // ==========================================
    const CONFIG = {
        HOUR_HEIGHT: 80,
        HEADER_HEIGHT: 60,
        API_BASE: 'http://localhost:8080/api/tasks',
        OCR_BASE: 'http://localhost:8000'
    };

    const state = {
        currentFocusDate: new Date(),   // 当前查看的日期
        miniMonthDate: new Date(),      // 迷你日历显示的月份
        storage: {},                    // 按日期分组的任务数据
        isViewingCurrentWeek: true
    };

    // 把 Date 转成 YYYY-MM-DD 字符串
    const getCSTDateStr = (date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // ==========================================
    // 2. 后端接口层，增删改查都走这里
    // ==========================================
    const api = {
        async fetchTasks() {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/list`);
                if (!response.ok) throw new Error('Network error');

                const data = await response.json();

                state.storage = {};

                data.forEach(bt => {
                    const dateKey = bt.taskDate;
                    if (!state.storage[dateKey]) state.storage[dateKey] = [];

                    // 兼容不同后端返回的 id 字段名
                    const realId = bt.id || bt.taskId || bt.tid || bt.pk;

                    state.storage[dateKey].push({
                        id: realId,
                        name: bt.taskName,
                        taskName: bt.taskName,
                        time: bt.startTime,
                        startTime: bt.startTime,
                        duration: bt.duration != null ? bt.duration : 1,
                        color: bt.color,
                        notes: bt.notes || "",
                        deadline: bt.deadline || null,
                        taskType: bt.taskType || (bt.duration === 0 ? "DDL" : "BLOCK")
                    });
                });

                ui.renderAll();
            } catch (error) {
                ui.renderAll();
            }
        },

        async saveTask(clientTaskData) {
            try {
                // 补全秒数，前端只传 HH:MM，后端要 HH:MM:SS
                if (clientTaskData.startTime && clientTaskData.startTime.length === 5) {
                    clientTaskData.startTime += ":00";
                }
                if (clientTaskData.deadline && clientTaskData.deadline.length === 5) {
                    clientTaskData.deadline += ":00";
                }

                const colorValue = document.getElementById('task-color-select').value;
                const payload = {
                    ...clientTaskData,
                    color: colorValue
                };

                const response = await fetch(`${CONFIG.API_BASE}/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    await this.fetchTasks();
                    return true;
                } else {
                    return false;
                }
            } catch (error) {
                return false;
            }
        },

        // 删完直接全量刷新，简单粗暴
        async deleteTask(id) {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/delete/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    await this.fetchTasks();
                } else {
                    alert("Server delete failed");
                }
            } catch (error) {
                // 网络挂了也没办法，静默处理
            }
        },

        async updateTaskTime(id, newDate, startTime) {
            try {
                if (!id || id === "null") {
                    return;
                }

                const response = await fetch(`${CONFIG.API_BASE}/update-time`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: id,
                        date: newDate,
                        startTime: startTime
                    })
                });
                if (!response.ok) throw new Error('Backend update failed');
            } catch (error) {
                // silently fail
            }
        }
    };

    // ==========================================
    // 3. 页面渲染，负责画日历、网格、任务卡片
    // ==========================================
    const ui = {
        renderAll() {
            this.renderMiniCalendar();
            this.renderWeeklyGrid();
        },

        renderMiniCalendar() {
            const year = state.miniMonthDate.getFullYear();
            const month = state.miniMonthDate.getMonth();
            const label = document.getElementById('mini-month-label');
            if (label) label.textContent = `${year}.${(month + 1).toString().padStart(2, '0')}`;

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const container = document.getElementById('mini-days');
            if (!container) return;

            container.innerHTML = '';
            for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
                container.appendChild(document.createElement('div'));
            }

            const focusStr = getCSTDateStr(state.currentFocusDate);
            for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, month, d);
                const dateStr = getCSTDateStr(dateObj);
                const dayEl = document.createElement('div');
                dayEl.className = 'mini-day';

                if (dateStr === focusStr) dayEl.classList.add('active');
                if (state.storage[dateStr]?.length > 0) {
                    dayEl.style.boxShadow = "inset 0 -3px 0 var(--acid-green)";
                }
                dayEl.textContent = d;

                dayEl.addEventListener('click', () => {
                    state.currentFocusDate = dateObj;
                    this.renderAll();
                });
                container.appendChild(dayEl);
            }
        },

        renderWeeklyGrid() {
            const grid = document.getElementById('weekly-grid');
            if (!grid) return;
            grid.innerHTML = '';

            // 左侧 0:00 ~ 23:00 时间轴
            const gutter = document.createElement('div');
            gutter.className = 'time-gutter';
            gutter.innerHTML = `<div class="column-header" style="font-size:0.6rem">CST</div>`;
            for (let i = 0; i < 24; i++) {
                const l = document.createElement('div');
                l.className = 'time-slot-label';
                l.textContent = `${i}:00`;
                gutter.appendChild(l);
            }
            grid.appendChild(gutter);

            // 根据当前焦点日期算出本周的周一和周日
            const temp = new Date(state.currentFocusDate);
            const dayIdx = temp.getDay();
            const diff = temp.getDate() - (dayIdx === 0 ? 6 : dayIdx - 1);
            const monday = new Date(temp.setDate(diff));
            const lastDay = new Date(monday);
            lastDay.setDate(monday.getDate() + 6);

            const formatTitle = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
            const titleEl = document.getElementById('range-title');
            if (titleEl) titleEl.textContent = `日程安排 // ${formatTitle(monday)} - ${formatTitle(lastDay)}`;

            const today = new Date();
            const isViewingCurrentWeek = today >= monday && today <= lastDay;
            state.isViewingCurrentWeek = isViewingCurrentWeek;

            // Day columns
            const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
            const todayStr = getCSTDateStr(new Date());

            for (let i = 0; i < 7; i++) {
                const cur = new Date(monday);
                cur.setDate(monday.getDate() + i);
                const key = getCSTDateStr(cur);
                const isToday = key === todayStr;
                const now = new Date();
                const isCurrentDay =
                    cur.getFullYear() === now.getFullYear() &&
                    cur.getMonth() === now.getMonth() &&
                    cur.getDate() === now.getDate();

                const col = document.createElement('div');
                col.className = `day-column ${isToday ? 'today' : ''}`;
                col.dataset.date = key;
                col.innerHTML = `<div class="column-header">${weekNames[i]} <span>${cur.getMonth()+1}/${cur.getDate()}</span></div>`;

                // 今天的话画一条当前时间红线
                if (isCurrentDay) {
                    const currentHour = now.getHours();
                    const currentMin = now.getMinutes();
                    const currentTop = CONFIG.HEADER_HEIGHT + ((currentHour + currentMin / 60) * CONFIG.HOUR_HEIGHT);
                    const line = document.createElement('div');
                    line.className = 'current-time-line';
                    line.style.top = `${currentTop}px`;
                    col.appendChild(line);
                }

                const tasks = state.storage[key] || [];
                tasks.forEach(t => {
                    // 防御：时间数据不对就跳过，防止整个页面崩掉
                    if (!t.time || typeof t.time !== 'string') {
                        return;
                    }

                    const [h, m] = t.time.split(':').map(Number);
                    const startDecimal = h + m / 60;

                    const item = document.createElement('div');
                    item.className = 'event-item';
                    item.setAttribute('data-task-id', t.id);

                    const isDDL = t.taskType === "DDL" || t.duration === 0;
                    if (isDDL) {
                        item.classList.add('ddl-line-task');
                    }

                    if (t.color) {
                        item.style.setProperty('--task-color', t.color);
                    }
                    if (!t.color && isToday) {
                        item.classList.add('important');
                    }

                    item.style.top = `${startDecimal * CONFIG.HOUR_HEIGHT + CONFIG.HEADER_HEIGHT}px`;

                    if (isDDL) {
                        const ddlColor = t.color || '#c1ff00';
                        item.style.setProperty('--ddl-color', ddlColor.substring(0, 7));
                        item.style.height = '4px';
                        item.style.minHeight = '4px';
                        item.style.padding = '0';
                        item.style.borderRadius = '0';
                        item.style.border = 'none';
                        item.style.backgroundColor = ddlColor;
                        const glowColor = ddlColor.length >= 7
                            ? ddlColor.substring(0, 7) + '66'
                            : ddlColor;
                        item.style.boxShadow = `0 0 6px ${glowColor}`;
                        item.innerHTML = `
                            <div class="ddl-label">
                                <span class="event-time-tag">${t.time.substring(0, 5)}</span>
                                <span class="event-name-text">${t.name}</span>
                            </div>
                            <button class="del-btn-mini ddl-del" data-id="${t.id}">×</button>
                        `;
                    } else {
                        const taskDuration = t.duration ?? 1;
                        item.style.height = `${taskDuration * CONFIG.HOUR_HEIGHT}px`;

                        item.innerHTML = `
                            <div class="resize-handle top">▴</div>
                            <div class="event-time-tag">${t.time.substring(0, 5)}</div>
                            <div class="event-name-text">${t.name}</div>
                            <button class="del-btn-mini" data-id="${t.id}">×</button>
                            <div class="resize-handle bottom">▾</div>
                        `;
                    }

                    col.appendChild(item);
                });
                grid.appendChild(col);
            }
        },

        showToast(message) {
            let toast = document.querySelector('.save-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'save-toast';
                document.body.appendChild(toast);
            }
            toast.innerText = `>> ${message}`;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2500);
        }
    };

    // ==========================================
    // 4. 事件绑定：按钮点击、双击编辑、时间下拉框填充
    // ==========================================
    function bindEvents() {
        const grid = document.getElementById('weekly-grid');
        if (grid) {
            // 点叉号删除任务
            grid.addEventListener('click', (e) => {
                if (e.target.classList.contains('del-btn-mini') || e.target.classList.contains('ddl-del')) {
                    const taskId = e.target.getAttribute('data-id');
                    if (taskId && confirm("Delete this task?")) {
                        api.deleteTask(taskId);
                    }
                }
            });

            // 双击弹出快捷编辑框
            grid.addEventListener('dblclick', (e) => {
                const item = e.target.closest('.event-item');
                if (e.target.classList.contains('del-btn-mini')) return;

                if (item) {
                    const taskId = item.getAttribute('data-task-id');
                    const dateStr = item.closest('.day-column').dataset.date;

                    if (state.storage[dateStr]) {
                        const taskData = state.storage[dateStr].find(t => String(t.id) === String(taskId));
                        if (taskData) {
                            openQuickEditModal(taskData, dateStr);
                        }
                    }
                }
            });
        }

        const themeBtn = document.getElementById('theme-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
            });
        }

        const saveBtn = document.getElementById('save-task-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const name = document.getElementById('task-name-input').value;
                const date = document.getElementById('task-date-input').value;

                const hour = document.getElementById('task-hour-select').value;
                const minute = document.getElementById('task-min-select').value;
                const time = `${hour}:${minute}`;

                const deadlineHour = document.getElementById('task-deadline-hour-select').value;
                const deadlineMin = document.getElementById('task-deadline-min-select').value;

                let duration = null;
                let deadlineTime = null;
                let taskType = null;

                // 判断任务类型：填了截止时间就是 BLOCK，没填就是 DDL
                if (deadlineHour !== "" && deadlineMin !== "") {
                    taskType = "BLOCK";
                    const startMinutes = parseInt(hour) * 60 + parseInt(minute);
                    const endMinutes = parseInt(deadlineHour) * 60 + parseInt(deadlineMin);
                    duration = (endMinutes - startMinutes) / 60;

                    if (duration <= 0) {
                        alert("Deadline must be later than start time");
                        return;
                    }
                    deadlineTime = `${deadlineHour}:${deadlineMin}:00`;
                } else {
                    taskType = "DDL";
                    duration = 0;
                    deadlineTime = `${hour}:${minute}:00`;
                }

                if (!name || !date) {
                    alert("Please fill in task name and date");
                    return;
                }

                const newTask = {
                    taskName: name,
                    taskDate: date,
                    startTime: time,
                    duration: duration,
                    deadline: deadlineTime,
                    taskType: taskType
                };

                const success = await api.saveTask(newTask);
                if (success) {
                    document.getElementById('task-name-input').value = '';
                }
            });
        }

        const prevMonthBtn = document.getElementById('prev-month-btn');
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
                state.miniMonthDate.setMonth(state.miniMonthDate.getMonth() - 1);
                ui.renderMiniCalendar();
            });
        }

        const backToTodayBtn = document.getElementById('back-to-today-btn');
        if (backToTodayBtn) {
            backToTodayBtn.addEventListener('click', () => {
                const today = new Date();
                state.currentFocusDate = new Date(today);
                state.miniMonthDate = new Date(today);
                ui.renderAll();
                ui.showToast("CALENDAR: BACK_TO_PRESENT");
            });
        }

        const nextMonthBtn = document.getElementById('next-month-btn');
        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
                state.miniMonthDate.setMonth(state.miniMonthDate.getMonth() + 1);
                ui.renderMiniCalendar();
            });
        }

        const hourSel = document.getElementById('task-hour-select');
        const minSel = document.getElementById('task-min-select');
        const deadlineHourSel = document.getElementById('task-deadline-hour-select');
        const deadlineMinSel = document.getElementById('task-deadline-min-select');

        if (hourSel && minSel) {
            hourSel.innerHTML = '';
            minSel.innerHTML = '';

            // 小时 00-23，分钟每 5 分钟一档（00, 05, 10...）
            for (let h = 0; h < 24; h++) {
                const hStr = h.toString().padStart(2, '0');
                hourSel.add(new Option(hStr, hStr));
                if (deadlineHourSel) deadlineHourSel.add(new Option(hStr, hStr));
            }

            for (let m = 0; m < 60; m += 5) {
                const mStr = m.toString().padStart(2, '0');
                minSel.add(new Option(mStr, mStr));
                if (deadlineMinSel) deadlineMinSel.add(new Option(mStr, mStr));
            }
        }
    }

    // 图片拖拽上传 + OCR 识别，结果自动填入任务名
    function initOcrUpload() {
        const dropZone = document.getElementById('ocr-drop-zone');
        const fileInput = document.getElementById('ocr-file-input');
        const statusEl = document.getElementById('ocr-status');
        const nameInput = document.getElementById('task-name-input');

        if (!dropZone || !fileInput || !statusEl || !nameInput) return;

        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                uploadAndRecognize(fileInput.files[0]);
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                uploadAndRecognize(file);
            }
        });

        async function uploadAndRecognize(file) {
            statusEl.textContent = '识别中...';
            statusEl.style.display = 'block';
            statusEl.style.whiteSpace = 'pre-line';
            statusEl.style.cursor = 'default';
            dropZone.style.pointerEvents = 'none';
            dropZone.style.opacity = '0.6';

            try {
                const formData = new FormData();
                formData.append('file', file);

                const resp = await fetch(`${CONFIG.OCR_BASE}/ocr`, {
                    method: 'POST',
                    body: formData,
                });

                if (!resp.ok) throw new Error('OCR service error');

                const result = await resp.json();

                if (result.text) {
                    const lines = result.text.split('\n');
                    // 第一行自动填入任务名
                    if (lines.length > 0) {
                        nameInput.value = lines[0];
                    }
                    // 全部文本展示在状态栏，点击某一行可切换填入任务名
                    statusEl.innerHTML = '';
                    lines.forEach((line, i) => {
                        const span = document.createElement('span');
                        span.textContent = line;
                        span.style.display = 'block';
                        span.style.cursor = 'pointer';
                        span.style.padding = '1px 0';
                        span.title = '点击填入任务名';
                        span.addEventListener('click', (e) => {
                            e.stopPropagation();
                            nameInput.value = line;
                            // 高亮当前选中行
                            statusEl.querySelectorAll('span').forEach(s => s.style.opacity = '0.5');
                            span.style.opacity = '1';
                        });
                        statusEl.appendChild(span);
                    });
                    statusEl.style.color = 'var(--black)';
                } else {
                    statusEl.textContent = '未识别到文字';
                }
            } catch (err) {
                statusEl.textContent = 'OCR 服务未启动';
            } finally {
                dropZone.style.pointerEvents = 'auto';
                dropZone.style.opacity = '1';
                // 点其他地方恢复为空
                const hide = () => {
                    statusEl.textContent = '';
                    statusEl.style.display = '';
                    statusEl.style.whiteSpace = '';
                    statusEl.style.color = '';
                    document.removeEventListener('click', hide);
                };
                setTimeout(() => document.addEventListener('click', hide), 100);
            }
        }
    }

    // 双击任务卡片的弹窗：改名字、颜色、备注
    function openQuickEditModal(task, dateStr) {
        const existing = document.getElementById('quick-edit-modal');
        if (existing) existing.remove();

        const modalHtml = `
            <div id="quick-edit-modal" class="quick-edit-overlay">
                <div class="quick-edit-panel">
                    <div class="quick-edit-header">
                        <span class="quick-edit-title">// QUICK EDIT</span>
                        <button id="cancel-edit-btn" class="quick-close-btn">✕</button>
                    </div>
                    <div class="quick-edit-body">
                        <label class="quick-label">Task Name</label>
                        <input type="text" id="edit-task-name" class="quick-input" value="${task.name}">
                        <label class="quick-label">Color</label>
                        <div class="quick-color-row">
                            <button class="quick-color-option" data-color="#c1ff00aa" style="background:#c1ff00aa"></button>
                            <button class="quick-color-option" data-color="#f498adaa" style="background:#f498adaa"></button>
                            <button class="quick-color-option" data-color="#0077ffaa" style="background:#0077ffaa"></button>
                            <button class="quick-color-option" data-color="#7a5fffaa" style="background:#7a5fffaa"></button>
                            <button class="quick-color-option" data-color="#ffffffaa" style="background:#ffffffaa"></button>
                        </div>
                        <label class="quick-label">Notes</label>
                        <textarea id="edit-task-notes" class="quick-textarea" rows="4">${task.notes || ''}</textarea>
                    </div>
                    <div class="quick-edit-footer">
                        <button id="save-edit-btn" class="quick-save-btn">Save</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        let selectedColor = task.color || '#c1ff00aa';

        // 颜色小圆点点击切换，高亮当前选中的
        document.querySelectorAll('.quick-color-option').forEach(btn => {
            if (btn.dataset.color === selectedColor) {
                btn.classList.add('active');
            }
            btn.onclick = () => {
                document.querySelectorAll('.quick-color-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedColor = btn.dataset.color;
            };
        });

        document.getElementById('cancel-edit-btn').onclick = () => {
            document.getElementById('quick-edit-modal').remove();
        };

        document.getElementById('save-edit-btn').onclick = () => {
            const newName = document.getElementById('edit-task-name').value.trim();
            const newNotes = document.getElementById('edit-task-notes').value.trim();

            if (!newName) {
                alert('Task name cannot be empty');
                return;
            }

            task.taskName = newName;
            task.name = newName;
            task.notes = newNotes;
            task.color = selectedColor;

            const currentDuration = task.duration != null ? parseFloat(task.duration) : 1.0;

            const payload = {
                id: task.id,
                date: dateStr,
                startTime: task.time || task.startTime,
                duration: currentDuration,
                taskName: newName,
                notes: newNotes,
                color: task.color,
                taskType: task.taskType || null,
                deadline: task.deadline || null
            };

            fetch(`${CONFIG.API_BASE}/update-time`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(() => {
                ui.renderWeeklyGrid();
                document.getElementById('quick-edit-modal').remove();
            });
        };
    }

    // ==========================================
    // 5. 启动：拉数据、绑事件、开交互
    // ==========================================
    function init() {
        // 先画个空壳出来，避免白屏，然后再异步拉数据刷新
        ui.renderAll();
        api.fetchTasks();

        if (localStorage.getItem('eclipse_theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }

        bindEvents();
        initOcrUpload();
        initInteractJS();
        // 滚动到当前时间位置（调两次是为了等 DOM 就绪）
        setTimeout(() => { scrollToCurrentTime(); }, 100);
        scrollToCurrentTime();
    }

    // ==========================================
    // 6. 拖拽和拉伸，底层用 Interact.js
    // ==========================================
    function initInteractJS() {
        if (typeof interact === 'undefined') {
            return;
        }

        // BLOCK 任务块：可以拖拽，也可以拉底部/顶部手柄调时长
        interact('.event-item:not(.ddl-line-task)')
            .draggable({
                inertia: false,
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: '#weekly-grid',
                        endOnly: false
                    })
                ],
                autoScroll: true,
                onmove: dragMoveListener,
                onend: updateTaskAfterDrag
            })
            .resizable({
                edges: { left: false, right: false, bottom: '.resize-handle.bottom', top: '.resize-handle.top' },
                modifiers: [
                    interact.modifiers.restrictEdges({ outer: 'parent' }),
                    interact.modifiers.snapSize({
                        targets: [interact.createSnapGrid({ x: 1, y: CONFIG.HOUR_HEIGHT / 4 })],
                        endOnly: true
                    })
                ],
                listeners: {
                    move: resizeMoveListener,
                    end: updateTaskAfterResize
                }
            });

        // DDL 截止线：只拖拽，不拉伸
        interact('.ddl-line-task')
            .draggable({
                inertia: false,
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: '#weekly-grid',
                        endOnly: false
                    })
                ],
                autoScroll: true,
                onmove: dragMoveListener,
                onend: updateTaskAfterDrag
            });
    }

    // 拖拽中：卡片跟着鼠标走
    function dragMoveListener(event) {
        const target = event.target;
        target.style.transition = 'none';
        target.style.animation = 'none';

        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

        target.style.transform = `translate(${x}px, ${y}px)`;
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);

        target.style.opacity = '0.75';
        target.style.boxShadow = '0 16px 35px rgba(0,0,0,0.3)';
        target.style.zIndex = '9999';
    }

    // 拖拽松手：算新位置、跨列移动、同步后端
    function updateTaskAfterDrag(event) {
        const target = event.target.closest('.event-item');
        if (!target) return;

        target.style.opacity = '1';
        target.style.boxShadow = '';
        target.style.zIndex = '';

        // 找出鼠标下方是哪个日期列
        target.style.pointerEvents = 'none';
        const dropTarget = document.elementFromPoint(event.clientX, event.clientY);
        target.style.pointerEvents = 'auto';

        const newColumn = dropTarget ? dropTarget.closest('.day-column') : null;
        const currentColumn = target.closest('.day-column');

        let dateStr = currentColumn ? currentColumn.dataset.date : null;
        if (newColumn) {
            dateStr = newColumn.dataset.date;
        }

        if (!dateStr) {
            ui.renderWeeklyGrid();
            return;
        }

        const taskId = target.getAttribute('data-task-id');

        const initialTop = parseFloat(target.style.top) || 0;
        const dragY = parseFloat(target.getAttribute('data-y')) || 0;
        const absoluteY = initialTop + dragY - CONFIG.HEADER_HEIGHT - 5;

        // 像素转分钟，吸附到 15 分钟刻度
        let totalMinutes = (absoluteY / CONFIG.HOUR_HEIGHT) * 60;
        totalMinutes = Math.round(totalMinutes / 15) * 15;
        if (totalMinutes < 0) totalMinutes = 0;
        if (totalMinutes > 23.75 * 60) totalMinutes = 23.75 * 60;

        const startHour = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
        const startMin = (totalMinutes % 60).toString().padStart(2, '0');
        const newStartTimeStr = `${startHour}:${startMin}`;

        // 从内存里找到并移动这个任务
        let foundTaskObj = null;
        Object.keys(state.storage).forEach(key => {
            const idx = state.storage[key].findIndex(t => String(t.id) === String(taskId));
            if (idx !== -1) {
                foundTaskObj = state.storage[key].splice(idx, 1)[0];
            }
        });

        if (foundTaskObj) {
            foundTaskObj.time = newStartTimeStr;
            foundTaskObj.startTime = newStartTimeStr;

            // DDL 的 deadline 始终等于开始时间
            if (foundTaskObj.taskType === "DDL") {
                foundTaskObj.deadline = newStartTimeStr + ":00";
            }

            if (!state.storage[dateStr]) state.storage[dateStr] = [];
            state.storage[dateStr].push(foundTaskObj);

            ui.renderWeeklyGrid();

            // DDL 任务强制 duration = 0
            const ddlDuration = (foundTaskObj.taskType === "DDL" || foundTaskObj.duration === 0)
                ? 0 : (foundTaskObj.duration || 1);
            const payload = {
                id: foundTaskObj.id,
                date: dateStr,
                startTime: newStartTimeStr,
                duration: ddlDuration,
                taskName: foundTaskObj.name || foundTaskObj.taskName,
                notes: foundTaskObj.notes || "",
                taskType: foundTaskObj.taskType || null,
                deadline: foundTaskObj.deadline || null
            };

            fetch(`${CONFIG.API_BASE}/update-time`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
    }

    function resizeMoveListener(event) {
        let target = event.target;
        let x = (parseFloat(target.getAttribute('data-x')) || 0);
        let y = (parseFloat(target.getAttribute('data-y')) || 0);

        target.style.height = event.rect.height + 'px';

        if (event.edges.top) {
            y += event.deltaRect.top;
            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute('data-y', y);
        }
    }

    // 拉伸松手：根据新的像素高度算时长，同步到内存和后端
    function updateTaskAfterResize(event) {
        let target = event.target;
        const taskId = target.getAttribute('data-task-id');
        const dateStr = target.closest('.day-column').dataset.date;

        const currentHeight = parseFloat(target.style.height);
        let newDuration = currentHeight / CONFIG.HOUR_HEIGHT;
        // 每 0.25h (15分钟) 一档，最小不低于 15 分钟
        newDuration = Math.round(newDuration * 4) / 4;
        if (newDuration < 0.25) newDuration = 0.25;

        const initialTop = parseFloat(target.style.top) || 0;
        const dragY = parseFloat(target.getAttribute('data-y')) || 0;
        const absoluteY = initialTop + dragY - CONFIG.HEADER_HEIGHT - 5;

        let totalMinutes = (absoluteY / CONFIG.HOUR_HEIGHT) * 60;
        totalMinutes = Math.round(totalMinutes / 15) * 15;
        if (totalMinutes < 0) totalMinutes = 0;

        const startHour = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
        const startMin = (totalMinutes % 60).toString().padStart(2, '0');
        const newStartTimeStr = `${startHour}:${startMin}`;

        let taskObj = null;
        if (state.storage[dateStr]) {
            taskObj = state.storage[dateStr].find(t => String(t.id) === String(taskId));
            if (taskObj) {
                taskObj.time = newStartTimeStr;
                taskObj.startTime = newStartTimeStr;
                taskObj.duration = newDuration;

                // DDL 被拉高了就自动转成 BLOCK
                if (taskObj.taskType === "DDL" && newDuration > 0) {
                    taskObj.taskType = "BLOCK";
                    const endTotalMin = totalMinutes + (newDuration * 60);
                    const endH = Math.floor(endTotalMin / 60).toString().padStart(2, '0');
                    const endM = Math.round(endTotalMin % 60).toString().padStart(2, '0');
                    taskObj.deadline = `${endH}:${endM}:00`;
                }
            }
        }

        ui.renderWeeklyGrid();

        const currentName = taskObj ? (taskObj.taskName || taskObj.name) : target.querySelector('.event-name-text').textContent;
        const currentNotes = taskObj ? taskObj.notes : "";

        const payload = {
            id: taskId,
            date: dateStr,
            startTime: newStartTimeStr,
            duration: newDuration,
            taskName: currentName,
            notes: currentNotes,
            taskType: taskObj ? taskObj.taskType : null,
            deadline: taskObj ? taskObj.deadline : null
        };

        fetch(`${CONFIG.API_BASE}/update-time`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }

    // 请求浏览器通知权限
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    // 任务提醒：每分钟检查一次，开始前 5 分钟弹通知
    const firedReminders = {};
    function checkTaskReminders() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const now = new Date();
        const todayStr = getCSTDateStr(now);
        const tasks = state.storage[todayStr] || [];

        tasks.forEach(t => {
            if (!t.time || t.taskType === 'DDL') return;

            const [h, m] = t.time.split(':').map(Number);
            const startMin = h * 60 + m;
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const diff = startMin - nowMin;

            // 距离开始 4-6 分钟时提醒，用 id+时间 去重防止重复弹
            const key = `${t.id}-${todayStr}`;
            if (diff >= 4 && diff <= 6 && !firedReminders[key]) {
                firedReminders[key] = true;
                new Notification('EclipseFlow 任务提醒', {
                    body: `${t.name || t.taskName} 将在 ${diff} 分钟后开始`,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>',
                });
            }
        });
    }

    // 侧边栏倒计时：列出今天进行中的任务，显示剩余时间
    function updateCountdown() {
        const listEl = document.getElementById('countdown-list');
        if (!listEl) return;

        const now = new Date();
        const todayStr = getCSTDateStr(now);
        const tasks = state.storage[todayStr] || [];
        const nowMin = now.getHours() * 60 + now.getMinutes();

        // 筛选进行中的任务：已开始但未结束
        const active = tasks.filter(t => {
            if (!t.time || t.taskType === 'DDL') return false;
            const [h, m] = t.time.split(':').map(Number);
            const startMin = h * 60 + m;
            const duration = t.duration || 1;
            const endMin = startMin + duration * 60;
            return nowMin >= startMin && nowMin < endMin;
        });

        if (active.length === 0) {
            listEl.innerHTML = '<span class="countdown-empty">暂无进行中的任务</span>';
            return;
        }

        listEl.innerHTML = active.map(t => {
            const [h, m] = t.time.split(':').map(Number);
            const startMin = h * 60 + m;
            const duration = t.duration || 1;
            const endMin = startMin + duration * 60;
            const remaining = endMin - nowMin;
            const remH = Math.floor(remaining / 60);
            const remM = Math.floor(remaining % 60);
            const timeStr = remH > 0 ? `${remH}h ${remM}m` : `${remM}m`;

            return `
                <div class="countdown-item">
                    <span class="countdown-item-color" style="background:${t.color || '#c1ff00'}"></span>
                    <span class="countdown-item-name">${t.name || t.taskName}</span>
                    <span class="countdown-item-time">${timeStr}</span>
                </div>
            `;
        }).join('');
    }

    init();
    setInterval(() => { ui.renderWeeklyGrid(); }, 60000);

    // 倒计时每秒刷新
    setInterval(updateCountdown, 1000);
    // 通知检查每分钟一次
    setInterval(checkTaskReminders, 60000);

    // 初始化通知权限请求 + 数据加载后跑一次倒计时
    requestNotificationPermission();
    setTimeout(() => {
        updateCountdown();
        checkTaskReminders();
    }, 2000);

    function scrollToCurrentTime() {
        if (!state.isViewingCurrentWeek) return;
        const container = document.getElementById('weekly-scroll-container');
        if (!container) return;

        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();

        const currentPosition = CONFIG.HEADER_HEIGHT + ((currentHour + currentMin / 60) * CONFIG.HOUR_HEIGHT);
        const targetScroll = currentPosition - (container.clientHeight * 0.4);

        container.scrollTo({
            top: Math.max(targetScroll, 0),
            behavior: 'smooth'
        });
    }
});
