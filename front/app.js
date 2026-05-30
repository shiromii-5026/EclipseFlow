document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 全局配置与状态 (State)
    // ==========================================
    const CONFIG = {
        HOUR_HEIGHT: 80,
        HEADER_HEIGHT: 60,
        API_BASE: 'http://localhost:8080/api/tasks'
    };

    const state = {
        currentFocusDate: new Date(),
        miniMonthDate: new Date(),
        storage: {},

        isViewingCurrentWeek: true
    };

    // 工具函数：格式化日期为 YYYY-MM-DD
    const getCSTDateStr = (date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // ==========================================
    // 2. API 数据层 (与后端通信)
    // ==========================================
    const api = {
        // 获取任务列表
        async fetchTasks() {
            console.log("正在拉取数据...");
            try {
                const response = await fetch(`${CONFIG.API_BASE}/list`);
                if (!response.ok) throw new Error('网络响应错误');
                
                const data = await response.json();
                console.log("后端原始 JSON 数据:", data);
                if (data.length > 0) console.table(data); 

                state.storage = {}; 
                
                data.forEach(bt => {
                    const dateKey = bt.taskDate; 
                    if (!state.storage[dateKey]) state.storage[dateKey] = [];
                    
                    const realId = bt.id || bt.taskId || bt.tid || bt.pk;
                    
                    if (!realId) console.warn("警告：该任务对象中找不到任何 ID 字段", bt);

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

                        // 🌟 任务类型：DDL（截止日线任务）或 BLOCK（时间块任务）
                        taskType: bt.taskType || (bt.duration === 0 ? "DDL" : "BLOCK")
                    });
                });
                
                console.log("转换后的 state.storage:", state.storage);
                ui.renderAll(); // 数据拉取成功后重新驱动视图
            } catch (error) {
                console.error('拉取数据失败，展示本地空沙盒:', error);
                // 即使失败了，我们也保持基本 UI 可用
                ui.renderAll(); 
            }
        },

        async saveTask(clientTaskData) {
            try {
                if (clientTaskData.startTime && clientTaskData.startTime.length === 5) {
                    clientTaskData.startTime += ":00";
                }

                // 🌟 确保 deadline 也是 HH:mm:ss 格式
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
                    console.log("任务保存成功并同步到数据库");
                    await this.fetchTasks(); 
                    return true;
                } else {
                    const errorMsg = await response.text();
                    console.error("后端拒绝了请求:", errorMsg);
                    return false;
                }
            } catch (error) {
                console.error("网络请求失败:", error);
                return false;
            }
        },

        // 删除任务
        async deleteTask(id) {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/delete/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    console.log(`🗑️ 任务 ${id} 已删除`);
                    await this.fetchTasks(); 
                } else {
                    alert("服务器删除失败");
                }
            } catch (error) {
                console.error("❌ 删除请求出错:", error);
            }
        },

        //更新任务时间
        async updateTaskTime(id, newDate, startTime) {
            try {
                console.log(`📡 正在向后端发送：id=${id}, date=${newDate}, startTime=${startTime}`);
                
                if (!id || id === "null") {
                    console.error("❌ 阻止请求：任务 ID 未能成功捕获。");
                    return;
                }

                const response = await fetch(`${CONFIG.API_BASE}/update-time`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: id,            // 对应 Java DTO 的 id
                        date: newDate,      // 对应 Java DTO 的 date
                        startTime: startTime // 对应 Java DTO 的 startTime
                    })
                });
                if (!response.ok) throw new Error('后端数据库更新失败');
                console.log('✅ Java 后端数据库同步成功！');
            } catch (error) {
                console.error('❌ 同步数据库时发生崩溃:', error);
            }
        }
    };

    // ==========================================
    // 3. 视图渲染层 (UI)
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

            // 1. 绘制左侧时间轴
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

            // 2. 计算当前周范围
            const temp = new Date(state.currentFocusDate);
            const dayIdx = temp.getDay();
            const diff = temp.getDate() - (dayIdx === 0 ? 6 : dayIdx - 1);
            const monday = new Date(temp.setDate(diff));
            const lastDay = new Date(monday); 
            lastDay.setDate(monday.getDate() + 6);
            
            const formatTitle = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
            const titleEl = document.getElementById('range-title');
            if (titleEl) titleEl.textContent = `日程安排 // ${formatTitle(monday)} - ${formatTitle(lastDay)}`;
            // 判断当前显示周是不是本周
            const today = new Date();

            const isViewingCurrentWeek =
                today >= monday &&
                today <= lastDay;

            // 保存到全局状态
            state.isViewingCurrentWeek = isViewingCurrentWeek;

            // 3. 绘制 7 天的列
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
                // 当前时间线
                if (isCurrentDay) {
                    const currentHour = now.getHours();
                    const currentMin = now.getMinutes();

                    const currentTop =
                        CONFIG.HEADER_HEIGHT +
                        ((currentHour + currentMin / 60) * CONFIG.HOUR_HEIGHT);

                    const line = document.createElement('div');

                    line.className = 'current-time-line';

                    line.style.top = `${currentTop}px`;

                    col.appendChild(line);
                }
                
                const tasks = state.storage[key] || [];
                tasks.forEach(t => {
                    // 🔴 核心修复：防御性木桶。确保时间存在且为字符串，防止脏数据引发 split 异常导致页面崩溃
                    if (!t.time || typeof t.time !== 'string') {
                        console.warn("发现缺失时间数据的任务，已自动跳过防止崩溃:", t);
                        return;
                    }

                    // 计算任务位置
                    const [h, m] = t.time.split(':').map(Number);
                    const startDecimal = h + m / 60;

                    const item = document.createElement('div');
                    item.className = 'event-item';
                    item.setAttribute('data-task-id', t.id);

                    // 🌟 DDL 线任务判定：taskType 为 "DDL" 或 duration 为 0
                    const isDDL = t.taskType === "DDL" || t.duration === 0;
                    if (isDDL) {
                        item.classList.add('ddl-line-task');
                    }

                    if (t.color) {
                        item.style.backgroundColor = t.color || 'var(--white)';
                        item.style.border = (t.color.toLowerCase() === '#ffffff' || t.color.toLowerCase() === '#ffffffaa') ? "1px solid var(--black)" : "none";
                    } else if (isToday) {
                        item.classList.add('important');
                    }

                    item.style.top = `${startDecimal * CONFIG.HOUR_HEIGHT + CONFIG.HEADER_HEIGHT}px`;

                    if (isDDL) {
                        // 🌟 DDL 线任务：固定 2px 高度 + 左侧小标签
                        item.style.height = '2px';
                        item.style.minHeight = '2px';
                        item.style.padding = '0';
                        item.style.borderRadius = '0';
                        item.style.border = 'none';
                        // 使用任务颜色作为线条颜色
                        if (t.color) {
                            item.style.backgroundColor = t.color;
                        }
                        item.innerHTML = `
                            <div class="ddl-line-marker"></div>
                            <span class="ddl-label">${t.name}</span>
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
    // 4. 事件监听注册层 (Controller)
    // ==========================================
    function bindEvents() {
        const grid = document.getElementById('weekly-grid');
        if (grid) {
            
            // 1️⃣ 【你原有的逻辑】：单击删除按钮
            grid.addEventListener('click', (e) => {
                if (e.target.classList.contains('del-btn-mini') || e.target.classList.contains('ddl-del')) {
                    const taskId = e.target.getAttribute('data-id');
                    if (taskId && confirm("确定要从数据库中删除这个任务吗？")) {
                        api.deleteTask(taskId);
                    }
                }
            });

            // 2️⃣ 🌟【新加入的逻辑】：双击卡片快速编辑任务名与备注
            grid.addEventListener('dblclick', (e) => {
                // 向上寻找最近的卡片节点（确保双击卡片内任何文本、空白处都能触发）
                const item = e.target.closest('.event-item');
                
                // 🌟 核心防错：如果双击的是删除按钮，则直接拦截，不触发编辑弹窗
                if (e.target.classList.contains('del-btn-mini')) return;

                if (item) {
                    // 从卡片标签上抓取绑定的任务 ID
                    const taskId = item.getAttribute('data-task-id');
                    // 从它所属的单日列容器上抓取日期
                    const dateStr = item.closest('.day-column').dataset.date;
                    
                    console.log(`🔍 触发双击编辑 -> 任务ID: ${taskId}, 日期: ${dateStr}`);

                    // 去内存状态机里捞出这条任务的原始对象数据
                    if (state.storage[dateStr]) {
                        const taskData = state.storage[dateStr].find(t => String(t.id) === String(taskId));
                        if (taskData) {
                            // 呼出我们上一轮写的玻璃拟态快捷编辑弹窗
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

            // 🌟 截止时间选择器（重命名自 end-*）
            const deadlineHour =
                document.getElementById('task-deadline-hour-select').value;

            const deadlineMin =
                document.getElementById('task-deadline-min-select').value;

            // 🌟 核心逻辑：判断任务类型
            // 有截止时间 → BLOCK 块任务；无截止时间 → DDL 线任务
            let duration = null;
            let deadlineTime = null;
            let taskType = null;

            if (deadlineHour !== "" && deadlineMin !== "") {
                // ✅ 有截止时间 → BLOCK（任务块）
                taskType = "BLOCK";

                const startMinutes =
                    parseInt(hour) * 60 + parseInt(minute);

                const endMinutes =
                    parseInt(deadlineHour) * 60 + parseInt(deadlineMin);

                duration =
                    (endMinutes - startMinutes) / 60;

                if (duration <= 0) {
                    alert("截止时间必须晚于开始时间");
                    return;
                }

                // 截止时间 = 用户选择的结束时间
                deadlineTime = `${deadlineHour}:${deadlineMin}:00`;
            } else {
                // ✅ 无截止时间 → DDL（截止日线任务）
                taskType = "DDL";
                duration = 0;
                // DDL 任务的 deadline = 开始时间（即这条线的锚点时间）
                deadlineTime = `${hour}:${minute}:00`;
            }

                if (!name || !date) {
                    alert("请填写任务名称和日期！");
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

        const deadlineHourSel =
            document.getElementById('task-deadline-hour-select');
        const deadlineMinSel =
            document.getElementById('task-deadline-min-select');


        if (hourSel && minSel) {
            hourSel.innerHTML = '';
            minSel.innerHTML = '';

            // 2. 填充小时 (00-23)
            for (let h = 0; h < 24; h++) {
                const hStr = h.toString().padStart(2, '0');
                hourSel.add(new Option(hStr, hStr));
                if (deadlineHourSel) deadlineHourSel.add(new Option(hStr, hStr));
            }

            // 3. 填充分钟 (按 5 分钟步长：00, 05, 10...55)
            for (let m = 0; m < 60; m += 5) {
                const mStr = m.toString().padStart(2, '0');
                minSel.add(new Option(mStr, mStr));
                if (deadlineMinSel) deadlineMinSel.add(new Option(mStr, mStr));
            }
        }
    }

    function saveToLocal() {
        localStorage.setItem('eclipse_tasks', JSON.stringify(state.storage));
        showSaveFeedback(); 
    }

    function showSaveFeedback() {
        let toast = document.querySelector('.save-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'save-toast';
            toast.innerText = 'DATA_SYNCED_OK';
            document.body.appendChild(toast);
        }
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    //双击后进行一个弹窗
    function openQuickEditModal(task, dateStr) {
        // 移除已有的
        const existing = document.getElementById('quick-edit-modal');
        if (existing) existing.remove();

        // 创建玻璃拟态遮罩和弹窗
        const modalHtml = `
            <div id="quick-edit-modal" class="quick-edit-overlay">

                <div class="quick-edit-panel">

                    <div class="quick-edit-header">
                        <span class="quick-edit-title">
                            // QUICK EDIT
                        </span>

                        <button id="cancel-edit-btn"
                            class="quick-close-btn">
                            ✕
                        </button>
                    </div>

                    <div class="quick-edit-body">

                        <label class="quick-label">
                            任务名
                        </label>

                        <input
                            type="text"
                            id="edit-task-name"
                            class="quick-input"
                            value="${task.name}"
                        >

                        <label class="quick-label">
                            Notes
                        </label>

                        <label class="quick-label">
                            任务颜色
                        </label>

                        <div class="quick-color-row">

                            <button
                                class="quick-color-option"
                                data-color="#c1ff00aa"
                                style="background:#c1ff00aa"
                            ></button>

                            <button
                                class="quick-color-option"
                                data-color="#f498adaa"
                                style="background:#f498adaa"
                            ></button>

                            <button
                                class="quick-color-option"
                                data-color="#0077ffaa"
                                style="background:#0077ffaa"
                            ></button>

                            <button
                                class="quick-color-option"
                                data-color="#7a5fffaa"
                                style="background:#7a5fffaa"
                            ></button>

                            <button
                                class="quick-color-option"
                                data-color="#ffffffaa"
                                style="background:#ffffffaa"
                            ></button>

                        </div>

                        <textarea
                            id="edit-task-notes"
                            class="quick-textarea"
                            rows="4"
                        >${task.notes || ''}</textarea>

                    </div>

                    <div class="quick-edit-footer">

                        <button
                            id="save-edit-btn"
                            class="quick-save-btn"
                        >
                            保存修改
                        </button>

                    </div>

                </div>

            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        let selectedColor =
            task.color || '#c1ff00aa';

        document
        .querySelectorAll('.quick-color-option')
        .forEach(btn => {

            if (
                btn.dataset.color === selectedColor
            ) {
                btn.classList.add('active');
            }

            btn.onclick = () => {

                document
                    .querySelectorAll('.quick-color-option')
                    .forEach(b =>
                        b.classList.remove('active')
                    );

                btn.classList.add('active');

                selectedColor =
                    btn.dataset.color;
            };
        });

        // 绑定关闭和保存事件
        document.getElementById('cancel-edit-btn').onclick = () => {
            document.getElementById('quick-edit-modal').remove();
        };

        document.getElementById('save-edit-btn').onclick = () => {
            const newName = document.getElementById('edit-task-name').value.trim();
            const newNotes = document.getElementById('edit-task-notes').value.trim();
            
            if (!newName) {
                alert('任务名称不能为空');
                return;
            }

            // 同步数据到内存
            task.taskName = newName;
            task.name = newName; 
            task.notes = newNotes;
            task.color = selectedColor;

            // 核心：强制兜底获取当前时长，防止刷成 1
            // 🌟 DDL 任务 duration 可以为 0，用 ?? 替代 ||
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
    // 5. 初始化运行区 (Init)
    // ==========================================
    function init() {
        // ① 优先进行本地首次渲染（打破白屏，进入兜底状态）
        ui.renderAll(); 

        // ② 异步拉取后端真实数据（悄悄加载，加载完再刷视图）
        api.fetchTasks(); 

        if (localStorage.getItem('eclipse_theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }

        bindEvents();

        // ③ 🔴 激活交互引擎：正式开启拖拽与拉伸支持！
        initInteractJS();
        setTimeout(() => {
            scrollToCurrentTime();
        }, 100);
        scrollToCurrentTime();
    }

    // ==========================================
    // 6. 高级交互层 (Drag & Drop / Resize)
    // ==========================================
    function initInteractJS() {
        if (typeof interact === 'undefined') {
            console.warn('Interact.js 未加载，拖拽功能不可用');
            return;
        }

        // 计算 5 分钟对应的像素：(5 / 60) * 80px = 6.666px
        const FIVE_MIN_PX = (5 / 60) * CONFIG.HOUR_HEIGHT;

        // 🌟 BLOCK 任务：可拖拽 + 可拉伸
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
                // 绑定到我们刚才写的 class 上
                edges: { left: false, right: false, bottom: '.resize-handle.bottom', top: '.resize-handle.top' },
                modifiers: [
                    interact.modifiers.restrictEdges({ outer: 'parent' }),
                    interact.modifiers.snapSize({
                        // 每 15 分钟吸附一次 (即 HOUR_HEIGHT 的四分之一)
                        targets: [ interact.createSnapGrid({ x: 1, y: CONFIG.HOUR_HEIGHT / 4 }) ],
                        endOnly: true
                    })
                ],
                listeners: {
                    move: resizeMoveListener,
                    end: updateTaskAfterResize
                }
            });

        // 🌟 DDL 线任务：只可拖拽（不可拉伸）
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

    // --- 拖动时的视觉跟随 (二维追踪) ---
    function dragMoveListener(event) {
        const target = event.target;
        
        target.style.transition = 'none';
        target.style.animation = 'none';

        // 3. 🔴 同时追踪 X 轴和 Y 轴的鼠标累加位移
        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

        // 4. 🔴 运用二维平移，让卡片跟着鼠标全屏幕乱飞
        target.style.transform = `translate(${x}px, ${y}px)`;
        
        // 保存当前的最新坐标
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);
        
        // 华丽的拖拽视觉反馈
        target.style.opacity = '0.75';
        target.style.boxShadow = '0 16px 35px rgba(0,0,0,0.3)';
        target.style.zIndex = '9999'; 
    }

    // --- 拖拽结束：核心跨列判定 ---
    // --- 拖拽结束：核心跨列判定与数据驱动重刷 ---
    function updateTaskAfterDrag(event) {
        // 1. 确保拿到最外层任务卡片节点
        const target = event.target.closest('.event-item');
        if (!target) return;
        
        // 恢复拖拽时改变的临时视觉样式
        target.style.opacity = '1';
        target.style.boxShadow = '';
        target.style.zIndex = '';

        // 2. 雷达透视探测：获取鼠标松手那一刻下方的真正单日列容器
        target.style.pointerEvents = 'none';
        const dropTarget = document.elementFromPoint(event.clientX, event.clientY);
        target.style.pointerEvents = 'auto'; 

        const newColumn = dropTarget ? dropTarget.closest('.day-column') : null;
        const currentColumn = target.closest('.day-column');
        
        // 确定最终落脚的日期
        let dateStr = currentColumn ? currentColumn.dataset.date : null;
        if (newColumn) {
            dateStr = newColumn.dataset.date;
        }
        
        if (!dateStr) {
            // 如果飘到网格外面去了，强刷视图让它就地复位
            ui.renderWeeklyGrid();
            return;
        }

        const taskId = target.getAttribute('data-task-id'); 
        
        // 3. 核心计算：基于最原始未污染的初始 top + 本次累计拖拽位移 dragY 算出绝对高度
        const initialTop = parseFloat(target.style.top) || 0;
        const dragY = parseFloat(target.getAttribute('data-y')) || 0;
        const absoluteY = initialTop + dragY - CONFIG.HEADER_HEIGHT - 5;
        
        // 精准将绝对像素值转换为总分钟数
        let totalMinutes = (absoluteY / CONFIG.HOUR_HEIGHT) * 60;
        // 极客式网格吸附：强制对齐到最近的 15 分钟刻度
        totalMinutes = Math.round(totalMinutes / 15) * 15;
        
        // 限制单天边界
        if (totalMinutes < 0) totalMinutes = 0;
        if (totalMinutes > 23.75 * 60) totalMinutes = 23.75 * 60;
        
        // 格式化得到干净的开始时间字符串 (HH:mm)
        const startHour = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
        const startMin = (totalMinutes % 60).toString().padStart(2, '0');
        const newStartTimeStr = `${startHour}:${startMin}`;

        console.log(`🎯 拖拽数据换算 -> 任务ID: ${taskId}, 新日期: ${dateStr}, 新时间: ${newStartTimeStr}`);

        // 4. 【核心演算法】：维护内存状态机仓库
        let foundTaskObj = null;
        // 先从内存各处挖出这个任务
        Object.keys(state.storage).forEach(key => {
            const idx = state.storage[key].findIndex(t => String(t.id) === String(taskId));
            if (idx !== -1) {
                foundTaskObj = state.storage[key].splice(idx, 1)[0]; // 剔除旧位置
            }
        });

        if (foundTaskObj) {
            // 覆写新属性
            foundTaskObj.time = newStartTimeStr;
            foundTaskObj.startTime = newStartTimeStr;

            // 🌟 拖拽 DDL 任务：同步更新 deadline = 新的开始时间
            if (foundTaskObj.taskType === "DDL") {
                foundTaskObj.deadline = newStartTimeStr + ":00";
            }

            // 塞入新日期分类中
            if (!state.storage[dateStr]) state.storage[dateStr] = [];
            state.storage[dateStr].push(foundTaskObj);

            // 🌟 核心杀招：数据更新完毕，立刻全量重刷视图！
            // 原来带有随意 transform 位移的脏 DOM 被瞬间销毁，新卡片从生成时就会规规矩矩地绝对定位对齐！
            ui.renderWeeklyGrid();

            // 5. 组装干净的 payload 同步到 Java 后端
            const ddlDuration = (foundTaskObj.taskType === "DDL" || foundTaskObj.duration === 0) ? 0 : (foundTaskObj.duration || 1);
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
            }).then(res => {
                if (!res.ok) console.error("❌ 后端数据库同步失败");
            });
        }
    }
    // --- 拉伸进行时的视觉跟随 ---
    function resizeMoveListener(event) {
        let target = event.target;
        let x = (parseFloat(target.getAttribute('data-x')) || 0);
        let y = (parseFloat(target.getAttribute('data-y')) || 0);

        // 动态改变高度
        target.style.height = event.rect.height + 'px';

        // 如果是往上拉伸（拉动 top 边缘），需要同时改变 Y 坐标，否则只有底部在动
        if (event.edges.top) {
            y += event.deltaRect.top;
            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute('data-y', y);
        }
    }

    // --- 拉伸松手后的数据同步 ---
    // --- 拉伸松手后的数据同步与全量清爽重刷 ---
    function updateTaskAfterResize(event) {
        let target = event.target;
        const taskId = target.getAttribute('data-task-id');
        const dateStr = target.closest('.day-column').dataset.date;

        // 1. 基于结束时拉伸出的纯净像素高度，算出全新时长 (15分钟步长即 0.25)
        const currentHeight = parseFloat(target.style.height);
        let newDuration = currentHeight / CONFIG.HOUR_HEIGHT; 
        newDuration = Math.round(newDuration * 4) / 4; 
        if (newDuration < 0.25) newDuration = 0.25; // 限制最小长度为15分钟

        // 2. 计算顶端绝对高度（适配往上拉伸边缘的情况）
        const initialTop = parseFloat(target.style.top) || 0;
        const dragY = parseFloat(target.getAttribute('data-y')) || 0;
        const absoluteY = initialTop + dragY - CONFIG.HEADER_HEIGHT - 5;
        
        let totalMinutes = (absoluteY / CONFIG.HOUR_HEIGHT) * 60;
        totalMinutes = Math.round(totalMinutes / 15) * 15;
        if (totalMinutes < 0) totalMinutes = 0;

        const startHour = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
        const startMin = (totalMinutes % 60).toString().padStart(2, '0');
        const newStartTimeStr = `${startHour}:${startMin}`;

        // 3. 更新内存状态机数据仓库
        let taskObj = null;
        if (state.storage[dateStr]) {
            taskObj = state.storage[dateStr].find(t => String(t.id) === String(taskId));
            if (taskObj) {
                taskObj.time = newStartTimeStr;
                taskObj.startTime = newStartTimeStr;
                taskObj.duration = newDuration; // 写入精炼后的新时长

                // 🌟 拉伸后不再是 DDL 线任务，转为 BLOCK
                if (taskObj.taskType === "DDL" && newDuration > 0) {
                    taskObj.taskType = "BLOCK";
                    // 根据新的起始+持续时长反推截止时间
                    const endTotalMin = totalMinutes + (newDuration * 60);
                    const endH = Math.floor(endTotalMin / 60).toString().padStart(2, '0');
                    const endM = Math.round(endTotalMin % 60).toString().padStart(2, '0');
                    taskObj.deadline = `${endH}:${endM}:00`;
                }
            }
        }

        // 🌟 核心杀招：丢弃所有拉伸事件残留在 DOM 上的百分比/高宽杂质，彻底干净地重新从生成层渲染对齐！
        ui.renderWeeklyGrid();

        // 4. 提取其余属性，发送全量数据包持久化入库
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
        }).then(res => {
            if (!res.ok) console.error("❌ 后端拉伸数据更新同步失败");
        });
    }
    
    // 运行启动
    init(); 
    setInterval(() => {
        ui.renderWeeklyGrid();
    }, 60000);
    function scrollToCurrentTime() {
        if (!state.isViewingCurrentWeek) return;
        const container = document.getElementById('weekly-scroll-container');

        if (!container) return;

        const now = new Date();

        const currentHour = now.getHours();
        const currentMin = now.getMinutes();

        // 当前时间对应的绝对像素位置
        const currentPosition =
            CONFIG.HEADER_HEIGHT +
            ((currentHour + currentMin / 60) * CONFIG.HOUR_HEIGHT);

        // 让当前时间位于屏幕中间偏上一点
        const targetScroll =
            currentPosition - (container.clientHeight * 0.4);

        container.scrollTo({
            top: Math.max(targetScroll, 0),
            behavior: 'smooth'
        });
    }
});