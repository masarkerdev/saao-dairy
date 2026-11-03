-- ১০: কৃষক গ্রুপের বিস্তারিত তথ্য
--   • আমার গ্রুপে: সভাপতির নাম, গ্রাম, ইউনিয়ন (ব্লক আগে থেকেই আছে)
--   • সূচির প্রতিটি গ্রুপে সভাপতির নাম; প্রিন্টের "কৃষক গ্রুপের নম্বর, নাম ঠিকানা ও মোবাইল নম্বর" ঘরে বসে
-- ০৯ চালানোর পরে চালাবেন। একাধিকবার চালালেও সমস্যা নেই।

alter table public.farmer_groups   add column if not exists president  text not null default '';
alter table public.farmer_groups   add column if not exists village    text not null default '';
alter table public.farmer_groups   add column if not exists union_name text not null default '';

alter table public.schedule_groups add column if not exists president  text not null default '';
