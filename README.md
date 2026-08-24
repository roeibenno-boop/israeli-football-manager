# Israeli Football Manager

A football club management game for web and mobile, starting with the Israeli
Premier League (Ligat ha'Al). Built with Expo (React Native + react-native-web)
and Supabase.

See [CLAUDE.md](./CLAUDE.md) for the full stack, folder structure, and
conventions.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase project's URL and
   anon key (Supabase dashboard → Project Settings → API).

3. Run the SQL in `supabase/migrations/0001_init.sql` against your Supabase
   project (SQL Editor, or the Supabase CLI).

4. Start the app

   ```bash
   npx expo start
   ```

   Press `w` for web, or scan the QR code with the **Expo Go** app on your
   phone.
