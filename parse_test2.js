const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('/Users/hoctap/Desktop/naem/naem-scraper-api/schedule.html', 'utf8');

function parseSchedule(html) {
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
            const rawContent = $(cell).html();
            if(!rawContent) return;
            
            // Text might have <br>
            const content = $(cell).text().trim().replace(/\s+/g, ' ');
            if (content && content.length > 5) {
                let subjectName = content.split('Tiết học:')[0].trim();
                let tietHoc = (content.match(/Tiết học:\s*(.*?)(?=\s*Mã lớp:|$)/) || [])[1] || '';
                let giangVien = (content.match(/GV:\s*(.*?)(?=\s*Phòng:|$)/) || [])[1] || '';
                let phong = (content.match(/Phòng:\s*(.*?)(?=\s*Hình thức học:|$)/) || [])[1] || '';

                const thuDate = days[j - 1] || `Thứ ${j + 1}`;

                schedule.push([
                    thuDate,
                    buoi,
                    tietHoc,
                    '',
                    subjectName,
                    '',
                    '',
                    giangVien,
                    phong
                ]);
            }
        });
    });
    
    return schedule;
}

console.log(parseSchedule(html));
