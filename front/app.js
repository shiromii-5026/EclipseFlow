document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 配置和全局状态
    // ==========================================
    // 智能检测运行环境：
    // - Docker/nginx: 使用相对路径（/api/tasks → nginx 反向代理）
    // - 本地直接打开 HTML: 使用 localhost:8080
    const isProxied = window.location.protocol !== 'file:'
        && (!window.location.port || window.location.port === '80' || window.location.port === '443');

    const CONFIG = {
        HOUR_HEIGHT: 80,
        HEADER_HEIGHT: 60,
        API_BASE: isProxied ? '/api/tasks' : 'http://localhost:8080/api/tasks',
        OCR_BASE: isProxied ? '' : 'http://localhost:8000',
        SOCIAL_BASE: isProxied ? '/api/social' : 'http://localhost:8080/api/social',
        AUTH_BASE: isProxied ? '/api/auth' : 'http://localhost:8080/api/auth',
        PUSH_BASE: isProxied ? '/api/push' : 'http://localhost:8080/api/push'
    };

    // 移动端检测
    const isMobile = () => window.matchMedia('(max-width: 780px)').matches;

    // 每次请求带上 JWT token
    const token = () => localStorage.getItem('eclipse_token') || '';
    const authHeaders = () => token() ? { 'Authorization': 'Bearer ' + token() } : {};

    // 统一处理 401 未登录 → 跳转登录页
    const handleResponse = async (response) => {
        if (response.status === 401) {
            localStorage.removeItem('eclipse_token');
            window.location.href = 'login.html';
            throw new Error('未登录');
        }
        return response;
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
                const response = await fetch(`${CONFIG.API_BASE}/list`, { headers: authHeaders() });
                await handleResponse(response);

                const result = await response.json();
                // 兼容 ApiResponse 包装和裸数组
                const data = Array.isArray(result) ? result : (result.data || []);

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
                    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                await handleResponse(response);

                if (response.ok) {
                    await this.fetchTasks();
                    return true;
                } else {
                    const err = await response.json().catch(() => ({}));
                    alert(err.message || '保存失败');
                    return false;
                }
            } catch (error) {
                return false;
            }
        },

        // 删完直接全量刷新，简单粗暴
        async deleteTask(id) {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/delete/${id}`, { method: 'DELETE', headers: authHeaders() });
                await handleResponse(response);
                if (response.ok) {
                    await this.fetchTasks();
                } else {
                    const err = await response.json().catch(() => ({}));
                    alert(err.message || '服务器删除失败');
                }
            } catch (error) {
                // 网络异常，静默处理（handleResponse 已处理 401）
            }
        },

        async updateTaskTime(id, newDate, startTime) {
            try {
                if (!id || id === "null") {
                    return;
                }

                const response = await fetch(`${CONFIG.API_BASE}/update-time`, {
                    method: 'PUT',
                    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
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
            // 如果移动端日视图/列表视图可见，也一并刷新
            const dayContainer = document.getElementById('day-view-container');
            if (dayContainer && !dayContainer.classList.contains('hidden')) {
                this.renderDayView();
            }
            const listContainer = document.getElementById('list-view-container');
            if (listContainer && !listContainer.classList.contains('hidden')) {
                this.renderListView();
            }
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
                    dayEl.classList.add('has-tasks');
                }
                dayEl.textContent = d;

                dayEl.addEventListener('click', () => {
                    state.currentFocusDate = dateObj;
                    this.renderAll();
                    // 移动端：选完日期后关闭侧边栏抽屉
                    if (isMobile()) closeSidebarDrawer();
                    // 滚动到当天第一个任务
                    setTimeout(() => {
                        const col = document.querySelector(`.day-column[data-date="${dateStr}"]`);
                        if (col) {
                            const firstTask = col.querySelector('.event-item');
                            if (firstTask) {
                                firstTask.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }
                    }, 50);
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
                        const ddlColor = t.color || '#9fc518';
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

                        const noteHtml = t.notes ? `<div class="event-note-text">${t.notes}</div>` : '';
                        item.innerHTML = `
                            <div class="resize-handle top">▴</div>
                            <div class="event-time-tag">${t.time.substring(0, 5)}</div>
                            <div class="event-name-text">${t.name}</div>
                            ${noteHtml}
                            <button class="del-btn-mini" data-id="${t.id}">×</button>
                            <div class="resize-handle bottom">▾</div>
                        `;
                    }

                    col.appendChild(item);
                });
                grid.appendChild(col);
            }
        },

        renderDayView() {
            const grid = document.getElementById('day-grid');
            const label = document.getElementById('day-date-label');
            if (!grid || !label) return;

            const d = state.currentFocusDate;
            const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            label.textContent = `${d.getMonth() + 1}月${d.getDate()}日 ${weekNames[d.getDay()]}`;

            const dateStr = getCSTDateStr(d);
            const tasks = (state.storage[dateStr] || []).filter(t => t.taskType !== 'DDL' || t.duration === 0);

            grid.innerHTML = '';

            for (let h = 0; h < 24; h++) {
                const slot = document.createElement('div');
                slot.className = 'day-slot';
                const labelDiv = document.createElement('div');
                labelDiv.className = 'day-slot-label';
                labelDiv.textContent = `${h}:00`;
                const contentDiv = document.createElement('div');
                contentDiv.className = 'day-slot-content';
                slot.appendChild(labelDiv);
                slot.appendChild(contentDiv);
                grid.appendChild(slot);
            }

            // 今日红色时间线
            const todayStr = getCSTDateStr(new Date());
            if (dateStr === todayStr) {
                const now = new Date();
                const topPx = (now.getHours() + now.getMinutes() / 60) * CONFIG.HOUR_HEIGHT;
                const line = document.createElement('div');
                line.className = 'current-time-line';
                line.style.cssText = `position:absolute;top:${topPx}px;left:50px;right:0;z-index:10;`;
                grid.appendChild(line);
            }

            tasks.forEach(t => {
                if (!t.time) return;
                const [h, m] = t.time.split(':').map(Number);
                const topPx = (h + m / 60) * CONFIG.HOUR_HEIGHT;
                const heightPx = Math.max((t.duration || 0.5) * CONFIG.HOUR_HEIGHT, 20);

                const card = document.createElement('div');
                card.className = 'day-task-card';
                card.style.top = `${topPx}px`;
                card.style.height = `${heightPx}px`;
                card.style.setProperty('--task-color', t.color || '#b5d528aa');
                card.textContent = `${t.time.substring(0, 5)} ${t.name}`;
                card.dataset.taskId = t.id;
                card.dataset.date = dateStr;

                // 点击编辑
                card.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openQuickEditModal(t, dateStr);
                });

                // 长按上下文菜单
                let lpTimer;
                card.addEventListener('touchstart', (e) => {
                    lpTimer = setTimeout(() => {
                        if (navigator.vibrate) navigator.vibrate(15);
                        showMobileContextMenu(t, dateStr, card);
                    }, 500);
                });
                card.addEventListener('touchend', () => clearTimeout(lpTimer));
                card.addEventListener('touchmove', () => clearTimeout(lpTimer));

                grid.appendChild(card);
            });
        },

        renderListView() {
            const container = document.getElementById('task-list');
            const label = document.getElementById('list-range-label');
            if (!container) return;

            // 计算本周一
            const temp = new Date(state.currentFocusDate);
            const dayIdx = temp.getDay();
            const diff = temp.getDate() - (dayIdx === 0 ? 6 : dayIdx - 1);
            const monday = new Date(temp.getFullYear(), temp.getMonth(), diff);

            const allTasks = [];
            for (let i = 0; i < 7; i++) {
                const cur = new Date(monday);
                cur.setDate(monday.getDate() + i);
                const key = getCSTDateStr(cur);
                const tasks = state.storage[key] || [];
                tasks.forEach(t => {
                    allTasks.push({ ...t, _date: key, _dayOffset: i });
                });
            }

            allTasks.sort((a, b) => {
                if (a._date !== b._date) return a._date.localeCompare(b._date);
                return (a.time || '00:00').localeCompare(b.time || '00:00');
            });

            const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
            if (label) label.textContent = `本周任务 (${allTasks.length})`;

            if (allTasks.length === 0) {
                container.innerHTML = '<div style="text-align:center;opacity:0.4;padding:40px;">暂无任务</div>';
                return;
            }

            container.innerHTML = allTasks.map(t => `
                <div class="task-list-item" data-task-id="${t.id}" data-date="${t._date}">
                    <div class="task-list-color" style="background:${t.color || '#b5d528aa'}"></div>
                    <div class="task-list-info">
                        <span class="task-list-name">${t.name}</span>
                        <span class="task-list-meta">${t._date} ${weekNames[t._dayOffset]} ${t.time ? t.time.substring(0, 5) : ''}</span>
                    </div>
                    <span class="task-list-time">${t.duration > 0 ? t.duration + 'h' : 'DDL'}</span>
                </div>
            `).join('');

            container.querySelectorAll('.task-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    const taskId = item.dataset.taskId;
                    const dateStr = item.dataset.date;
                    const task = (state.storage[dateStr] || []).find(t => String(t.id) === String(taskId));
                    if (task) openQuickEditModal(task, dateStr);
                });
            });
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
                    if (taskId && confirm("确定删除这个任务吗？")) {
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

            // 移动端：点击任务卡片 = 快捷编辑（替代双击）
            grid.addEventListener('click', (e) => {
                if (!isMobile()) return;
                if (e.target.classList.contains('del-btn-mini') || e.target.classList.contains('ddl-del')) return;
                const item = e.target.closest('.event-item');
                if (!item) return;
                const taskId = item.getAttribute('data-task-id');
                const dateStr = item.closest('.day-column')?.dataset.date;
                if (taskId && dateStr && state.storage[dateStr]) {
                    const task = state.storage[dateStr].find(t => String(t.id) === String(taskId));
                    if (task) openQuickEditModal(task, dateStr);
                }
            });

            // 移动端：长按任务 = 上下文菜单
            if (isMobile()) {
                let longPressTimer = null;
                grid.addEventListener('touchstart', (e) => {
                    const item = e.target.closest('.event-item');
                    if (!item) return;
                    longPressTimer = setTimeout(() => {
                        const taskId = item.getAttribute('data-task-id');
                        const dateStr = item.closest('.day-column')?.dataset.date;
                        if (taskId && dateStr && state.storage[dateStr]) {
                            const task = state.storage[dateStr].find(t => String(t.id) === String(taskId));
                            if (task) {
                                if (navigator.vibrate) navigator.vibrate(15);
                                showMobileContextMenu(task, dateStr, item);
                            }
                        }
                    }, 500);
                }, { passive: true });
                grid.addEventListener('touchend', () => {
                    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
                });
                grid.addEventListener('touchmove', () => {
                    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
                });
            }
        }

        // 侧边栏抽屉开关
        const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', openSidebarDrawer);
        }
        const sidebarBackdrop = document.getElementById('sidebar-backdrop');
        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', closeSidebarDrawer);
        }

        // 视图切换器
        const viewSwitcher = document.getElementById('view-switcher');
        if (viewSwitcher) {
            viewSwitcher.addEventListener('click', (e) => {
                const btn = e.target.closest('.view-switch-btn');
                if (!btn) return;
                showView(btn.dataset.view);
            });
        }

        // 日视图导航按钮
        const dayPrevBtn = document.getElementById('day-prev-btn');
        const dayNextBtn = document.getElementById('day-next-btn');
        if (dayPrevBtn) {
            dayPrevBtn.addEventListener('click', () => {
                state.currentFocusDate.setDate(state.currentFocusDate.getDate() - 1);
                state.currentFocusDate = new Date(state.currentFocusDate);
                ui.renderDayView();
                ui.renderMiniCalendar();
            });
        }
        if (dayNextBtn) {
            dayNextBtn.addEventListener('click', () => {
                state.currentFocusDate.setDate(state.currentFocusDate.getDate() + 1);
                state.currentFocusDate = new Date(state.currentFocusDate);
                ui.renderDayView();
                ui.renderMiniCalendar();
            });
        }

        // 日视图左右滑动切换日期
        const dayContainer = document.getElementById('day-view-container');
        if (dayContainer) {
            let touchStartX = 0, touchStartY = 0;
            dayContainer.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }, { passive: true });
            dayContainer.addEventListener('touchend', (e) => {
                const dx = e.changedTouches[0].clientX - touchStartX;
                const dy = e.changedTouches[0].clientY - touchStartY;
                // 水平位移 > 60px 且大于垂直位移时触发
                if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
                    const d = new Date(state.currentFocusDate);
                    d.setDate(d.getDate() + (dx < 0 ? 1 : -1));
                    state.currentFocusDate = d;
                    ui.renderDayView();
                    ui.renderMiniCalendar();
                }
            });
        }

        // 底部导航
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.addEventListener('click', (e) => {
                const item = e.target.closest('.bottom-nav-item');
                if (!item) return;
                const tab = item.dataset.tab;
                bottomNav.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
                item.classList.add('active');
                switch (tab) {
                    case 'schedule': showView('week'); break;
                    case 'day': showView('day'); break;
                    case 'friends':
                        openSidebarDrawer();
                        setTimeout(() => {
                            document.getElementById('friends-panel')?.scrollIntoView({ behavior: 'smooth' });
                        }, 350);
                        break;
                    case 'settings':
                        openSidebarDrawer();
                        break;
                }
            });
        }

        // FAB 快速添加
        const fab = document.getElementById('fab-add-task');
        if (fab) {
            fab.addEventListener('click', () => {
                if (isMobile()) openMobileTaskSheet();
            });
        }

        const themeBtn = document.getElementById('theme-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                const isDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('eclipse_theme', isDark ? 'dark' : 'light');
                const metaTheme = document.querySelector('meta[name="theme-color"]');
                if (metaTheme) {
                    metaTheme.content = isDark ? '#070b1a' : '#b5d528';
                }
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('eclipse_token');
                localStorage.removeItem('eclipse_username');
                window.location.href = 'login.html';
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
                        alert("截止时间必须晚于开始时间");
                        return;
                    }
                    deadlineTime = `${deadlineHour}:${deadlineMin}:00`;
                } else {
                    taskType = "DDL";
                    duration = 0;
                    deadlineTime = `${hour}:${minute}:00`;
                }

                if (!name || !date) {
                    alert("请填写任务名称和日期");
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
            statusEl.textContent = 'AI 识别中...';
            statusEl.style.display = 'block';
            statusEl.style.color = 'var(--black)';
            dropZone.style.pointerEvents = 'none';
            dropZone.style.opacity = '0.6';

            try {
                const formData = new FormData();
                formData.append('file', file);

                const today = getCSTDateStr(new Date());
                const resp = await fetch(`${CONFIG.OCR_BASE}/ocr-vision?today=${today}`, {
                    method: 'POST',
                    body: formData,
                });

                if (!resp.ok) throw new Error('Vision service error');

                const result = await resp.json();

                if (result.tasks && result.tasks.length > 0) {
                    statusEl.textContent = `识别到 ${result.tasks.length} 个任务`;
                    openBatchConfirmModal(result.tasks);
                } else if (result.error) {
                    statusEl.textContent = result.error;
                } else {
                    statusEl.textContent = '未识别到任务';
                }
            } catch (err) {
                statusEl.textContent = 'OCR 服务连接失败，请确认 ocr-service 已启动';
            } finally {
                dropZone.style.pointerEvents = 'auto';
                dropZone.style.opacity = '1';
                setTimeout(() => { statusEl.textContent = ''; statusEl.style.display = ''; }, 5000);
            }
        }
    }

    // AI 解析后的批量确认弹窗，逐个确认任务
    function openBatchConfirmModal(tasks) {
        const existing = document.getElementById('batch-confirm-modal');
        if (existing) existing.remove();

        let currentIndex = 0;
        const total = tasks.length;

        function renderTask(index) {
            if (index >= total) {
                document.getElementById('batch-confirm-modal').remove();
                ui.showToast('全部任务已处理');
                ui.fetchTasks ? api.fetchTasks() : null;
                return;
            }
            const t = tasks[index];
            const modal = document.getElementById('batch-confirm-modal');
            if (!modal) return;

            const colors = [
                { val: '#b5d528aa', name: '翠绿' },
                { val: '#f08830aa', name: '鲜橙' },
                { val: '#4da6d9', name: '天蓝' },
                { val: '#e8656e', name: '赤红' },
                { val: '#b8a0d8aa', name: '淡紫' },
            ];

            const colorOpts = colors.map(c =>
                `<option value="${c.val}" ${(t.color || '#b5d528aa') === c.val ? 'selected' : ''}>${c.name}</option>`
            ).join('');

            modal.querySelector('.batch-confirm-body').innerHTML = `
                <div class="batch-progress">${index + 1} / ${total}</div>
                <label class="quick-label">任务名</label>
                <input id="batch-task-name" class="quick-input" value="${t.taskName || ''}">
                <div class="batch-row">
                    <div class="batch-field">
                        <label class="quick-label">日期</label>
                        <input id="batch-date" class="quick-input" type="date" value="${t.taskDate || ''}">
                    </div>
                    <div class="batch-field">
                        <label class="quick-label">开始时间</label>
                        <input id="batch-start" class="quick-input" type="time" value="${t.startTime || '09:00'}">
                    </div>
                    <div class="batch-field">
                        <label class="quick-label">截止（可选）</label>
                        <input id="batch-end" class="quick-input" type="time" value="${t.endTime || ''}">
                    </div>
                    <div class="batch-field">
                        <label class="quick-label">颜色</label>
                        <select id="batch-color" class="quick-input">${colorOpts}</select>
                    </div>
                </div>
                <label class="quick-label">备注</label>
                <textarea id="batch-notes" class="quick-textarea" rows="2">${t.notes || ''}</textarea>
            `;

            modal.querySelector('#batch-confirm-btn').onclick = async () => {
                const taskData = {
                    taskName: document.getElementById('batch-task-name').value.trim(),
                    taskDate: document.getElementById('batch-date').value,
                    startTime: document.getElementById('batch-start').value,
                    duration: 0,
                    deadline: null,
                    taskType: 'DDL',
                    notes: document.getElementById('batch-notes').value.trim(),
                };

                const endTime = document.getElementById('batch-end').value;
                if (endTime) {
                    const startMin = parseInt(taskData.startTime.split(':')[0]) * 60 + parseInt(taskData.startTime.split(':')[1]);
                    const endMin = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
                    if (endMin > startMin) {
                        taskData.duration = (endMin - startMin) / 60;
                        taskData.deadline = endTime + ':00';
                        taskData.taskType = 'BLOCK';
                    }
                } else {
                    taskData.deadline = taskData.startTime + ':00';
                }

                taskData.startTime += ':00';
                const colorSel = document.getElementById('batch-color');
                taskData.color = colorSel ? colorSel.value : '#b5d528aa';

                await api.saveTask(taskData);
                currentIndex++;
                renderTask(currentIndex);
            };

            modal.querySelector('#batch-skip-btn').onclick = () => {
                currentIndex++;
                renderTask(currentIndex);
            };

            modal.querySelector('#batch-all-btn').onclick = async () => {
                // 一键确认剩下的全部
                for (let i = index; i < total; i++) {
                    const t = tasks[i];
                    const startTime = (t.startTime || '09:00') + ':00';
                    let duration = 0, deadline = startTime, taskType = 'DDL';
                    if (t.endTime) {
                        const sm = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
                        const em = parseInt(t.endTime.split(':')[0]) * 60 + parseInt(t.endTime.split(':')[1]);
                        if (em > sm) {
                            duration = (em - sm) / 60;
                            deadline = t.endTime + ':00';
                            taskType = 'BLOCK';
                        }
                    }
                    await api.saveTask({
                        taskName: t.taskName || '',
                        taskDate: t.taskDate || getCSTDateStr(new Date()),
                        startTime: startTime,
                        duration: duration,
                        deadline: deadline,
                        taskType: taskType,
                        notes: t.notes || '',
                        color: t.color || '#b5d528aa',
                    });
                }
                document.getElementById('batch-confirm-modal').remove();
                ui.showToast(`${total} 个任务已全部导入`);
                api.fetchTasks();
            };

            modal.querySelector('#batch-cancel-btn').onclick = () => {
                document.getElementById('batch-confirm-modal').remove();
            };
        }

        const modalHtml = `
            <div id="batch-confirm-modal" class="quick-edit-overlay">
                <div class="quick-edit-panel" style="width:480px;max-height:90vh;overflow-y:auto;">
                    <div class="quick-edit-header">
                        <span class="quick-edit-title">确认导入任务</span>
                        <button id="batch-cancel-btn" class="quick-close-btn">✕</button>
                    </div>
                    <div class="batch-confirm-body"></div>
                    <div class="quick-edit-footer" style="justify-content:space-between;">
                        <button id="batch-all-btn" class="quick-save-btn" style="background:var(--white);color:var(--black);border:1px solid var(--black);">一键确认</button>
                        <div style="display:flex;gap:8px;">
                            <button id="batch-skip-btn" class="quick-save-btn" style="background:transparent;color:var(--black);border:1px solid var(--black);">跳过</button>
                            <button id="batch-confirm-btn" class="quick-save-btn">确认并保存</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        renderTask(0);
    }

    // 双击任务卡片的弹窗：改名字、颜色、备注
    function openQuickEditModal(task, dateStr) {
        const existing = document.getElementById('quick-edit-modal');
        if (existing) existing.remove();

        const modalHtml = `
            <div id="quick-edit-modal" class="quick-edit-overlay">
                <div class="quick-edit-panel">
                    <div class="quick-edit-header">
                        <span class="quick-edit-title">快捷编辑</span>
                        <button id="cancel-edit-btn" class="quick-close-btn">✕</button>
                    </div>
                    <div class="quick-edit-body">
                        <label class="quick-label">任务名</label>
                        <input type="text" id="edit-task-name" class="quick-input" value="${task.name}">
                        <label class="quick-label">颜色</label>
                        <div class="quick-color-row">
                            <button class="quick-color-option" data-color="#9fc518aa" style="background:#9fc518aa"></button>
                            <button class="quick-color-option" data-color="#f89828aa" style="background:#f08830aa"></button>
                            <button class="quick-color-option" data-color="#5eb8e8" style="background:#4da6d9"></button>
                            <button class="quick-color-option" data-color="#f07880" style="background:#e8656e"></button>
                            <button class="quick-color-option" data-color="#b088e0aa" style="background:#b8a0d8aa"></button>
                        </div>
                        <label class="quick-label">备注</label>
                        <textarea id="edit-task-notes" class="quick-textarea" rows="4">${task.notes || ''}</textarea>
                    </div>
                    <div class="quick-edit-footer">
                        <button id="save-edit-btn" class="quick-save-btn">保存</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        let selectedColor = task.color || '#b5d528aa';

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
                alert('任务名称不能为空');
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
    // 4.5 移动端核心函数
    // ==========================================

    function showView(viewName) {
        const weekContainer = document.getElementById('weekly-scroll-container');
        const dayContainer = document.getElementById('day-view-container');
        const listContainer = document.getElementById('list-view-container');
        const viewBtns = document.querySelectorAll('.view-switch-btn');

        [weekContainer, dayContainer, listContainer].forEach(c => {
            if (c) c.classList.add('hidden');
        });

        viewBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.view === viewName);
        });

        switch (viewName) {
            case 'week':
                if (weekContainer) weekContainer.classList.remove('hidden');
                break;
            case 'day':
                if (dayContainer) {
                    dayContainer.classList.remove('hidden');
                    ui.renderDayView();
                }
                break;
            case 'list':
                if (listContainer) {
                    listContainer.classList.remove('hidden');
                    ui.renderListView();
                }
                break;
        }

        // 同步底部导航选中态
        const tabMap = { week: 'schedule', day: 'day', list: 'schedule' };
        const targetTab = tabMap[viewName];
        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === targetTab);
        });
    }

    function openSidebarDrawer() {
        const sidebar = document.querySelector('.sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('visible');
    }

    function closeSidebarDrawer() {
        const sidebar = document.querySelector('.sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('visible');
    }

    function openMobileTaskSheet() {
        const existing = document.getElementById('mobile-task-sheet');
        if (existing) existing.remove();

        const todayStr = getCSTDateStr(new Date());
        const hourOpts = Array.from({ length: 24 }, (_, i) =>
            `<option value="${String(i).padStart(2, '0')}" ${i === 9 ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`
        ).join('');
        const minOpts = Array.from({ length: 12 }, (_, i) =>
            `<option value="${String(i * 5).padStart(2, '0')}">${String(i * 5).padStart(2, '0')}</option>`
        ).join('');

        const sheetHtml = `
            <div id="mobile-task-sheet" class="quick-edit-overlay" style="align-items:flex-end;">
                <div class="quick-edit-panel" style="width:100%;max-width:480px;border-radius:24px 24px 0 0;padding-bottom:calc(20px + env(safe-area-inset-bottom, 0px));">
                    <div class="quick-edit-header">
                        <span class="quick-edit-title">新建任务</span>
                        <button id="mobile-task-cancel" class="quick-close-btn">✕</button>
                    </div>
                    <div class="quick-edit-body">
                        <input id="mobile-task-name" class="quick-input" placeholder="任务内容">
                        <input id="mobile-task-date" class="quick-input" type="date" value="${todayStr}">
                        <div style="display:flex;gap:8px;">
                            <select id="mobile-task-hour" class="quick-input" style="flex:1;">${hourOpts}</select>
                            <span style="align-self:center;font-weight:900;">:</span>
                            <select id="mobile-task-min" class="quick-input" style="flex:1;">${minOpts}</select>
                        </div>
                        <select id="mobile-task-color" class="quick-input">
                            <option value="#b5d528aa">翠绿</option>
                            <option value="#f89828aa">鲜橙</option>
                            <option value="#5eb8e8">天蓝</option>
                            <option value="#f07880">赤红</option>
                            <option value="#b088e0aa">淡紫</option>
                        </select>
                    </div>
                    <div class="quick-edit-footer">
                        <button id="mobile-task-save" class="quick-save-btn">保存</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', sheetHtml);

        document.getElementById('mobile-task-cancel').onclick = () =>
            document.getElementById('mobile-task-sheet').remove();

        document.getElementById('mobile-task-save').onclick = async () => {
            const name = document.getElementById('mobile-task-name').value.trim();
            const date = document.getElementById('mobile-task-date').value;
            const hour = document.getElementById('mobile-task-hour').value;
            const min = document.getElementById('mobile-task-min').value;
            const color = document.getElementById('mobile-task-color').value;

            if (!name || !date) { alert('请填写任务名称和日期'); return; }

            const taskData = {
                taskName: name,
                taskDate: date,
                startTime: `${hour}:${min}`,
                duration: 1,
                deadline: null,
                taskType: 'BLOCK',
                color: color
            };
            taskData.deadline = `${hour}:${min}:00`;

            const success = await api.saveTask(taskData);
            if (success) {
                document.getElementById('mobile-task-sheet').remove();
            }
        };
    }

    function showMobileContextMenu(task, dateStr, anchorElement) {
        document.getElementById('mobile-context-menu')?.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'mobile-context-backdrop';
        backdrop.id = 'mobile-context-backdrop';

        const sheet = document.createElement('div');
        sheet.className = 'mobile-context-sheet';
        sheet.id = 'mobile-context-menu';
        sheet.innerHTML = `
            <button class="mobile-context-item" data-action="edit">编辑任务</button>
            <button class="mobile-context-item" data-action="time">调整时间</button>
            <button class="mobile-context-item" data-action="color">更换颜色</button>
            <div class="context-divider"></div>
            <button class="mobile-context-item danger" data-action="delete">删除任务</button>
        `;

        const close = () => {
            backdrop.remove();
            sheet.remove();
        };

        backdrop.addEventListener('click', close);

        sheet.querySelectorAll('.mobile-context-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                close();
                switch (action) {
                    case 'edit':
                        openQuickEditModal(task, dateStr);
                        break;
                    case 'time':
                        openTimePickerModal(task, dateStr);
                        break;
                    case 'color':
                        openQuickEditModal(task, dateStr);
                        break;
                    case 'delete':
                        if (confirm('确定删除这个任务吗？')) {
                            api.deleteTask(task.id);
                        }
                        break;
                }
            });
        });

        document.body.appendChild(backdrop);
        document.body.appendChild(sheet);
    }

    function openTimePickerModal(task, dateStr) {
        const modal = document.getElementById('time-picker-modal');
        if (!modal) return;

        document.getElementById('time-picker-date').value = dateStr;
        document.getElementById('time-picker-start').value = (task.time || task.startTime || '09:00').substring(0, 5);
        document.getElementById('time-picker-duration').value = task.duration || 1;

        modal.classList.remove('hidden');

        document.getElementById('time-picker-cancel').onclick = () => modal.classList.add('hidden');

        document.getElementById('time-picker-save').onclick = async () => {
            const newDate = document.getElementById('time-picker-date').value;
            const newStart = document.getElementById('time-picker-start').value;
            const newDuration = parseFloat(document.getElementById('time-picker-duration').value);

            if (!newDate || !newStart) return;

            task.time = newStart;
            task.startTime = newStart;
            task.duration = newDuration;

            // 日期变了就挪到新日期
            const oldDate = Object.keys(state.storage).find(k =>
                state.storage[k].some(t2 => String(t2.id) === String(task.id))
            );
            if (oldDate && oldDate !== newDate) {
                const idx = state.storage[oldDate].findIndex(t2 => String(t2.id) === String(task.id));
                if (idx !== -1) {
                    const [moved] = state.storage[oldDate].splice(idx, 1);
                    if (!state.storage[newDate]) state.storage[newDate] = [];
                    state.storage[newDate].push(moved);
                }
            }

            await api.updateTaskTime(task.id, newDate, newStart);
            ui.renderAll();
            modal.classList.add('hidden');
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

        // FAB 显示/隐藏管理
        const fab = document.getElementById('fab-add-task');
        const mediaQuery = window.matchMedia('(max-width: 780px)');
        const updateFabVisibility = () => {
            if (fab) {
                fab.classList.toggle('visible', mediaQuery.matches);
            }
        };
        updateFabVisibility();
        mediaQuery.addEventListener('change', updateFabVisibility);

        // 滚动到当前时间位置（调两次是为了等 DOM 就绪）
        setTimeout(() => { scrollToCurrentTime(); }, 100);
        scrollToCurrentTime();
    }

    // ==========================================
    // 6. 拖拽和拉伸，底层用 Interact.js
    // ==========================================
    function initInteractJS() {
        if (typeof interact === 'undefined') return;
        if (isMobile()) return; // 移动端禁用拖拽，改用时间选择弹窗

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
        const activeEl = document.getElementById('countdown-list');
        const upcomingEl = document.getElementById('upcoming-list');
        if (!activeEl || !upcomingEl) return;

        const now = new Date();
        const todayStr = getCSTDateStr(now);
        const tasks = state.storage[todayStr] || [];
        const nowMin = now.getHours() * 60 + now.getMinutes();

        const active = [];
        const upcoming = [];

        tasks.forEach(t => {
            if (!t.time) return;
            const [h, m] = t.time.split(':').map(Number);
            const startMin = h * 60 + m;
            const isDDL = t.taskType === 'DDL' || t.duration === 0;

            if (isDDL) {
                // DDL 任务只显示在即将开始，不显示在进行中
                if (startMin > nowMin && startMin - nowMin <= 60) {
                    upcoming.push(t);
                }
                return;
            }

            const duration = t.duration || 1;
            const endMin = startMin + duration * 60;

            if (nowMin >= startMin && nowMin < endMin) {
                active.push(t);
            } else if (startMin > nowMin && startMin - nowMin <= 60) {
                upcoming.push(t);
            }
        });

        // 按开始时间排序
        const sortByTime = (a, b) => {
            const am = parseInt(a.time.split(':')[0]) * 60 + parseInt(a.time.split(':')[1]);
            const bm = parseInt(b.time.split(':')[0]) * 60 + parseInt(b.time.split(':')[1]);
            return am - bm;
        };
        active.sort(sortByTime);
        upcoming.sort(sortByTime);

        const renderItem = (t, showRemaining) => {
            const [h, m] = t.time.split(':').map(Number);
            const startMin = h * 60 + m;
            const color = t.color || '#9fc518';
            const isDDL = t.taskType === 'DDL' || t.duration === 0;

            if (showRemaining && !isDDL) {
                const duration = t.duration || 1;
                const endMin = startMin + duration * 60;
                const remaining = endMin - nowMin;
                const remH = Math.floor(remaining / 60);
                const remM = Math.floor(remaining % 60);
                const timeStr = remH > 0 ? `${remH}h ${remM}m` : `${remM}m`;
                return `<div class="countdown-item">
                    <span class="countdown-item-color" style="background:${color}"></span>
                    <span class="countdown-item-name">${t.name || t.taskName}</span>
                    <span class="countdown-item-time">${timeStr}</span>
                </div>`;
            } else {
                const waitMin = startMin - nowMin;
                const waitStr = waitMin <= 0 ? '即将开始' : `${waitMin}分钟后`;
                return `<div class="countdown-item">
                    <span class="countdown-item-color" style="background:${color}"></span>
                    <span class="countdown-item-name">${t.name || t.taskName}</span>
                    <span class="countdown-item-time upcoming-time">${waitStr}</span>
                </div>`;
            }
        };

        activeEl.innerHTML = active.length > 0
            ? active.map(t => renderItem(t, true)).join('')
            : '<span class="countdown-empty">-</span>';

        upcomingEl.innerHTML = upcoming.length > 0
            ? upcoming.map(t => renderItem(t, false)).join('')
            : '<span class="countdown-empty">-</span>';
    }

    init();
    setInterval(() => { ui.renderWeeklyGrid(); }, 60000);

    // 倒计时每秒刷新
    setInterval(updateCountdown, 1000);
    // 任务提醒每 30 秒检查一次，确保不遗漏 5 分钟窗口
    checkTaskReminders();
    setInterval(checkTaskReminders, 30000);

    // 推送订阅：把浏览器生成的订阅对象发给后端保存
    async function subscribePush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (sub) return;
        try {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: 'BEfDYqG4eOMOiAeUNW3wfUzTPzSx1iBLgoODzGuAEoLwpsJh-VkPugQSvEY5Zu4zXZcnCUoWiaZppxWvuJECoU0',
            });
            const subJson = sub.toJSON();
            await fetch(`${CONFIG.PUSH_BASE}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subJson),
            });
        } catch (e) {
            // 浏览器不支持或用户拒绝
        }
    }

    // 权限请求 + 订阅推送 + 启动倒计时
    requestNotificationPermission();
    subscribePush();
    setTimeout(() => { updateCountdown(); }, 1000);

    // ===== 好友系统 + 聊天 =====
    const socialApi = (path, opts = {}) =>
        fetch(`${CONFIG.SOCIAL_BASE}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } })
        .then(r => { if (r.status === 401) { localStorage.removeItem('eclipse_token'); window.location.href = 'login.html'; throw new Error('未登录'); } return r.json(); })
        .then(data => data && data.data !== undefined ? data.data : data); // 兼容 ApiResponse 和裸响应
    let chatFriendId = null;

    function refreshFriends() {
        socialApi('/friends').then(list => {
            const el = document.getElementById('friend-list');
            if (!el) return;
            if (list.length === 0) { el.innerHTML = '<span class="countdown-empty">暂无好友</span>'; return; }
            el.innerHTML = list.map(f => `
                <div class="countdown-item" style="cursor:pointer;">
                    <span class="countdown-item-name">${f.username} ${f.calendarPublic ? '(公开)' : ''}</span>
                    <button class="chat-btn" data-id="${f.id}">聊天</button>
                    <button class="cal-btn" data-id="${f.id}">日历</button>
                </div>
            `).join('');
            // 绑定聊天按钮
            el.querySelectorAll('.chat-btn').forEach(b => b.onclick = (e) => { e.stopPropagation(); openChat(b.dataset.id, list.find(f => f.id == b.dataset.id)?.username); });
            // 绑定日历查看按钮
            el.querySelectorAll('.cal-btn').forEach(b => b.onclick = (e) => { e.stopPropagation(); viewFriendCalendar(b.dataset.id); });
        });
        // 好友请求
        socialApi('/requests').then(list => {
            const el = document.getElementById('friend-requests');
            if (!el || list.length === 0) { if (el) el.innerHTML = ''; return; }
            el.innerHTML = '<div style="font-size:0.68rem;opacity:0.5;margin-top:4px;">好友申请</div>' + list.map(r => `
                <div class="countdown-item" style="font-size:0.7rem;">${r.username} <button class="accept-btn" data-id="${r.id}">接受</button></div>
            `).join('');
            el.querySelectorAll('.accept-btn').forEach(b => b.onclick = () => { socialApi('/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: b.dataset.id }) }).then(refreshFriends); });
        });
    }

    document.getElementById('friend-search-btn')?.addEventListener('click', () => {
        const q = document.getElementById('friend-search-input').value.trim();
        if (!q) return;
        socialApi('/search?q=' + q).then(users => {
            if (users.length === 0) { alert('未找到用户'); return; }
            const u = users[0];
            socialApi('/add-friend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ friendId: u.id }) }).then(r => alert(r.status === 'pending' ? '已发送申请' : '已是好友'));
        });
    });

    function openChat(friendId, name) {
        chatFriendId = friendId;
        document.getElementById('chat-friend-name').textContent = name || '聊天';
        document.getElementById('chat-modal').classList.remove('hidden');
        loadMessages();
    }
    document.getElementById('chat-close-btn')?.addEventListener('click', () => { document.getElementById('chat-modal').classList.add('hidden'); chatFriendId = null; });
    document.getElementById('chat-send-btn')?.addEventListener('click', () => {
        const input = document.getElementById('chat-input');
        const content = input.value.trim();
        if (!content || !chatFriendId) return;
        socialApi('/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receiverId: chatFriendId, content }) }).then(() => { input.value = ''; loadMessages(); });
    });
    function loadMessages() {
        if (!chatFriendId) return;
        socialApi('/messages/' + chatFriendId).then(msgs => {
            const el = document.getElementById('chat-messages');
            el.innerHTML = msgs.map(m => `<div class="chat-msg ${m.mine ? 'mine' : 'theirs'}">${m.content}</div>`).join('');
            el.scrollTop = el.scrollHeight;
        });
    }
    setInterval(() => { if (chatFriendId) loadMessages(); refreshFriends(); }, 5000);
    refreshFriends();

    function viewFriendCalendar(friendId) {
        fetch(`${CONFIG.SOCIAL_BASE}/friend-calendar/${friendId}`, { headers: authHeaders() })
            .then(r => r.json()).then(result => {
                const tasks = Array.isArray(result) ? result : (result.data || []);
                if (!tasks || tasks.length === 0) { alert('好友未公开日历或无任务'); return; }
                const dateKey = tasks[0]?.taskDate || getCSTDateStr(new Date());
                state.storage[dateKey] = tasks.map(bt => ({
                    id: bt.id, name: bt.taskName, taskName: bt.taskName,
                    time: bt.startTime, startTime: bt.startTime,
                    duration: bt.duration != null ? bt.duration : 1,
                    color: bt.color, notes: bt.notes || '', deadline: bt.deadline || null,
                    taskType: bt.taskType || (bt.duration === 0 ? 'DDL' : 'BLOCK')
                }));
                ui.renderAll();
                ui.showToast('已切换到好友日历');
            });
    }

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
