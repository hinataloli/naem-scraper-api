const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('/Users/hoctap/Desktop/naem/naem-scraper-api/schedule.html', 'utf8');
const $ = cheerio.load(html);
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
