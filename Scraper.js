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
                    let maLop = (content.match(/Mã lớp:\s*(.*?)(?=\s*GV:|$)/) || [])[1] || '';
                    let giangVien = (content.match(/GV:\s*(.*?)(?=\s*Phòng:|$)/) || [])[1] || '';
                    let phong = (content.match(/Phòng:\s*(.*?)(?=\s*Hình thức học:|$)/) || [])[1] || '';
                    let hinhThuc = (content.match(/Hình thức học:\s*(.*?)$/) || [])[1] || '';

                    const thuDate = days[j - 1] || `Thứ ${j + 1}`;

                    schedule.push([
                        thuDate,       // row[0]
                        buoi,          // row[1]
                        tietHoc,       // row[2]
                        maLop,         // row[3] (Mã lớp)
                        subjectName,   // row[4]
                        hinhThuc,      // row[5] (Hình thức học)
                        '',            // row[6]
                        giangVien,     // row[7]
                        phong          // row[8]
                    ]);
                }
            });
        });
        
        return schedule;
    }

    static async getAnnouncements(page = 1) {
        const url = `https://naem.edu.vn/vi/sinh-vien?page=${page}`;
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 10000
        });

        const $ = cheerio.load(res.data);
        const announcements = [];

        $('.module__fostering .fostering').each((i, el) => {
            const titleEl = $(el).find('.fostering__title a');
            const title = titleEl.text().trim();
            const link = titleEl.attr('href') || '';
            const thumb = $(el).find('.frame img').attr('src') || '';
            const desc = $(el).find('.fostering__desc p').text().trim();

            const day = $(el).find('.new__post-date .date__item span').eq(0).text().trim();
            const month = $(el).find('.new__post-date .date__item span').eq(1).text().trim();
            const yearShort = $(el).find('.new__post-date .date__item').eq(1).text().trim();
            const date = (day && month) ? `${day.padStart(2, '0')}/${month.padStart(2, '0')}/20${yearShort || '26'}` : '';

            if (title) {
                announcements.push({
                    title,
                    link: link.startsWith('http') ? link : `https://naem.edu.vn${link}`,
                    thumbnail: thumb.startsWith('http') ? thumb : `https://naem.edu.vn${thumb}`,
                    description: desc,
                    date
                });
            }
        });

        const pages = [];
        $('.pagination ul li').each((i, el) => {
            const pageNum = parseInt($(el).text().trim());
            if (!isNaN(pageNum)) pages.push(pageNum);
        });
        const maxPage = pages.length > 0 ? Math.max(...pages) : 1;

        return {
            page: parseInt(page),
            maxPage,
            announcements
        };
    }
}

module.exports = NaemScraper;
