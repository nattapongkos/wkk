
  // ==========================================
// 🗄️ ตั้งค่า Supabase 2 โกดัง
// ==========================================
const SUPA1_URL = 'https://vbdfnsathdkhthxejkws.supabase.co';
const SUPA1_KEY = 'sb_publishable_2-XHNvGBpfZwH0gtfjcdIg_bkWv7nqY';
const supabase1 = supabase.createClient(SUPA1_URL, SUPA1_KEY);

const SUPA2_URL = 'https://cdduysitlkvirsbgbaqj.supabase.co';
const SUPA2_KEY = 'sb_publishable_fuvWgbT4puXvHmf96dXx5w_kv0BoaC4';
const supabase2 = supabase.createClient(SUPA2_URL, SUPA2_KEY);

// ชื่อ Bucket ที่ครูต้องไปสร้างไว้ใน Supabase (ต้องตั้งชื่อให้เหมือนกันทั้ง 2 โกดัง)
const BUCKET_NAME = 'student_works';


// ฟังก์ชันอัปโหลดไฟล์เข้า Supabase
async function uploadToSupabase(file, studentId) {
    try {
        // 1. สุ่มโกดัง (50/50)
        const useStorage1 = Math.random() > 0.5;
        const activeSupa = useStorage1 ? supabase1 : supabase2;
        
        // 2. ตั้งชื่อไฟล์ไม่ให้ซ้ำกัน (เช่น 12345_169000000.jpg)
        const fileExt = file.name.split('.').pop();
        const fileName = `${studentId}_${Date.now()}.${fileExt}`;

        // 3. อัปโหลดไฟล์เข้า Supabase
        const { data, error } = await activeSupa.storage
            .from(BUCKET_NAME)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false // ไม่ทับไฟล์เก่า
            });

        if (error) throw error;

        // 4. ขอลิงก์รูปภาพแบบสาธารณะ (Public URL) เพื่อเอาไปโชว์ในเว็บ
        const { data: urlData } = activeSupa.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        return urlData.publicUrl; // คืนค่าลิงก์ URL เอาไปเก็บใน Firebase ต่อได้เลย

    } catch (error) {
        console.error("Supabase Upload Error:", error);
        throw new Error("อัปโหลดไฟล์ไม่สำเร็จ");
    }
}

// ฟังก์ชันลบไฟล์ออกจาก Supabase แบบข้ามโกดัง
async function deleteFromSupabase(fileUrl) {
    if (!fileUrl) return;

    try {
        // 1. ดึงชื่อไฟล์ออกมาจาก URL ท้ายสุด
        // URL มักจะหน้าตาแบบนี้: https://xyz.supabase.co/storage/v1/object/public/student_works/12345_6789.jpg
        const fileName = fileUrl.split('/').pop(); 

        // 2. เช็คว่า URL มีรหัสโปรเจกต์ของโกดังไหน
        if (fileUrl.includes(SUPA1_URL.split('//')[1])) {
            // มาจากโกดังที่ 1
            const { error } = await supabase1.storage.from(BUCKET_NAME).remove([fileName]);
            if (error) console.error("ลบจากโกดัง 1 พลาด:", error);
            else console.log("🗑️ ลบไฟล์ออกจากโกดัง 1 เรียบร้อย");

        } else if (fileUrl.includes(SUPA2_URL.split('//')[1])) {
            // มาจากโกดังที่ 2
            const { error } = await supabase2.storage.from(BUCKET_NAME).remove([fileName]);
            if (error) console.error("ลบจากโกดัง 2 พลาด:", error);
            else console.log("🗑️ ลบไฟล์ออกจากโกดัง 2 เรียบร้อย");
        }

    } catch (error) {
        console.error("Supabase Delete Error:", error);
    }
}