
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Student',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.study_sets (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'yLearn',
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'General',
  description TEXT,
  summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  source_type TEXT NOT NULL DEFAULT 'topic',
  cloned_from UUID REFERENCES public.study_sets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sets TO authenticated;
GRANT SELECT ON public.study_sets TO anon;
GRANT ALL ON public.study_sets TO service_role;
ALTER TABLE public.study_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public sets are viewable by everyone" ON public.study_sets FOR SELECT USING (visibility = 'public');
CREATE POLICY "Owners can view own sets" ON public.study_sets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sets" ON public.study_sets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update own sets" ON public.study_sets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can delete own sets" ON public.study_sets FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX study_sets_user_idx ON public.study_sets(user_id);
CREATE INDEX study_sets_visibility_idx ON public.study_sets(visibility);

CREATE TABLE public.cards (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT SELECT ON public.cards TO anon;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cards of public sets are viewable by everyone" ON public.cards FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.study_sets s WHERE s.id = cards.set_id AND s.visibility = 'public')
);
CREATE POLICY "Owners can view own cards" ON public.cards FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.study_sets s WHERE s.id = cards.set_id AND s.user_id = auth.uid())
);
CREATE POLICY "Owners can insert cards" ON public.cards FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.study_sets s WHERE s.id = cards.set_id AND s.user_id = auth.uid())
);
CREATE POLICY "Owners can update cards" ON public.cards FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.study_sets s WHERE s.id = cards.set_id AND s.user_id = auth.uid())
);
CREATE POLICY "Owners can delete cards" ON public.cards FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.study_sets s WHERE s.id = cards.set_id AND s.user_id = auth.uid())
);
CREATE INDEX cards_set_idx ON public.cards(set_id);

CREATE TABLE public.saved_sets (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_sets TO authenticated;
GRANT ALL ON public.saved_sets TO service_role;
ALTER TABLE public.saved_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved sets" ON public.saved_sets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.card_reviews (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('easy','medium','hard')),
  interval_days INTEGER NOT NULL DEFAULT 1,
  repetitions INTEGER NOT NULL DEFAULT 1,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_reviews TO authenticated;
GRANT ALL ON public.card_reviews TO service_role;
ALTER TABLE public.card_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reviews" ON public.card_reviews FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_days (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  cards_studied INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
GRANT SELECT, INSERT, UPDATE ON public.study_days TO authenticated;
GRANT ALL ON public.study_days TO service_role;
ALTER TABLE public.study_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own study days" ON public.study_days FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Student'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Demo community content
WITH s AS (
  INSERT INTO public.study_sets (id, user_id, author_name, title, subject, description, summary, visibility, source_type) VALUES
  ('11111111-1111-4111-8111-111111111111', NULL, 'Mrs. Keller', 'Biology: Human Organs', 'Biology', 'Key organs of the human body and what each one does.', '["The body is organised into systems, each built from specialised organs.","The heart, lungs and kidneys work together to deliver oxygen and remove waste.","The liver is the body''s main chemical processing plant."]'::jsonb, 'public', 'topic'),
  ('22222222-2222-4222-8222-222222222222', NULL, 'Lucas M.', 'French Vocabulary: Unit 3', 'Languages', 'Everyday French words and phrases from Unit 3.', '["Nouns carry a gender: le for masculine, la for feminine.","Most regular verbs in this unit end in -er.","Greetings change with the time of day and formality."]'::jsonb, 'public', 'text'),
  ('33333333-3333-4333-8333-333333333333', NULL, 'Mr. Dawson', 'History: The Cold War', 'History', 'Turning points of the Cold War, 1945-1991.', '["The Cold War was a rivalry between the USA and the USSR without direct war.","Nuclear deterrence shaped almost every decision.","It ended with the collapse of the Soviet Union in 1991."]'::jsonb, 'public', 'topic'),
  ('44444444-4444-4444-8444-444444444444', NULL, 'Amira K.', 'Chemistry: Periodic Trends', 'Chemistry', 'How properties change across and down the periodic table.', '["Atomic radius decreases across a period and increases down a group.","Ionisation energy rises across a period.","Electronegativity peaks at fluorine."]'::jsonb, 'public', 'image'),
  ('55555555-5555-4555-8555-555555555555', NULL, 'Noah P.', 'Maths: Quadratic Equations', 'Mathematics', 'Solving and interpreting quadratic equations.', '["A quadratic has the form ax^2 + bx + c = 0.","The discriminant tells you how many real roots exist.","The graph is always a parabola."]'::jsonb, 'public', 'text')
  RETURNING id
)
SELECT count(*) FROM s;

INSERT INTO public.cards (set_id, front, back, position) VALUES
('11111111-1111-4111-8111-111111111111','Heart','A muscular organ that pumps blood around the body, delivering oxygen and nutrients and carrying away waste.',0),
('11111111-1111-4111-8111-111111111111','Lungs','A pair of organs where oxygen enters the blood and carbon dioxide leaves it, through tiny air sacs called alveoli.',1),
('11111111-1111-4111-8111-111111111111','Liver','The largest internal organ. It filters toxins from the blood, produces bile for digestion and stores glucose as glycogen.',2),
('11111111-1111-4111-8111-111111111111','Kidneys','Two bean-shaped organs that filter waste and excess water out of the blood to make urine, and regulate blood pressure.',3),
('11111111-1111-4111-8111-111111111111','Stomach','A muscular sac that mixes food with acid and enzymes, breaking proteins down into smaller pieces.',4),
('11111111-1111-4111-8111-111111111111','Small intestine','A long coiled tube where most digestion finishes and nutrients are absorbed through villi into the bloodstream.',5),
('11111111-1111-4111-8111-111111111111','Pancreas','Produces digestive enzymes and the hormones insulin and glucagon, which control blood sugar levels.',6),
('11111111-1111-4111-8111-111111111111','Brain','The control centre of the nervous system, processing sensory information and coordinating movement, memory and thought.',7),
('11111111-1111-4111-8111-111111111111','Skin','The largest organ overall. It protects against infection, regulates temperature and senses touch.',8),
('11111111-1111-4111-8111-111111111111','Alveoli','Microscopic air sacs in the lungs where gas exchange between air and blood actually happens.',9),

('22222222-2222-4222-8222-222222222222','la bibliothèque','the library (feminine noun)',0),
('22222222-2222-4222-8222-222222222222','faire les courses','to do the shopping',1),
('22222222-2222-4222-8222-222222222222','le quartier','the neighbourhood (masculine noun)',2),
('22222222-2222-4222-8222-222222222222','se réveiller','to wake up (reflexive verb)',3),
('22222222-2222-4222-8222-222222222222','toujours','always / still',4),
('22222222-2222-4222-8222-222222222222','le repas','the meal (masculine noun)',5),
('22222222-2222-4222-8222-222222222222','pendant','during / for (a length of time)',6),
('22222222-2222-4222-8222-222222222222','chercher','to look for (no preposition needed after it)',7),
('22222222-2222-4222-8222-222222222222','la gare','the train station (feminine noun)',8),
('22222222-2222-4222-8222-222222222222','d''habitude','usually',9),

('33333333-3333-4333-8333-333333333333','What was the Iron Curtain?','The political and physical divide separating Soviet-controlled Eastern Europe from the democratic West after 1945.',0),
('33333333-3333-4333-8333-333333333333','What was the Marshall Plan?','A US programme from 1948 that sent billions of dollars of aid to rebuild Western Europe and limit the appeal of communism.',1),
('33333333-3333-4333-8333-333333333333','What was the Cuban Missile Crisis?','A 13-day standoff in 1962 after the USSR placed nuclear missiles in Cuba. It brought the superpowers closest to nuclear war.',2),
('33333333-3333-4333-8333-333333333333','What was NATO?','A military alliance formed in 1949 by Western countries agreeing that an attack on one is an attack on all.',3),
('33333333-3333-4333-8333-333333333333','What was the Warsaw Pact?','The Soviet answer to NATO, signed in 1955, binding the Eastern Bloc states into a military alliance led by Moscow.',4),
('33333333-3333-4333-8333-333333333333','Why was the Berlin Wall built?','Built in 1961 by East Germany to stop citizens escaping to West Berlin. It became the symbol of a divided Europe.',5),
('33333333-3333-4333-8333-333333333333','What does détente mean?','A 1970s easing of tension between the superpowers, marked by arms-limitation talks such as SALT.',6),
('33333333-3333-4333-8333-333333333333','When and how did the Cold War end?','With the fall of the Berlin Wall in 1989 and the dissolution of the Soviet Union in December 1991.',7),

('44444444-4444-4444-8444-444444444444','Atomic radius trend','Decreases left to right across a period (stronger nuclear pull) and increases down a group (more electron shells).',0),
('44444444-4444-4444-8444-444444444444','Ionisation energy','The energy needed to remove one electron from a gaseous atom. It increases across a period and decreases down a group.',1),
('44444444-4444-4444-8444-444444444444','Electronegativity','An atom''s ability to attract a shared pair of electrons. Fluorine is the most electronegative element.',2),
('44444444-4444-4444-8444-444444444444','Shielding effect','Inner electrons reduce the pull the nucleus has on outer electrons, which is why atoms get larger down a group.',3),
('44444444-4444-4444-8444-444444444444','Metallic character','Increases down a group and decreases across a period, because electrons are lost more easily from larger atoms.',4),
('44444444-4444-4444-8444-444444444444','Group 1 alkali metals','Very reactive metals with one outer electron. Reactivity increases down the group.',5),
('44444444-4444-4444-8444-444444444444','Group 17 halogens','Highly reactive non-metals needing one electron to fill their outer shell. Reactivity decreases down the group.',6),
('44444444-4444-4444-8444-444444444444','Noble gases','Group 18 elements with full outer shells, making them almost completely unreactive.',7),

('55555555-5555-4555-8555-555555555555','Standard form of a quadratic','ax² + bx + c = 0, where a ≠ 0.',0),
('55555555-5555-4555-8555-555555555555','The quadratic formula','x = (−b ± √(b² − 4ac)) / 2a',1),
('55555555-5555-4555-8555-555555555555','The discriminant','b² − 4ac. Positive means two real roots, zero means one repeated root, negative means no real roots.',2),
('55555555-5555-4555-8555-555555555555','What does factorising do?','Rewrites the quadratic as a product of two brackets, so each bracket set to zero gives a root.',3),
('55555555-5555-4555-8555-555555555555','Vertex of a parabola','The turning point, found at x = −b / 2a.',4),
('55555555-5555-4555-8555-555555555555','Completing the square','Rewriting ax² + bx + c in the form a(x + p)² + q, which reveals the vertex directly.',5),
('55555555-5555-4555-8555-555555555555','Roots vs. x-intercepts','The roots of a quadratic are exactly where its parabola crosses the x-axis.',6);
