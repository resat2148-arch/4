-- Sample questions for development: yesterday, today and the next five days
-- (Turkish time). Runs automatically on `supabase db reset` locally; for the
-- hosted project, run it once in the SQL editor.
insert into public.questions (text, publish_date, intensity)
select q.text, private.app_today() + q.day_offset, q.intensity::public.question_intensity
from (
  values
    (-1, 'Son zamanlarda kimseye söylemediğin bir sevincin var mı?', 'light'),
    (0, 'Bugün seni en çok ne yordu ve bunu kimseye söyleyemedin?', 'deep'),
    (1, 'Seni en son ne zaman biri gerçekten dinledi?', 'deep'),
    (2, 'Küçükken seni en çok ne korkuturdu?', 'light'),
    (3, 'Birine hâlâ teşekkür etmediğin bir şey var mı?', 'light'),
    (4, 'Hayatında geri dönüp değiştirmek istediğin bir an var mı?', 'deep'),
    (5, 'Bugün kendine nasıl davrandın?', 'light')
) as q(day_offset, text, intensity)
on conflict (publish_date) do nothing;
