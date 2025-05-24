/*
  Warnings:

  - Changed the type of `clockStart` on the `booking` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `clockEnd` on the `booking` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "booking" DROP COLUMN "clockStart",
ADD COLUMN     "clockStart" JSONB NOT NULL,
DROP COLUMN "clockEnd",
ADD COLUMN     "clockEnd" JSONB NOT NULL;
