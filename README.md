# CloudST TouchSign

Private agreement workspace built with Next.js, Neon Auth, PostgreSQL and private S3-compatible Neon Object Storage. Includes administrator user management, personal profiles and password changes, document assignments, PDF preview, field mapping, signature and initials capture, and completion certificates.

## Run

Use Node 24 (see `.nvmrc`).

```sh
npm ci
cp .env.example .env
# Populate server credentials for the already-provisioned Neon branch.
npm run dev
```

Open `/auth/sign-in`. Authentication and database connections must reference the same Neon branch. Application roles are ADMIN, UPLOADER and SIGNER. Passwords are managed by Neon Auth. Administrators manage workspace accounts; provider-level password resets depend on Neon Auth capabilities. Users can change their own passwords in My profile.

The database must already contain the TouchSign schema, including the signing workflow migration. Private bootstrap SQL, migration tools, administrator credentials, project guides and agent skills are deliberately excluded from this repository. A new environment requires provisioning that schema through the owner's private maintenance materials before use.

## Configuration

Use `.env.example` for variable names; all real credentials remain server-only. Set `NEXT_PUBLIC_APP_URL` to the deployment's HTTPS origin and allow that origin in Neon Auth. Set the private storage bucket name to the provisioned bucket. AWS-standard storage settings and the documented Neon aliases are supported. Leave optional aliases blank to use AWS settings.

Only enable `TRUST_PROXY_HEADERS=1` behind a proxy that strips and replaces forwarded headers. Vercel's trusted forwarding header is used automatically there. Otherwise the signing record reports the IP as unavailable.

## Verify and build

```sh
npm run typecheck
npm test
npm run build
npm start
```

Optional connected checks: `npm run auth:check`, `npm run storage:check`, and `npm run services:check`. Service/storage checks create and remove a temporary private object. `storage:setup` can provision the configured bucket if absent.

Deploy with the standard Next.js build and start commands, or import this repository into Vercel. Configure environment variables through the hosting provider, using a restricted database runtime role. Never upload `.env`, credential files, database exports, private agreements or build caches.

## Signing workflow

Upload an unencrypted A4 PDF up to 4 MB and 100 pages. Add up to ten signers, place their signature, initials, day, month and place fields, save, then publish. Publication freezes the fields and participant identities. Assigned users draw signatures and initials, choose a day (01–31) and month, and type their signing place. Day, Month and Place are independent mapped fields for the blanks in the agreement. No geolocation permission is requested. The selected date uses the current South African calendar year; the actual submission timestamp remains in the completion record. Server-side PDF generation and revision checks prevent stale submissions from replacing newer versions.

The final signature automatically locks the agreement and appends a completion certificate. Owners and administrators may also explicitly finalise early; unsigned participants are identified on the certificate. The canonical completed file is hash-checked and immutable through the workspace. Downloaded PDFs are ordinary PDF files, without a cryptographic digital-signature certificate.

Before production use, verify signing, consent denial, downloads and access isolation with disposable agreements and separate accounts on actual desktop and mobile devices. Local automated checks do not establish those live results.

Existing deployments upgrading to mapped signing details must run the backward-compatible upgrade once before deploying the new application:

```sh
node --env-file=.env scripts/upgrade-signing-details.mjs
```

This upgrade extends the existing TouchSign schema; it does not bootstrap a new database. Optional database integration verification: `node --env-file=.env tests/signing-database.mjs` (all fixtures are rolled back). Published and locked field mappings remain frozen; add new fields while an agreement is Draft.
