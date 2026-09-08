const express = require('express');
const cors = require('cors');
const NaemScraper = require('./Scraper');

const app = express();
app.use(cors());
app.use(express.json());

// API: Đăng nhập và xác minh lấy thông tin hồ sơ sinh viên
app.post('/api/student/profile', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'Thiếu mã sinh viên hoặc mật khẩu' });

    try {
        const scraper = new NaemScraper();
        await scraper.login(username, password);
        const profile = await scraper.getStudentProfile();
        
        res.json({
            success: true,
            message: 'Lấy thông tin sinh viên thành công',
            data: profile
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// API 1: Đăng nhập và lấy danh sách Tuần (kèm thông tin hồ sơ)
app.post('/api/auth/weeks', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Thiếu username hoặc password' });

    try {
        const scraper = new NaemScraper();
        await scraper.login(username, password);
        const { weeks, hiddenFields } = await scraper.getWeeks();
        let profile = null;
        try {
            profile = await scraper.getStudentProfile();
        } catch (e) {
            console.warn('Không lấy được profile kèm theo:', e.message);
        }
        
        res.json({
            success: true,
            message: 'Lấy dữ liệu thành công',
            data: {
                weeks,
                hiddenFields,
                profile,
                cookies: scraper.cookies
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

// API 3: Lấy Thông Báo từ website nhà trường (naem.edu.vn)
app.get('/api/announcements', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const category = req.query.category === 'dao-tao' ? 'dao-tao' : 'sinh-vien';
    try {
        const data = await NaemScraper.getAnnouncements(page, category);
        res.json({
            success: true,
            data
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Naem Scraper API đang chạy tại http://localhost:${PORT}`);
});
