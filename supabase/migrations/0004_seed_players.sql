-- 0004_seed_players.sql
-- Seed full first-team squads for all 14 Ligat ha'Al clubs, 2026/27 season.
-- Source: https://www.transfermarkt.us/ligat-haal/startseite/wettbewerb/ISR1
-- (each club's /kader/ page). ~400 rows pulled via an LLM-assisted page read,
-- not an exact table parse — spot-check before relying on this for anything
-- beyond development/demo data.
--
-- Notes on mapping Transfermarkt's data to our schema:
--   position:    Transfermarkt's granular positions collapse to GK/DF/MF/FW
--                (e.g. Centre-Back/Left-Back/Right-Back -> DF).
--   nationality: dual-nationality players ("Israel/Portugal") keep only the
--                first-listed (primary) nationality.
--   market_value: "-"/"--" (not listed) becomes 0.
--   weekly_wage, contract_until, birth_date: not available in bulk view,
--                left at their column defaults (0 / null / null).
--
-- Run once, after 0001-0003. Re-running will insert duplicates (no unique
-- constraint on player name) — delete existing rows first if you need to redo it.

-- Maccabi Tel Aviv
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Maccabi Tel Aviv'), full_name, position, age, market_value, nationality
from (values
  ('Ofek Melika', 'GK', 21, 1200000, 'Israel'),
  ('Roi Mishpati', 'GK', 33, 175000, 'Israel'),
  ('Idan Trau', 'GK', 18, 0, 'Israel'),
  ('Shalev Saadya', 'GK', 20, 0, 'Israel'),
  ('Tyrese Asante', 'DF', 24, 2700000, 'Netherlands'),
  ('Mohamed Camara', 'DF', 28, 1400000, 'Guinea'),
  ('Raz Shlomo', 'DF', 27, 800000, 'Israel'),
  ('Itay Ben Hemo', 'DF', 24, 350000, 'Israel'),
  ('Itay Malma', 'DF', 19, 50000, 'Israel'),
  ('Roy Revivo', 'DF', 23, 4500000, 'Israel'),
  ('Shahar Rosen', 'DF', 23, 375000, 'Israel'),
  ('Denny Gropper', 'DF', 27, 300000, 'Israel'),
  ('Noam Ben Harush', 'DF', 21, 1200000, 'Israel'),
  ('Kristijan Belic', 'MF', 25, 3000000, 'Serbia'),
  ('Issouf Sissokho', 'MF', 24, 1700000, 'Mali'),
  ('Dan Glazer', 'MF', 29, 600000, 'Israel'),
  ('Itamar Noy', 'MF', 25, 600000, 'Israel'),
  ('Roei Magor', 'MF', 19, 0, 'Israel'),
  ('Dor Peretz', 'MF', 31, 1600000, 'Israel'),
  ('Ido Shahar', 'MF', 25, 1500000, 'Israel'),
  ('Lotem Asras', 'MF', 19, 0, 'Israel'),
  ('Kervin Andrade', 'MF', 21, 1300000, 'Venezuela'),
  ('Ilay Ben Simon', 'MF', 17, 250000, 'Israel'),
  ('Hélio Varela', 'FW', 24, 2500000, 'Cape Verde'),
  ('Ori Azo', 'FW', 21, 800000, 'Israel'),
  ('Hisham Layous', 'FW', 25, 700000, 'Israel'),
  ('Anis Porat Ayash', 'FW', 21, 175000, 'Israel'),
  ('Osher Davida', 'FW', 25, 1500000, 'Israel'),
  ('Sagiv Jehezkel', 'FW', 31, 375000, 'Israel'),
  ('Sayed Abu Farkhi', 'FW', 20, 2000000, 'Israel'),
  ('Ester Sokler', 'FW', 27, 1500000, 'Slovenia'),
  ('Elad Madmon', 'FW', 22, 1200000, 'Israel'),
  ('Ion Nicolaescu', 'FW', 27, 1000000, 'Moldova')
) as x(full_name, position, age, market_value, nationality);

-- Maccabi Haifa
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Maccabi Haifa'), full_name, position, age, market_value, nationality
from (values
  ('Omri Glazer', 'GK', 30, 1500000, 'Israel'),
  ('Sharif Kaiuf', 'GK', 25, 300000, 'Israel'),
  ('Omer Nir''on', 'GK', 25, 250000, 'Israel'),
  ('Mark Golenkov', 'GK', 18, 0, 'Israel'),
  ('Glenn Alvin', 'GK', 19, 0, 'Israel'),
  ('Arad Gaist', 'DF', 18, 0, 'Israel'),
  ('Nigel Lonwijk', 'DF', 23, 1200000, 'Suriname'),
  ('Pedrão', 'DF', 29, 750000, 'Brazil'),
  ('Shon Goldberg', 'DF', 31, 600000, 'Israel'),
  ('Noam Sztejfman', 'DF', 18, 225000, 'Israel'),
  ('Elad Amir', 'DF', 20, 200000, 'Israel'),
  ('Tsunami', 'DF', 30, 1400000, 'Brazil'),
  ('Yinon Faingezicht', 'DF', 19, 750000, 'Israel'),
  ('Pierre Cornud', 'DF', 29, 600000, 'France'),
  ('Jelle Bataille', 'DF', 27, 2300000, 'Belgium'),
  ('Zohar Zasano', 'DF', 24, 200000, 'Israel'),
  ('Ali Mohamed', 'MF', 30, 1300000, 'Niger'),
  ('Navot Ratner', 'MF', 19, 700000, 'Israel'),
  ('Goni Naor', 'MF', 27, 350000, 'Israel'),
  ('Yarin Levi', 'MF', 21, 2000000, 'Israel'),
  ('Ethane Azoulay', 'MF', 24, 2000000, 'Israel'),
  ('Cédric Don', 'MF', 22, 1600000, 'Côte d''Ivoire'),
  ('Lior Kassa', 'MF', 20, 1300000, 'Israel'),
  ('Amit Arazi', 'MF', 21, 200000, 'Israel'),
  ('Kenny Saief', 'MF', 32, 250000, 'United States'),
  ('Bruninho', 'MF', 26, 1200000, 'Brazil'),
  ('Yair Mordechai', 'FW', 22, 800000, 'Israel'),
  ('Kenji Gorré', 'FW', 31, 600000, 'Curaçao'),
  ('Iyad Khalaili', 'FW', 20, 400000, 'Israel'),
  ('Hamza Shibli', 'FW', 22, 125000, 'Israel'),
  ('Manuel Benson', 'FW', 29, 2200000, 'Angola'),
  ('Silva Kani', 'FW', 23, 550000, 'Israel'),
  ('Jad Shibli', 'FW', 20, 25000, 'Israel'),
  ('Guy Melamed', 'FW', 33, 500000, 'Israel'),
  ('Andrija Novakovich', 'FW', 29, 350000, 'United States'),
  ('Omer Dahan', 'FW', 21, 175000, 'Israel'),
  ('Adam Grimberg', 'FW', 16, 0, 'Israel')
) as x(full_name, position, age, market_value, nationality);

-- Maccabi Petah Tikva
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Maccabi Petah Tikva'), full_name, position, age, market_value, nationality
from (values
  ('Maor Erlich', 'GK', 23, 225000, 'Israel'),
  ('Dor Hevron', 'GK', 25, 175000, 'Israel'),
  ('Pavlos Correa', 'DF', 28, 200000, 'Cyprus'),
  ('Bashar Abdach', 'DF', 21, 175000, 'Israel'),
  ('Eitan Tibi', 'DF', 38, 25000, 'Israel'),
  ('Yanir Zeigerman', 'DF', 21, 0, 'Israel'),
  ('Mohammed Hindi', 'DF', 30, 250000, 'Israel'),
  ('Aviv Salem', 'DF', 26, 150000, 'Israel'),
  ('Or Dadia', 'DF', 29, 250000, 'Israel'),
  ('Guy Dezent', 'DF', 20, 250000, 'Israel'),
  ('Omer Shirazi', 'DF', 25, 125000, 'Israel'),
  ('Ido Cohen', 'MF', 21, 800000, 'Israel'),
  ('Ibrahima Soumah', 'MF', 22, 175000, 'Guinea'),
  ('Eyal Inbrum', 'MF', 24, 150000, 'Israel'),
  ('Lee-Yam Dan', 'MF', 21, 100000, 'Israel'),
  ('Liran Hazan', 'MF', 20, 1000000, 'Israel'),
  ('Noam Shemesh', 'MF', 20, 25000, 'Israel'),
  ('Yuval Kretzo', 'MF', 21, 25000, 'Israel'),
  ('Kyle Spence', 'FW', 29, 500000, 'England'),
  ('Ariel Lugassy', 'FW', 21, 125000, 'Israel'),
  ('Samuel Owusu', 'FW', 30, 300000, 'Ghana'),
  ('Yoav Koren', 'FW', 20, 200000, 'Israel'),
  ('Adar Ratner', 'FW', 23, 200000, 'Israel'),
  ('Anas Sarsur', 'FW', 20, 10000, 'Israel'),
  ('Marko Rakonjac', 'FW', 26, 450000, 'Montenegro'),
  ('José Cortés', 'FW', 31, 225000, 'Colombia')
) as x(full_name, position, age, market_value, nationality);

-- Hapoel Be'er Sheva
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Hapoel Be''er Sheva'), full_name, position, age, market_value, nationality
from (values
  ('Marco Wolff', 'GK', 29, 250000, 'Argentina'),
  ('Ofir Marciano', 'GK', 36, 100000, 'Israel'),
  ('Yonatan Shani', 'GK', 20, 0, 'Israel'),
  ('Djibril Diop', 'DF', 27, 650000, 'Senegal'),
  ('Matan Baltaxa', 'DF', 30, 600000, 'Israel'),
  ('Itay Rotman', 'DF', 24, 400000, 'Israel'),
  ('Miguel Vítor', 'DF', 37, 125000, 'Israel'),
  ('Pedro Amador', 'DF', 27, 850000, 'Portugal'),
  ('Ofir Davidzada', 'DF', 35, 125000, 'Israel'),
  ('Guy Mizrahi', 'DF', 25, 1300000, 'Israel'),
  ('Roy Levy', 'DF', 26, 600000, 'Israel'),
  ('Lucas Ventura', 'MF', 28, 2000000, 'Brazil'),
  ('Eliel Peretz', 'MF', 29, 1700000, 'Israel'),
  ('Niv Yehoshua', 'MF', 21, 1500000, 'Israel'),
  ('Hamode Kanaan', 'MF', 26, 1200000, 'Israel'),
  ('Yoan Stoyanov', 'MF', 25, 700000, 'Bulgaria'),
  ('Itay Hazut', 'MF', 19, 100000, 'Israel'),
  ('Amir Ganah', 'FW', 22, 1600000, 'Israel'),
  ('Zahi Ahmed', 'FW', 25, 800000, 'Israel'),
  ('João Victor', 'FW', 22, 400000, 'Brazil'),
  ('Dan Biton', 'FW', 31, 2000000, 'Israel'),
  ('Muhammad Abu Rumi', 'FW', 22, 900000, 'Israel'),
  ('Javon East', 'FW', 31, 500000, 'Jamaica'),
  ('Igor Zlatanovic', 'FW', 28, 1000000, 'Serbia'),
  ('Yonas Malede', 'FW', 26, 250000, 'Israel'),
  ('Eylon Almog', 'FW', 27, 250000, 'Israel'),
  ('Noam Shahar', 'FW', 22, 150000, 'Israel')
) as x(full_name, position, age, market_value, nationality);

-- Beitar Jerusalem
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Beitar Jerusalem'), full_name, position, age, market_value, nationality
from (values
  ('Miguel Silva', 'GK', 31, 400000, 'Portugal'),
  ('Yehonatan Ozer', 'GK', 26, 175000, 'Israel'),
  ('Dvir Nir', 'GK', 23, 10000, 'Israel'),
  ('Amit Korenfein', 'GK', 21, 0, 'Israel'),
  ('Luka Gadrani', 'DF', 29, 1200000, 'Georgia'),
  ('Brayan Carabalí', 'DF', 27, 850000, 'Colombia'),
  ('Gil Cohen', 'DF', 25, 700000, 'Israel'),
  ('Ori Dahan', 'DF', 26, 300000, 'Israel'),
  ('Liel Deri', 'DF', 22, 125000, 'Israel'),
  ('Yuval Shalev', 'DF', 20, 0, 'Israel'),
  ('Yarden Cohen', 'DF', 29, 550000, 'Israel'),
  ('Nevo Shedo', 'DF', 23, 175000, 'Israel'),
  ('Nana Antwi', 'DF', 26, 550000, 'Ghana'),
  ('Roey Elimelech', 'DF', 24, 250000, 'Israel'),
  ('Boris Enow', 'MF', 26, 1600000, 'Cameroon'),
  ('Aílson Tavares', 'MF', 28, 600000, 'Cape Verde'),
  ('Nadav Markovich', 'MF', 22, 100000, 'Israel'),
  ('Noam Muche', 'MF', 23, 375000, 'Israel'),
  ('Degats Worko', 'MF', 22, 325000, 'Israel'),
  ('Adi Yona', 'MF', 22, 1800000, 'Israel'),
  ('Ziv Ben Shimol', 'MF', 22, 500000, 'Israel'),
  ('Tomer Yosefi', 'MF', 27, 400000, 'Israel'),
  ('Yarden Shua', 'FW', 27, 2000000, 'Israel'),
  ('Eugene Ansah', 'FW', 31, 550000, 'Ghana'),
  ('Ravid Abergil', 'FW', 22, 125000, 'Israel'),
  ('Omer Atzili', 'FW', 33, 1200000, 'Israel'),
  ('Timothy Muzie', 'FW', 25, 750000, 'Israel'),
  ('Yan Yusupov', 'FW', 21, 25000, 'Israel'),
  ('Shon Weissman', 'FW', 30, 750000, 'Israel'),
  ('Johnbosco Samuel Kalu', 'FW', 28, 650000, 'Nigeria')
) as x(full_name, position, age, market_value, nationality);

-- Hapoel Tel Aviv
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Hapoel Tel Aviv'), full_name, position, age, market_value, nationality
from (values
  ('Assaf Tzur', 'GK', 27, 700000, 'Israel'),
  ('Dor Benyamini', 'GK', 21, 150000, 'Israel'),
  ('Roy Baranes', 'GK', 24, 10000, 'Israel'),
  ('Yanal Bazdog', 'GK', 17, 0, 'Israel'),
  ('Chico', 'DF', 27, 1200000, 'Brazil'),
  ('Fernand Mayembo', 'DF', 30, 800000, 'Congo'),
  ('Tal Archel', 'DF', 23, 300000, 'Israel'),
  ('Shahar Piven', 'DF', 30, 275000, 'Israel'),
  ('Or Israelov', 'DF', 21, 200000, 'Israel'),
  ('Doron Leidner', 'DF', 24, 300000, 'Israel'),
  ('Marcus Coco', 'DF', 30, 750000, 'Guadeloupe'),
  ('Falcão', 'MF', 28, 550000, 'Brazil'),
  ('El Yam Kancepolsky', 'MF', 22, 175000, 'Israel'),
  ('Andrian Kraev', 'MF', 27, 1400000, 'Bulgaria'),
  ('Itay Shavit', 'MF', 19, 150000, 'Israel'),
  ('Roei Alkukin', 'MF', 22, 350000, 'Israel'),
  ('Amit Lemkin', 'MF', 20, 350000, 'Israel'),
  ('Omri Altman', 'MF', 32, 275000, 'Israel'),
  ('Yonatan Farber', 'MF', 24, 225000, 'Israel'),
  ('Ben Zaid', 'MF', 20, 0, 'Israel'),
  ('Xande Silva', 'FW', 29, 600000, 'Portugal'),
  ('Mor Buskila', 'FW', 22, 225000, 'Israel'),
  ('Sami Adam', 'FW', 21, 100000, 'Israel'),
  ('Douglas Owusu', 'FW', 20, 4500000, 'Ghana'),
  ('Stav Turiel', 'FW', 25, 1800000, 'Israel'),
  ('Roy Korine', 'FW', 23, 275000, 'Israel'),
  ('Daniel Dappa', 'FW', 18, 1000000, 'Israel'),
  ('Emmanuel Boateng', 'FW', 30, 800000, 'Ghana'),
  ('Anas Mahamid', 'FW', 28, 225000, 'Israel')
) as x(full_name, position, age, market_value, nationality);

-- Maccabi Netanya
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Maccabi Netanya'), full_name, position, age, market_value, nationality
from (values
  ('Samu', 'GK', 27, 1600000, 'Portugal'),
  ('Niv Antman', 'GK', 34, 100000, 'Israel'),
  ('Daniel Cohen', 'GK', 20, 0, 'Israel'),
  ('Bakary Konaté', 'DF', 23, 500000, 'Mali'),
  ('Saba Khvadagiani', 'DF', 23, 400000, 'Georgia'),
  ('Denis Kulikov', 'DF', 22, 300000, 'Israel'),
  ('Itay Ben Shabat', 'DF', 26, 275000, 'Israel'),
  ('Benny Feldman', 'DF', 19, 75000, 'Israel'),
  ('Grigoriy Morozov', 'DF', 32, 600000, 'Russia'),
  ('Karem Jaber', 'DF', 25, 600000, 'Israel'),
  ('Alon Azugi', 'DF', 27, 325000, 'Israel'),
  ('Amit Cohen', 'DF', 27, 250000, 'Israel'),
  ('Aziz Ouattara', 'MF', 25, 1000000, 'Côte d''Ivoire'),
  ('Omri Shamir', 'MF', 23, 200000, 'Israel'),
  ('Maor Levi', 'MF', 26, 700000, 'Israel'),
  ('Nadav Niddam', 'MF', 25, 375000, 'Israel'),
  ('Basam Zaarura', 'MF', 23, 350000, 'Israel'),
  ('Wylan Cyprien', 'MF', 31, 275000, 'France'),
  ('Saher Taji', 'MF', 25, 150000, 'Israel'),
  ('Aviv Kanarik', 'MF', 23, 100000, 'Israel'),
  ('Oz Bilu', 'MF', 25, 750000, 'Israel'),
  ('Dolev Haziza', 'FW', 31, 750000, 'Israel'),
  ('Liam Cohen', 'FW', 20, 25000, 'Israel'),
  ('Matheus Davó', 'FW', 27, 1300000, 'Brazil'),
  ('Dor Hugi', 'FW', 31, 300000, 'Israel')
) as x(full_name, position, age, market_value, nationality);

-- Ihud Bnei Sakhnin
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Ihud Bnei Sakhnin'), full_name, position, age, market_value, nationality
from (values
  ('Raul Bălbărău', 'GK', 25, 500000, 'Romania'),
  ('Mohammed Abu Nil', 'GK', 25, 325000, 'Israel'),
  ('Majid Suleiman', 'GK', 22, 0, 'Israel'),
  ('Maroun Gantus', 'DF', 30, 250000, 'Israel'),
  ('Dimitri Cavaré', 'DF', 31, 200000, 'Guadeloupe'),
  ('Eyad Abu Abaid', 'DF', 31, 200000, 'Israel'),
  ('Akram Zbedat', 'DF', 18, 0, 'Israel'),
  ('Ali Gnameh', 'DF', 19, 0, 'Israel'),
  ('Saná', 'DF', 26, 350000, 'Guinea-Bissau'),
  ('Amit Karadi', 'DF', 20, 125000, 'Israel'),
  ('Mohamad Ganame', 'DF', 22, 10000, 'Israel'),
  ('Modestas Vorobjovas', 'MF', 30, 400000, 'Lithuania'),
  ('Ahmad Taha', 'MF', 21, 250000, 'Israel'),
  ('Rani Sif', 'MF', 20, 0, 'Israel'),
  ('Carlitos', 'MF', 27, 275000, 'Angola'),
  ('Mustafa Sheikh Yosef', 'MF', 30, 150000, 'Israel'),
  ('Ilay Hajaj', 'MF', 24, 200000, 'Israel'),
  ('Niv Livnat', 'MF', 24, 75000, 'Israel'),
  ('Mathew Anim Cudjoe', 'MF', 22, 275000, 'Ghana'),
  ('Ahmad Salman', 'FW', 22, 300000, 'Israel'),
  ('Jubayer Bushnak', 'FW', 23, 200000, 'Israel'),
  ('Loai Helf', 'FW', 26, 75000, 'Israel'),
  ('Daniel Paraschiv', 'FW', 27, 800000, 'Romania'),
  ('Baseel Khuri', 'FW', 22, 200000, 'Israel'),
  ('Shaker Abu Husein', 'FW', 20, 0, 'Israel')
) as x(full_name, position, age, market_value, nationality);

-- Hapoel Haifa
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Hapoel Haifa'), full_name, position, age, market_value, nationality
from (values
  ('Yoav Gerafi', 'GK', 32, 300000, 'Israel'),
  ('Matan Ambar', 'GK', 31, 125000, 'Israel'),
  ('Ivan Kricak', 'DF', 30, 450000, 'Serbia'),
  ('George Diba', 'DF', 28, 350000, 'Israel'),
  ('Dario Zuparic', 'DF', 34, 300000, 'Croatia'),
  ('Tamir Arbel', 'DF', 24, 150000, 'Israel'),
  ('Ilay Hazan', 'DF', 19, 0, 'Israel'),
  ('Arial Mendy', 'DF', 31, 275000, 'Senegal'),
  ('Noam Cohen', 'DF', 27, 225000, 'Israel'),
  ('Dor Malul', 'DF', 37, 75000, 'Israel'),
  ('Shalev Sardal', 'DF', 20, 0, 'Israel'),
  ('Shai Elias', 'MF', 27, 500000, 'Israel'),
  ('Tal Naim', 'MF', 22, 100000, 'Israel'),
  ('Liam Nahum', 'MF', 20, 0, 'Israel'),
  ('Naor Sabag', 'MF', 33, 200000, 'Israel'),
  ('Cheick Keita', 'MF', 21, 0, 'Mali'),
  ('Israel Sali Pahima', 'MF', 21, 150000, 'Israel'),
  ('Yaad Gonen', 'MF', 20, 25000, 'Israel'),
  ('Liran Rotman', 'FW', 30, 250000, 'Israel'),
  ('Waheb Habiballah', 'FW', 28, 250000, 'Israel'),
  ('Willy Agada', 'FW', 26, 600000, 'Nigeria'),
  ('Alon Turgeman', 'FW', 35, 175000, 'Israel'),
  ('Itay Zafrani', 'FW', 19, 0, 'Israel'),
  ('Ahmad Hamam', 'FW', 20, 0, 'Israel')
) as x(full_name, position, age, market_value, nationality);

-- Ironi Kiryat Shmona
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Ironi Kiryat Shmona'), full_name, position, age, market_value, nationality
from (values
  ('Daniel Tenenbaum', 'GK', 31, 250000, 'Brazil'),
  ('Nikola Djurkovic', 'GK', 24, 125000, 'Serbia'),
  ('Nemanja Ljubisavljevic', 'DF', 29, 500000, 'Serbia'),
  ('Shay Ben David', 'DF', 29, 350000, 'Israel'),
  ('Shon Edri', 'DF', 22, 225000, 'Israel'),
  ('Amit Glazer', 'DF', 26, 150000, 'Israel'),
  ('Shay Sabah', 'DF', 21, 150000, 'Israel'),
  ('Itzik Sholmyster', 'DF', 28, 125000, 'Israel'),
  ('Harel Goldenberg', 'DF', 21, 100000, 'Israel'),
  ('Ovadia Darwish', 'DF', 27, 300000, 'Israel'),
  ('Ido Vaier', 'DF', 29, 75000, 'Israel'),
  ('Ofir Benbenishti', 'MF', 26, 200000, 'Israel'),
  ('Talles Costa', 'MF', 24, 900000, 'Brazil'),
  ('Alex Sola', 'MF', 22, 300000, 'Angola'),
  ('Yehonatan Malka', 'MF', 19, 0, 'Israel'),
  ('Ariel Sheratzky', 'MF', 24, 225000, 'Israel'),
  ('Awajo Asefa', 'FW', 27, 75000, 'Israel'),
  ('Amadou Sagna', 'FW', 27, 700000, 'Senegal'),
  ('Rüfat Abdullazada', 'FW', 25, 450000, 'Azerbaijan'),
  ('Mor Siman Tov', 'FW', 22, 125000, 'Israel'),
  ('Adrián Ugarriza', 'FW', 29, 1000000, 'Peru'),
  ('Jwan Halabi', 'FW', 21, 125000, 'Israel'),
  ('Niv Gabay', 'FW', 19, 125000, 'Israel'),
  ('Ori Shnaper', 'FW', 22, 0, 'Israel')
) as x(full_name, position, age, market_value, nationality);

-- Hapoel Ramat Gan
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Hapoel Ramat Gan'), full_name, position, age, market_value, nationality
from (values
  ('Amit Raif', 'GK', 22, 125000, 'Israel'),
  ('Tomer Haran', 'GK', 27, 0, 'Israel'),
  ('Ben Parduaro', 'GK', 20, 0, 'Israel'),
  ('Márcio Silva', 'DF', 25, 400000, 'Brazil'),
  ('Jota', 'DF', 26, 350000, 'Portugal'),
  ('Daniel Tishler', 'DF', 19, 150000, 'Israel'),
  ('Omer Itzhak', 'DF', 25, 125000, 'Israel'),
  ('Amit Banay', 'DF', 20, 0, 'Israel'),
  ('Fard Ibrahim', 'DF', 26, 200000, 'Ghana'),
  ('Dudu Twitto', 'DF', 32, 150000, 'Israel'),
  ('Ofek Ovadia', 'DF', 25, 250000, 'Israel'),
  ('Noam Schwartz', 'DF', 20, 175000, 'Israel'),
  ('Getachew Yabelo', 'DF', 21, 175000, 'Israel'),
  ('Srdjan Mijailovic', 'MF', 32, 600000, 'Serbia'),
  ('Tamir Glazer', 'MF', 26, 100000, 'Israel'),
  ('Maxim Plakushchenko', 'MF', 30, 300000, 'Israel'),
  ('Ido Oli', 'MF', 20, 125000, 'Israel'),
  ('Ido Mizrahi', 'MF', 22, 100000, 'Israel'),
  ('Tom Aida', 'MF', 26, 25000, 'Israel'),
  ('Moshe Semel', 'MF', 23, 300000, 'Israel'),
  ('Christopher Boniface', 'MF', 24, 200000, 'Nigeria'),
  ('David Asanka', 'MF', 21, 150000, 'Israel'),
  ('Ollie Cohen Bergman', 'MF', 20, 25000, 'Israel'),
  ('Luan Campos', 'FW', 24, 400000, 'Brazil'),
  ('Idan Baranes', 'FW', 22, 175000, 'Israel'),
  ('Matan Hozez', 'FW', 30, 325000, 'Israel'),
  ('Hod Messika', 'FW', 26, 75000, 'Israel'),
  ('Amit Tzur', 'FW', 22, 75000, 'Israel'),
  ('Marius Noubissi', 'FW', 29, 400000, 'Cameroon'),
  ('Liam Aluk', 'FW', 19, 0, 'Israel')
) as x(full_name, position, age, market_value, nationality);

-- Hapoel Petah Tikva
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Hapoel Petah Tikva'), full_name, position, age, market_value, nationality
from (values
  ('Omer Katz', 'GK', 28, 200000, 'Israel'),
  ('Roy Sason', 'GK', 24, 200000, 'Israel'),
  ('Amit Mashiah', 'GK', 21, 0, 'Israel'),
  ('Diego Arroyo', 'DF', 21, 500000, 'Bolivia'),
  ('Alex Moucketou-Moussounda', 'DF', 25, 450000, 'Gabon'),
  ('Stav Israeli', 'DF', 27, 150000, 'Israel'),
  ('Moshe Meir', 'DF', 24, 125000, 'Israel'),
  ('Orel Dgani', 'DF', 37, 100000, 'Israel'),
  ('Roy Ben Navi', 'DF', 22, 10000, 'Israel'),
  ('Yaar Zambrawski', 'DF', 23, 10000, 'Israel'),
  ('Yazen Nassar', 'DF', 29, 225000, 'Israel'),
  ('Harel Shalom', 'DF', 28, 200000, 'Israel'),
  ('Avishay Cohen', 'DF', 31, 100000, 'Israel'),
  ('Nachman Assal', 'DF', 19, 0, 'Israel'),
  ('Itay Ehud', 'MF', 19, 275000, 'Israel'),
  ('Roee David', 'MF', 22, 600000, 'Israel'),
  ('Tomer Altman', 'MF', 28, 300000, 'Israel'),
  ('Boni Amian', 'MF', 23, 225000, 'Côte d''Ivoire'),
  ('Edmond Asante', 'MF', 19, 25000, 'Ghana'),
  ('Chipyoka Songa', 'MF', 21, 600000, 'Zambia'),
  ('Karim Kimvuidi', 'MF', 24, 550000, 'DR Congo'),
  ('Tedros Demelash', 'MF', 21, 0, 'Israel'),
  ('Clé', 'FW', 28, 300000, 'Cape Verde'),
  ('Guy Badash', 'FW', 32, 175000, 'Israel'),
  ('Shavit Mazal', 'FW', 24, 300000, 'Israel'),
  ('Franck Rivollier', 'FW', 25, 150000, 'France'),
  ('Omri Cohen', 'FW', 18, 0, 'Israel')
) as x(full_name, position, age, market_value, nationality);

-- Hapoel Jerusalem
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Hapoel Jerusalem'), full_name, position, age, market_value, nationality
from (values
  ('Nadav Zamir', 'GK', 25, 500000, 'Israel'),
  ('Ben Gordin', 'GK', 23, 100000, 'Israel'),
  ('Noam Shavit', 'GK', 21, 0, 'Israel'),
  ('Guy Bar', 'GK', 18, 0, 'United States'),
  ('Ilay Tovim', 'GK', 21, 0, 'Israel'),
  ('Yonatan Laish', 'DF', 22, 600000, 'Israel'),
  ('Noam Malmud', 'DF', 24, 550000, 'Israel'),
  ('Tamir Haimovich', 'DF', 23, 225000, 'Israel'),
  ('Hilay Sharabi Melman', 'DF', 21, 175000, 'Israel'),
  ('Ofek Nadir', 'DF', 27, 250000, 'Israel'),
  ('Sharani Zuberu', 'DF', 26, 150000, 'Togo'),
  ('Li On Mizrahi', 'DF', 23, 125000, 'Israel'),
  ('Omer Agvadish', 'DF', 25, 250000, 'Israel'),
  ('Idan Cohen', 'DF', 30, 150000, 'Israel'),
  ('Ayano Farada', 'MF', 24, 350000, 'Israel'),
  ('Christ Tiéhi', 'MF', 28, 325000, 'Côte d''Ivoire'),
  ('Ilay Madmon', 'MF', 23, 300000, 'Israel'),
  ('Yanai Distalfeld', 'MF', 21, 300000, 'Israel'),
  ('Omer Abuhav', 'MF', 22, 200000, 'Israel'),
  ('Raz Haim Yehezkel', 'MF', 21, 0, 'Israel'),
  ('Ori Katz', 'MF', 21, 0, 'Israel'),
  ('Daniel Koudougou', 'MF', 19, 0, 'Côte d''Ivoire'),
  ('Andrew Idoko', 'FW', 20, 375000, 'Nigeria'),
  ('Ohad Almagor', 'FW', 24, 350000, 'Israel'),
  ('Nadim Warsana', 'FW', 20, 100000, 'Israel'),
  ('Sani Abdulsalam', 'FW', 19, 0, 'Nigeria'),
  ('Vitalie Damascan', 'FW', 27, 400000, 'Moldova'),
  ('Israel Dappa', 'FW', 17, 200000, 'Israel')
) as x(full_name, position, age, market_value, nationality);

-- Ironi Tiberias
insert into public.players (club_id, full_name, position, age, market_value, nationality)
select (select id from public.clubs where name = 'Ironi Tiberias'), full_name, position, age, market_value, nationality
from (values
  ('Ido Sharon', 'GK', 24, 200000, 'Israel'),
  ('Gad Amos', 'GK', 37, 50000, 'Israel'),
  ('Jones Abu Ganima', 'GK', 22, 0, 'Israel'),
  ('Ondrej Baco', 'DF', 30, 375000, 'Czech Republic'),
  ('Ziv Morgan', 'DF', 26, 225000, 'Israel'),
  ('Sambinha', 'DF', 33, 175000, 'Guinea-Bissau'),
  ('Nehoray Chen', 'DF', 21, 25000, 'Israel'),
  ('Ran Haliwa', 'DF', 19, 0, 'Israel'),
  ('Daniel Joulani', 'DF', 23, 250000, 'Ukraine'),
  ('Gal Ma''atuk', 'DF', 23, 125000, 'Israel'),
  ('Ron Unger', 'DF', 24, 175000, 'Israel'),
  ('Guy Sanker', 'DF', 24, 125000, 'Israel'),
  ('David Keltjens', 'MF', 31, 225000, 'Israel'),
  ('Ravid Shamay', 'MF', 22, 0, 'Israel'),
  ('Yarin Shyovitz', 'MF', 20, 0, 'Israel'),
  ('Chriso', 'MF', 26, 400000, 'Côte d''Ivoire'),
  ('Eden Shamir', 'MF', 31, 275000, 'Israel'),
  ('Ariel Cohen', 'MF', 23, 200000, 'Israel'),
  ('Yarin Swisa', 'MF', 21, 100000, 'Israel'),
  ('Guy Hadida', 'MF', 31, 500000, 'Israel'),
  ('Niv Gotlieb', 'MF', 23, 275000, 'Israel'),
  ('Bar Cohen', 'MF', 25, 225000, 'Israel'),
  ('Mansour Badjie', 'FW', 21, 100000, 'The Gambia'),
  ('Néné Gbamblé', 'FW', 24, 200000, 'Côte d''Ivoire'),
  ('Itamar Shviro', 'FW', 28, 250000, 'Israel'),
  ('Qays Ghanem', 'FW', 28, 200000, 'Israel'),
  ('Samir Farhud', 'FW', 25, 150000, 'Israel'),
  ('Agam Yehuda', 'FW', 19, 0, 'Israel')
) as x(full_name, position, age, market_value, nationality);
