const NaemScraper = require('./Scraper');

async function test() {
    const scraper = new NaemScraper();
    await scraper.login('2614802010096', 'HinataLoli08::3@');
    const { hiddenFields } = await scraper.getWeeks();
    const res = await scraper.client.post('/wfrmLichHocSinhVienTinChi.aspx', new URLSearchParams({
        ...hiddenFields,
        __EVENTTARGET: 'cmbTuan_thu',
        __EVENTARGUMENT: '',
        cmbTuan_thu: '09/07/2026-09/13/2026'
    }).toString());
    
    const fs = require('fs');
    fs.writeFileSync('/Users/hoctap/Desktop/naem/naem-scraper-api/schedule.html', res.data);
    
    const cheerio = require('cheerio');
    const $ = cheerio.load(res.data);
    const table = $('#grdViewLopDangKy');
    if (!table.length) {
        console.log('No table');
    } else {
        table.find('tr').each((i, row) => {
            const cells = $(row).find('th, td');
            const data = cells.map((j, c) => $(c).text().trim().replace(/\s+/g, ' ')).get();
            console.log('Row ' + i + ':', data);
        });
    }
}
test().catch(console.error);
