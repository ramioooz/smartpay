/*
  This script will be fully implemented once merchant-srv Prisma schema and generated client exist.
*/

async function seed() {
  // TODO: wire Merchant Prisma upsert and Mongo merchant config seeding.
  console.log('Seed script placeholder: merchant Prisma client is not available in this PR yet.');
}

seed().catch((error) => {
  console.error('Seed script failed', error);
  process.exit(1);
});
