import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { OAuthProvider, Role, UserStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError, asyncHandler } from "../lib/http";
import { requireAuth, signSessionToken, verifySessionToken } from "../lib/auth";

export const authRouter = Router();

const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const oauthStateSecret = process.env.OAUTH_STATE_SECRET ?? "dev-secret";
const linkedInScopes =
  process.env.LINKEDIN_SCOPES ?? "openid profile email";

const base64UrlEncode = (value: string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const base64UrlDecode = (value: string) =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf-8"
  );

const signState = (payload: string) =>
  crypto.createHmac("sha256", oauthStateSecret).update(payload).digest("hex");

const buildState = (data: { role?: Role; userId?: string }) => {
  const payload = JSON.stringify({
    role: data.role,
    userId: data.userId,
    nonce: crypto.randomBytes(8).toString("hex"),
    ts: Date.now(),
  });
  const encoded = base64UrlEncode(payload);
  const signature = signState(encoded);
  return `${encoded}.${signature}`;
};

const verifyState = (state: string) => {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) {
    return null;
  }
  const expected = signState(encoded);
  if (signature !== expected) {
    return null;
  }
  const payload = JSON.parse(base64UrlDecode(encoded)) as {
    role?: Role;
    userId?: string;
    ts: number;
  };
  if (Date.now() - payload.ts > 10 * 60 * 1000) {
    return null;
  }
  return payload;
};

const upsertOauthUser = async (params: {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  name: string;
  role?: Role;
  userIdOverride?: string;
}) => {
  if (params.userIdOverride) {
    const user = await prisma.user.findUnique({
      where: { id: params.userIdOverride },
    });
    if (!user) {
      throw new HttpError(404, "user_not_found");
    }
    if (params.role && user.role !== params.role) {
      throw new HttpError(409, "role_mismatch");
    }
    await prisma.oAuthAccount.upsert({
      where: {
        provider_providerUserId: {
          provider: params.provider,
          providerUserId: params.providerUserId,
        },
      },
      create: {
        userId: user.id,
        provider: params.provider,
        providerUserId: params.providerUserId,
      },
      update: {
        userId: user.id,
      },
    });
    return user;
  }

  const existingOauth = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: params.provider,
        providerUserId: params.providerUserId,
      },
    },
    include: { user: true },
  });

  if (existingOauth) {
    return existingOauth.user;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: params.email },
  });

  if (existingUser) {
    if (params.role && existingUser.role !== params.role) {
      throw new HttpError(409, "role_mismatch");
    }
    await prisma.oAuthAccount.create({
      data: {
        userId: existingUser.id,
        provider: params.provider,
        providerUserId: params.providerUserId,
      },
    });
    return existingUser;
  }

  if (!params.role) {
    throw new HttpError(400, "role_required");
  }

  const user = await prisma.user.create({
    data: {
      email: params.email,
      name: params.name,
      role: params.role,
      status:
        params.role === Role.MENTOR ? UserStatus.PENDING : UserStatus.ACTIVE,
    },
  });

  await prisma.oAuthAccount.create({
    data: {
      userId: user.id,
      provider: params.provider,
      providerUserId: params.providerUserId,
    },
  });

  return user;
};

const getUserIdFromSession = (req: { cookies?: Record<string, string> }) => {
  const token = req.cookies?.wb_session;
  if (!token) return null;
  try {
    const session = verifySessionToken(token);
    return session.id;
  } catch {
    return null;
  }
};

const updateOauthTokens = async (params: {
  provider: OAuthProvider;
  providerUserId: string;
  accessToken?: string;
  refreshToken?: string;
  scopes?: string;
  expiresIn?: number;
}) => {
  if (!params.accessToken) return;
  const expiresAt =
    params.expiresIn && params.expiresIn > 0
      ? new Date(Date.now() + params.expiresIn * 1000)
      : undefined;

  await prisma.oAuthAccount.updateMany({
    where: {
      provider: params.provider,
      providerUserId: params.providerUserId,
    },
    data: {
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      scopes: params.scopes,
      expiresAt,
    },
  });
};

const fetchLinkedInData = async (accessToken: string) => {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [userinfoRes, meRes] = await Promise.allSettled([
    fetch("https://api.linkedin.com/v2/userinfo", { headers }),
    fetch(
      "https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,headline,localizedHeadline,profilePicture(displayImage~:playableStreams),vanityName,locationName,industryName)",
      { headers }
    ),
  ]);

  const userinfo =
    userinfoRes.status === "fulfilled" && userinfoRes.value.ok
      ? await userinfoRes.value.json()
      : null;
  const me =
    meRes.status === "fulfilled" && meRes.value.ok
      ? await meRes.value.json()
      : null;

  return { userinfo, me };
};

const mapLinkedInToMentorProfile = (data: {
  userinfo: Record<string, unknown> | null;
  me: Record<string, unknown> | null;
}) => {
  const result: {
    headline?: string;
    linkedinHeadline?: string;
    linkedinUrl?: string;
    linkedinLocation?: string;
    linkedinIndustry?: string;
    currentCompany?: string;
    currentTitle?: string;
    profilePhotoUrl?: string;
    expertiseTags?: string[];
    achievements?: string;
    linkedinRaw?: Prisma.InputJsonValue;
  } = {};

  const merged = {
    ...(data.userinfo ?? {}),
    ...(data.me ?? {}),
  };
  result.linkedinRaw = merged as Prisma.InputJsonValue;

  const headline =
    (data.me?.localizedHeadline as string | undefined) ??
    (data.me?.headline as string | undefined);
  if (headline) {
    result.headline = headline;
    result.linkedinHeadline = headline;
  }

  if (data.me?.vanityName) {
    result.linkedinUrl = `https://www.linkedin.com/in/${String(
      data.me.vanityName
    )}`;
  }
  if (data.me?.locationName) {
    result.linkedinLocation = String(data.me.locationName);
  }
  if (data.me?.industryName) {
    result.linkedinIndustry = String(data.me.industryName);
  }

  const picture =
    (data.userinfo?.picture as string | undefined) ??
    (data.me?.profilePicture as { "displayImage~"?: { elements?: { identifiers?: { identifier?: string }[] }[] } })
      ?.["displayImage~"]?.elements?.at(-1)?.identifiers?.at(-1)?.identifier;
  if (picture) {
    result.profilePhotoUrl = picture;
  }

  return result;
};

const googleAuthSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  providerUserId: z.string().min(1),
  role: z.nativeEnum(Role).refine((value) => value !== Role.ADMIN, {
    message: "invalid_role",
  }),
  phone: z.string().optional(),
});

authRouter.post(
  "/google",
  asyncHandler(async (req, res) => {
    const input = googleAuthSchema.parse(req.body);
    const user = await upsertOauthUser({
      provider: OAuthProvider.GOOGLE,
      providerUserId: input.providerUserId,
      email: input.email,
      name: input.name,
      role: input.role,
    });

    const token = signSessionToken({
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });
    res.cookie("wb_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      user,
      authToken: token,
    });
  })
);

const linkedinSchema = z.object({
  providerUserId: z.string().min(1),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  scopes: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

authRouter.post(
  "/linkedin",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = linkedinSchema.parse(req.body);

    const existing = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: OAuthProvider.LINKEDIN,
          providerUserId: input.providerUserId,
        },
      },
    });

    if (existing && existing.userId !== req.user?.id) {
      throw new HttpError(409, "oauth_already_linked");
    }

    await prisma.oAuthAccount.upsert({
      where: {
        provider_providerUserId: {
          provider: OAuthProvider.LINKEDIN,
          providerUserId: input.providerUserId,
        },
      },
      create: {
        userId: req.user!.id,
        provider: OAuthProvider.LINKEDIN,
        providerUserId: input.providerUserId,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        scopes: input.scopes,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
      update: {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        scopes: input.scopes,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
    });

    return res.json({ ok: true });
  })
);

authRouter.get(
  "/google/start",
  asyncHandler(async (req, res) => {
    const role = req.query.role
      ? (String(req.query.role).toUpperCase() as Role)
      : undefined;
    const requestCalendar = req.query.calendar === "1";
    const linking = req.query.link === "1";
    if (role && role !== Role.MENTOR && role !== Role.LEARNER) {
      throw new HttpError(400, "invalid_role");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new HttpError(500, "google_oauth_not_configured");
    }

    const scope = [
      "openid",
      "email",
      "profile",
      ...(requestCalendar ? ["https://www.googleapis.com/auth/calendar.events"] : []),
    ].join(" ");

    const userId = linking ? getUserIdFromSession(req) ?? undefined : undefined;
    if (linking && !userId) {
      throw new HttpError(401, "login_required");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
      state: buildState({ role, userId }),
      prompt: requestCalendar ? "consent" : "select_account",
    });

    if (requestCalendar) {
      params.set("access_type", "offline");
      params.set("include_granted_scopes", "true");
    }

    return res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
  })
);

authRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const code = req.query.code ? String(req.query.code) : null;
    const state = req.query.state ? String(req.query.state) : null;
    if (!code || !state) {
      throw new HttpError(400, "missing_code_or_state");
    }
    const stateData = verifyState(state);
    if (!stateData) {
      throw new HttpError(400, "invalid_state");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new HttpError(500, "google_oauth_not_configured");
    }

    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new HttpError(502, "google_token_exchange_failed");
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    const accessToken = tokenPayload.access_token;
    if (!accessToken) {
      throw new HttpError(502, "google_access_token_missing");
    }

    const profileResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!profileResponse.ok) {
      throw new HttpError(502, "google_profile_fetch_failed");
    }

    const profile = (await profileResponse.json()) as {
      sub: string;
      email: string;
      name: string;
      picture?: string;
      given_name?: string;
      family_name?: string;
    };

    const user = await upsertOauthUser({
      provider: OAuthProvider.GOOGLE,
      providerUserId: profile.sub,
      email: profile.email,
      name: profile.name,
      role: stateData.role,
      userIdOverride: stateData.userId,
    });

    await updateOauthTokens({
      provider: OAuthProvider.GOOGLE,
      providerUserId: profile.sub,
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token,
      scopes: tokenPayload.scope,
      expiresIn: tokenPayload.expires_in,
    });

    if (user.role === Role.MENTOR) {
      await prisma.mentorProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          bio: `Google profile imported for ${profile.name}. Please edit.`,
          yearsExperience: 0,
          expertiseTags: [],
          subjectTags: [],
          collectionTags: [],
          languages: [],
          headline: profile.name,
          profilePhotoUrl: profile.picture,
        },
        update: {
          headline: profile.name,
          profilePhotoUrl: profile.picture ?? undefined,
        },
      });
    }

    const token = signSessionToken({
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });
    res.cookie("wb_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(`${appBaseUrl}/auth/success`);
  })
);

authRouter.get(
  "/linkedin/start",
  asyncHandler(async (req, res) => {
    const role = req.query.role
      ? (String(req.query.role).toUpperCase() as Role)
      : undefined;
    const linking = req.query.link === "1";
    if (role && role !== Role.MENTOR && role !== Role.LEARNER) {
      throw new HttpError(400, "invalid_role");
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new HttpError(500, "linkedin_oauth_not_configured");
    }

    const userId = linking ? getUserIdFromSession(req) ?? undefined : undefined;
    if (linking && !userId) {
      throw new HttpError(401, "login_required");
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: linkedInScopes,
      state: buildState({ role, userId }),
    });

    if (linking) {
      params.set("prompt", "consent");
    }

    return res.redirect(
      `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
    );
  })
);

authRouter.get(
  "/linkedin/callback",
  asyncHandler(async (req, res) => {
    const code = req.query.code ? String(req.query.code) : null;
    const state = req.query.state ? String(req.query.state) : null;
    if (!code || !state) {
      throw new HttpError(400, "missing_code_or_state");
    }
    const stateData = verifyState(state);
    if (!stateData) {
      throw new HttpError(400, "invalid_state");
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new HttpError(500, "linkedin_oauth_not_configured");
    }

    const tokenResponse = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new HttpError(502, "linkedin_token_exchange_failed");
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!tokenPayload.access_token) {
      throw new HttpError(502, "linkedin_access_token_missing");
    }

    const linkedInData = await fetchLinkedInData(tokenPayload.access_token);
    if (!linkedInData.userinfo) {
      throw new HttpError(502, "linkedin_profile_fetch_failed");
    }

    const profile = linkedInData.userinfo as {
      sub: string;
      name: string;
      email: string;
      picture?: string;
      given_name?: string;
      family_name?: string;
      localizedFirstName?: string;
      localizedLastName?: string;
      locale?: string;
    };

    const user = await upsertOauthUser({
      provider: OAuthProvider.LINKEDIN,
      providerUserId: profile.sub,
      email: profile.email,
      name: profile.name,
      role: stateData.role,
      userIdOverride: stateData.userId,
    });

    if (user.role === Role.MENTOR) {
      const mapped = mapLinkedInToMentorProfile({
        userinfo: linkedInData.userinfo as Record<string, unknown>,
        me: linkedInData.me as Record<string, unknown>,
      });
      await prisma.mentorProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          bio: `LinkedIn profile imported for ${profile.name}. Please edit.`,
          yearsExperience: 0,
          expertiseTags: [],
          subjectTags: [],
          collectionTags: [],
          languages: [],
          headline: mapped.headline ?? profile.name,
          linkedinHeadline: mapped.linkedinHeadline ?? null,
          linkedinUrl: mapped.linkedinUrl ?? null,
          linkedinLocation: mapped.linkedinLocation ?? null,
          linkedinIndustry: mapped.linkedinIndustry ?? null,
          currentCompany: mapped.currentCompany ?? null,
          currentTitle: mapped.currentTitle ?? null,
          profilePhotoUrl: mapped.profilePhotoUrl ?? profile.picture,
          linkedinRaw: mapped.linkedinRaw ?? (profile as unknown as Prisma.InputJsonValue),
        },
        update: {
          headline: mapped.headline ?? profile.name,
          linkedinHeadline: mapped.linkedinHeadline ?? undefined,
          linkedinUrl: mapped.linkedinUrl ?? undefined,
          linkedinLocation: mapped.linkedinLocation ?? undefined,
          linkedinIndustry: mapped.linkedinIndustry ?? undefined,
          currentCompany: mapped.currentCompany ?? undefined,
          currentTitle: mapped.currentTitle ?? undefined,
          profilePhotoUrl: mapped.profilePhotoUrl ?? profile.picture ?? undefined,
          linkedinRaw: mapped.linkedinRaw ?? (profile as unknown as Prisma.InputJsonValue),
        },
      });
    }

    await updateOauthTokens({
      provider: OAuthProvider.LINKEDIN,
      providerUserId: profile.sub,
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token,
      expiresIn: tokenPayload.expires_in,
    });

    const token = signSessionToken({
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });
    res.cookie("wb_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(`${appBaseUrl}/auth/success`);
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { mentorProfile: true, learnerProfile: true },
    });

    if (!user) {
      throw new HttpError(404, "user_not_found");
    }

    return res.json({ user });
  })
);

authRouter.get(
  "/links",
  requireAuth,
  asyncHandler(async (req, res) => {
    const accounts = await prisma.oAuthAccount.findMany({
      where: { userId: req.user!.id },
      select: { provider: true },
    });
    const providers = new Set(accounts.map((account) => account.provider));
    return res.json({
      googleLinked: providers.has(OAuthProvider.GOOGLE),
      linkedinLinked: providers.has(OAuthProvider.LINKEDIN),
    });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    res.clearCookie("wb_session", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return res.json({ ok: true });
  })
);
