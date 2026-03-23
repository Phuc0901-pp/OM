const fs = require('fs');
const path = require('path');

const cp1252 = {
    0x20AC: 0x80, // €
    0x201A: 0x82, // ‚
    0x0192: 0x83, // ƒ
    0x201E: 0x84, // „
    0x2026: 0x85, // …
    0x2020: 0x86, // †
    0x2021: 0x87, // ‡
    0x02C6: 0x88, // ˆ
    0x2030: 0x89, // ‰
    0x0160: 0x8A, // Š
    0x2039: 0x8B, // ‹
    0x0152: 0x8C, // Œ
    0x017D: 0x8E, // Ž
    0x2018: 0x91, // ‘
    0x2019: 0x92, // ’
    0x201C: 0x93, // “
    0x201D: 0x94, // ”
    0x2022: 0x95, // •
    0x2013: 0x96, // –
    0x2014: 0x97, // —
    0x02DC: 0x98, // ˜
    0x2122: 0x99, // ™
    0x0161: 0x9A, // š
    0x203A: 0x9B, // ›
    0x0153: 0x9C, // œ
    0x017E: 0x9E, // ž
    0x0178: 0x9F  // Ÿ
};

function charToWin1252(charCode) {
    if (charCode <= 0x7F) return charCode;
    if (charCode >= 0xA0 && charCode <= 0xFF) return charCode;
    if (cp1252[charCode] !== undefined) return cp1252[charCode];
    if (charCode === 0x81 || charCode === 0x8D || charCode === 0x8F || charCode === 0x90 || charCode === 0x9D)
        return charCode;
    return -1; // Unmappable
}

function repair(filePath) {
    let str = fs.readFileSync(filePath, 'utf8');

    if (str.includes('Ã')) {
        let buf = Buffer.alloc(str.length);
        let valid = true;
        for (let i = 0; i < str.length; i++) {
            let ch = str.charCodeAt(i);
            let byte = charToWin1252(ch);
            if (byte === -1) {
                // Ignore decoding error at this char, powershell may have replaced invalid bytes with '?'
                // Actually if there's '?', charCode is 63 which maps to 63.
                // If it's something else, fallback to 0x3F (?)
                buf[i] = 0x3F;
            } else {
                buf[i] = byte;
            }
        }

        let repaired = buf.toString('utf8');
        fs.writeFileSync(filePath, repaired, 'utf8');
        console.log("Repaired " + path.basename(filePath));
    }
}

const readDirRec = (dir, list) => {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            readDirRec(fullPath, list);
        } else {
            if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
                list.push(fullPath);
            }
        }
    });
};

let files = [];
readDirRec('C:\\Pham_Phuc\\UTE\\YEAR4\\HK2\\Do_an_tot_nghiep_2425\\Proj\\Code\\code\\OM\\frontend\\src', files);
files.forEach(repair);
