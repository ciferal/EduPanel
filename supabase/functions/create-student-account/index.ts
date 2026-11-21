// Supabase Edge Function: create-student-account
// Creates or updates a student's Supabase Auth account from their manager-maintained record.
// Username is mapped to a private synthetic email; password is the student's phone number.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toEnglishDigits = (value: unknown) =>
  String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "تنظیمات امن تابع در Supabase کامل نیست." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "ابتدا وارد حساب مدیر شوید." }, 401);

  // Validate the caller's JWT, then verify manager role from the trusted database.
  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(jwt);
  if (callerError || !callerData.user) return json({ error: "نشست کاربری معتبر نیست؛ دوباره وارد شوید." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle();

  if (profileError || callerProfile?.role !== "manager") {
    return json({ error: "فقط مدیر سامانه اجازه ساخت حساب دانش‌آموز را دارد." }, 403);
  }

  let body: { student_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "درخواست ارسالی معتبر نیست." }, 400);
  }

  const studentId = String(body.student_id || "").trim();
  if (!studentId) return json({ error: "شناسه دانش‌آموز ارسال نشده است." }, 400);

  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id,user_id,full_name,national_id,phone")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) return json({ error: "خواندن پرونده دانش‌آموز ناموفق بود: " + studentError.message }, 500);
  if (!student) return json({ error: "دانش‌آموز موردنظر پیدا نشد." }, 404);

  const nationalId = toEnglishDigits(student.national_id).replace(/\D/g, "");
  const phone = toEnglishDigits(student.phone).replace(/\D/g, "");
  if (!/^\d{10}$/.test(nationalId)) return json({ error: "کد ملی دانش‌آموز باید دقیقاً ۱۰ رقم باشد." }, 400);
  if (!/^09\d{9}$/.test(phone)) return json({ error: "شماره همراه باید با 09 شروع شود و ۱۱ رقم باشد." }, 400);

  const loginEmail = `${nationalId}@students.edupanel.local`;
  let userId = student.user_id as string | null;
  let createdNow = false;

  if (userId) {
    // Existing linked account: synchronize its login identifier and initial/current password.
    const { data: updateData, error: updateError } = await admin.auth.admin.updateUserById(userId, {
      email: loginEmail,
      password: phone,
      email_confirm: true,
      user_metadata: { role: "student", student_id: student.id, full_name: student.full_name },
    });
    if (updateError) {
      return json({ error: "به‌روزرسانی حساب قبلی ناموفق بود: " + updateError.message }, 400);
    }
    userId = updateData.user.id;
  } else {
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email: loginEmail,
      password: phone,
      email_confirm: true,
      user_metadata: { role: "student", student_id: student.id, full_name: student.full_name },
    });
    if (createError || !createData.user) {
      return json({ error: "ساخت حساب ورود ناموفق بود: " + (createError?.message || "خطای نامشخص") }, 400);
    }
    userId = createData.user.id;
    createdNow = true;
  }

  const { error: upsertProfileError } = await admin.from("profiles").upsert({
    id: userId,
    full_name: student.full_name,
    role: "student",
  }, { onConflict: "id" });

  if (upsertProfileError) {
    if (createdNow && userId) await admin.auth.admin.deleteUser(userId);
    return json({ error: "ثبت پروفایل دانش‌آموز ناموفق بود: " + upsertProfileError.message }, 500);
  }

  const { error: linkError } = await admin
    .from("students")
    .update({ user_id: userId })
    .eq("id", student.id);

  if (linkError) {
    if (createdNow && userId) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
    return json({ error: "اتصال حساب به پرونده دانش‌آموز ناموفق بود: " + linkError.message }, 500);
  }

  return json({
    success: true,
    user_id: userId,
    message: "حساب ورود دانش‌آموز با موفقیت ایجاد یا به‌روزرسانی شد.",
  });
});
