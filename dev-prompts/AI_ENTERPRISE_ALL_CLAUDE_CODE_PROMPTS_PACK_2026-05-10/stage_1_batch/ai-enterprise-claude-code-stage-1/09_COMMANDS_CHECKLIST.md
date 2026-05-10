# Commands Checklist

Run from project root unless otherwise stated.

## Baseline

```bash
pwd
ls
cat package.json
npm test
npm run build
npx tsc --noEmit
```

## Prisma checks

```bash
ls prisma
cat prisma/schema.prisma
cat prisma.config.ts 2>/dev/null || true
grep -R "generated/prisma/client" -n .
grep -R "new PrismaClient" -n lib app prisma .
npx prisma generate
```

## Font checks

```bash
grep -R "next/font/google" -n app components lib .
grep -R "Cormorant\|Geist" -n app components lib .
```

## Capabilities data flow

```bash
grep -R "seed-capabilities" -n .
grep -R "VendorCapability" -n .
grep -R "capabilities" -n app lib components | head -100
```

## Truth/evidence

```bash
grep -R "EvidenceSource" -n .
grep -R "TruthRecord" -n .
grep -R "evidenceGrade" -n lib app components | head -100
grep -R "dataStatus" -n lib app components | head -100
```

## Model inventory

```bash
grep -R "CommercialModel" -n .
grep -R "model-inventory" -n .
```

## Investor Tools

```bash
grep -R "investor-tools" -n app lib components .
grep -R "simulator" -n app lib components | head -100
```

## Connector status

```bash
grep -R "connector" -n lib app | head -100
grep -R "data-sources" -n app lib components .
```

## After every task

```bash
npm test
npm run build
npx tsc --noEmit
```

If any fail, stop and fix before moving on.
