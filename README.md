This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Clerk setup (Sign-in)

This project includes a basic Clerk sign-in integration scaffolded in the app:

- `app/clerk/ClerkProviderClient.tsx` — client wrapper for `ClerkProvider`.
- `app/sign-in/page.tsx` — sign-in page that renders Clerk's `<SignIn />` component.

To enable Clerk locally:

1. Install the new dependency:

```powershell
npm install
```

2. Create a `.env.local` file in the project root with these variables (values from your Clerk dashboard):

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_your_publishable_key_here
# optional server-side key used by Clerk SDKs
CLERK_API_KEY=sk_your_api_key_here
```

3. Start the dev server:

```powershell
npm run dev
```

If you don't set the env vars yet, the app will still run, but Clerk functionality will not be available until the keys are configured.

### Encryption key for middleware

If you use Clerk's middleware with `secretKey` (the server secret), the middleware requires an additional `CLERK_ENCRYPTION_KEY` to securely propagate the secret. Without it you'll see an error like "Missing CLERK_ENCRYPTION_KEY".

Generate a secure key (32 bytes or more) and add it to `.env.local`:

```powershell
# generate a 32-byte hex key using Node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# then add to .env.local
# CLERK_ENCRYPTION_KEY=your_generated_hex_value
```

Restart the dev server after adding env vars:

```powershell
npm run dev
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
