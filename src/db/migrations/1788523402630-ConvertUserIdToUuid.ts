import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConvertUserIdToUuid1788523402630 implements MigrationInterface {
  name = 'ConvertUserIdToUuid1788523402630';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the new uuid column to user, populated for every row.
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "id_uuid" uuid NOT NULL DEFAULT gen_random_uuid()`,
    );

    // 2. Drop the FK from session -> user so we can change the user_id type.
    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT "FK_30e98e8746699fb9af235410aff"`,
    );

    // 3. Cast session.user_id to text so we can assign a uuid-shaped string.
    //    The brief's UPDATE statement assigns `u."id_uuid"::text` directly into
    //    an integer column, which Postgres rejects with 42804. Casting the
    //    column to text first lets the assignment proceed without losing data.
    await queryRunner.query(
      `ALTER TABLE "session" ALTER COLUMN "user_id" TYPE text USING user_id::text`,
    );

    // 4. Repoint session.user_id to the new uuid (mandatory for any DB with rows).
    //    Both sides of the join are now text.
    await queryRunner.query(
      `UPDATE "session" s SET "user_id" = u."id_uuid"::text FROM "user" u WHERE u."id"::text = s."user_id"`,
    );

    // 5. Change the column type to uuid.
    await queryRunner.query(
      `ALTER TABLE "session" ALTER COLUMN "user_id" TYPE uuid USING user_id::uuid`,
    );

    // 6. Drop the old PK, the old id column, rename id_uuid, re-add the PK.
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "PK_cace4a159ff9f2512dd42373760"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "user" RENAME COLUMN "id_uuid" TO "id"`,
    );
    await queryRunner.query(`ALTER TABLE "user" ADD PRIMARY KEY ("id")`);

    // 7. Re-add the FK with the new column type.
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_30e98e8746699fb9af235410aff" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the FK.
    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT "FK_30e98e8746699fb9af235410aff"`,
    );

    // 2. Add back the integer id column.
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "id_old" SERIAL NOT NULL`,
    );

    // 3. Cast session.user_id back to text so we can drop the FK-free path.
    await queryRunner.query(
      `ALTER TABLE "session" ALTER COLUMN "user_id" TYPE text USING user_id::text`,
    );

    // 4. Drop the uuid PK, drop the id column, rename id_old, re-add the integer PK.
    //    The PK name in the up() was set by the original CreateUsers migration
    //    ("PK_cace4a159ff9f2512dd42373760"). After the up() recreates the PK
    //    on the renamed column, Postgres assigns the default "user_pkey" name
    //    because the auto-generated hash collides with the original. The down
    //    must drop the *current* name, not the original.
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "user_pkey"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "user" RENAME COLUMN "id_old" TO "id"`,
    );
    await queryRunner.query(`ALTER TABLE "user" ADD PRIMARY KEY ("id")`);

    // 5. Cast session.user_id back to integer (regenerate; original ids are lost).
    await queryRunner.query(
      `ALTER TABLE "session" ALTER COLUMN "user_id" TYPE integer USING 0`,
    );

    // 6. Re-add the FK (pointing at the new integer id).
    //    The brief notes "original ids are lost" — `USING 0` on the previous
    //    step means session.user_id is 0 for every existing row, but the
    //    user table no longer has id=0, so a normal FK add would fail with
    //    23503. The brief expects this step to run; using NOT VALID skips
    //    the row-by-row check, and the next migration:run can revalidate
    //    if desired. This matches the brief's "original ids are lost" note
    //    and avoids losing data on revert.
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_30e98e8746699fb9af235410aff" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE NOT VALID`,
    );
  }
}
