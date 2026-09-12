-- Lab 3: migrate the Lab 2 Development Requester model into a real
-- authenticated User model, preserving all existing rows and the Ticket
-- ownership foreign key (specification.md Section 7, "Migration strategy").
-- A RENAME is used instead of DROP+CREATE so no existing data is lost.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- RenameTable (preserves rows and the Ticket.requesterId foreign key)
ALTER TABLE "RequesterUser" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "RequesterUser_pkey" TO "User_pkey";
ALTER INDEX "RequesterUser_email_key" RENAME TO "User_email_key";

-- AddColumn: auth fields. passwordHash defaults to '' only as a transient
-- placeholder — the Lab 3 seed script immediately overwrites every existing
-- row with a real bcrypt hash of the documented local-dev seed password
-- (specification.md BR-37), and every row is REQUESTER role by default,
-- matching what these rows actually were under Lab 2.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'REQUESTER';
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
