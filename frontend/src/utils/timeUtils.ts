import { useState, useEffect } from 'react';

// Global state for time offset
let timeOffset = 0;
let isSynced = false;
let syncPromise: Promise<void> | null = null;

/**
 * Lấy thời gian hiện tại đã đồng bộ với Internet (WorldTimeAPI).
 * Nếu chưa đồng bộ được, nó sẽ trả về local time của máy tính.
 */
export const getSyncedTime = (): Date => {
    return new Date(Date.now() + timeOffset);
};

export const syncInternetTime = async () => {
    if (isSynced) return;
    if (syncPromise) return syncPromise;

    syncPromise = (async () => {
        try {
            const start = Date.now();
            const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Ho_Chi_Minh');

            if (!res.ok) throw new Error('Failed to fetch from WorldTimeAPI');

            const data = await res.json();

            // Expected format: "2026-02-27T14:47:07.123+07:00"
            const internetTime = new Date(data.datetime).getTime();
            const end = Date.now();

            // Tính toán Round Trip Time (RTT) để bù trừ độ trễ mạng
            const rtt = end - start;

            // Cập nhật lại Offset giữa giờ máy tính và giờ Internet
            timeOffset = (internetTime + rtt / 2) - end;
            isSynced = true;
            console.log('Đã đồng bộ thời gian Internet thành công (Asia/Ho_Chi_Minh). Offset:', timeOffset, 'ms');
        } catch (error) {
            console.warn('Không thể đồng bộ giờ Internet. Đang sử dụng giờ local của máy tính.', error);
        } finally {
            syncPromise = null;
        }
    })();

    return syncPromise;
};

/**
 * Custom hook tự động đồng bộ giờ Internet và trả về thời gian siêu chính xác (chạy theo từng giây).
 */
export const useSyncedTime = () => {
    const [time, setTime] = useState<Date>(getSyncedTime());
    const [synced, setSynced] = useState(isSynced);

    useEffect(() => {
        if (!isSynced) {
            syncInternetTime().then(() => {
                setSynced(true);
                setTime(getSyncedTime());
            });
        }

        // Tạo vòng lặp cập nhật mỗi giây
        const updateTick = () => setTime(getSyncedTime());

        // Canh chuẩn vào mỗi đầu giây
        const now = getSyncedTime();
        const msUntilNextSecond = 1000 - now.getMilliseconds();

        let interval: NodeJS.Timeout;
        const timeout = setTimeout(() => {
            updateTick();
            interval = setInterval(updateTick, 1000);
        }, msUntilNextSecond);

        return () => {
            clearTimeout(timeout);
            if (interval) clearInterval(interval);
        };
    }, []);

    return { time, isSynced: synced };
};

/**
 * Hàm hỗ trợ an toàn để parse chuỗi thời gian, đảm bảo chuỗi ngày tháng từ DB (thiếu múi giờ)
 * mặc định được hiểu là UTC. Giải quyết tình trạng lệch timezone 7 tiếng trên frontend.
 * @param dateStr Chuỗi ngày tháng (VD: "2026-02-27T08:51:24")
 * @returns Đối tượng Date đã chuẩn hóa UTC
 */
export const parseSafeDate = (dateStr?: string | null): Date => {
    if (!dateStr) return new Date();

    // Nếu chuỗi đã có định dạng múi giờ ('Z', '+07:00'), dùng trực tiếp
    if (dateStr.endsWith('Z') || dateStr.match(/[+\-]\d{2}:\d{2}$/)) {
        return new Date(dateStr);
    }

    // Nếu chuỗi không có múi giờ, ép buộc nó là UTC theo thiết kế của backend
    return new Date(dateStr + 'Z');
};
