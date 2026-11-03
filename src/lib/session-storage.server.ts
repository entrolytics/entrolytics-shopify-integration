import { Session } from "@shopify/shopify-app-react-router/server";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

import { Prisma, type PrismaClient, type Session as SessionRow } from "../generated/prisma/client";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * Shopify session storage on the app's Prisma 7 client.
 *
 * Replaces `@shopify/shopify-app-session-storage-prisma`, whose releases only support Prisma 6. It
 * reads and writes the `Session` table with the same column mapping as that package (11.0.1), so
 * rows it stored keep loading: user columns are only filled for online sessions, a missing access
 * token is stored as an empty string, and `findSessionsByShop` returns at most 25 sessions, latest
 * expiry first.
 */
export class PrismaSessionStorage implements SessionStorage {
  constructor(private readonly prisma: PrismaClient) {}

  async storeSession(session: Session): Promise<boolean> {
    const data = sessionToRow(session);
    const upsert = () =>
      this.prisma.session.upsert({ where: { id: session.id }, create: data, update: data });

    try {
      await upsert();
    } catch (error) {
      // Two concurrent first writes of the same id both try to insert; the second one updates.
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw error;
      }
      await upsert();
    }
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const row = await this.prisma.session.findUnique({ where: { id } });
    return row ? rowToSession(row) : undefined;
  }

  /** Deleting a session that does not exist succeeds, as in the Shopify adapter. */
  async deleteSession(id: string): Promise<boolean> {
    await this.prisma.session.deleteMany({ where: { id } });
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    await this.prisma.session.deleteMany({ where: { id: { in: ids } } });
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const rows = await this.prisma.session.findMany({
      where: { shop },
      take: 25,
      orderBy: [{ expires: "desc" }],
    });
    return rows.map(rowToSession);
  }
}

function sessionToRow(session: Session): SessionRow {
  const { onlineAccessInfo, refreshToken, refreshTokenExpires } = session.toObject();
  const user = onlineAccessInfo?.associated_user;

  return {
    id: session.id,
    shop: session.shop,
    state: session.state,
    isOnline: session.isOnline,
    scope: session.scope || null,
    expires: session.expires || null,
    accessToken: session.accessToken || "",
    userId: user?.id ? BigInt(user.id) : null,
    firstName: user?.first_name || null,
    lastName: user?.last_name || null,
    email: user?.email || null,
    accountOwner: user?.account_owner || false,
    locale: user?.locale || null,
    collaborator: user?.collaborator || false,
    emailVerified: user?.email_verified || false,
    refreshToken: refreshToken || null,
    refreshTokenExpires: refreshTokenExpires || null,
  };
}

/**
 * Builds the session the way the Shopify adapter does, through `Session.fromPropertyArray` with
 * user data and without empty scope, token and expiry values. One deliberate difference: NULL user
 * columns of an online session are left out instead of being stringified to "null".
 */
function rowToSession(row: SessionRow): Session {
  const entries: [string, string | number | boolean | null][] = [
    ["id", row.id],
    ["shop", row.shop],
    ["state", row.state],
    ["isOnline", row.isOnline],
    ["scope", row.scope || null],
    ["expires", row.expires?.getTime() ?? null],
    ["accessToken", row.accessToken || null],
    ["refreshToken", row.refreshToken || null],
    ["refreshTokenExpires", row.refreshTokenExpires?.getTime() ?? null],
    ["userId", row.userId === null ? null : Number(row.userId)],
    ["firstName", row.firstName],
    ["lastName", row.lastName],
    ["email", row.email],
    ["accountOwner", row.accountOwner],
    ["locale", row.locale],
    ["collaborator", row.collaborator],
    ["emailVerified", row.emailVerified],
  ];

  return Session.fromPropertyArray(
    entries.filter((entry): entry is [string, string | number | boolean] => entry[1] !== null),
    true,
  );
}
