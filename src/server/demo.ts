import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { expenses, fixedCosts, households, incomes, members, paySettings, receiptItems } from "@/db/schema";
import type { CategoryId } from "@/lib/categories";
import { DEMO_EMAIL_DOMAIN, DEMO_LIFETIME_HOURS } from "@/lib/demo";
import { MEMBER_COLORS } from "@/lib/model";
import { deleteAccount } from "@/server/account";
import { db } from "@/server/db";
import { lockSyncWrites } from "@/server/sync";

/*
 * Creates a demo account with a filled-in family: the Walkers, in USD, with
 * two paydays, bills, two weeks of spending, a scanned receipt and some extra
 * income. Dates are relative to today, so the demo always looks current.
 *
 * The login account is written straight into Supabase Auth with a random
 * password that is used once to sign in and then forgotten. No email is sent.
 */

const nextSeq = sql`nextval('sync_seq')`;

type ExpenseSeed = {
  who: "emma" | "james";
  amount: number;
  category: CategoryId;
  daysAgo: number;
  merchant?: string;
  note?: string;
  source?: "manual" | "receipt" | "voice";
  items?: [name: string, amount: number, category: CategoryId][];
};

const EXPENSES: ExpenseSeed[] = [
  {
    who: "emma",
    amount: 8452,
    category: "groceries",
    daysAgo: 0,
    merchant: "Green Valley Market",
    source: "receipt",
    items: [
      ["Organic whole milk 1 gal", 589, "groceries"],
      ["Sourdough bread", 499, "groceries"],
      ["Free range eggs 12ct", 429, "groceries"],
      ["Chicken breast 2 lb", 1198, "groceries"],
      ["Bananas", 167, "groceries"],
      ["Greek yogurt 4 pack", 549, "groceries"],
      ["Paper towels 6 roll", 1299, "household"],
      ["Dish soap", 379, "household"],
      ["Kids vitamins", 1399, "health"],
      ["Apple juice 64 oz", 399, "kids"],
      ["Cheddar cheese", 649, "groceries"],
      ["Spinach", 349, "groceries"],
      ["Coffee beans", 547, "groceries"],
    ],
  },
  { who: "emma", amount: 1450, category: "eating_out", daysAgo: 1, note: "Lunch with Sarah", source: "voice" },
  { who: "james", amount: 5200, category: "transport", daysAgo: 2, merchant: "Fuel Stop" },
  { who: "emma", amount: 3999, category: "kids", daysAgo: 3, merchant: "Brick & Block Toys", note: "Birthday present for Lily" },
  { who: "james", amount: 1875, category: "eating_out", daysAgo: 3, merchant: "Luigi's Pizza" },
  { who: "emma", amount: 9630, category: "groceries", daysAgo: 5, merchant: "FreshMart", source: "receipt" },
  { who: "james", amount: 2400, category: "fun", daysAgo: 6, note: "Movie night", source: "voice" },
  { who: "emma", amount: 4500, category: "clothing", daysAgo: 7, merchant: "Urban Threads" },
  { who: "emma", amount: 2850, category: "health", daysAgo: 8, merchant: "City Pharmacy" },
  { who: "james", amount: 11240, category: "groceries", daysAgo: 9, merchant: "FreshMart", source: "receipt" },
  { who: "james", amount: 680, category: "eating_out", daysAgo: 10, merchant: "Bean There Coffee" },
  { who: "emma", amount: 3200, category: "eating_out", daysAgo: 11, note: "Pizza night" },
  { who: "james", amount: 6500, category: "kids", daysAgo: 12, note: "Soccer club fee" },
  { who: "emma", amount: 8900, category: "bills", daysAgo: 13, merchant: "Metro Power" },
  { who: "james", amount: 2299, category: "household", daysAgo: 14, merchant: "HomeBase" },
  { who: "emma", amount: 7415, category: "groceries", daysAgo: 15, merchant: "Green Valley Market", source: "receipt" },
];

const INCOMES = [
  { who: "emma", amount: 32000, source: "side_job", daysAgo: 4, note: "Logo design for a client" },
  { who: "james", amount: 4599, source: "refund", daysAgo: 7, note: "Returned headphones" },
] as const;

function dayAgo(today: Date, days: number): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** A payday that fell `days` ago, as a day of the month that exists in every month. */
function paydayDaysAgo(today: Date, days: number): number {
  return Math.min(28, Number(dayAgo(today, days).slice(8, 10)));
}

export type DemoLogin = { email: string; password: string };

export async function createDemoAccount(): Promise<DemoLogin> {
  const userId = randomUUID();
  const email = `walker-${randomBytes(6).toString("hex")}@${DEMO_EMAIL_DOMAIN}`;
  const password = randomBytes(24).toString("base64url");
  const today = new Date();
  const now = today.toISOString();
  const stamps = { createdAt: now, updatedAt: now, serverSeq: nextSeq };

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, email_change_token_current, reauthentication_token,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
      ) values (
        '00000000-0000-0000-0000-000000000000', ${userId}, 'authenticated', 'authenticated', ${email},
        extensions.crypt(${password}, extensions.gen_salt('bf')), ${now},
        '', '', '', '', '', '', '', '',
        ${JSON.stringify({ provider: "email", providers: ["email"], demo: true })}::jsonb,
        ${JSON.stringify({ sub: userId, name: "Emma Walker", email, email_verified: true })}::jsonb,
        ${now}, ${now}, false, false
      )`);
    await tx.execute(sql`
      insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
      values (
        ${randomUUID()}, ${userId}, ${userId},
        ${JSON.stringify({ sub: userId, name: "Emma Walker", email, email_verified: true })}::jsonb,
        'email', ${now}, ${now}
      )`);

    await lockSyncWrites(tx);
    const householdId = randomUUID();
    await tx.insert(households).values({ id: householdId, name: "The Walkers", currency: "USD", ...stamps });

    const ids = { emma: randomUUID(), james: randomUUID(), lily: randomUUID() };
    await tx.insert(members).values([
      { id: ids.emma, householdId, userId, name: "Emma Walker", role: "owner", color: MEMBER_COLORS[0], ...stamps },
      { id: ids.james, householdId, name: "James Walker", role: "adult", color: MEMBER_COLORS[1], ...stamps },
      { id: ids.lily, householdId, name: "Lily", role: "child", color: MEMBER_COLORS[2], birthYear: 2017, ...stamps },
    ]);

    await tx.insert(paySettings).values([
      { memberId: ids.emma, paydayDay: paydayDaysAgo(today, 15), incomeMinor: 520000, savingsGoalMinor: 30000, ...stamps },
      { memberId: ids.james, paydayDay: paydayDaysAgo(today, 10), incomeMinor: 460000, savingsGoalMinor: 40000, ...stamps },
    ]);
    await tx.insert(fixedCosts).values(
      (
        [
          ["emma", "Rent", 185000],
          ["emma", "Phone & internet", 9500],
          ["emma", "Streaming", 2300],
          ["james", "Car loan", 42000],
          ["james", "Car insurance", 13800],
          ["james", "Gym", 4500],
        ] as const
      ).map(([who, name, amountMinor]) => ({ id: randomUUID(), memberId: ids[who], name, amountMinor, ...stamps })),
    );

    for (const e of EXPENSES) {
      const expenseId = randomUUID();
      await tx.insert(expenses).values({
        id: expenseId,
        householdId,
        memberId: ids[e.who],
        amountMinor: e.amount,
        category: e.category,
        spentOn: dayAgo(today, e.daysAgo),
        merchant: e.merchant ?? null,
        note: e.note ?? null,
        source: e.source ?? "manual",
        createdByUserId: e.who === "emma" ? userId : null,
        ...stamps,
      });
      if (e.items) {
        await tx.insert(receiptItems).values(
          e.items.map(([name, lineTotalMinor, category], position) => ({
            id: randomUUID(),
            expenseId,
            position,
            name,
            lineTotalMinor,
            category,
            ...stamps,
          })),
        );
      }
    }

    await tx.insert(incomes).values(
      INCOMES.map((i) => ({
        id: randomUUID(),
        householdId,
        memberId: ids[i.who],
        amountMinor: i.amount,
        source: i.source,
        receivedOn: dayAgo(today, i.daysAgo),
        note: i.note,
        createdByUserId: i.who === "emma" ? userId : null,
        ...stamps,
      })),
    );
  });

  return { email, password };
}

/** Deletes demo accounts older than their lifetime, a few at a time. */
export async function removeExpiredDemoAccounts(): Promise<number> {
  const cutoff = new Date(Date.now() - DEMO_LIFETIME_HOURS * 3_600_000).toISOString();
  const expired = await db.execute<{ id: string }>(sql`
    select id from auth.users
    where email like ${`%@${DEMO_EMAIL_DOMAIN}`} and created_at < ${cutoff}
    order by created_at limit 10`);
  for (const { id } of expired) await deleteAccount(id);
  return expired.length;
}
