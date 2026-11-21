-- اجازه می‌دهد هر کاربر فقط پروفایل خودش را بخواند.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users read own profile'
  ) THEN
    CREATE POLICY "Users read own profile"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;
END
$$;

-- جلوگیری از ثبت کد ملی تکراری (رکوردهای خالی مشمول این محدودیت نیستند).
CREATE UNIQUE INDEX IF NOT EXISTS students_national_id_unique_idx
  ON public.students (national_id)
  WHERE national_id IS NOT NULL AND btrim(national_id) <> '';
