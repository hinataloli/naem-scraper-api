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
        const $ = cheerio.load(html);
        const schedule = [];
        
        const table = $('#grdViewLopDangKy');
        if (!table.length) return [];

        let days = [];
        table.find('tr').each((i, row) => {
            if (i === 0) {
                $(row).find('th, td').each((j, cell) => {
                    if (j > 0) days.push($(cell).text().trim());
                });
                return;
            }

            const cells = $(row).find('th, td');
            let buoi = '';
            cells.each((j, cell) => {
                if (j === 0) {
                    buoi = $(cell).text().trim();
                    return;
                }
                
                const content = $(cell).text().trim().replace(/\s+/g, ' ');
                if (content && content.length > 5) {
                    let subjectName = content.split('Tiết học:')[0].trim();
                    let tietHoc = (content.match(/Tiết học:\s*(.*?)(?=\s*Mã lớp:|$)/) || [])[1] || '';
                    let giangVien = (content.match(/GV:\s*(.*?)(?=\s*Phòng:|$)/) || [])[1] || '';
                    let phong = (content.match(/Phòng:\s*(.*?)(?=\s*Hình thức học:|$)/) || [])[1] || '';

                    const thuDate = days[j - 1] || `Thứ ${j + 1}`;

                    schedule.push([
                        thuDate,       // row[0]
                        buoi,          // row[1]
                        tietHoc,       // row[2]
                        '',            // row[3]
                        subjectName,   // row[4]
                        '',            // row[5]
                        '',            // row[6]
                        giangVien,     // row[7]
                        phong          // row[8]
                    ]);
                }
            });
        });
        
        return schedule;
    }
}

module.exports = NaemScraper;
