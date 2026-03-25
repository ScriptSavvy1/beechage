# Name
### beec-hage

# Synopsis


# Description

# Example

# Install:
`npm install beec-hage`

# Test:
`npm test`

#License:

## Deployment (Vercel + Prisma Postgres)

### What to set
The app expects these environment variables:
- `DATABASE_URL` (Prisma)
- `AUTH_SECRET` (NextAuth + middleware)
- `AUTH_URL` (recommended; helps NextAuth use deterministic callback URLs in production)

### Local development (keep working)
- Keep `DATABASE_URL` pointing to your local PostgreSQL (your current `.env.example` already does that).
- Keep `AUTH_URL` as `http://localhost:3000` (or your local port).

### Production (Vercel)
Set these in Vercel → Project Settings → Environment Variables:
- `DATABASE_URL` = your Prisma Postgres connection string
- `AUTH_SECRET` = the same secret you generated locally (do not change across deployments)
- `AUTH_URL` = your deployed URL (example: `https://beec-hage.vercel.app`)

### Prisma commands for production DB
Before deploying (or right after connecting the production DB), run:

```bash
# 1) Generate Prisma client
npx prisma generate

# 2) Apply migrations to production
npx prisma migrate deploy

# 3) Optional (recommended for first demo)
npm run db:seed:prod
```

### Local vs production data
Your local DB does NOT automatically sync to production.
If you deploy without running migrations + seed on the production `DATABASE_URL`, you may see:
- login failing (no seeded users)
- empty services/categories (no catalog data)


