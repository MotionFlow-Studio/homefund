CREATE TYPE "public"."income_source" AS ENUM('bonus', 'side_job', 'refund', 'gift', 'sale', 'benefit', 'other');--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"source" "income_source" NOT NULL,
	"received_on" date NOT NULL,
	"note" varchar(280),
	"created_by_user_id" uuid,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"server_seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incomes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incomes_household_received_idx" ON "incomes" USING btree ("household_id","received_on");--> statement-breakpoint
CREATE INDEX "incomes_household_seq_idx" ON "incomes" USING btree ("household_id","server_seq");