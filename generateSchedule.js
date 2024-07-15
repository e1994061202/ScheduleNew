// 全局變量
let dayShiftCount, eveningShiftCount, nightShiftCount;
let daysInMonth;
const POPULATION_SIZE = 50;
const MAX_GENERATIONS = 1000;  // 增加到 300
const CROSSOVER_RATE = 0.8;
const MUTATION_RATE = 0.02;  // 稍微增加變異率
const ELITISM_COUNT = 2;

function generateSchedule() {
    // 獲取用戶選擇的年份和月份
    const year = parseInt(document.getElementById("year").value);
    const month = parseInt(document.getElementById("month").value);
    daysInMonth = new Date(year, month, 0).getDate();
  
    // 獲取各班次所需人數
    dayShiftCount = parseInt(document.getElementById("dayShiftCount").value);
    eveningShiftCount = parseInt(document.getElementById("eveningShiftCount").value); 
    nightShiftCount = parseInt(document.getElementById("nightShiftCount").value);
  
    // 初始化種群
    let population = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
        population.push(createRandomSchedule());
    }
  
    // 運行遺傳算法
    let bestSchedule = null;
    let bestFitness = -Infinity;
  
    for (let generation = 0; generation < MAX_GENERATIONS; generation++) {
        console.log(`第 ${generation} 代`);
  
        // 評估種群中每個排班表的適應度
        let fitnessValues = population.map(evaluateScheduleFitness);
      
        // 檢查是否有新的最佳解  
        let bestIndex = fitnessValues.indexOf(Math.max(...fitnessValues));
        if (fitnessValues[bestIndex] > bestFitness) {
            bestSchedule = population[bestIndex];
            bestFitness = fitnessValues[bestIndex]; 
            console.log(`新的最佳適應度: ${bestFitness}`);
        }
  
        // 提前終止條件：如果找到幾乎完美的排班表，就提前結束
        if (bestFitness >= 24990) {  // 可根據需要調整此閾值
            console.log("找到完美排班表，提前終止。");
            break;
        }
  
        // 選擇父代進行繁殖
        let parents = selectParents(population, fitnessValues);
  
        // 創建新一代種群
        let newPopulation = [];
  
        // 精英策略：保留最佳解
        for (let i = 0; i < ELITISM_COUNT; i++) {
            if (bestSchedule) {
                newPopulation.push(bestSchedule);
            }
        }
  
        // 通過交叉和變異生成新的排班表
        while (newPopulation.length < POPULATION_SIZE) {
            if (Math.random() < CROSSOVER_RATE) {
                // 執行交叉操作
                let [parent1, parent2] = getParentsFromSelected(parents);
                let [child1, child2] = crossover(parent1, parent2);
                newPopulation.push(child1, child2);
            } else {
                // 執行變異操作
                let parent = getRandomFromSelected(parents);
                let child = mutate(parent);  
                newPopulation.push(child);
            }
        }
  
        // 用新一代取代舊一代
        population = newPopulation;
    }
  
    console.log('最佳排班表:', bestSchedule);
    console.log('最佳適應度:', bestFitness);
    
    // 顯示最終的排班結果
    displaySchedule(bestSchedule, year, month);
    displayStatistics(bestSchedule);
    displayScheduleMatrix(bestSchedule, year, month);
}
function createRandomSchedule() {
    let schedule = {};
    for (let day = 1; day <= daysInMonth; day++) {
        schedule[day] = {
            [SHIFTS.DAY]: [],
            [SHIFTS.EVENING]: [],
            [SHIFTS.NIGHT]: []
        };
    }

    staffList.forEach(staff => {
        // 調整預期排班數，考慮預休天數
        staff.expectedShiftDays = Math.floor((daysInMonth * (dayShiftCount + eveningShiftCount + nightShiftCount)) / staffList.length);
        staff.actualShiftDays = 0;
        staff.consecutiveWorkDays = staff.previousMonthSchedules ? staff.previousMonthSchedules.length : 0;
    });

    // 先安排預排班
    schedulePrescheduledShifts(schedule);

    // 依預休天數來分配剩餘的班次
    staffList.forEach(staff => {
        for (let day of staff.preVacationDates) {
            let remainingShifts = {
                [SHIFTS.DAY]: dayShiftCount - schedule[day][SHIFTS.DAY].length,
                [SHIFTS.EVENING]: eveningShiftCount - schedule[day][SHIFTS.EVENING].length,
                [SHIFTS.NIGHT]: nightShiftCount - schedule[day][SHIFTS.NIGHT].length
            };

            // 對預休天數進行排班
            let shifts = [staff.shift1, staff.shift2].filter(shift => shift !== "");
            shuffleArray(shifts);
            for (let shift of shifts) {
                if (remainingShifts[shift] > 0) {
                    schedule[day][shift].push(staff.name);
                    staff.actualShiftDays++;
                    remainingShifts[shift]--;
                    break;
                }
            }
        }
    });

    // 填補剩餘班次
    for (let day = 1; day <= daysInMonth; day++) {
        // 跳過已經安排了預休的日子
        if (staffList.some(staff => staff.preVacationDates.includes(day))) {
            continue;
        }

        let remainingShifts = {
            [SHIFTS.DAY]: dayShiftCount - schedule[day][SHIFTS.DAY].length,
            [SHIFTS.EVENING]: eveningShiftCount - schedule[day][SHIFTS.EVENING].length,
            [SHIFTS.NIGHT]: nightShiftCount - schedule[day][SHIFTS.NIGHT].length
        };

        let availableStaff = getAvailableStaff(day, schedule);
        // 優先考慮排班數較少的人員
        availableStaff.sort((a, b) => (a.actualShiftDays / a.expectedShiftDays) - (b.actualShiftDays / b.expectedShiftDays));

        availableStaff.forEach(staff => {
            let shifts = [staff.shift1, staff.shift2].filter(shift => shift !== "");
            shuffleArray(shifts);
            for (let shift of shifts) {
                if (remainingShifts[shift] > 0 && staff.actualShiftDays < staff.expectedShiftDays) {
                    if (isStaffAvailableForShift(staff, day, shift, schedule)) {
                        schedule[day][shift].push(staff.name);
                        staff.actualShiftDays++;
                        remainingShifts[shift]--;
                        staff.consecutiveWorkDays++;
                        break;
                    }
                }
            }
        });

        // 更新沒有排班的員工的連續工作天數
        staffList.forEach(staff => {
            if (!isStaffScheduledOnDay(schedule, staff.name, day)) {
                staff.consecutiveWorkDays = 0;
            }
        });
    }

    return schedule;
}
function evaluateScheduleFitness(schedule) {
    let fitness = 0;

    // 規則 1：所有班次都必須被填滿
    let allShiftsFilled = true;
    for (let day = 1; day <= daysInMonth; day++) {
        if (schedule[day][SHIFTS.DAY].length < dayShiftCount ||
            schedule[day][SHIFTS.EVENING].length < eveningShiftCount ||
            schedule[day][SHIFTS.NIGHT].length < nightShiftCount) {
            allShiftsFilled = false;
            fitness -= 1000;  // 對未填滿的班次給予嚴重懲罰
        }    
    }
    fitness += allShiftsFilled ? 10000 : 0;  // 如果所有班次都填滿，給予高獎勵

    // 規則 2：尊重預排班
    let prescheduledRespected = true;
    staffList.forEach(staff => {
        staff.prescheduledDates.forEach(preschedule => {
            let shiftStaff = schedule[preschedule.date][preschedule.shift];
            if (!shiftStaff.includes(staff.name)) {
                prescheduledRespected = false;
                fitness -= 500;  // 對不尊重預排班的情況給予嚴重懲罰
            }
        });  
    });
    fitness += prescheduledRespected ? 5000 : 0;  // 如果所有預排班都被尊重，給予高獎勵

    // 規則 3：實際排班數 >= 預期排班數（更精確的計算）
    let totalShiftDeficit = 0;
    staffList.forEach(staff => {
        const shiftDeficit = staff.expectedShiftDays - staff.actualShiftDays;
        if (shiftDeficit > 0) {
            totalShiftDeficit += shiftDeficit;
            fitness -= shiftDeficit * 100;  // 對每個缺少的班次給予懲罰
        }
    });
    fitness += totalShiftDeficit === 0 ? 10000 : 0;  // 如果沒有缺少的班次，給予高獎勵

    // 規則 4：尊重班次偏好
    let shiftPreferenceViolations = 0;
    staffList.forEach(staff => {
        let staffShifts = new Set([staff.shift1, staff.shift2]);
        for (let day = 1; day <= daysInMonth; day++) {
            for (let shift in SHIFTS) {
                if (schedule[day][shift].includes(staff.name) && !staffShifts.has(shift)) {
                    shiftPreferenceViolations++;
                }
            }
        }
    });
    fitness -= shiftPreferenceViolations * 50;  // 對每次違反班次偏好的情況給予懲罰

    // 規則 5：避免單日排班
    let singleDayShiftCount = 0;
    staffList.forEach(staff => {
        for (let day = 2; day < daysInMonth; day++) {
            if (!isStaffScheduledOnDay(schedule, staff.name, day - 1) &&
                isStaffScheduledOnDay(schedule, staff.name, day) &&
                !isStaffScheduledOnDay(schedule, staff.name, day + 1)) {
                singleDayShiftCount++;
            }
        }
    });
    fitness -= singleDayShiftCount * 20;  // 對每次單日排班的情況給予懲罰

    // 規則 6：避免連續工作超過 6 天
    let consecutiveShiftViolations = 0;
    staffList.forEach(staff => {
        if (staff.consecutiveWorkDays > 6) {
            consecutiveShiftViolations += staff.consecutiveWorkDays - 6;
        }
    });
    fitness -= consecutiveShiftViolations * 50;  // 對每次違反連續工作天數限制的情況給予懲罰

    return fitness;  // 返回最終的適應度分數
}

function selectParents(population, fitnessValues) {
    let parents = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
        let randomValue = Math.random() * fitnessValues.reduce((a, b) => a + b, 0);
        let sum = 0;
        for (let j = 0; j < POPULATION_SIZE; j++) {
            sum += fitnessValues[j];
            if (sum >= randomValue) {
                parents.push(population[j]);
                break;
            }
        }
    }
    return parents;
}

function getParentsFromSelected(selectedParents) {
    let parent1 = selectedParents[Math.floor(Math.random() * selectedParents.length)];
    let parent2 = selectedParents[Math.floor(Math.random() * selectedParents.length)];
    return [parent1, parent2];
}

function getRandomFromSelected(selectedParents) {
    return selectedParents[Math.floor(Math.random() * selectedParents.length)];
}

function crossover(parent1, parent2) {
    let child1 = JSON.parse(JSON.stringify(parent1)); 
    let child2 = JSON.parse(JSON.stringify(parent2));

    let crossoverPoint = Math.floor(Math.random() * daysInMonth) + 1;

    for (let day = crossoverPoint; day <= daysInMonth; day++) {
        [child1[day], child2[day]] = [child2[day], child1[day]];
    }

    return [child1, child2];
}

function mutate(schedule) {
    let mutatedSchedule = JSON.parse(JSON.stringify(schedule));

    for (let day = 1; day <= daysInMonth; day++) {
        for (let shift in SHIFTS) {
            if (Math.random() < MUTATION_RATE) {
                let staffToReplace = Math.floor(Math.random() * mutatedSchedule[day][shift].length);
                let replacementStaff = getStaffWithLeastShifts(day, shift, mutatedSchedule);
                if (replacementStaff && !mutatedSchedule[day][shift].includes(replacementStaff.name)) {
                    mutatedSchedule[day][shift][staffToReplace] = replacementStaff.name;
                }
            }
        }
    }

    return mutatedSchedule;
}


function createRandomSchedule() {
    let schedule = {};
    for (let day = 1; day <= daysInMonth; day++) {
        schedule[day] = {
            [SHIFTS.DAY]: [],  
            [SHIFTS.EVENING]: [],
            [SHIFTS.NIGHT]: [] 
        };
    }

    staffList.forEach(staff => {
    // 調整預期排班數，考慮預休天數
    staff.expectedShiftDays = Math.floor((daysInMonth * (dayShiftCount + eveningShiftCount + nightShiftCount)) / staffList.length);
    staff.actualShiftDays = 0;
    staff.consecutiveWorkDays = staff.previousMonthSchedules ? staff.previousMonthSchedules.length : 0;
    });

    // 先安排預排班
    schedulePrescheduledShifts(schedule);  

    // 填補剩餘班次  
    for (let day = 1; day <= daysInMonth; day++) {
        let remainingShifts = {
            [SHIFTS.DAY]: dayShiftCount - schedule[day][SHIFTS.DAY].length,
            [SHIFTS.EVENING]: eveningShiftCount - schedule[day][SHIFTS.EVENING].length,  
            [SHIFTS.NIGHT]: nightShiftCount - schedule[day][SHIFTS.NIGHT].length
        };

        let availableStaff = getAvailableStaff(day, schedule);
        // 優先考慮排班數較少的人員
        availableStaff.sort((a, b) => (a.actualShiftDays / a.expectedShiftDays) - (b.actualShiftDays / b.expectedShiftDays));

        availableStaff.forEach(staff => {
            let shifts = [staff.shift1, staff.shift2].filter(shift => shift !== "");
            shuffleArray(shifts);
            for (let shift of shifts) {
                if (remainingShifts[shift] > 0 && staff.actualShiftDays < staff.expectedShiftDays) {
                    if (isStaffAvailableForShift(staff, day, shift, schedule)) {
                        schedule[day][shift].push(staff.name);
                        staff.actualShiftDays++;
                        remainingShifts[shift]--;
                        staff.consecutiveWorkDays++;
                        break;  
                    }
                }
            }
        });

        // 更新沒有排班的員工的連續工作天數
        staffList.forEach(staff => {
            if (!isStaffScheduledOnDay(schedule, staff.name, day)) {
                staff.consecutiveWorkDays = 0;
            }
        });
    }

    // 輸出排班結果
    console.log('排班結果:');
    staffList.forEach(staff => {
        let prescheduledDates = staff.prescheduledDates.map(item => `${item.date}日(${SHIFT_DISPLAY[item.shift]})`).join(', ');
        let preVacationDates = staff.preVacationDates.map(date => `${date}日`).join(', ');
        let dailySchedule = [];
        for (let day = 1; day <= daysInMonth; day++) {
            let shift = getStaffShiftOnDay(schedule, staff.name, day);
            if (shift) {
                dailySchedule.push(`${day}日(${SHIFT_DISPLAY[shift]})`);
            }
        }
        let totalShifts = staff.actualShiftDays;
        console.log(`${staff.name}
預排班日期: ${prescheduledDates}
預休日期: ${preVacationDates}
排班情況: ${dailySchedule.join(', ')}
總班次: ${totalShifts}`);
    });

    return schedule;
}

function evaluateScheduleFitness(schedule) {
    let fitness = 0;

    // 規則 1：所有班次都必須被填滿
    let allShiftsFilled = true;
    for (let day = 1; day <= daysInMonth; day++) {
        if (schedule[day][SHIFTS.DAY].length < dayShiftCount ||
            schedule[day][SHIFTS.EVENING].length < eveningShiftCount ||
            schedule[day][SHIFTS.NIGHT].length < nightShiftCount) {
            allShiftsFilled = false;
            fitness -= 1000;  // 對未填滿的班次給予嚴重懲罰
        }    
    }
    fitness += allShiftsFilled ? 10000 : 0;  // 如果所有班次都填滿，給予高獎勵

    // 規則 2：尊重預排班
    let prescheduledRespected = true;
    staffList.forEach(staff => {
        staff.prescheduledDates.forEach(preschedule => {
            let shiftStaff = schedule[preschedule.date][preschedule.shift];
            if (!shiftStaff.includes(staff.name)) {
                prescheduledRespected = false;
                fitness -= 500;  // 對不尊重預排班的情況給予嚴重懲罰
            }
        });  
    });
    fitness += prescheduledRespected ? 5000 : 0;  // 如果所有預排班都被尊重，給予高獎勵

    // 規則 3：實際排班數 >= 預期排班數（更精確的計算）
    let totalShiftDeficit = 0;
    staffList.forEach(staff => {
        const shiftDeficit = staff.expectedShiftDays - staff.actualShiftDays;
        if (shiftDeficit > 0) {
            totalShiftDeficit += shiftDeficit;
            fitness -= shiftDeficit * 100;  // 對每個缺少的班次給予懲罰
        }
    });
    fitness += totalShiftDeficit === 0 ? 10000 : 0;  // 如果沒有缺少的班次，給予高獎勵

    // 規則 4：尊重班次偏好
    let shiftPreferenceViolations = 0;
    staffList.forEach(staff => {
        let staffShifts = new Set([staff.shift1, staff.shift2]);
        for (let day = 1; day <= daysInMonth; day++) {
            for (let shift in SHIFTS) {
                if (schedule[day][shift].includes(staff.name) && !staffShifts.has(shift)) {
                    shiftPreferenceViolations++;
                }
            }
        }
    });
    fitness -= shiftPreferenceViolations * 50;  // 對每次違反班次偏好的情況給予懲罰

    // 規則 5：避免單日排班
    let singleDayShiftCount = 0;
    staffList.forEach(staff => {
        for (let day = 2; day < daysInMonth; day++) {
            if (!isStaffScheduledOnDay(schedule, staff.name, day - 1) &&
                isStaffScheduledOnDay(schedule, staff.name, day) &&
                !isStaffScheduledOnDay(schedule, staff.name, day + 1)) {
                singleDayShiftCount++;
            }
        }
    });
    fitness -= singleDayShiftCount * 20;  // 對每次單日排班的情況給予懲罰

    // 規則 6：避免連續工作超過 6 天
    let consecutiveShiftViolations = 0;
    staffList.forEach(staff => {
        if (staff.consecutiveWorkDays > 6) {
            consecutiveShiftViolations += staff.consecutiveWorkDays - 6;
        }
    });
    fitness -= consecutiveShiftViolations * 50;  // 對每次違反連續工作天數限制的情況給予懲罰

    return fitness;  // 返回最終的適應度分數
}

function mutate(schedule) {
    let mutatedSchedule = JSON.parse(JSON.stringify(schedule));

    for (let day = 1; day <= daysInMonth; day++) {
        if (Math.random() < MUTATION_RATE) {
            let shift = getRandomShift();
            let staffToReplace = Math.floor(Math.random() * mutatedSchedule[day][shift].length);
            
            // 優先選擇排班數較少的人員進行替換
            let replacementStaff = getRandomAvailableStaffWithLeastShifts(day, shift, mutatedSchedule);
            if (replacementStaff) {
                mutatedSchedule[day][shift][staffToReplace] = replacementStaff.name;
            }
        }  
    }

    return mutatedSchedule;
}

function getRandomAvailableStaffWithLeastShifts(day, shift, schedule) {
    let availableStaff = getAvailableStaff(day, schedule);
    availableStaff = availableStaff.filter(staff => isStaffAvailableForShift(staff, day, shift, schedule));
    if (availableStaff.length > 0) {
        // 選擇實際排班數與預期排班數比例最小的人員
        return availableStaff.reduce((min, staff) => 
            (staff.actualShiftDays / staff.expectedShiftDays < min.actualShiftDays / min.expectedShiftDays) ? staff : min
        );
    }
    return null;
}

// ... (rest of the code remains the same)
function getRandomShift() {
    let shifts = [SHIFTS.DAY, SHIFTS.EVENING, SHIFTS.NIGHT];
    return shifts[Math.floor(Math.random() * shifts.length)];
}

function getRandomAvailableStaff(day, shift, schedule) {
    let availableStaff = getAvailableStaff(day, schedule);
    availableStaff = availableStaff.filter(staff => isStaffAvailableForShift(staff, day, shift, schedule));
    if (availableStaff.length > 0) {
        return availableStaff[Math.floor(Math.random() * availableStaff.length)];
    }
    return null;
}

function shuffleArray(array) {
    return array.sort(() => 0.5 - Math.random());
}

function isStaffAvailableForShift(staff, day, shift, schedule) {
    if (isStaffScheduledOnDay(schedule, staff.name, day)) {
        return false;
    }

    if (staff.preVacationDates.includes(day)) {
        return false;
    }

    if (shift !== staff.shift1 && shift !== staff.shift2) {
        return false;
    }

    // 檢查連續工作天數，包括上個月的情況
    if (staff.consecutiveWorkDays >= 6) {
        return false;
    }

    // 第一天的特殊處理
    if (day === 1) {
        if (staff.lastMonthLastDayShift) {
            // 確保第一天的班次與上月最後一天相同
            if (shift !== staff.lastMonthLastDayShift) {
                return false;
            }
            // 如果上個月最後六天已經連續工作了6天，第一天就不該再排班
            if (staff.previousMonthSchedules && staff.previousMonthSchedules.length >= 6) {
                return false;
            }
        }
    } else {
        let prevDay = day - 1;
        let prevDayShift = getStaffShiftOnDay(schedule, staff.name, prevDay);
        if ((prevDayShift === SHIFTS.EVENING && shift === SHIFTS.DAY) ||
            (prevDayShift === SHIFTS.NIGHT && (shift === SHIFTS.DAY || shift === SHIFTS.EVENING))) {
            return false;
        }
    }

    return true;
}

function getStaffWithLeastShifts(day, shift, schedule) {
    let availableStaff = getAvailableStaff(day, schedule);
    availableStaff = availableStaff.filter(staff => 
        (staff.shift1 === shift || staff.shift2 === shift) &&
        isStaffAvailableForShift(staff, day, shift, schedule)
    );
    
    if (availableStaff.length > 0) {
        return availableStaff.reduce((min, staff) => 
            (staff.actualShiftDays / staff.expectedShiftDays < min.actualShiftDays / min.expectedShiftDays) ? staff : min
        );
    }
    return null;
}
function isStaffScheduledOnDay(schedule, staffName, day) {
    return Object.values(schedule[day]).some(shift => shift.includes(staffName));
}

function getAvailableStaff(day, schedule) {
    return staffList.filter(staff =>
        !isStaffScheduledOnDay(schedule, staff.name, day) &&
        !staff.preVacationDates.includes(day)
    );
}

function schedulePrescheduledShifts(schedule) {
    staffList.forEach(staff => {
        staff.prescheduledDates.forEach(prescheduled => {
            let { date, shift } = prescheduled;
            if (!schedule[date][shift].includes(staff.name)) {
                schedule[date][shift].push(staff.name);
                staff.actualShiftDays++;
            }
        });
    });
}

function getStaffShiftOnDay(schedule, staffName, day) {
    for (let shift in schedule[day]) {
        if (schedule[day][shift].includes(staffName)) {
            return shift;
        }
    }
    return null;
}

function getShiftCount(shift) {
    switch(shift) {
        case SHIFTS.DAY: return dayShiftCount;
        case SHIFTS.EVENING: return eveningShiftCount;
        case SHIFTS.NIGHT: return nightShiftCount;
        default: return 0;
    }
}

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

function displayStatistics(schedule) {
    const statisticsTable = document.getElementById('statisticsTable');
    
    let tableHTML = `
        <table class="statistics-table">
            <thead>
                <tr>
                    <th>員工名稱</th>
                    <th>預期班數</th>
                    <th>實際班數</th>
                    <th>白班天數</th>
                    <th>小夜天數</th>
                    <th>大夜天數</th>
                </tr>
            </thead>
            <tbody>
    `;

    staffList.forEach(staff => {
        const expectedDays = staff.expectedShiftDays;
        let actualDays = 0;
        let dayShiftDays = 0;
        let eveningShiftDays = 0;
        let nightShiftDays = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            if (schedule[day][SHIFTS.DAY].includes(staff.name)) {
                dayShiftDays++;
                actualDays++;
            }
            if (schedule[day][SHIFTS.EVENING].includes(staff.name)) {
                eveningShiftDays++;
                actualDays++;
            }
            if (schedule[day][SHIFTS.NIGHT].includes(staff.name)) {
                nightShiftDays++;
                actualDays++;
            }
        }

        tableHTML += `
            <tr>
                <td>${staff.name}</td>
                <td>${expectedDays}</td>
                <td>${actualDays}</td>
                <td>${dayShiftDays}</td>
                <td>${eveningShiftDays}</td>
                <td>${nightShiftDays}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    statisticsTable.innerHTML = tableHTML;
}

function displayScheduleMatrix(schedule, year, month) {
    const scheduleMatrixDiv = document.getElementById('scheduleMatrix');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    
    let tableHTML = `
        <table class="schedule-matrix">
            <thead>
                <tr>
                    <th>人員 \ 日期</th>
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

document.addEventListener('DOMContentLoaded', function() {
    let generateBtn = document.getElementById('generateScheduleBtn');
    generateBtn.addEventListener('click', generateSchedule);
});