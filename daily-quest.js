// ==========================================
// 🤖 DAILY QUEST SYSTEM: TECH MASTER
// ==========================================

const DAILY_QUEST_CONFIG = {
    rewardMin: 100,
    rewardMax: 400,
    // เปลี่ยนลิงก์ตรงนี้ครับ
    mascotImg: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Ghost.png", 
};

// 📚 คลังคำถาม 100 ข้อ (Easy, Medium, Hard) ครบถ้วน!
const TECH_QUESTIONS = [
    // --- ระดับ EASY (ข้อ 1-35) ---
    { q: "AI ย่อมาจากอะไร?", options: ["Artificial Intelligence", "Auto Interface", "Alpha Index", "Apple Integration"], a: 0, level: "easy" },
    { q: "ข้อใดคือเบราว์เซอร์สำหรับท่องอินเทอร์เน็ต?", options: ["Excel", "Chrome", "Photoshop", "Windows"], a: 1, level: "easy" },
    { q: "RAM ทำหน้าที่อะไรในคอมพิวเตอร์?", options: ["เก็บข้อมูลถาวร", "ประมวลผลกราฟิก", "หน่วยความจำชั่วคราว", "ระบายความร้อน"], a: 2, level: "easy" },
    { q: "WWW ย่อมาจากอะไร?", options: ["World Wide Web", "West Web World", "Wide Word Web", "Win Web World"], a: 0, level: "easy" },
    { q: "ไฟล์นามสกุล .jpg คือไฟล์ประเภทใด?", options: ["เอกสาร", "เสียง", "วิดีโอ", "รูปภาพ"], a: 3, level: "easy" },
    { q: "CPU เปรียบเสมือนส่วนใดของร่างกาย?", options: ["หัวใจ", "สมอง", "มือ", "ดวงตา"], a: 1, level: "easy" },
    { q: "ถ้าต้องการพิมพ์รายงาน ควรใช้โปรแกรมใด?", options: ["Word", "PowerPoint", "Calculator", "Paint"], a: 0, level: "easy" },
    { q: "สัญลักษณ์ @ มักใช้ในเรื่องใด?", options: ["เกมออนไลน์", "ที่อยู่อีเมล", "การคำนวณ", "การตั้งค่าเครื่อง"], a: 1, level: "easy" },
    { q: "ข้อใดคืออุปกรณ์ Output (แสดงผล)?", options: ["เมาส์", "คีย์บอร์ด", "เครื่องพิมพ์", "สแกนเนอร์"], a: 2, level: "easy" },
    { q: "เราควรตั้งรหัสผ่านอย่างไรให้ปลอดภัย?", options: ["123456", "วันเกิดตัวเอง", "ชื่อเล่น", "ผสมตัวเลขและอักษร"], a: 3, level: "easy" },
    { q: "ปุ่ม Shortcut 'Ctrl + C' ใช้ทำอะไร?", options: ["ตัดข้อความ", "วางข้อความ", "คัดลอกข้อความ", "บันทึกข้อมูล"], a: 2, level: "easy" },
    { q: "ปุ่ม Shortcut 'Ctrl + V' ใช้ทำอะไร?", options: ["วางข้อความ", "ลบข้อความ", "เปิดไฟล์ใหม่", "พิมพ์เอกสาร"], a: 0, level: "easy" },
    { q: "ข้อใดคือระบบปฏิบัติการบนสมาร์ทโฟน?", options: ["Windows", "Linux", "iOS", "macOS"], a: 2, level: "easy" },
    { q: "อุปกรณ์ใดใช้สำหรับรับข้อมูลเสียงเข้าสู่คอมพิวเตอร์?", options: ["ลำโพง", "ไมโครโฟน", "หน้าจอ", "หูฟัง"], a: 1, level: "easy" },
    { q: "การรีบูต (Reboot) เครื่องหมายถึงอะไร?", options: ["ปิดเครื่องถาวร", "เริ่มระบบใหม่", "สแกนไวรัส", "ลบข้อมูลในเครื่อง"], a: 1, level: "easy" },
    { q: "ไฟล์นามสกุล .mp4 คือไฟล์อะไร?", options: ["รูปภาพ", "เอกสารสิ่งพิมพ์", "เสียงเพลง", "วิดีโอ"], a: 3, level: "easy" },
    { q: "ซอฟต์แวร์ใดใช้สำหรับนำเสนองาน?", options: ["PowerPoint", "Notepad", "Excel", "Access"], a: 0, level: "easy" },
    { q: "ข้อใดคืออีเมลของ Google?", options: ["Outlook", "Yahoo", "Gmail", "iCloud"], a: 2, level: "easy" },
    { q: "อุปกรณ์ใดที่ช่วยกระจายสัญญาณ Wi-Fi ในบ้าน?", options: ["Flash Drive", "Router", "VGA Card", "Monitor"], a: 1, level: "easy" },
    { q: "การกระทำใดเสี่ยงต่อการติดไวรัสคอมพิวเตอร์มากที่สุด?", options: ["พิมพ์งาน", "เปิดเว็บดูหนัง", "โหลดไฟล์ไม่ทราบแหล่งที่มา", "ฟังเพลงในเครื่อง"], a: 2, level: "easy" },
    { q: "ปุ่ม 'Enter' บนคีย์บอร์ดมีหน้าที่หลักคืออะไร?", options: ["ลบตัวอักษร", "ยืนยันคำสั่ง / ขึ้นบรรทัดใหม่", "เว้นวรรค", "เปลี่ยนภาษา"], a: 1, level: "easy" },
    { q: "1 Gigabyte (GB) เท่ากับกี่ Megabyte (MB) โดยประมาณ?", options: ["10 MB", "100 MB", "1000 MB", "10000 MB"], a: 2, level: "easy" },
    { q: "ฮาร์ดดิสก์ (Hard Disk) ทำหน้าที่อะไร?", options: ["ประมวลผล", "เก็บข้อมูลแบบถาวร", "แสดงภาพ", "รับคำสั่งจากผู้ใช้"], a: 1, level: "easy" },
    { q: "หากต้องการค้นหาข้อมูลในอินเทอร์เน็ต ควรใช้เว็บไซต์ใด?", options: ["Facebook", "Netflix", "Google", "Shopee"], a: 2, level: "easy" },
    { q: "แฟลชไดร์ฟ (Flash Drive) เชื่อมต่อกับคอมพิวเตอร์ผ่านพอร์ตใด?", options: ["HDMI", "USB", "LAN", "VGA"], a: 1, level: "easy" },
    { q: "ข้อใดเป็นภัยคุกคามทางไซเบอร์?", options: ["Anti-Virus", "Firewall", "Phishing", "Backup"], a: 2, level: "easy" },
    { q: "แอปพลิเคชันใดเน้นการอัปโหลดและดูวิดีโอสั้นเป็นหลัก?", options: ["YouTube", "TikTok", "LinkedIn", "Spotify"], a: 1, level: "easy" },
    { q: "หากลืมบันทึกงานแล้วไฟดับ ข้อมูลในส่วนใดจะหายไป?", options: ["ROM", "Hard Disk", "Flash Drive", "RAM"], a: 3, level: "easy" },
    { q: "ปุ่ม 'Spacebar' ทำหน้าที่อะไร?", options: ["เว้นวรรค", "ขึ้นบรรทัดใหม่", "ลบคำ", "สลับหน้าต่าง"], a: 0, level: "easy" },
    { q: "สัญลักษณ์ 🔍 ในโปรแกรมต่างๆ มักหมายถึงอะไร?", options: ["การตั้งค่า", "การลบ", "การค้นหา", "การบันทึก"], a: 2, level: "easy" },
    { q: "แอปพลิเคชันใดใช้สำหรับการประชุมออนไลน์?", options: ["Zoom", "Photoshop", "Excel", "Notepad"], a: 0, level: "easy" },
    { q: "คำว่า 'Download' หมายถึงอะไร?", options: ["ส่งข้อมูลขึ้นอินเทอร์เน็ต", "ดึงข้อมูลจากอินเทอร์เน็ตมาที่เครื่อง", "ลบข้อมูลทิ้ง", "แก้ไขข้อมูล"], a: 1, level: "easy" },
    { q: "อุปกรณ์ใดทำหน้าที่เป็นเหมือน 'ตา' ของคอมพิวเตอร์?", options: ["ไมโครโฟน", "เว็บแคม (Webcam)", "คีย์บอร์ด", "เมาส์"], a: 1, level: "easy" },
    { q: "ไอคอนรูป 'แผ่นดิสก์' 💾 มักใช้แทนคำสั่งใด?", options: ["Copy", "Paste", "Save", "Delete"], a: 2, level: "easy" },
    { q: "ไฟล์นามสกุล .pdf เปิดด้วยโปรแกรมอะไรได้ดีที่สุด?", options: ["Acrobat Reader", "Windows Media Player", "Paint", "Calculator"], a: 0, level: "easy" },

    // --- ระดับ MEDIUM (ข้อ 36-70) ---
    { q: "ภาษาใดมักใช้ในการสร้างโครงสร้างหน้าเว็บไซต์?", options: ["Python", "HTML", "C++", "Java"], a: 1, level: "medium" },
    { q: "IoT ย่อมาจากอะไร?", options: ["Internet of Things", "Index of Technology", "Internal Output Testing", "Input of Transfer"], a: 0, level: "medium" },
    { q: "ระบบคลาวด์ (Cloud Computing) คืออะไร?", options: ["การประมวลผลบนท้องฟ้า", "การเก็บและประมวลผลข้อมูลผ่านอินเทอร์เน็ต", "การพยากรณ์อากาศ", "เซิร์ฟเวอร์แบบออฟไลน์"], a: 1, level: "medium" },
    { q: "มัลแวร์ (Malware) ประเภทใดที่จับไฟล์เราเป็นตัวประกันเพื่อเรียกค่าไถ่?", options: ["Trojan", "Spyware", "Ransomware", "Worm"], a: 2, level: "medium" },
    { q: "ข้อใดคือระบบจัดการฐานข้อมูล?", options: ["MySQL", "HTML", "CSS", "Photoshop"], a: 0, level: "medium" },
    { q: "Phishing คือการโจมตีรูปแบบใด?", options: ["แฮกกล้องวงจรปิด", "หลอกลวงให้กรอกข้อมูลส่วนตัว", "ทำลายฮาร์ดแวร์", "ส่งไวรัสผ่านแฟลชไดร์ฟ"], a: 1, level: "medium" },
    { q: "คำสั่ง 'ping' ใน Command Prompt ใช้ทำอะไร?", options: ["ทดสอบการเชื่อมต่อเครือข่าย", "ลบไฟล์ขยะ", "เปลี่ยนรหัสผ่าน", "สแกนไวรัส"], a: 0, level: "medium" },
    { q: "URL ย่อมาจากอะไร?", options: ["Universal Record Link", "Uniform Resource Locator", "Ultra Router Line", "Unit Rate Limit"], a: 1, level: "medium" },
    { q: "เทคโนโลยีใดที่ใช้ในสกุลเงินดิจิทัลอย่าง Bitcoin?", options: ["Cloud Computing", "AI", "Blockchain", "IoT"], a: 2, level: "medium" },
    { q: "SSD (Solid State Drive) ดีกว่า HDD (Hard Disk Drive) อย่างไร?", options: ["ราคาถูกกว่ามาก", "อ่านและเขียนข้อมูลเร็วกว่า", "ความจุน้อยกว่า", "เปราะบางกว่า"], a: 1, level: "medium" },
    { q: "ภาษาใดเหมาะสำหรับการเขียนโปรแกรมวิเคราะห์ข้อมูลและ AI มากที่สุด?", options: ["PHP", "Ruby", "Python", "Swift"], a: 2, level: "medium" },
    { q: "IP Address เปรียบเสมือนสิ่งใดในชีวิตจริง?", options: ["หมายเลขบัตรประชาชน", "บ้านเลขที่", "หมายเลขโทรศัพท์", "ชื่อเล่น"], a: 1, level: "medium" },
    { q: "อุปกรณ์ใดทำหน้าที่เชื่อมต่อเครือข่ายคอมพิวเตอร์หลายๆ วงเข้าด้วยกัน?", options: ["Switch", "Router", "Hub", "Modem"], a: 1, level: "medium" },
    { q: "การกระทำใดเรียกว่า Cyberbullying?", options: ["โหลดเกมเถื่อน", "การกลั่นแกล้งหรือด่าทอผ่านโซเชียลมีเดีย", "การขโมยรหัสผ่าน", "การปล่อยไวรัส"], a: 1, level: "medium" },
    { q: "CSS มีหน้าที่หลักเพื่ออะไรในการทำเว็บไซต์?", options: ["จัดการฐานข้อมูล", "สร้างตรรกะให้ปุ่ม", "ตกแต่งความสวยงามของเว็บ", "เชื่อมต่อ Server"], a: 2, level: "medium" },
    { q: "VGA Card หรือ Graphic Card มีหน้าที่อะไร?", options: ["คำนวณตัวเลข", "ประมวลผลและส่งภาพขึ้นจอ", "จ่ายไฟให้เมนบอร์ด", "เก็บข้อมูลเกม"], a: 1, level: "medium" },
    { q: "ข้อใดคือระบบปฏิบัติการแบบ Open Source (ฟรีและปรับแต่งได้)?", options: ["Windows", "iOS", "Linux", "macOS"], a: 2, level: "medium" },
    { q: "ระบบ GPS (Global Positioning System) ทำงานร่วมกับสิ่งใด?", options: ["สายไฟเบอร์ออพติก", "ดาวเทียม", "เสาสัญญาณวิทยุ", "สายโทรศัพท์"], a: 1, level: "medium" },
    { q: "Two-Factor Authentication (2FA) คืออะไร?", options: ["รหัสผ่านที่ต้องมี 2 ตัวอักษร", "การยืนยันตัวตนแบบสองขั้นตอน", "การใช้คอมพิวเตอร์ 2 เครื่องล็อกอิน", "การสแกนใบหน้าสองครั้ง"], a: 1, level: "medium" },
    { q: "ข้อใดคือเครื่องมือพัฒนาเว็บไซต์ของครูเบียร์ที่ใช้ทำหน้าเว็บ (ในโปรเจกต์นี้)?", options: ["Tailwind CSS", "Bootstrap", "Material UI", "Bulma"], a: 0, level: "medium" },
    { q: "แอปพลิเคชันใดไม่จัดอยู่ในกลุ่ม Social Media?", options: ["Instagram", "Twitter(X)", "Microsoft Word", "Facebook"], a: 2, level: "medium" },
    { q: "ในภาษา JavaScript คำสั่งใดใช้แสดงผลข้อความออกทางคอนโซล?", options: ["print()", "echo()", "console.log()", "System.out.println()"], a: 2, level: "medium" },
    { q: "ข้อใดคือเกมเอนจิน (Game Engine) สำหรับสร้างเกม?", options: ["Unity", "Excel", "Photoshop", "Wordpress"], a: 0, level: "medium" },
    { q: "สัญลักษณ์ # (Hashtag) เริ่มเป็นที่นิยมใช้งานแพร่หลายบนแพลตฟอร์มใดเป็นที่แรกๆ?", options: ["Facebook", "Twitter", "Hi5", "MySpace"], a: 1, level: "medium" },
    { q: "Firebase คือบริการที่จัดเตรียมสิ่งใดให้นักพัฒนา?", options: ["ฐานข้อมูลและระบบหลังบ้าน", "เซิร์ฟเวอร์เล่นเกม", "โปรแกรมแต่งรูป", "ระบบจัดการเอกสาร"], a: 0, level: "medium" },
    { q: "QR Code ย่อมาจากอะไร?", options: ["Quick Request Code", "Quality Rate Code", "Quick Response Code", "Quiet Read Code"], a: 2, level: "medium" },
    { q: "ซอฟต์แวร์ที่แจกให้ใช้ฟรีแต่มีโฆษณาแฝงเรียกว่าอะไร?", options: ["Freeware", "Shareware", "Adware", "Spyware"], a: 2, level: "medium" },
    { q: "Dark Web คืออะไร?", options: ["เว็บที่มีพื้นหลังสีดำ", "ส่วนของอินเทอร์เน็ตที่ต้องใช้ซอฟต์แวร์เฉพาะในการเข้าถึง", "เว็บที่ล่มบ่อย", "เว็บเกี่ยวกับดาราศาสตร์"], a: 1, level: "medium" },
    { q: "หน่วยความจำใดมีความเร็วในการเข้าถึงข้อมูลสูงที่สุด?", options: ["Hard Disk", "SSD", "RAM", "Cache (ใน CPU)"], a: 3, level: "medium" },
    { q: "ข้อใดคือการ Backup ข้อมูล?", options: ["การลบข้อมูลสำรอง", "การสำเนาข้อมูลเก็บไว้อีกที่หนึ่งเพื่อป้องกันการสูญหาย", "การส่งข้อมูลกลับไปให้เพื่อน", "การย้อนกลับโปรแกรม"], a: 1, level: "medium" },
    { q: "OpenAI คือผู้สร้างเทคโนโลยี AI ใดที่โด่งดัง?", options: ["Siri", "Alexa", "ChatGPT", "Gemini"], a: 2, level: "medium" },
    { q: "Virtual Reality (VR) ต่างจาก Augmented Reality (AR) อย่างไร?", options: ["VR คือโลกจำลองทั้งหมด AR คือการซ้อนภาพกราฟิกบนโลกจริง", "VR ใช้บนมือถือเท่านั้น AR ต้องใส่แว่น", "ไม่มีความต่างกัน", "VR ใช้ทำงาน AR ใช้เล่นเกม"], a: 0, level: "medium" },
    { q: "การ์ดจอค่ายใดที่มีโลโก้สีเขียวเป็นเอกลักษณ์?", options: ["AMD", "Intel", "NVIDIA", "ASUS"], a: 2, level: "medium" },
    { q: "ตัวแปร (Variable) ในการเขียนโปรแกรมเปรียบเสมือนอะไร?", options: ["คำสั่งหยุดการทำงาน", "กล่องสำหรับเก็บข้อมูล", "โปรแกรมลบไวรัส", "หน้าต่างแสดงผล"], a: 1, level: "medium" },
    { q: "สาย LAN (Ethernet) มาตรฐานทั่วไปใช้หัวต่อแบบใด?", options: ["RJ-11", "RJ-45", "USB Type-C", "HDMI"], a: 1, level: "medium" },

    // --- ระดับ HARD (ข้อ 71-100) ---
    { q: "IP Address รูปแบบ IPv4 ประกอบด้วยตัวเลขกี่ชุด?", options: ["2 ชุด", "3 ชุด", "4 ชุด", "6 ชุด"], a: 2, level: "hard" },
    { q: "พอร์ต (Port) มาตรฐานสำหรับการเชื่อมต่อเว็บแบบเข้ารหัส (HTTPS) คือพอร์ตใด?", options: ["80", "21", "443", "22"], a: 2, level: "hard" },
    { q: "ระบบโดเมนเนม (DNS) ทำหน้าที่อะไร?", options: ["แปลงชื่อเว็บเป็นหมายเลข IP", "ป้องกันไวรัส", "เพิ่มความเร็วเน็ต", "เก็บข้อมูลรหัสผ่าน"], a: 0, level: "hard" },
    { q: "Big Data หมายถึงข้อใด?", options: ["คอมพิวเตอร์ขนาดใหญ่", "ข้อมูลที่มีปริมาณมหาศาล หลากหลาย และเปลี่ยนแปลงเร็ว", "ฮาร์ดดิสก์ความจุ 100TB", "เครือข่ายอินเทอร์เน็ตที่กว้างใหญ่"], a: 1, level: "hard" },
    { q: "API ย่อมาจากอะไร?", options: ["Application Programming Interface", "Advanced Program Index", "Auto Processing Integration", "Access Point Internet"], a: 0, level: "hard" },
    { q: "หลักการทำงานของ Machine Learning คืออะไร?", options: ["เขียนโค้ดกำหนดทุกเงื่อนไขแบบตายตัว", "ให้คอมพิวเตอร์เรียนรู้จากข้อมูลจำนวนมากและหารูปแบบเอง", "ใช้คนพิมพ์คำตอบไว้ล่วงหน้า", "ให้หุ่นยนต์อ่านหนังสือ"], a: 1, level: "hard" },
    { q: "การโจมตีแบบ DDoS คืออะไร?", options: ["การขโมยข้อมูลบัตรเครดิต", "การส่งข้อมูลขยะจำนวนมหาศาลเพื่อทำให้เซิร์ฟเวอร์ล่ม", "การแฮกเข้ากล้องวงจรปิด", "การส่งไวรัสเรียกค่าไถ่"], a: 1, level: "hard" },
    { q: "สถาปัตยกรรม CPU แบบใดที่สมาร์ทโฟนส่วนใหญ่ใช้งาน?", options: ["x86", "x64", "ARM", "PowerPC"], a: 2, level: "hard" },
    { q: "ข้อใดคือ NoSQL Database?", options: ["MySQL", "PostgreSQL", "MongoDB", "OracleDB"], a: 2, level: "hard" },
    { q: "การทำ SEO (Search Engine Optimization) คืออะไร?", options: ["การซื้อโฆษณาบนหน้าเว็บ", "การปรับแต่งเว็บให้ติดอันดับการค้นหาบน Google", "การออกแบบโลโก้เว็บให้สวยงาม", "การเพิ่มความปลอดภัยให้เว็บไซต์"], a: 1, level: "hard" },
    { q: "ข้อใดคือการจัดเรียงข้อมูลแบบ LIFO (Last In, First Out)?", options: ["Queue (คิว)", "Tree (ต้นไม้)", "Stack (สแต็ก)", "Graph (กราฟ)"], a: 2, level: "hard" },
    { q: "Framework ใดของ JavaScript ที่พัฒนาโดยบริษัท Facebook (Meta)?", options: ["Angular", "Vue.js", "React", "Svelte"], a: 2, level: "hard" },
    { q: "ในระบบเครือข่าย คำว่า 'Bandwidth' หมายถึงอะไร?", options: ["ความเร็วสูงสุดที่ข้อมูลสามารถรับส่งได้ในเวลาหนึ่ง", "ระยะทางของสายสัญญาณ", "ความจุของฮาร์ดดิสก์บนเซิร์ฟเวอร์", "จำนวนไวรัสที่บล็อกได้"], a: 0, level: "hard" },
    { q: "โปรโตคอลใดใช้สำหรับรับส่งไฟล์ข้ามเซิร์ฟเวอร์?", options: ["HTTP", "SMTP", "FTP", "POP3"], a: 2, level: "hard" },
    { q: "Zero-Day Exploit คืออะไร?", options: ["ไวรัสที่ทำงานเที่ยงคืน", "ช่องโหว่ซอฟต์แวร์ที่ยังไม่ถูกเปิดเผยหรือยังไม่มีแพตช์แก้ไข", "โปรแกรมแฮกที่หมดอายุใน 1 วัน", "การโจมตีที่ใช้เวลา 0 วินาที"], a: 1, level: "hard" },
    { q: "ข้อใดคือตัวดำเนินการทางตรรกศาสตร์ (Logical Operator) ที่หมายถึง 'และ' ในหลายๆ ภาษาโปรแกรม?", options: ["||", "!", "&&", "=="], a: 2, level: "hard" },
    { q: "JSON ย่อมาจากอะไร?", options: ["JavaScript Object Notation", "Java Syntax Output Network", "Just Synchronize Object Node", "JavaScript Oriented Network"], a: 0, level: "hard" },
    { q: "อะไรคือประโยชน์หลักของการทำ 'Containerization' (เช่น Docker)?", options: ["ทำให้จอสีสวยขึ้น", "รวมโค้ดและสภาพแวดล้อมให้ทำงานได้เหมือนกันในทุกเครื่อง", "ลดขนาดฮาร์ดดิสก์", "ทำให้เมาส์คลิกเร็วขึ้น"], a: 1, level: "hard" },
    { q: "Deepfake คือเทคโนโลยีประเภทใด?", options: ["การลบรูปคนอื่น", "AI ที่ปลอมแปลงภาพใบหน้าหรือเสียงให้เหมือนของจริง", "แอปพลิเคชันถ่ายภาพใต้น้ำลึก", "เทคนิคการซ่อนไฟล์ในรหัสผ่าน"], a: 1, level: "hard" },
    { q: "ในวงการฐานข้อมูล SQL ย่อมาจากอะไร?", options: ["Simple Query Language", "Structured Query Language", "System Question Logic", "Server Quality Link"], a: 1, level: "hard" },
    { q: "MAC Address ของการ์ดแลน มีความยาวกี่บิต?", options: ["16 บิต", "32 บิต", "48 บิต", "64 บิต"], a: 2, level: "hard" },
    { q: "ข้อใดไม่ใช่ระบบควบคุมเวอร์ชันโค้ด (Version Control System)?", options: ["Git", "Subversion (SVN)", "Mercurial", "Apache"], a: 3, level: "hard" },
    { q: "คำสั่ง 'sudo' ใน Linux ใช้เพื่ออะไร?", options: ["ขอสิทธิ์ระดับผู้ดูแลระบบ (Root) เพื่อรันคำสั่ง", "ลบไฟล์ทั้งหมด", "เปิดเว็บเซิร์ฟเวอร์", "ดาวน์โหลดโปรแกรม"], a: 0, level: "hard" },
    { q: "VPN (Virtual Private Network) ทำงานโดยใช้เทคนิคใดเป็นหลักเพื่อความปลอดภัย?", options: ["Compression", "Encryption (การเข้ารหัสข้อมูล)", "Defragmentation", "Overclocking"], a: 1, level: "hard" },
    { q: "โครงสร้างข้อมูลแบบ 'Array' เริ่มต้นนับตำแหน่งแรก (Index) ที่ตัวเลขใด?", options: ["1", "-1", "0", "แล้วแต่ภาษาโปรแกรม แต่ส่วนใหญ่เริ่มที่ 1"], a: 2, level: "hard" },
    { q: "รหัสสี #FFFFFF ในระบบ HEX Color Code คือสีอะไร?", options: ["สีดำ", "สีแดง", "สีน้ำเงิน", "สีขาว"], a: 3, level: "hard" },
    { q: "HTTP Status Code หมายเลข 404 มีความหมายว่าอะไร?", options: ["สำเร็จ (OK)", "เซิร์ฟเวอร์ล่ม (Internal Error)", "ไม่พบหน้าเว็บที่ระบุ (Not Found)", "ห้ามเข้าถึง (Forbidden)"], a: 2, level: "hard" },
    { q: "เทคนิค 'Phishing' จัดอยู่ในกลุ่มการโจมตีประเภทใด?", options: ["Social Engineering (วิศวกรรมสังคม)", "Brute Force", "SQL Injection", "Man-in-the-Middle"], a: 0, level: "hard" },
    { q: "ภาษาใดมักถูกนำมาใช้เขียนโปรแกรมฝั่ง Server (Back-end) ควบคู่กับ Node.js?", options: ["Python", "PHP", "JavaScript", "Ruby"], a: 2, level: "hard" },
    { q: "กระบวนการแปลงข้อมูลให้อ่านไม่ออกเพื่อความปลอดภัย เรียกว่าอะไร?", options: ["Decryption", "Encryption", "Compilation", "Extraction"], a: 1, level: "hard"}
];

let currentSelectedQuestion = null;

// 🟢 ฟังก์ชันตรวจสอบสถานะ (เรียกเมื่อ Login สำเร็จ)
async function checkDailyQuestStatus(studentId) {
    if (!studentId) return;
    
    try {
        const studentSnap = await db.collection('students').where("student_id", "==", String(studentId)).get();
        if (studentSnap.empty) return; 
        
        const userData = studentSnap.docs[0].data();
        // เทคนิคดึงวันที่ตามเวลาเครื่องให้เป๊ะ
        const now = new Date();
        const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

        if (userData.last_daily_quest === today) {
            console.log("📅 วันนี้ตอบคำถามไปแล้ว ซ่อนมาสคอต");
            hideMascot();
        } else {
            console.log("🤖 วันนี้ยังไม่ได้ตอบคำถาม แสดงมาสคอต");
            showMascot();
        }
    } catch (error) {
        console.error("Error checking quest status:", error);
    }
}

// 🟢 แสดงมาสคอตมุมจอ
function showMascot() {
    const mascotContainer = document.getElementById('daily-mascot-container');
    if (mascotContainer) {
        mascotContainer.classList.remove('hidden');
        mascotContainer.classList.add('flex', 'animate-bounce-slow');
    }
}

function hideMascot() {
    const mascotContainer = document.getElementById('daily-mascot-container');
    if (mascotContainer) {
        mascotContainer.classList.remove('flex', 'animate-bounce-slow');
        mascotContainer.classList.add('hidden');
    }
}

// 🟢 เปิดหน้าต่างคำถาม
function openDailyQuest() {
    // สุ่มคำถามจาก 100 ข้อ
    currentSelectedQuestion = TECH_QUESTIONS[Math.floor(Math.random() * TECH_QUESTIONS.length)];
    
    const modal = document.getElementById('quest-modal');
    const questionText = document.getElementById('quest-question');
    const optionsContainer = document.getElementById('quest-options');
    
    questionText.innerText = currentSelectedQuestion.q;
    optionsContainer.innerHTML = '';
    
    currentSelectedQuestion.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = "w-full py-4 px-6 bg-white border-2 border-slate-100 rounded-2xl text-left font-bold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 transition-all shadow-[0_4px_0_#f1f5f9] active:translate-y-1 active:shadow-none mb-3 flex items-center gap-4 group";
        btn.innerHTML = `
            <span class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">${String.fromCharCode(65 + idx)}</span>
            <span>${opt}</span>
        `;
        btn.onclick = () => submitAnswer(idx);
        optionsContainer.appendChild(btn);
    });
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// 🟢 ส่งคำตอบ
async function submitAnswer(index) {
    // 🛠️ แก้บั๊ก: ตรวจสอบแบบนี้นะครับถึงจะกัน Error ได้ 100%
    if (typeof loggedInUser === 'undefined' || !loggedInUser || !loggedInUser.id) {
        console.error("ไม่พบข้อมูล loggedInUser หรือไม่ได้ Login");
        if(typeof showToast === 'function') showToast("กรุณาเข้าสู่ระบบก่อนตอบคำถาม!", "error");
        return; 
    }

    const isCorrect = index === currentSelectedQuestion.a;
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

    try {
        // หา Document ID ของนักเรียนคนนี้ก่อน
        const studentSnap = await db.collection('students').where("student_id", "==", String(loggedInUser.id)).get();
        if (studentSnap.empty) return;
        
        const docId = studentSnap.docs[0].id; 

        // บันทึกวันที่ตอบทันที (ป้องกันการรีเฟรชหน้าเพื่อตอบใหม่)
        await db.collection('students').doc(docId).update({
            last_daily_quest: today
        });

        if (isCorrect) {
            // สุ่มเหรียญรางวัล
            const reward = Math.floor(Math.random() * (DAILY_QUEST_CONFIG.rewardMax - DAILY_QUEST_CONFIG.rewardMin + 1)) + DAILY_QUEST_CONFIG.rewardMin;
            
            // อัปเดตเหรียญในคลาวด์ 
            await db.collection('students').doc(docId).update({
                coins: firebase.firestore.FieldValue.increment(reward)
            });

            // อัปเดตเหรียญบนหน้าจอให้เห็นแบบ Real-time
            if (typeof currentStudentCoins !== 'undefined') currentStudentCoins += reward;
            if (document.getElementById("user-coins")) document.getElementById("user-coins").innerText = currentStudentCoins.toLocaleString();
            if (document.getElementById("shop-coins")) document.getElementById("shop-coins").innerText = currentStudentCoins.toLocaleString();

            showQuestResult(true, reward);
            if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        } else {
            showQuestResult(false, 0);
        }
    } catch (error) {
        console.error("Error submitting answer:", error);
    }
}

function showQuestResult(isCorrect, reward) {
    const optionsContainer = document.getElementById('quest-options');
    const questionText = document.getElementById('quest-question');
    
    if (isCorrect) {
        questionText.innerHTML = `<span class="text-green-500">ถูกต้อง! 🎉</span>`;
        optionsContainer.innerHTML = `
            <div class="text-center py-8 animate-fade-in">
                <div class="text-5xl mb-4">💰</div>
                <div class="text-2xl font-black text-slate-800 mb-2">คุณได้รับ ${reward} เหรียญ</div>
                <p class="text-slate-500 font-bold">ยอดเยี่ยมมากเจ้าเทคมาสเตอร์!</p>
                <button onclick="closeQuestModal()" class="mt-6 px-8 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-[0_4px_0_#000] hover:-translate-y-1 transition-transform">กลับไปหน้าหลัก</button>
            </div>
        `;
    } else {
        questionText.innerHTML = `<span class="text-rose-500">ผิดไปนิดเดียว! 😅</span>`;
        optionsContainer.innerHTML = `
            <div class="text-center py-8 animate-fade-in">
                <div class="text-5xl mb-4">❌</div>
                <div class="text-xl font-black text-slate-800 mb-2">คำตอบที่ถูกคือ: ${currentSelectedQuestion.options[currentSelectedQuestion.a]}</div>
                <p class="text-slate-500 font-bold">ไม่เป็นไร พรุ่งนี้มาลองใหม่นะ!</p>
                <button onclick="closeQuestModal()" class="mt-6 px-8 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-[0_4px_0_#000] hover:-translate-y-1 transition-transform">ปิดหน้าต่าง</button>
            </div>
        `;
    }
}

function closeQuestModal() {
    document.getElementById('quest-modal').classList.remove('flex');
    document.getElementById('quest-modal').classList.add('hidden');
    hideMascot();
}