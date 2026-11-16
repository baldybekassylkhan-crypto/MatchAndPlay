-- 21 город Казахстана (координаты центра города)
insert into public.cities (id, slug, name_ru, name_kz, aliases, lat, lng, sort_order) values
  (1,  'astana',          'Астана',            'Астана',       array['Нур-Султан','Нурсултан','Целиноград','Акмола','Astana'],          51.1694, 71.4491, 1),
  (2,  'almaty',          'Алматы',            'Алматы',       array['Алма-Ата','Алмата','Almaty'],                                     43.2389, 76.8897, 2),
  (3,  'shymkent',        'Шымкент',           'Шымкент',      array['Чимкент','Shymkent'],                                              42.3417, 69.5901, 3),
  (4,  'karaganda',       'Караганда',         'Қарағанды',    array['Караганды','Karaganda'],49.8047, 73.1094, 4),
  (5,  'aktobe',          'Актобе',            'Ақтөбе',       array['Актюбинск','Aktobe'],                                              50.2839, 57.1670, 5),
  (6,  'taraz',           'Тараз',             'Тараз',        array['Джамбул','Жамбыл','Taraz'],                                        42.9000, 71.3667, 6),
  (7,  'pavlodar',        'Павлодар',          'Павлодар',     array['Pavlodar'],                                                        52.2873, 76.9674, 7),
  (8,  'oskemen',         'Усть-Каменогорск',  'Өскемен',      array['Оскемен','Усть-Каман','Ust-Kamenogorsk','Oskemen'],                49.9483, 82.6275, 8),
  (9,  'semey',           'Семей',             'Семей',        array['Семипалатинск','Semey'],                                           50.4111, 80.2275, 9),
  (10, 'atyrau',          'Атырау',            'Атырау',       array['Гурьев','Atyrau'],                                                 47.1167, 51.8833, 10),
  (11, 'kostanay',        'Костанай',          'Қостанай',     array['Кустанай','Kostanay'],                                             53.2144, 63.6246, 11),
  (12, 'kyzylorda',       'Кызылорда',         'Қызылорда',    array['Кзыл-Орда','Kyzylorda'],                                           44.8488, 65.4823, 12),
  (13, 'oral',            'Уральск',           'Орал',         array['Орал','Uralsk','Oral'],                                            51.2333, 51.3667, 13),
  (14, 'petropavl',       'Петропавловск',     'Петропавл',    array['Петропавл','Petropavl','Petropavlovsk'],                           54.8667, 69.1500, 14),
  (15, 'aktau',           'Актау',             'Ақтау',        array['Шевченко','Aktau'],                                                43.6500, 51.1667, 15),
  (16, 'turkistan',       'Туркестан',         'Түркістан',    array['Туркистан','Turkistan'],                                           43.2973, 68.2518, 16),
  (17, 'kokshetau',       'Кокшетау',          'Көкшетау',     array['Кокчетав','Kokshetau'],                                            53.2833, 69.4000, 17),
  (18, 'taldykorgan',     'Талдыкорган',       'Талдықорған',  array['Талды-Курган','Taldykorgan'],                                      45.0156, 78.3739, 18),
  (19, 'temirtau',        'Темиртау',          'Теміртау',     array['Temirtau'],                                                        50.0549, 72.9646, 19),
  (20, 'zhezkazgan',      'Жезказган',         'Жезқазған',    array['Джезказган','Zhezkazgan'],                                         47.7833, 67.7667, 20),
  (21, 'konaev',          'Конаев',            'Қонаев',       array['Капчагай','Капшагай','Qonaev','Konaev'],                           43.8667, 77.0667, 21)
on conflict (id) do update set
  slug = excluded.slug, name_ru = excluded.name_ru, name_kz = excluded.name_kz,
  aliases = excluded.aliases, lat = excluded.lat, lng = excluded.lng, sort_order = excluded.sort_order;
