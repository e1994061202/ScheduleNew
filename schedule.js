const SHIFTS = {
    DAY: 'DAY',
    EVENING: 'EVENING',
    NIGHT: 'NIGHT'
};

const SHIFT_DISPLAY = {
    [SHIFTS.DAY]: '白班',
    [SHIFTS.EVENING]: '小夜',
    [SHIFTS.NIGHT]: '大夜'
};

let staffList = [];
let currentFlatpickr = null;
let currentEditingIndex = null;
let currentEditingMode = null; // 'previous', 'prescheduled', 或 'vacation'
let hasUnsavedChanges = false;
function addStaff() {
    const name = prompt("請輸入人員姓名：");
    if (name) {
        const staff = {
            name: name,
            prescheduledDates: [],
            preVacationDates: [],
            previousMonthSchedules: [],
            lastMonthLastDayShift: '',
            isPreviousMonthConfirmed: false,  // 初始化確認標誌
            shift1: '',
            shift2: ''
        };
        staffList.push(staff);
        updateStaffList();
        saveToLocalStorage();
    }
}
function updateStaffList() {
    const staffListUl = document.getElementById("staffList");
    staffListUl.innerHTML = "";
    staffList.forEach((staff, index) => {
        const staffLi = document.createElement("li");
        staffLi.className = "staff-item";
        staffLi.draggable = true;
        staffLi.dataset.index = index;
        staffLi.innerHTML = `
            <span class="staff-name" ondblclick="editStaffName(${index}, this)">${staff.name}</span>
            <select class="shift-select" onchange="updateStaffShift(${index}, 1, this.value)">
                <option value="">選擇班次1</option>
                <option value="${SHIFTS.DAY}" ${staff.shift1 === SHIFTS.DAY ? 'selected' : ''}>${SHIFT_DISPLAY[SHIFTS.DAY]}</option>
                <option value="${SHIFTS.EVENING}" ${staff.shift1 === SHIFTS.EVENING ? 'selected' : ''}>${SHIFT_DISPLAY[SHIFTS.EVENING]}</option>
                <option value="${SHIFTS.NIGHT}" ${staff.shift1 === SHIFTS.NIGHT ? 'selected' : ''}>${SHIFT_DISPLAY[SHIFTS.NIGHT]}</option>
            </select>
            <select class="shift-select" onchange="updateStaffShift(${index}, 2, this.value)">
                <option value="">選擇班次2</option>
                <option value="${SHIFTS.DAY}" ${staff.shift2 === SHIFTS.DAY ? 'selected' : ''}>${SHIFT_DISPLAY[SHIFTS.DAY]}</option>
                <option value="${SHIFTS.EVENING}" ${staff.shift2 === SHIFTS.EVENING ? 'selected' : ''}>${SHIFT_DISPLAY[SHIFTS.EVENING]}</option>
                <option value="${SHIFTS.NIGHT}" ${staff.shift2 === SHIFTS.NIGHT ? 'selected' : ''}>${SHIFT_DISPLAY[SHIFTS.NIGHT]}</option>
            </select>
            <button id="previous-month-button-${index}" onclick="showPreviousMonthCalendar(${index})">上月班表</button>
            <button onclick="deletePreviousMonthSchedule(${index})">刪除上月班表</button>
            <button onclick="preschedule(${index})">預班</button>
            <button onclick="deletePreschedule(${index})">刪除預班</button>
            <button onclick="preVacation(${index})">預休</button>
            <button onclick="deletePreVacation(${index})">刪除預休</button>
            <button onclick="deleteStaff(${index})">刪除人員</button>
            <span class="prescheduled-dates" id="prescheduled-${index}"></span>
            <span class="pre-vacation-dates" id="pre-vacation-${index}"></span>
            <div id="previous-month-calendar-container-${index}" style="display: none;">
                <div id="previous-month-calendar-${index}"></div>
                <div id="shift-selection-container-${index}"></div>
            </div>
            <div id="calendar-container-${index}" style="display: none;">
                <div id="calendar-${index}"></div>
                <div id="shift-select-container-${index}" class="shift-select-container"></div>
                <button onclick="confirmPreschedule(${index})">確認</button>
            </div>
            <div id="vacation-calendar-container-${index}" style="display: none;">
                <div id="vacation-calendar-${index}"></div>
                <button onclick="confirmPreVacation(${index})">確認預休</button>
            </div>
            <div id="previous-month-schedules-${index}" class="previous-month-schedules"></div>
        `;
        staffListUl.appendChild(staffLi);
        updatePrescheduledDatesDisplay(index);
        updatePreVacationDatesDisplay(index);
        updatePreviousMonthSchedulesDisplay(index);
    });
    console.log('人員列表已更新');
    addDragListeners();
    
    // 為每個員工設置上月班表按鈕
    staffList.forEach((_, index) => setupPreviousMonthButton(index));
}

function editStaffName(index, element) {
    const currentName = staffList[index].name;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'edit-name-input';
    
    // 替換 span 為 input
    element.parentNode.replaceChild(input, element);
    input.focus();

    // 當 input 失去焦點或按下 Enter 鍵時保存更改
    input.addEventListener('blur', finishEdit);
    input.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            finishEdit();
        }
    });

    function finishEdit() {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            staffList[index].name = newName;
            saveToLocalStorage();
        }
        updateStaffList();
    }
}

function addDragListeners() {
    const staffListElement = document.getElementById('staffList');
    
    staffListElement.addEventListener('dragstart', dragStart);
    staffListElement.addEventListener('dragover', dragOver);
    staffListElement.addEventListener('drop', drop);
    staffListElement.addEventListener('dragend', dragEnd);
    
    console.log('拖曳監聽器已添加');
}

function dragStart(e) {
    if (e.target.classList.contains('staff-item')) {
        e.dataTransfer.setData('text/plain', e.target.dataset.index);
        e.target.classList.add('dragging');
        console.log('開始拖曳', e.target.dataset.index);
    }
}

function dragOver(e) {
    e.preventDefault();
    const afterElement = getDragAfterElement(e.currentTarget, e.clientY);
    const draggable = document.querySelector('.dragging');
    if (draggable) {
        if (afterElement == null) {
            e.currentTarget.appendChild(draggable);
        } else {
            e.currentTarget.insertBefore(draggable, afterElement);
        }
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.staff-item:not(.dragging)')];

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

function drop(e) {
    e.preventDefault();
    const draggedElement = document.querySelector('.dragging');
    if (!draggedElement) return;

    const fromIndex = parseInt(draggedElement.dataset.index);
    const toIndex = Array.from(e.currentTarget.children).indexOf(draggedElement);
    
    if (fromIndex !== toIndex) {
        const [reorderedItem] = staffList.splice(fromIndex, 1);
        staffList.splice(toIndex, 0, reorderedItem);
        updateStaffList();
        saveToLocalStorage();
        console.log('項目從', fromIndex, '移動到', toIndex);
    }
}

function dragEnd(e) {
    if (e.target.classList.contains('staff-item')) {
        e.target.classList.remove('dragging');
        console.log('拖曳結束');
    }
}
function hidePreviousMonthConfirmation(index) {
    const previousMonthCalendarContainer = document.getElementById(`previous-month-calendar-container-${index}`);
    if (previousMonthCalendarContainer) {
        previousMonthCalendarContainer.style.display = 'none';
    }
    
    const shiftSelectionContainer = document.getElementById(`shift-selection-container-${index}`);
    if (shiftSelectionContainer) {
        shiftSelectionContainer.style.display = 'none';
    }
    
    const confirmButton = previousMonthCalendarContainer.querySelector('button');
    if (confirmButton) {
        confirmButton.style.display = 'none';
    }
}
function checkUnsavedChanges(newIndex, newMode) {
    if (hasUnsavedChanges && (currentEditingIndex !== newIndex || currentEditingMode !== newMode)) {
        const confirmSwitch = confirm(`您在${currentEditingMode === 'previous' ? '上月班表' : currentEditingMode === 'prescheduled' ? '預班' : '預休'}中有未保存的更改。是否確定要切換？未保存的更改將會丟失。`);
        if (!confirmSwitch) {
            return false;  // 如果用戶取消切換，則不執行後續操作
        }
        // 重置未保存更改標記
        hasUnsavedChanges = false;
    }
    currentEditingIndex = newIndex;
    currentEditingMode = newMode;
    return true;
}
function preschedule(index) {
    if (!checkUnsavedChanges(index, 'prescheduled')) {
        return;
    }

    const year = document.getElementById("year").value;
    const month = document.getElementById("month").value;
    const calendarContainer = document.getElementById(`calendar-container-${index}`);
    const vacationCalendarContainer = document.getElementById(`vacation-calendar-container-${index}`);
    const previousMonthCalendarContainer = document.getElementById(`previous-month-calendar-container-${index}`);
    
    // 隱藏預休日曆和確認按鈕以及上月班表
    vacationCalendarContainer.style.display = 'none';
    previousMonthCalendarContainer.style.display = 'none';
    
    // 切換預班日曆的顯示狀態
    if (calendarContainer.style.display === 'none' || calendarContainer.style.display === '') {
        calendarContainer.style.display = 'block';
        
        if (currentFlatpickr) {
            currentFlatpickr.destroy();
        }
        
        currentFlatpickr = flatpickr(`#calendar-${index}`, {
            mode: "multiple",
            dateFormat: "Y-m-d",
            minDate: `${year}-${month.padStart(2, '0')}-01`,
            maxDate: new Date(year, month, 0),
            defaultDate: staffList[index].prescheduledDates.map(item => `${year}-${month.padStart(2, '0')}-${item.date.toString().padStart(2, '0')}`),
            inline: true,
            onChange: function(selectedDates, dateStr, instance) {
                updateShiftSelections(index, selectedDates);
                hasUnsavedChanges = true;
            }
        });

        updateShiftSelections(index, currentFlatpickr.selectedDates);
    } else {
        calendarContainer.style.display = 'none';
        if (currentFlatpickr) {
            currentFlatpickr.destroy();
            currentFlatpickr = null;
        }
    }
}

function updateShiftSelections(index, selectedDates) {
    const shiftSelectContainer = document.getElementById(`shift-select-container-${index}`);
    shiftSelectContainer.innerHTML = '';

    selectedDates.forEach(date => {
        const dateStr = date.getDate().toString();
        const existingPrescheduled = staffList[index].prescheduledDates.find(item => item.date.toString() === dateStr);
        const shiftSelect = document.createElement('div');
        shiftSelect.innerHTML = `
            ${dateStr}日: 
            <select id="shift-select-${index}-${dateStr}" onchange="updatePrescheduledShift(${index}, '${dateStr}', this.value)">
                <option value="${SHIFTS.DAY}" ${existingPrescheduled && existingPrescheduled.shift === SHIFTS.DAY ? 'selected' : ''}>${SHIFT_DISPLAY[SHIFTS.DAY]}</option>
                <option value="${SHIFTS.EVENING}" ${existingPrescheduled && existingPrescheduled.shift === SHIFTS.EVENING ? 'selected' : ''}>${SHIFT_DISPLAY[SHIFTS.EVENING]}</option>
                <option value="${SHIFTS.NIGHT}" ${existingPrescheduled && existingPrescheduled.shift === SHIFTS.NIGHT ? 'selected' : ''}>${SHIFT_DISPLAY[SHIFTS.NIGHT]}</option>
            </select>
        `;
        shiftSelectContainer.appendChild(shiftSelect);
    });
}

function updatePrescheduledShift(index, dateStr, shift) {
    const existingIndex = staffList[index].prescheduledDates.findIndex(item => item.date.toString() === dateStr);
    if (existingIndex !== -1) {
        staffList[index].prescheduledDates[existingIndex].shift = shift;
    } else {
        staffList[index].prescheduledDates.push({ date: parseInt(dateStr), shift: shift });
    }
}

function confirmPreschedule(index) {
    staffList[index].prescheduledDates = currentFlatpickr.selectedDates.map(date => ({
        date: date.getDate(),
        shift: document.getElementById(`shift-select-${index}-${date.getDate()}`).value
    }));

    updatePrescheduledDatesDisplay(index);
    document.getElementById(`calendar-container-${index}`).style.display = 'none';
    document.getElementById(`shift-select-container-${index}`).innerHTML = '';
    if (currentFlatpickr) {
        currentFlatpickr.destroy();
        currentFlatpickr = null;
    }
    saveToLocalStorage();
}

function updatePrescheduledDatesDisplay(index) {
    const prescheduledSpan = document.getElementById(`prescheduled-${index}`);
    if (staffList[index].prescheduledDates.length > 0) {
        const sortedDates = [...staffList[index].prescheduledDates].sort((a, b) => a.date - b.date);
        const formattedDates = sortedDates.map(item => `${item.date}日(${SHIFT_DISPLAY[item.shift]})`).join('、');
        prescheduledSpan.textContent = `預班日期: ${formattedDates}`;
    } else {
        prescheduledSpan.textContent = '';
    }
}

function preVacation(index) {
    if (!checkUnsavedChanges(index, 'vacation')) {
        return;
    }

    const year = document.getElementById("year").value;
    const month = document.getElementById("month").value;
    const vacationCalendarContainer = document.getElementById(`vacation-calendar-container-${index}`);
    const calendarContainer = document.getElementById(`calendar-container-${index}`);
    const previousMonthCalendarContainer = document.getElementById(`previous-month-calendar-container-${index}`);
    
    // 隱藏預班日曆、選擇框和確認按鈕以及上月班表
    calendarContainer.style.display = 'none';
    document.getElementById(`shift-select-container-${index}`).innerHTML = '';
    previousMonthCalendarContainer.style.display = 'none';
    
    // 切換預休日曆的顯示狀態
    if (vacationCalendarContainer.style.display === 'none' || vacationCalendarContainer.style.display === '') {
        vacationCalendarContainer.style.display = 'block';
        
        if (currentFlatpickr) {
            currentFlatpickr.destroy();
        }
        
        currentFlatpickr = flatpickr(`#vacation-calendar-${index}`, {
            mode: "multiple",
            dateFormat: "Y-m-d",
            minDate: `${year}-${month.padStart(2, '0')}-01`,
            maxDate: new Date(year, month, 0),
            defaultDate: staffList[index].preVacationDates ? staffList[index].preVacationDates.map(date => `${year}-${month.padStart(2, '0')}-${date.toString().padStart(2, '0')}`) : [],
            inline: true,
            onChange: function(selectedDates, dateStr, instance) {
                hasUnsavedChanges = true;
            }
        });
    } else {
        vacationCalendarContainer.style.display = 'none';
        if (currentFlatpickr) {
            currentFlatpickr.destroy();
            currentFlatpickr = null;
        }
    }
}

function confirmPreVacation(index) {
    staffList[index].preVacationDates = currentFlatpickr.selectedDates.map(date => date.getDate());
    updatePreVacationDatesDisplay(index);
    document.getElementById(`vacation-calendar-container-${index}`).style.display = 'none';
    if (currentFlatpickr) {
        currentFlatpickr.destroy();
        currentFlatpickr = null;
    }
    saveToLocalStorage();
}
function updatePreviousMonthSchedulesDisplay(index) {
    const previousMonthSchedulesElement = document.getElementById(`previous-month-schedules-${index}`);
    if (previousMonthSchedulesElement) {
        if (staffList[index].isPreviousMonthConfirmed) {
            const uniqueDates = [...new Set(staffList[index].previousMonthSchedules)].sort((a, b) => a - b);
            const formattedDates = uniqueDates.map(day => `${day}日`).join('、');
            const lastMonthLastDayShift = staffList[index].lastMonthLastDayShift 
                ? ` (${SHIFT_DISPLAY[staffList[index].lastMonthLastDayShift]})` 
                : '';
            previousMonthSchedulesElement.textContent = `上月上班日期: ${formattedDates}${lastMonthLastDayShift}`;
            previousMonthSchedulesElement.style.display = 'block';
        } else {
            previousMonthSchedulesElement.textContent = '';
            previousMonthSchedulesElement.style.display = 'none';
        }
    }
}
function updateLastDayHighlight(instance, lastDay, year, month) {
    const lastDayElement = instance.days.querySelector(`[aria-label="${year}-${month.toString().padStart(2, '0')}-${lastDay}"]`);
    if (lastDayElement) {
        lastDayElement.style.backgroundColor = 'yellow';
        lastDayElement.style.fontWeight = 'bold';
        lastDayElement.style.position = 'relative';
        
        // 檢查是否已經添加了說明文字
        if (!lastDayElement.querySelector('.last-day-note')) {
            const noteElement = document.createElement('div');
            noteElement.className = 'last-day-note';
            noteElement.textContent = '必選';
            noteElement.style.position = 'absolute';
            noteElement.style.top = '-20px';
            noteElement.style.left = '50%';
            noteElement.style.transform = 'translateX(-50%)';
            noteElement.style.backgroundColor = 'red';
            noteElement.style.color = 'white';
            noteElement.style.padding = '2px 5px';
            noteElement.style.borderRadius = '3px';
            noteElement.style.fontSize = '12px';
            lastDayElement.appendChild(noteElement);
        }
    }
}
function setupPreviousMonthButton(index) {
    const button = document.getElementById(`previous-month-button-${index}`);
    if (button) {
        button.onclick = function() {
            showPreviousMonthCalendar(index);
        };
    }
}
function cancelPreviousMonthEdit(index) {
    // 重置臨時數據
    delete staffList[index].tempPreviousMonthSchedules;

    // 關閉日曆
    const calendarContainer = document.getElementById(`previous-month-calendar-container-${index}`);
    calendarContainer.style.display = 'none';

    // 銷毀 Flatpickr 實例
    if (currentFlatpickr) {
        currentFlatpickr.destroy();
        currentFlatpickr = null;
    }

    // 重置未保存更改標記
    hasUnsavedChanges = false;
    currentEditingIndex = null;
    currentEditingMode = null;

    // 更新顯示
    updatePreviousMonthSchedulesDisplay(index);

    // 可選：顯示取消訊息
    alert('已取消編輯上月班表');
}
function showPreviousMonthCalendar(index) {
    const calendarContainer = document.getElementById(`previous-month-calendar-container-${index}`);
    const shiftSelectionContainer = document.getElementById(`shift-selection-container-${index}`);
    const confirmedScheduleDisplay = document.getElementById(`previous-month-schedules-${index}`);

    // 檢查日曆是否顯示
    if (calendarContainer.style.display === 'block') {
        // 如果日曆已顯示,則關閉他
        calendarContainer.style.display = 'none';
        if (shiftSelectionContainer) {
            shiftSelectionContainer.style.display = 'none';
        }
        if (currentFlatpickr) {
            currentFlatpickr.destroy();
            currentFlatpickr = null;
        }
        return;  // 提前退出函數
    }

    // 如果日曆未顯示，則繼續原有的顯示邏輯
    if (!checkUnsavedChanges(index, 'previous')) {
        return;
    }

    // 確保已確認的的上月上班日期和最后一班次始終顯示
    if (confirmedScheduleDisplay) {
        confirmedScheduleDisplay.style.display = 'block';
    }

    const year = document.getElementById("year").value;
    const month = document.getElementById("month").value;
    const previousMonth = month - 1 < 1 ? 12 : month - 1;
    const previousYear = month - 1 < 1 ? year - 1 : year;

    // 計算上個月的最後6天
    const previousMonthLastDay = new Date(previousYear, previousMonth, 0).getDate();
    const lastSixDays = [];
    for (let day = previousMonthLastDay - 5; day <= previousMonthLastDay; day++) {
        lastSixDays.push(day);
    }

    // 關閉所有人員的上月班表界面
    staffList.forEach((_, i) => {
        const container = document.getElementById(`previous-month-calendar-container-${i}`);
        if (container) {
            container.style.display = 'none';
        }
        const shiftSelection = document.getElementById(`shift-selection-container-${i}`);
        if (shiftSelection) {
            shiftSelection.style.display = 'none';
        }
    });

    // 隱藏其他所有日曆和選擇框
    document.querySelectorAll('[id^="calendar-container-"]').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[id^="vacation-calendar-container-"]').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[id^="shift-select-container-"]').forEach(el => el.innerHTML = '');

    calendarContainer.style.display = 'block';

    if (currentFlatpickr) {
        currentFlatpickr.destroy();
    }

    // 初始化 tempPreviousMonthSchedules
    staffList[index].tempPreviousMonthSchedules = staffList[index].previousMonthSchedules ? 
        staffList[index].previousMonthSchedules.filter(day => lastSixDays.includes(day)) : [];

    currentFlatpickr = flatpickr(`#previous-month-calendar-${index}`, {
        mode: "multiple",
        dateFormat: "Y-m-d",
        minDate: `${previousYear}-${previousMonth.toString().padStart(2, '0')}-${lastSixDays[0]}`,
        maxDate: `${previousYear}-${previousMonth.toString().padStart(2, '0')}-${lastSixDays[lastSixDays.length - 1]}`,
        defaultDate: staffList[index].tempPreviousMonthSchedules.map(day => `${previousYear}-${previousMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`),
        inline: true,
        onChange: function(selectedDates, dateStr, instance) {
            staffList[index].tempPreviousMonthSchedules = selectedDates.map(date => date.getDate());
            hasUnsavedChanges = true;
            updateLastDayHighlight(instance, previousMonthLastDay, previousYear, previousMonth);
        },
        onReady: function(selectedDates, dateStr, instance) {
            updateLastDayHighlight(instance, previousMonthLastDay, previousYear, previousMonth);
        }
    });

    // 重新創建或更新班次選擇的選項
    if (!shiftSelectionContainer) {
        shiftSelectionContainer = document.createElement('div');
        shiftSelectionContainer.id = `shift-selection-container-${index}`;
        calendarContainer.appendChild(shiftSelectionContainer);
    }
    shiftSelectionContainer.innerHTML = `
        <label for="last-day-shift-${index}" style="color: red;">上月最後一天班次 (必選):</label>
        <select id="last-day-shift-${index}" style="border: 2px solid red;">
            <option value="" selected>請選擇</option>
            <option value="${SHIFTS.DAY}">${SHIFT_DISPLAY[SHIFTS.DAY]}</option>
            <option value="${SHIFTS.EVENING}">${SHIFT_DISPLAY[SHIFTS.EVENING]}</option>
            <option value="${SHIFTS.NIGHT}">${SHIFT_DISPLAY[SHIFTS.NIGHT]}</option>
        </select>
    `;
    shiftSelectionContainer.style.display = 'block';  // 確保選擇欄可見

    // 設置上月最後一班次的值
    const lastDayShiftSelect = document.getElementById(`last-day-shift-${index}`);
    if (staffList[index].lastMonthLastDayShift) {
        lastDayShiftSelect.value = staffList[index].lastMonthLastDayShift;
    } else {
        lastDayShiftSelect.value = ""; // 確保默認選項是"請選擇"
    }

    // 更新最後一天班次選擇的事件處理
    lastDayShiftSelect.onchange = () => {
        hasUnsavedChanges = true;
    };

    // 創建或更新確認按鈕和取消按鈕
    let buttonContainer = calendarContainer.querySelector('.button-container');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        calendarContainer.appendChild(buttonContainer);
    }
    buttonContainer.innerHTML = `
        <button id="confirm-previous-month-${index}">確認上月班表</button>
        <button id="cancel-previous-month-${index}">取消</button>
    `;
    
    document.getElementById(`confirm-previous-month-${index}`).onclick = () => confirmPreviousMonthSchedules(index);
    document.getElementById(`cancel-previous-month-${index}`).onclick = () => cancelPreviousMonthEdit(index);

    // 更新顯示
    updatePreviousMonthSchedulesDisplay(index);
}
function confirmPreviousMonthSchedules(index) {
    // 檢查是否選擇了上月最後一天的班次
    const lastDayShift = document.getElementById(`last-day-shift-${index}`).value;
    if (!lastDayShift) {
        alert('請選擇上月最後一天的班次！');
        return;  // 如果沒有選擇，則不繼續執行後續操作
    }

    // 獲取用戶選擇的上班日期
    const selectedDates = staffList[index].tempPreviousMonthSchedules || [];
    if (selectedDates.length === 0) {
        alert('請選擇至少一天的上班日期！');
        return;
    }

    // 計算上月最後一天的日期
    const currentYear = parseInt(document.getElementById("year").value);
    const currentMonth = parseInt(document.getElementById("month").value);
    const previousMonth = currentMonth - 1 < 1 ? 12 : currentMonth - 1;
    const previousYear = currentMonth - 1 < 1 ? currentYear - 1 : currentYear;
    const previousMonthLastDay = new Date(previousYear, previousMonth, 0).getDate();

    // 檢查是否選擇了上月最後一天
    if (!selectedDates.includes(previousMonthLastDay)) {
        const confirmClear = confirm(`您沒有選擇上月最後一天 (${previousMonthLastDay} 日) 為上班日。這是必須的。是否要清除所有選擇並重新開始？`);
        if (confirmClear) {
            // 清除所有選擇
            staffList[index].tempPreviousMonthSchedules = [];
            staffList[index].lastMonthLastDayShift = '';
            document.getElementById(`last-day-shift-${index}`).value = '';
            if (currentFlatpickr) {
                currentFlatpickr.clear();
            }
            alert('所有選擇已清除。請重新選擇上班日期，並確保包含上月最後一天。');
        }
        return;  // 無論用戶選擇清除與否，都中止當前的確認過程
    }

    // 如果程序執行到這裡，說明已經選擇了上月最後一天

    // 計算上月最後六天的日期
    const lastSixDays = [];
    for (let day = previousMonthLastDay - 5; day <= previousMonthLastDay; day++) {
        lastSixDays.push(day);
    }

    // 只保留最後六天內的選擇
    staffList[index].previousMonthSchedules = selectedDates.filter(day => lastSixDays.includes(day)).sort((a, b) => a - b);

    // 設置上月最後一天班次
    staffList[index].lastMonthLastDayShift = lastDayShift;

    // 初始化 lastMonthSchedules
    staffList[index].lastMonthSchedules = {};

    // 只為選中的日期設置班次
    staffList[index].previousMonthSchedules.forEach(day => {
        staffList[index].lastMonthSchedules[day.toString()] = staffList[index].lastMonthLastDayShift;
    });

    // 設置確認標誌
    staffList[index].isPreviousMonthConfirmed = true;

    // 清理臨時數據
    delete staffList[index].tempPreviousMonthSchedules;

    updatePreviousMonthSchedulesDisplay(index);
    document.getElementById(`previous-month-calendar-container-${index}`).style.display = 'none';
    if (currentFlatpickr) {
        currentFlatpickr.destroy();
        currentFlatpickr = null;
    }
    saveToLocalStorage();

    // 重置未保存更改標記
    hasUnsavedChanges = false;
    currentEditingIndex = null;
    currentEditingMode = null;

    // 顯示確認消息
    alert('上月班表已成功確認！');
}
function updatePreVacationDatesDisplay(index) {
    const preVacationSpan = document.getElementById(`pre-vacation-${index}`);
    if (staffList[index].preVacationDates && staffList[index].preVacationDates.length > 0) {
        const sortedDates = [...staffList[index].preVacationDates].sort((a, b) => a - b);
        const formattedDates = sortedDates.map(date => `${date}日`).join(', ');
        preVacationSpan.textContent = `預休日期: ${formattedDates}`;
    } else {
        preVacationSpan.textContent = '';
    }
}

function updateStaffShift(index, shiftNumber, value) {
    staffList[index][`shift${shiftNumber}`] = value;
    saveToLocalStorage();
}

function deleteStaff(index) {
    if (confirm(`確定要刪除 ${staffList[index].name} 嗎？`)) {
        staffList.splice(index, 1);
        updateStaffList();
        saveToLocalStorage();
    }
}
function deletePreviousMonthSchedule(index) {
    if (confirm(`確定要刪除 ${staffList[index].name} 的上月班表嗎？此操作不可撤銷。`)) {
        // 清除上月班表相關數據
        staffList[index].previousMonthSchedules = [];
        staffList[index].lastMonthSchedules = {};
        staffList[index].lastMonthLastDayShift = '';
        staffList[index].isPreviousMonthConfirmed = false;

        // 更新顯示
        updatePreviousMonthSchedulesDisplay(index);

        // 如果日曆當前是開啟的，關閉它
        const calendarContainer = document.getElementById(`previous-month-calendar-container-${index}`);
        if (calendarContainer.style.display === 'block') {
            showPreviousMonthCalendar(index); // 這會切換日曆的顯示狀態
        }

        // 重置按鈕文字
        const button = document.getElementById(`previous-month-button-${index}`);
        if (button) {
            button.textContent = '上月班表';
        }

        // 保存更改
        saveToLocalStorage();

        alert(`${staffList[index].name} 的上月班表已成功刪除。`);
    }
}
function deletePreschedule(index) {
    if (confirm(`確定要刪除 ${staffList[index].name} 的所有預班資料嗎？`)) {
        staffList[index].prescheduledDates = [];
        updateStaffList();
        saveToLocalStorage();
        alert('預班資料已刪除');
    }
}

function deletePreVacation(index) {
    if (confirm(`確定要刪除 ${staffList[index].name} 的所有預休資料嗎？`)) {
        staffList[index].preVacationDates = [];
        updatePreVacationDatesDisplay(index);
        saveToLocalStorage();
        alert('預休資料已刪除');
    }
}
function deleteAllData() {
    if (confirm('確定要刪除所有人員的預班、預休以及上月班表資料嗎？此操作無法撤銷。')) {
        staffList.forEach(staff => {
            // 清除預班資料
            staff.prescheduledDates = [];
            
            // 清除預休資料
            staff.preVacationDates = [];
            
            // 清除上月班表資料
            staff.previousMonthSchedules = [];
            staff.lastMonthSchedules = {};
            staff.lastMonthLastDayShift = '';
            staff.isPreviousMonthConfirmed = false;
        });

        // 更新顯示
        updateStaffList();
        saveToLocalStorage();
        
        alert('所有預班、預休以及上月班表資料已成功刪除');
    }
}
function deleteAllPreschedulesAndVacations() {
    if (confirm('確定要刪除所有人員的預班和預休資料嗎？此操作無法撤銷。')) {
        staffList.forEach(staff => {
            staff.prescheduledDates = [];
            staff.preVacationDates = [];
        });
        updateStaffList();
        saveToLocalStorage();
        alert('所有預班和預休資料已刪除');
    }
}
function saveToLocalStorage() {
    // 保存人員列表
    localStorage.setItem('staffList', JSON.stringify(staffList));

    // 保存班次數量設置
    localStorage.setItem('shiftCounts', JSON.stringify({
        dayShift: document.getElementById('dayShiftCount').value,
        eveningShift: document.getElementById('eveningShiftCount').value,
        nightShift: document.getElementById('nightShiftCount').value
    }));

    // 保存當前選擇的年份和月份
    localStorage.setItem('currentYear', document.getElementById('year').value);
    localStorage.setItem('currentMonth', document.getElementById('month').value);

    // 保存上月最後六天的排班情況
    localStorage.setItem('lastMonthSchedules', JSON.stringify(staffList.reduce((acc, staff) => {
        acc[staff.name] = staff.lastMonthSchedules;
        return acc;
    }, {})));

    console.log('數據已保存到本地存儲'); // 調試日誌
}


function loadFromLocalStorage() {
    const savedStaffList = localStorage.getItem('staffList');
    if (savedStaffList) {
        staffList = JSON.parse(savedStaffList);
        staffList.forEach(staff => {
            if (!staff.preVacationDates) {
                staff.preVacationDates = [];
            }
            if (!staff.previousMonthSchedules) {
                staff.previousMonthSchedules = [];
            }
            if (!staff.hasOwnProperty('lastMonthLastDayShift')) {
                staff.lastMonthLastDayShift = '';
            }
            if (!staff.hasOwnProperty('isPreviousMonthConfirmed')) {
                staff.isPreviousMonthConfirmed = false;  // 初始化確認標誌
            }
        });
        updateStaffList();
    }
    const savedShiftCounts = localStorage.getItem('shiftCounts');
    if (savedShiftCounts) {
        const shiftCounts = JSON.parse(savedShiftCounts);
        document.getElementById('dayShiftCount').value = shiftCounts.dayShift;
        document.getElementById('eveningShiftCount').value = shiftCounts.eveningShift;
        document.getElementById('nightShiftCount').value = shiftCounts.nightShift;
    }
}

function saveStaffData() {
    const dataToSave = {
        staffList: staffList,
        shiftCounts: {
            dayShift: document.getElementById('dayShiftCount').value,
            eveningShift: document.getElementById('eveningShiftCount').value,
            nightShift: document.getElementById('nightShiftCount').value
        }
    };
    const dataStr = JSON.stringify(dataToSave);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'staff_data.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function loadStaffData() {
    document.getElementById('fileInput').click();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                staffList = data.staffList;
                updateStaffList();
                if (data.shiftCounts) {
                    document.getElementById('dayShiftCount').value = data.shiftCounts.dayShift;
                    document.getElementById('eveningShiftCount').value = data.shiftCounts.eveningShift;
                    document.getElementById('nightShiftCount').value = data.shiftCounts.nightShift;
                }
                saveToLocalStorage();
                alert('人員資料和班次人數設定已成功載入');
            } catch (error) {
                alert('載入失敗，請確保文件格式正確');
            }
        };
        reader.readAsText(file);
    }
}

function deleteAllStaff() {
    if (confirm('確定要刪除所有人員資料嗎？此操作無法撤銷。')) {
        staffList = [];
        updateStaffList();
        saveToLocalStorage();
        alert('所有人員資料已刪除');
    }
}

function clearAllPreschedules() {
    staffList.forEach(staff => {
        staff.prescheduledDates = [];
        staff.previousMonthSchedules = [];
        staff.lastMonthLastDayShift = '';
    });
    updateStaffList();
    saveToLocalStorage();
}

// 添加事件監聽器
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('addStaffBtn').addEventListener('click', addStaff);
    document.getElementById('saveStaffDataBtn').addEventListener('click', saveStaffData);
    document.getElementById('loadStaffDataBtn').addEventListener('click', loadStaffData);
    document.getElementById('deleteAllStaffBtn').addEventListener('click', deleteAllStaff);
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('deleteAllDataBtn').addEventListener('click', deleteAllData);
    document.getElementById('year').addEventListener('change', deleteAllData);
    document.getElementById('month').addEventListener('change', deleteAllData);

    document.getElementById('dayShiftCount').addEventListener('change', saveToLocalStorage);
    document.getElementById('eveningShiftCount').addEventListener('change', saveToLocalStorage);
    document.getElementById('nightShiftCount').addEventListener('change', saveToLocalStorage);

    // 頁面加載時從 localStorage 讀取數據
    loadFromLocalStorage();
});

// 添加生成排班表按鈕的點擊事件監聽
document.getElementById('generateScheduleBtn').addEventListener('click', function() {
    const year = parseInt(document.getElementById('year').value);
    const month = parseInt(document.getElementById('month').value);
    
    const shiftCounts = {
        day: parseInt(document.getElementById('dayShiftCount').value),
        evening: parseInt(document.getElementById('eveningShiftCount').value),
        night: parseInt(document.getElementById('nightShiftCount').value)
    };
    
    generateSchedule(staffList, shiftCounts, year, month);
});