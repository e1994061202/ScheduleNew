// 全局常量
const MAX_CONSECUTIVE_WORK_DAYS = 6;
// 全局變量
let daysInMonth;
let dayShiftCount, eveningShiftCount, nightShiftCount;
// 主要排班函數
function createSchedule() {
    let schedule = initializeEmptySchedule();
    let staffWorkDays = initializeStaffWorkDays();

    // 步驟1: 安排預排班
    schedulePrescheduledShifts(schedule, staffWorkDays);

    // 步驟2: 為每個員工安排不超過6天的連續工作日
    scheduleConsecutiveWorkDays(schedule, staffWorkDays);

    // 步驟3: 填補剩餘的班次
    fillRemainingShifts(schedule, staffWorkDays);

    return schedule;
}

// 初始化空的排班表
function initializeEmptySchedule() {
    let schedule = {};
    for (let day = 1; day <= daysInMonth; day++) {
        schedule[day] = {
            [SHIFTS.DAY]: [],
            [SHIFTS.EVENING]: [],
            [SHIFTS.NIGHT]: []
        };
    }
    return schedule;
}

// 初始化員工工作日數據
function initializeStaffWorkDays() {
    return staffList.reduce((acc, staff) => {
        acc[staff.name] = {
            workDays: [],
            consecutiveCount: staff.previousMonthSchedules ? staff.previousMonthSchedules.filter(Boolean).length : 0,
            lastShift: staff.lastMonthLastDayShift || null
        };
        return acc;
    }, {});
}

// 安排預排班
function schedulePrescheduledShifts(schedule, staffWorkDays) {
    staffList.forEach(staff => {
        staff.prescheduledDates.forEach(prescheduled => {
            schedule[prescheduled.date][prescheduled.shift].push(staff.name);
            staffWorkDays[staff.name].workDays.push(prescheduled.date);
            staffWorkDays[staff.name].lastShift = prescheduled.shift;
            updateConsecutiveCount(staffWorkDays[staff.name], prescheduled.date);
        });
    });
}

// 更新連續工作天數
function updateConsecutiveCount(staffWorkDay, currentDay) {
    if (staffWorkDay.workDays.includes(currentDay - 1)) {
        staffWorkDay.consecutiveCount++;
    } else {
        staffWorkDay.consecutiveCount = 1;
    }
}
// 為每個員工安排不超過6天的連續工作日
function scheduleConsecutiveWorkDays(schedule, staffWorkDays) {
    staffList.forEach(staff => {
        let consecutiveDays = 0;
        let lastWorkDay = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            if (staffWorkDays[staff.name].workDays.includes(day)) {
                consecutiveDays++;
                lastWorkDay = day;
            } else if (consecutiveDays > 0 && consecutiveDays < MAX_CONSECUTIVE_WORK_DAYS && day - lastWorkDay === 1) {
                let result = canWorkShift(staff, day, null, schedule, staffWorkDays);
                if (result.canWork) {
                    let shift = selectAppropriateShift(staff, day, staffWorkDays[staff.name].lastShift);
                    schedule[day][shift].push(staff.name);
                    staffWorkDays[staff.name].workDays.push(day);
                    staffWorkDays[staff.name].lastShift = shift;
                    consecutiveDays++;
                    lastWorkDay = day;
                } else {
                    consecutiveDays = 0;
                }
            } else {
                consecutiveDays = 0;
            }

            if (consecutiveDays >= MAX_CONSECUTIVE_WORK_DAYS) {
                consecutiveDays = 0;
            }
        }
    });
}

// 填補剩餘的班次
function fillRemainingShifts(schedule, staffWorkDays) {
    for (let day = 1; day <= daysInMonth; day++) {
        for (let shift in SHIFTS) {
            while (schedule[day][shift].length < getShiftCount(shift)) {
                let availableStaff = staffList.filter(staff => {
                    let result = canWorkShift(staff, day, shift, schedule, staffWorkDays);
                    return result.canWork && !staffWorkDays[staff.name].workDays.includes(day);
                });

                // 優先選擇偏好該班次的員工
                let preferredStaff = availableStaff.filter(staff => 
                    canWorkShift(staff, day, shift, schedule, staffWorkDays).isPreferredShift
                );

                if (preferredStaff.length > 0) {
                    availableStaff = preferredStaff;
                }

                // 根據當前工作天數排序，優先選擇工作天數較少的員工
                availableStaff.sort((a, b) => 
                    staffWorkDays[a.name].workDays.length - staffWorkDays[b.name].workDays.length
                );

                if (availableStaff.length > 0) {
                    let selectedStaff = availableStaff[0];
                    schedule[day][shift].push(selectedStaff.name);
                    staffWorkDays[selectedStaff.name].workDays.push(day);
                    staffWorkDays[selectedStaff.name].lastShift = shift;
                } else {
                    console.warn(`無法為 ${day} 日的 ${shift} 班次找到可用員工，嘗試調整限制條件`);
                    // 在這裡可以添加邏輯來調整限制條件，比如臨時允許超出連續工作天數限制
                    break;
                }
            }
        }
    }
}

// 檢查員工是否可以在指定日期工作指定班次
function canWorkShift(staff, day, shift, schedule, staffWorkDays) {
    // 檢查是否違反連續工作天數限制
    let consecutiveWorkDays = 0;
    for (let i = day - 1; i > day - MAX_CONSECUTIVE_WORK_DAYS; i--) {
        if (i < 1) break;
        if (staffWorkDays[staff.name].workDays.includes(i)) {
            consecutiveWorkDays++;
        } else {
            break;
        }
    }
    if (consecutiveWorkDays >= MAX_CONSECUTIVE_WORK_DAYS - 1) return false;

    // 檢查班次偏好（放寬限制，允許非偏好班次，但有較低優先級）
    let isPreferredShift = (shift === staff.shift1 || shift === staff.shift2);

    // 檢查班次連續性
    let prevDayShift = day > 1 ? getStaffShiftOnDay(schedule, staff.name, day - 1) : staff.lastMonthLastDayShift;
    if (prevDayShift) {
        if (prevDayShift === SHIFTS.NIGHT && (shift === SHIFTS.DAY || shift === SHIFTS.EVENING)) return false;
        if (prevDayShift === SHIFTS.EVENING && shift === SHIFTS.DAY) return false;
    }

    return { canWork: true, isPreferredShift: isPreferredShift };
}

// 選擇適當的班次
function selectAppropriateShift(staff, day, lastShift) {
    let possibleShifts = [staff.shift1, staff.shift2].filter(s => s);
    if (lastShift === SHIFTS.NIGHT) {
        possibleShifts = possibleShifts.filter(s => s === SHIFTS.NIGHT);
    } else if (lastShift === SHIFTS.EVENING) {
        possibleShifts = possibleShifts.filter(s => s !== SHIFTS.NIGHT);
    }
    return possibleShifts[Math.floor(Math.random() * possibleShifts.length)] || staff.shift1;
}

// 獲取指定班次所需的人數
function getShiftCount(shift) {
    switch(shift) {
        case SHIFTS.DAY: return dayShiftCount;
        case SHIFTS.EVENING: return eveningShiftCount;
        case SHIFTS.NIGHT: return nightShiftCount;
        default: return 0;
    }
}
// 檢查員工是否在指定日期被排班
function isStaffScheduledOnDay(schedule, staffName, day) {
    return Object.values(schedule[day]).some(shift => shift.includes(staffName));
}

// 獲取員工在指定日期的班次
function getStaffShiftOnDay(schedule, staffName, day) {
    for (let shift in schedule[day]) {
        if (schedule[day][shift].includes(staffName)) {
            return shift;
        }
    }
    return null;
}

// 評估排班表
function evaluateSchedule(schedule) {
    let score = 0;
    let violations = {
        shiftUnderStaffed: 0,
        consecutiveDaysViolation: 0,
        shiftPreferenceViolation: 0,
        shiftContinuityViolation: 0
    };

    // 檢查每個班次是否都有足夠的人員
    for (let day = 1; day <= daysInMonth; day++) {
        for (let shift in SHIFTS) {
            let staffCount = schedule[day][shift].length;
            let requiredCount = getShiftCount(shift);
            if (staffCount < requiredCount) {
                violations.shiftUnderStaffed += requiredCount - staffCount;
            }
        }
    }

    // 檢查連續工作天數和班次偏好
    staffList.forEach(staff => {
        let consecutiveDays = 0;
        let lastShift = staff.lastMonthLastDayShift;

        for (let day = 1; day <= daysInMonth; day++) {
            let currentShift = getStaffShiftOnDay(schedule, staff.name, day);
            
            if (currentShift) {
                consecutiveDays++;
                
                // 檢查班次偏好
                if (currentShift !== staff.shift1 && currentShift !== staff.shift2) {
                    violations.shiftPreferenceViolation++;
                }

                // 檢查班次連續性
                if (lastShift) {
                    if ((lastShift === SHIFTS.NIGHT && (currentShift === SHIFTS.DAY || currentShift === SHIFTS.EVENING)) ||
                        (lastShift === SHIFTS.EVENING && currentShift === SHIFTS.NIGHT)) {
                        violations.shiftContinuityViolation++;
                    }
                }

                lastShift = currentShift;
            } else {
                if (consecutiveDays > MAX_CONSECUTIVE_WORK_DAYS) {
                    violations.consecutiveDaysViolation += consecutiveDays - MAX_CONSECUTIVE_WORK_DAYS;
                }
                consecutiveDays = 0;
            }
        }

        // 檢查月底的連續工作天數
        if (consecutiveDays > MAX_CONSECUTIVE_WORK_DAYS) {
            violations.consecutiveDaysViolation += consecutiveDays - MAX_CONSECUTIVE_WORK_DAYS;
        }
    });

    // 計算總分
    score -= violations.shiftUnderStaffed * 1000;
    score -= violations.consecutiveDaysViolation * 10000;
    score -= violations.shiftPreferenceViolation * 100;
    score -= violations.shiftContinuityViolation * 500;

    return { score, violations };
}

// 打印排班統計
function printScheduleStatistics(schedule) {
    console.log("排班統計：");
    staffList.forEach(staff => {
        let dayShifts = 0, eveningShifts = 0, nightShifts = 0;
        let workDays = 0;
        let maxConsecutiveDays = 0;
        let currentConsecutiveDays = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            let shift = getStaffShiftOnDay(schedule, staff.name, day);
            if (shift) {
                workDays++;
                currentConsecutiveDays++;
                if (currentConsecutiveDays > maxConsecutiveDays) {
                    maxConsecutiveDays = currentConsecutiveDays;
                }
                switch (shift) {
                    case SHIFTS.DAY: dayShifts++; break;
                    case SHIFTS.EVENING: eveningShifts++; break;
                    case SHIFTS.NIGHT: nightShifts++; break;
                }
            } else {
                currentConsecutiveDays = 0;
            }
        }

        console.log(`${staff.name}:`);
        console.log(`  總工作天數: ${workDays}`);
        console.log(`  白班: ${dayShifts}, 小夜: ${eveningShifts}, 大夜: ${nightShifts}`);
        console.log(`  最長連續工作天數: ${maxConsecutiveDays}`);
    });
}



// 初始化函數
function initializeSchedulingSystem(year, month) {
    daysInMonth = new Date(year, month, 0).getDate();
    dayShiftCount = parseInt(document.getElementById("dayShiftCount").value);
    eveningShiftCount = parseInt(document.getElementById("eveningShiftCount").value);
    nightShiftCount = parseInt(document.getElementById("nightShiftCount").value);
}

// 主要排班流程
function generateSchedule() {
    const year = parseInt(document.getElementById("year").value);
    const month = parseInt(document.getElementById("month").value);
    
    initializeSchedulingSystem(year, month);
    
    console.log("開始生成排班表...");
    const schedule = createSchedule();
    console.log("排班表生成完成。");
    
    const evaluation = evaluateSchedule(schedule);
    console.log("排班表評估結果:", evaluation);
    
    printScheduleStatistics(schedule);
    
    displaySchedule(schedule, year, month);
    displayScheduleMatrix(schedule, year, month);
    displayStatistics(schedule);
}

function displayStatistics(schedule) {
    const statisticsTable = document.getElementById('statisticsTable');
    
    let tableHTML = `
        <table class="statistics-table">
            <thead>
                <tr>
                    <th>員工名稱</th>
                    <th>總工作天數</th>
                    <th>白班天數</th>
                    <th>小夜天數</th>
                    <th>大夜天數</th>
                    <th>最長連續工作天數</th>
                </tr>
            </thead>
            <tbody>
    `;

    staffList.forEach(staff => {
        let dayShifts = 0, eveningShifts = 0, nightShifts = 0;
        let workDays = 0;
        let maxConsecutiveDays = 0;
        let currentConsecutiveDays = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            let shift = getStaffShiftOnDay(schedule, staff.name, day);
            if (shift) {
                workDays++;
                currentConsecutiveDays++;
                if (currentConsecutiveDays > maxConsecutiveDays) {
                    maxConsecutiveDays = currentConsecutiveDays;
                }
                switch (shift) {
                    case SHIFTS.DAY: dayShifts++; break;
                    case SHIFTS.EVENING: eveningShifts++; break;
                    case SHIFTS.NIGHT: nightShifts++; break;
                }
            } else {
                currentConsecutiveDays = 0;
            }
        }

        tableHTML += `
            <tr>
                <td>${staff.name}</td>
                <td>${workDays}</td>
                <td>${dayShifts}</td>
                <td>${eveningShifts}</td>
                <td>${nightShifts}</td>
                <td>${maxConsecutiveDays}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    statisticsTable.innerHTML = tableHTML;
}
// 顯示排班表
function displaySchedule(schedule, year, month) {
    const scheduleTable = document.getElementById('scheduleTable');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    
    let tableHTML = `
        <table class="schedule-table">
            <thead>
                <tr>
                    <th>日期</th>
                    <th>星期</th>
                    <th>白班</th>
                    <th>小夜</th>
                    <th>大夜</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const weekday = weekdays[date.getDay()];
        
        tableHTML += `
            <tr>
                <td>${month}/${day}</td>
                <td>${weekday}</td>
                <td>${schedule[day][SHIFTS.DAY].join(', ')}</td>
                <td>${schedule[day][SHIFTS.EVENING].join(', ')}</td>
                <td>${schedule[day][SHIFTS.NIGHT].join(', ')}</td>
            </tr>
        `;
    }

    tableHTML += `
            </tbody>
        </table>
    `;

    scheduleTable.innerHTML = tableHTML;
}

// 顯示排班矩陣
function displayScheduleMatrix(schedule, year, month) {
    const scheduleMatrixDiv = document.getElementById('scheduleMatrix');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    
    let tableHTML = `
        <table class="schedule-matrix">
            <thead>
                <tr>
                    <th>人員 \\ 日期</th>
    `;
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const weekday = weekdays[date.getDay()];
        tableHTML += `<th>${month}/${day}<br>(${weekday})</th>`;
    }
    
    tableHTML += `
                </tr>
            </thead>
            <tbody>
    `;
    
    staffList.forEach(staff => {
        tableHTML += `
            <tr>
                <td>${staff.name}</td>
        `;
        
        for (let day = 1; day <= daysInMonth; day++) {
            let shiftForDay = '';
            if (schedule[day][SHIFTS.DAY].includes(staff.name)) {
                shiftForDay = '白';
            } else if (schedule[day][SHIFTS.EVENING].includes(staff.name)) {
                shiftForDay = '小';
            } else if (schedule[day][SHIFTS.NIGHT].includes(staff.name)) {
                shiftForDay = '大';
            }
            tableHTML += `<td>${shiftForDay}</td>`;
        }
        
        tableHTML += `
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    scheduleMatrixDiv.innerHTML = tableHTML;
}

// 事件監聽器設置
document.addEventListener('DOMContentLoaded', function() {
    let generateBtn = document.getElementById('generateScheduleBtn');
    generateBtn.addEventListener('click', generateSchedule);
});