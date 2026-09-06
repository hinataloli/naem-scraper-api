const express = require('express');
const cors = require('cors');
const NaemScraper = require('./Scraper');

const app = express();
app.use(cors());
app.use(express.json());

// API 1: Đăng nhập và lấy danh sách Tuần
app.post('/api/auth/weeks', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Thiếu username hoặc password' });

    try {
        const scraper = new NaemScraper();
        await scraper.login(username, password);
        const { weeks, hiddenFields } = await scraper.getWeeks();
        
        res.json({
            success: true,
            message: 'Lấy dữ liệu thành công',
            data: {
                weeks,
                hiddenFields, // Trả về cho client để dùng ở API gọi lịch học
                cookies: scraper.cookies // Nếu bạn muốn client giữ cookie để tái sử dụng
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API 2: Lấy Lịch học theo Tuần
app.post('/api/schedule', async (req, res) => {
    const { username, password, weekValue, hiddenFields } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });

    try {
        const scraper = new NaemScraper();
        // Luôn đăng nhập lại để đảm bảo session sống (hoặc bạn có thể tối ưu bằng cách dùng cookie cũ)
        await scraper.login(username, password);
        
        // Nếu client có truyền hiddenFields cũ lên thì dùng, không thì tự lấy lại
        let currentHiddenFields = hiddenFields;
        if (!currentHiddenFields) {
            const data = await scraper.getWeeks();
            currentHiddenFields = data.hiddenFields;
        }

        const schedule = await scraper.getScheduleForWeek(weekValue, currentHiddenFields);
        
        res.json({
            success: true,
            data: schedule
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Naem Scraper API đang chạy tại http://localhost:${PORT}`);
});
