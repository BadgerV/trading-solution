# Shared Trading Dashboard

Static Netlify dashboard for shared trade tracking with Supabase read access and password-protected write operations through Netlify Functions.

## 1) Setup files
1. Copy `config.example.js` to `config.js` and set your Supabase public values.
2. Install dependencies for functions:
   ```bash
   npm install
   ```
3. Run SQL in `supabase.sql` in your Supabase SQL editor.

## 2) Environment variables (Netlify)
Set these in **Site settings → Environment variables**:
- `ADMIN_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 3) Local development
```bash
npx netlify dev
```
Then open the local URL printed by Netlify.

## 4) Deploy
- Push the repo to GitHub.
- In Netlify, import the repo.
- Build command: *(none required)*
- Publish directory: `.`
- Functions directory: `netlify/functions` (already in `netlify.toml`).
- Add the environment variables.
- Deploy.
