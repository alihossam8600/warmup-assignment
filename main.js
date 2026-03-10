const fs = require("fs");

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime){

    function toSec(t){
        let [h,m,s,p] = t.match(/(\d+):(\d+):(\d+)\s*(am|pm)/i).slice(1);
        h = +h;
        if(p==="pm" && h!=12) h+=12;
        if(p==="am" && h==12) h=0;
        return h*3600 + m*60 + +s;
    }

    let start = toSec(startTime);
    let end = toSec(endTime);
    if(end < start) end += 86400;

    let sec = end-start;
    let h=Math.floor(sec/3600);
    let m=Math.floor(sec%3600/60);
    let s=sec%60;

    return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    // Parse time strings to total seconds
    function parseTime(timeStr) {
        const parts = timeStr.match(/(\d+):(\d+):(\d+)\s*(am|pm)/i);
        let hours = parseInt(parts[1]);
        const minutes = parseInt(parts[2]);
        const seconds = parseInt(parts[3]);
        const period = parts[4].toLowerCase();
        
        // Convert to 24-hour format
        if (period === 'pm' && hours !== 12) {
            hours += 12;
        } else if (period === 'am' && hours === 12) {
            hours = 0;
        }
        
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    let startSeconds = parseTime(startTime);
    let endSeconds = parseTime(endTime);
    
    // Handle case where end time is next day
    if (endSeconds < startSeconds) {
        endSeconds += 24 * 3600;
    }
    
    // Delivery hours: 8:00 AM (8*3600) to 10:00 PM (22*3600)
    const deliveryStart = 8 * 3600;
    const deliveryEnd = 22 * 3600;
    
    let idleSeconds = 0;
    
    // Idle time before 8:00 AM
    if (startSeconds < deliveryStart) {
        const idleBeforeEnd = Math.min(endSeconds, deliveryStart);
        idleSeconds += idleBeforeEnd - startSeconds;
    }
    
    // Idle time after 10:00 PM
    if (endSeconds > deliveryEnd) {
        const idleAfterStart = Math.max(startSeconds, deliveryEnd);
        idleSeconds += endSeconds - idleAfterStart;
    }
    
    const hours = Math.floor(idleSeconds / 3600);
    const minutes = Math.floor((idleSeconds % 3600) / 60);
    const seconds = idleSeconds % 60;
    
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    // Parse time string to seconds
    function parseTimeToSeconds(timeStr) {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseInt(parts[2]);
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    const shiftSeconds = parseTimeToSeconds(shiftDuration);
    const idleSeconds = parseTimeToSeconds(idleTime);
    
    const activeSeconds = shiftSeconds - idleSeconds;
    
    const hours = Math.floor(activeSeconds / 3600);
    const minutes = Math.floor((activeSeconds % 3600) / 60);
    const seconds = activeSeconds % 60;
    
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    // Parse time string to seconds
    function parseTimeToSeconds(timeStr) {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseInt(parts[2]);
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    const activeSeconds = parseTimeToSeconds(activeTime);
    
    // Check if date is in Eid period (Apr 10-30, 2025)
    const dateParts = date.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);
    
    let quotaSeconds;
    
    if (year === 2025 && month === 4 && day >= 10 && day <= 30) {
        // Eid period: 6 hours
        quotaSeconds = 6 * 3600;
    } else {
        // Normal day: 8 hours 24 minutes
        quotaSeconds = 8 * 3600 + 24 * 60;
    }
    
    return activeSeconds >= quotaSeconds;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    // Read existing file
    let fileContent = '';
    try {
        fileContent = fs.readFileSync(textFile, { encoding: 'utf8' });
    } catch (err) {
        // File doesn't exist, create empty content
        fileContent = '';
    }
    
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    
    // Check for duplicate (same driverID and date)
    for (let line of lines) {
        const parts = line.split(',');
        if (parts[0] === shiftObj.driverID && parts[2] === shiftObj.date) {
            return {};
        }
    }
    
    // Calculate all fields
    const shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    const idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    const activeTime = getActiveTime(shiftDuration, idleTime);
    const quotaMet = metQuota(shiftObj.date, activeTime);
    const hasBonus = false;
    
    // Create new record object
    const newRecord = {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: quotaMet,
        hasBonus: hasBonus
    };
    
    // Create new line
    const newLine = `${newRecord.driverID},${newRecord.driverName},${newRecord.date},${newRecord.startTime},${newRecord.endTime},${newRecord.shiftDuration},${newRecord.idleTime},${newRecord.activeTime},${newRecord.metQuota},${newRecord.hasBonus}`;
    
    // Find where to insert
    let insertIndex = -1;
    let lastDriverIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts[0] === shiftObj.driverID) {
            lastDriverIndex = i;
        }
    }
    
    if (lastDriverIndex !== -1) {
        // Insert after last record of same driver
        insertIndex = lastDriverIndex + 1;
    } else {
        // Append at end
        insertIndex = lines.length;
    }
    
    // Insert the new line
    lines.splice(insertIndex, 0, newLine);
    
    // Write back to file
    fs.writeFileSync(textFile, lines.join('\n') + '\n', { encoding: 'utf8' });
    
    return newRecord;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    const fileContent = fs.readFileSync(textFile, { encoding: 'utf8' });
    const lines = fileContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        const parts = lines[i].split(',');
        if (parts[0] === driverID && parts[2] === date) {
            // Update hasBonus (index 9)
            parts[9] = String(newValue);
            lines[i] = parts.join(',');
            break;
        }
    }
    
    fs.writeFileSync(textFile, lines.join('\n'), { encoding: 'utf8' });
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {

    const fileContent = fs.readFileSync(textFile, "utf8");
    const lines = fileContent.split("\n");

    const normalizedMonth = month.padStart(2, "0");

    let driverExists = false;
    let bonusCount = 0;

    // skip header row
    for (let i = 1; i < lines.length; i++) {

        if (lines[i].trim() === "") continue;

        const parts = lines[i].split(",");

        const lineDriverID = parts[0].trim();
        const lineDate = parts[2].trim();
        const lineMonth = lineDate.split("-")[1];

        const hasBonus = parts[9].trim() === "true";

        if (lineDriverID === driverID) {

            driverExists = true;

            if (lineMonth === normalizedMonth && hasBonus) {
                bonusCount++;
            }
        }
    }

    if (!driverExists) return -1;

    return bonusCount;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    const fileContent = fs.readFileSync(textFile, { encoding: 'utf8' });
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    
    // Normalize month to 2 digits
    const normalizedMonth = String(month).padStart(2, '0');
    
    // Parse time string to seconds
    function parseTimeToSeconds(timeStr) {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseInt(parts[2]);
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    let totalSeconds = 0;
    
    for (let line of lines) {
        const parts = line.split(',');
        const lineDriverID = parts[0];
        const lineDate = parts[2];
        const activeTime = parts[7];
        
        if (lineDriverID === driverID) {
            const lineMonth = lineDate.split('-')[1];
            
            if (lineMonth === normalizedMonth) {
                totalSeconds += parseTimeToSeconds(activeTime);
            }
        }
    }
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    // Read driver's day off from rateFile
    const rateContent = fs.readFileSync(rateFile, { encoding: 'utf8' });
    const rateLines = rateContent.split('\n').filter(line => line.trim() !== '');
    
    let dayOff = '';
    for (let line of rateLines) {
        const parts = line.split(',');
        if (parts[0] === driverID) {
            dayOff = parts[1];
            break;
        }
    }
    
    // Read shifts to find working days
    const shiftContent = fs.readFileSync(textFile, { encoding: 'utf8' });
    const shiftLines = shiftContent.split('\n').filter(line => line.trim() !== '');
    
    const normalizedMonth = String(month).padStart(2, '0');
    
    let totalRequiredSeconds = 0;
    
    for (let line of shiftLines) {
        const parts = line.split(',');
        const lineDriverID = parts[0];
        const lineDate = parts[2];
        
        if (lineDriverID === driverID) {
            const lineMonth = lineDate.split('-')[1];
            
            if (lineMonth === normalizedMonth) {
                // Get day of week
                const dateObj = new Date(lineDate);
                const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const dayName = daysOfWeek[dateObj.getDay()];
                
                // Skip if it's the driver's day off
                if (dayName === dayOff) {
                    continue;
                }
                
                // Check if date is in Eid period
                const dateParts = lineDate.split('-');
                const year = parseInt(dateParts[0]);
                const monthNum = parseInt(dateParts[1]);
                const day = parseInt(dateParts[2]);
                
                let dailyQuota;
                if (year === 2025 && monthNum === 4 && day >= 10 && day <= 30) {
                    // Eid period: 6 hours
                    dailyQuota = 6 * 3600;
                } else {
                    // Normal day: 8 hours 24 minutes
                    dailyQuota = 8 * 3600 + 24 * 60;
                }
                
                totalRequiredSeconds += dailyQuota;
            }
        }
    }
    
    // Reduce by 2 hours for each bonus
    totalRequiredSeconds -= bonusCount * 2 * 3600;
    
    // Ensure non-negative
    if (totalRequiredSeconds < 0) {
        totalRequiredSeconds = 0;
    }
    
    const hours = Math.floor(totalRequiredSeconds / 3600);
    const minutes = Math.floor((totalRequiredSeconds % 3600) / 60);
    const seconds = totalRequiredSeconds % 60;
    
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    // Parse time string to seconds
    function parseTimeToSeconds(timeStr) {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseInt(parts[2]);
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    const actualSeconds = parseTimeToSeconds(actualHours);
    const requiredSeconds = parseTimeToSeconds(requiredHours);
    
    // Read driver info from rateFile
    const rateContent = fs.readFileSync(rateFile, { encoding: 'utf8' });
    const rateLines = rateContent.split('\n').filter(line => line.trim() !== '');
    
    let basePay = 0;
    let tier = 0;
    
    for (let line of rateLines) {
        const parts = line.split(',');
        if (parts[0] === driverID) {
            basePay = parseInt(parts[2]);
            tier = parseInt(parts[3]);
            break;
        }
    }
    
    // If actual >= required, no deduction
    if (actualSeconds >= requiredSeconds) {
        return basePay;
    }
    
    // Calculate missing hours
    const missingSeconds = requiredSeconds - actualSeconds;
    
    // Tier allowances (in hours)
    const allowances = {
        1: 50,
        2: 20,
        3: 10,
        4: 3
    };
    
    const allowedMissingHours = allowances[tier] || 0;
    const allowedMissingSeconds = allowedMissingHours * 3600;
    
    // Calculate billable missing hours (only full hours count)
    let billableMissingSeconds = missingSeconds - allowedMissingSeconds;
    
    if (billableMissingSeconds <= 0) {
        return basePay;
    }
    
    // Only count full hours
    const billableMissingHours = Math.floor(billableMissingSeconds / 3600);
    
    // Calculate deduction
    const deductionRatePerHour = Math.floor(basePay / 185);
    const salaryDeduction = billableMissingHours * deductionRatePerHour;
    
    const netPay = basePay - salaryDeduction;
    
    return netPay;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
