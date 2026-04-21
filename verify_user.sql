UPDATE "users" SET "emailVerified" = true WHERE email = 'avatar@test.com';
SELECT id, email, "emailVerified" FROM "users" WHERE email = 'avatar@test.com';
