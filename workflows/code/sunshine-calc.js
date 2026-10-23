// 日照分析代码节点（JavaScript）
// 所属工作流：workflow_sunshine（经纬上的好好住）
// 输入变量：location, floor, building_gap, south_build_height, orientation
// 输出：包含日照计算各项指标的对象（全英文字段名，解决 ret: null 问题）

async function main({ params }) {
    // 1. 解析入参（带默认值防崩溃）
    const location = params.location || '';
    const floor = Number(params.floor) || 1;
    const building_gap = Number(params.building_gap) || 0;
    const south_build_height = Number(params.south_build_height) || 0;
    const orientation = params.orientation || '南';

    // 2. 解析经纬度（高德返回 "经度,纬度"）
    let phi = 30.0; // 默认北纬30°
    try {
        const parts = location.split(',');
        if (parts.length === 2) {
            const lng = parseFloat(parts[0].trim());
            const lat = parseFloat(parts[1].trim());
            if (!isNaN(lat) && lat >= -90 && lat <= 90) {
                phi = lat;
            } else if (!isNaN(lng) && lng >= -90 && lng <= 90) {
                phi = lng;
            }
        }
    } catch (e) {}

    // 3. 太阳高度角计算（冬至 / 夏至）
    const deltaWinter = -23.44;
    const deltaSummer = 23.44;

    const hWinter = 90 - Math.abs(phi - deltaWinter);
    const hSummer = 90 - Math.abs(phi - deltaSummer);

    const tanHWinter = Math.tan(hWinter * Math.PI / 180);
    const tanHSummer = Math.tan(hSummer * Math.PI / 180);

    // 4. 遮挡判定
    let ratio = 0;
    let isWinterBlocked = false;
    let isSummerBlocked = false;
    if (south_build_height > 0 && building_gap > 0) {
        ratio = south_build_height / building_gap;
        isWinterBlocked = ratio > tanHWinter;
        isSummerBlocked = ratio > tanHSummer;
    }

    // 5. 日照时长估算（冬至/夏至）
    let winterHours, summerHours;
    if (isWinterBlocked) {
        winterHours = 1.0 + (floor / 30) * 2.0;
    } else {
        winterHours = 4.0 + (floor / 30) * 2.0;
    }
    winterHours = Math.round(winterHours * 10) / 10;

    if (isSummerBlocked && floor < 5) {
        summerHours = 3.0 + (floor / 30) * 2.0;
    } else {
        summerHours = 6.0 + (floor / 30) * 1.0;
    }
    summerHours = Math.round(summerHours * 10) / 10;

    // 6. 采光星级
    let starLevel;
    if (winterHours >= 5) {
        starLevel = '⭐⭐⭐⭐⭐';
    } else if (winterHours >= 3) {
        starLevel = '⭐⭐⭐⭐';
    } else {
        starLevel = '⭐⭐⭐';
    }

    // 7. 西晒强度（0-100）
    let westScore = 10;
    if (['西', '西南', '西北'].includes(orientation)) {
        westScore = 80;
    } else if (['南', '东南'].includes(orientation)) {
        westScore = 20;
    } else if (['东', '东北'].includes(orientation)) {
        westScore = 40;
    }

    // ============================================================
    // 8. 构造返回对象（全部用英文变量名，解决 ret: null 问题）
    // ============================================================
    return {
        // 每个变量单独输出，下游用 {{节点名.变量名}} 引用
        latitude: Math.round(phi * 10000) / 10000,
        winter_altitude: Math.round(hWinter * 10) / 10,
        summer_altitude: Math.round(hSummer * 10) / 10,
        tan_winter: Math.round(tanHWinter * 1000) / 1000,
        blocking_ratio: Math.round(ratio * 100) / 100,
        is_blocked: isWinterBlocked,
        winter_hours: winterHours,
        summer_hours: Math.round((6.0 + (floor / 30) * 1.0) * 10) / 10,
        star_level: starLevel,
        west_score: westScore,
        orientation: orientation,
        floor: floor
    };
}
