CREATE TYPE "public"."category" AS ENUM('groceries', 'household', 'eating_out', 'transport', 'kids', 'health', 'clothing', 'fun', 'bills', 'other');--> statement-breakpoint
CREATE TYPE "public"."expense_source" AS ENUM('manual', 'receipt', 'voice');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'adult', 'child');--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"category" "category" NOT NULL,
	"spent_on" date NOT NULL,
	"merchant" varchar(120),
	"note" varchar(280),
	"source" "expense_source" DEFAULT 'manual' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"server_seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fixed_costs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"member_id" uuid NOT NULL,
	"name" varchar(60) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"server_seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fixed_costs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"currency" char(3) NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"server_seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(60) NOT NULL,
	"role" "member_role" NOT NULL,
	"color" varchar(7) NOT NULL,
	"birth_year" smallint,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"server_seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pay_settings" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"payday_day" smallint NOT NULL,
	"income_minor" bigint NOT NULL,
	"savings_goal_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	"server_seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pay_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "receipt_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expense_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"quantity_milli" integer DEFAULT 1000 NOT NULL,
	"unit_price" numeric(19, 6),
	"line_total_minor" bigint NOT NULL,
	"category" "category" NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"server_seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receipt_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_costs" ADD CONSTRAINT "fixed_costs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_settings" ADD CONSTRAINT "pay_settings_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_household_spent_idx" ON "expenses" USING btree ("household_id","spent_on");--> statement-breakpoint
CREATE INDEX "expenses_household_seq_idx" ON "expenses" USING btree ("household_id","server_seq");--> statement-breakpoint
CREATE INDEX "fixed_costs_member_idx" ON "fixed_costs" USING btree ("member_id","server_seq");--> statement-breakpoint
CREATE INDEX "households_seq_idx" ON "households" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "members_household_idx" ON "members" USING btree ("household_id","server_seq");--> statement-breakpoint
CREATE INDEX "members_user_idx" ON "members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_household_user_unique" ON "members" USING btree ("household_id","user_id");--> statement-breakpoint
CREATE INDEX "pay_settings_seq_idx" ON "pay_settings" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "receipt_items_expense_idx" ON "receipt_items" USING btree ("expense_id","server_seq");