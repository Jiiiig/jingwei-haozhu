// 通勤路线静态地图生成代码节点（JavaScript）
// 所属工作流：workflow_commute（经纬上的好好住）
// 输入变量：origin（房源经纬度）、destination（通勤目的地经纬度），均来自 poi_to_geocode 地理编码
// 输出：map_image_url（静态地图链接）、map_markdown（Markdown 图片语法）
//
// ⚠️ 安全提示：原代码中高德 Key 为明文，开源版本已替换为 YOUR_AMAP_KEY 占位符。
// 使用时请替换为你自己的高德 Web 服务 Key（https://lbs.amap.com/ 申请）。

async function main({ params }) {
    const key = 'YOUR_AMAP_KEY';
    const origin = params.origin || '';
    const destination = params.destination || '';

    // 1. 调用高德驾车API，加上 show_fields=polyline 参数
    const routeUrl = `https://restapi.amap.com/v5/direction/driving?key=${key}&origin=${origin}&destination=${destination}&show_fields=polyline`;
    let routePoints = '';
    try {
        const response = await fetch(routeUrl);
        const data = await response.json();
        if (data.status === '1' && data.route && data.route.paths && data.route.paths.length > 0) {
            const steps = data.route.paths[0].steps;
            const allPoints = [];
            for (const step of steps) {
                if (step.polyline) {
                    const points = step.polyline.split(';');
                    allPoints.push(...points);
                }
            }
            routePoints = allPoints.join(';');

            // 抽稀：如果坐标点太多，每隔3个取1个，防止URL过长
            if (routePoints.length > 3500) {
                const arr = routePoints.split(';');
                const simplified = [];
                for (let i = 0; i < arr.length; i += 3) {
                    simplified.push(arr[i]);
                }
                // 确保终点被包含
                if (simplified[simplified.length - 1] !== arr[arr.length - 1]) {
                    simplified.push(arr[arr.length - 1]);
                }
                routePoints = simplified.join(';');
            }
        }
    } catch (e) {
        // 失败降级
    }

    // 2. 降级：如果没拿到路线，用起终点画直线
    if (!routePoints) {
        const [oLng, oLat] = origin.split(',');
        const [dLng, dLat] = destination.split(',');
        routePoints = `${oLng},${oLat};${dLng},${dLat}`;
    }

    // 3. 提取起终点坐标用于标记
    const [oLng, oLat] = origin.split(',');
    const [dLng, dLat] = destination.split(',');

    // 4. 拼接静态地图URL
    const mapUrl = `https://restapi.amap.com/v3/staticmap?size=750*400`
        + `&paths=5,0x0000FF,1.0,,:${routePoints}`
        + `&markers=mid,0xFF0000,A:${oLng},${oLat}`
        + `&markers=mid,0x00FF00,B:${dLng},${dLat}`
        + `&key=${key}`;

    return {
        map_image_url: mapUrl,
        map_markdown: `![通勤路线图](${mapUrl})`
    };
}
