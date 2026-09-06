const axios = require('axios');
const cheerio = require('cheerio');

class NaemScraper {
    constructor() {
        this.client = axios.create({
            baseURL: 'http://sinhvien.naem.edu.vn',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });
        this.cookies = [];
    }

    _extractHiddenFields($) {
        return {
            __VIEWSTATE: $('#__VIEWSTATE').val() || '',
            __VIEWSTATEGENERATOR: $('#__VIEWSTATEGENERATOR').val() || '',
            __EVENTVALIDATION: $('#__EVENTVALIDATION').val() || ''
        };
    }

    _updateCookies(response) {
        if (response.headers['set-cookie']) {
            response.headers['set-cookie'].forEach(cookieStr => {
                const cookie = cookieStr.split(';')[0];
                const cookieName = cookie.split('=')[0];
                this.cookies = this.cookies.filter(c => !c.startsWith(cookieName + '='));
                this.cookies.push(cookie);
            });
            this.client.defaults.headers['Cookie'] = this.cookies.join('; ');
        }
    }

    async login(username, password) {
        // Bước 1: GET Login.aspx
        const resGet = await this.client.get('/Login.aspx');
        this._updateCookies(resGet);
        const $get = cheerio.load(resGet.data);
        const hiddenFields = this._extractHiddenFields($get);

        // Bước 2: POST Login.aspx
        const payload = new URLSearchParams({
            ...hiddenFields,
            txtusername: username,
            txtpassword: password,
            btnDangNhap: 'Đăng nhập'
        });

        const resPost = await this.client.post('/Login.aspx', payload.toString());
        this._updateCookies(resPost);

        const isAuth = this.cookies.some(c => c.includes('.ASPXAUTH'));
        if (!isAuth) {
            throw new Error('Đăng nhập thất bại. Sai thông tin hoặc lỗi hệ thống NAEM.');
        }
        return this.cookies;
    }

    async getWeeks() {
        // Bước 3: GET Lịch học để lấy danh sách Tuần
        const res = await this.client.get('/wfrmLichHocSinhVienTinChi.aspx');
        this._updateCookies(res);
        const $ = cheerio.load(res.data);
        
        const weeks = [];
        $('select[name="cmbTuan_thu"] option').each((i, el) => {
            weeks.push({
                value: $(el).attr('value'),
                text: $(el).text().trim(),
                isCurrent: $(el).attr('selected') ? true : false
            });
        });

        const hiddenFields = this._extractHiddenFields($);
        return { weeks, hiddenFields };
    }

    async getScheduleForWeek(weekValue, hiddenFields) {
        // Gửi POST đổi tuần (hoặc GET mặc định nếu parse luôn HTML hiện tại)
        if (!weekValue || !hiddenFields) {
            const res = await this.client.get('/wfrmLichHocSinhVienTinChi.aspx');
            this._updateCookies(res);
            return this._parseSchedule(res.data);
        }

        const payload = new URLSearchParams({
            ...hiddenFields,
            __EVENTTARGET: 'cmbTuan_thu',
            __EVENTARGUMENT: '',
            cmbTuan_thu: weekValue
        });

        const res = await this.client.post('/wfrmLichHocSinhVienTinChi.aspx', payload.toString());
        this._updateCookies(res);
        return this._parseSchedule(res.data);
    }

    _parseSchedule(html) {
        // Bước 4: Parse bảng HTML thành JSON
        const $ = cheerio.load(html);
        const schedule = [];
        
        // Dựa vào HTML tiêu chuẩn của các trường dùng chung bộ code ASP.NET (EduSoft)
        const table = $('table[id*="grid"], table[class*="grid"]').first();
        if (!table.length) return [];

        table.find('tr').each((i, row) => {
            if (i === 0) return; // Bỏ qua Header
            
            const cells = $(row).find('td');
            if (cells.length < 5) return; 

            // Cấu trúc giả định: Thứ | Buổi | Tiết | Mã MH | Tên MH | Số TC | Lớp | Giảng viên | Phòng
            // (Thực tế bạn cần log mảng rowData ra để xem chính xác cột nào chứa dữ liệu nào trên web NAEM)
            const rowData = [];
            cells.each((j, cell) => {
                rowData.push($(cell).text().trim());
            });
            schedule.push(rowData);
        });
        
        return schedule;
    }
}

module.exports = NaemScraper;
