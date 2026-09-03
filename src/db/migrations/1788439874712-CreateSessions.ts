import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessions1788439874712 implements MigrationInterface {
  name = 'CreateSessions1788439874712';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "session" (
      "id" uuid NOT NULL,
      "user_id" integer NOT NULL,
      "user_agent" character varying,
      "ip_address" character varying,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      CONSTRAINT "PK_session_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "idx_session_user_id" ON "session" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_session_expires_at" ON "session" ("expires_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_session_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT "FK_session_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "idx_session_expires_at"`);
    await queryRunner.query(`DROP INDEX "idx_session_user_id"`);
    await queryRunner.query(`DROP TABLE "session"`);
  }
}
