import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/http/errors";

const mocks = vi.hoisted(() => ({
  database: { kind: "database" },
  requireActiveUser: vi.fn(),
  getDatabase: vi.fn(),
  createProject: vi.fn(),
  getProjectById: vi.fn(),
  hasDatabaseErrorCode: vi.fn(),
  listProjects: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock("@/server/auth", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/server/db/client", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("@/server/db/repositories", () => ({
  createProject: mocks.createProject,
  getProjectById: mocks.getProjectById,
  hasDatabaseErrorCode: mocks.hasDatabaseErrorCode,
  listProjects: mocks.listProjects,
  updateProject: mocks.updateProject,
}));
vi.mock("@/server/logging/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { GET as listProjectsRoute, POST as createProjectRoute } from "@/app/api/projects/route";
import { PATCH as updateProjectRoute } from "@/app/api/projects/[projectId]/route";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "10000000-0000-4000-8000-000000000002";
const PROJECT_ID = "20000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-21T00:00:00.000Z");

const user = {
  id: USER_ID,
  email: "person@example.com",
  displayName: "Person Example",
  role: "user" as const,
  status: "active" as const,
  sessionVersion: 1,
  emailVerifiedAt: null,
  lastLoginAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const project = {
  id: PROJECT_ID,
  ownerId: USER_ID,
  name: "Acme",
  targetDomain: "example.com",
  description: null,
  defaultCountryCode: "US",
  defaultLanguageCode: "en",
  status: "active" as const,
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireActiveUser.mockResolvedValue(user);
  mocks.getDatabase.mockReturnValue(mocks.database);
  mocks.hasDatabaseErrorCode.mockReturnValue(false);
  mocks.listProjects.mockResolvedValue({ items: [], nextCursor: null });
  mocks.getProjectById.mockResolvedValue(null);
});

describe("projects API routes", () => {
  it("rejects unauthenticated listing before accessing tenant data", async () => {
    mocks.requireActiveUser.mockRejectedValue(
      new AppError("Sign in to continue.", "UNAUTHENTICATED", 401, false),
    );

    const response = await listProjectsRoute(
      new Request("https://app.example.test/api/projects", {
        headers: { "x-request-id": "projects-auth-1" },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "UNAUTHENTICATED", requestId: "projects-auth-1" },
    });
    expect(mocks.listProjects).not.toHaveBeenCalled();
  });

  it("lists only the authenticated tenant and omits owner identifiers", async () => {
    mocks.listProjects.mockResolvedValue({
      items: [{ ...project, ownerId: OTHER_USER_ID }],
      nextCursor: null,
    });

    const response = await listProjectsRoute(
      new Request("https://app.example.test/api/projects"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.listProjects).toHaveBeenCalledWith(mocks.database, USER_ID, { limit: 100 });
    expect(payload.projects).toEqual([
      expect.objectContaining({ id: PROJECT_ID, name: "Acme" }),
    ]);
    expect(payload.projects[0]).not.toHaveProperty("ownerId");
  });

  it("rejects cross-origin project creation before authentication or body processing", async () => {
    const response = await createProjectRoute(
      projectRequest(
        { name: "Acme", countryCode: "US", languageCode: "en" },
        { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
      ),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("INVALID_ORIGIN");
    expect(mocks.requireActiveUser).not.toHaveBeenCalled();
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("rejects oversized and schema-invalid project bodies without writing", async () => {
    const oversized = await createProjectRoute(
      projectRequest({}, { "content-length": String(8 * 1024 + 1) }),
    );
    expect(oversized.status).toBe(413);
    expect((await oversized.json()).error.code).toBe("PAYLOAD_TOO_LARGE");

    const invalid = await createProjectRoute(
      projectRequest({
        name: "A",
        targetDomain: "http://localhost",
        countryCode: "USA",
        languageCode: "x",
      }),
    );
    const invalidPayload = await invalid.json();
    expect(invalid.status).toBe(400);
    expect(invalidPayload.error.code).toBe("VALIDATION_ERROR");
    expect(invalidPayload.error.fields).toMatchObject({
      name: expect.any(Array),
      countryCode: expect.any(Array),
      languageCode: expect.any(Array),
      targetDomain: expect.any(Array),
    });
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("creates a normalized project for the session tenant and ignores ownership fields", async () => {
    mocks.createProject.mockResolvedValue(project);

    const response = await createProjectRoute(
      projectRequest({
        name: "  Acme  ",
        targetDomain: "HTTPS://EXAMPLE.COM/path",
        countryCode: "us",
        languageCode: "en",
        ownerId: OTHER_USER_ID,
        role: "admin",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.createProject).toHaveBeenCalledWith(mocks.database, USER_ID, {
      name: "Acme",
      targetDomain: "example.com",
      defaultCountryCode: "US",
      defaultLanguageCode: "en",
    });
    expect(payload.project).toEqual({
      id: PROJECT_ID,
      name: "Acme",
      targetDomain: "example.com",
      description: null,
      countryCode: "US",
      languageCode: "en",
      status: "active",
      version: 1,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(payload.project).not.toHaveProperty("ownerId");
  });

  it("updates a project with optimistic versioning inside the session tenant", async () => {
    const updated = {
      ...project,
      name: "Acme Labs",
      status: "archived" as const,
      version: 2,
    };
    mocks.updateProject.mockResolvedValue(updated);

    const response = await updateProjectRoute(
      projectRequest({ name: " Acme Labs ", archived: true, version: 1 }, {}, "PATCH"),
      { params: Promise.resolve({ projectId: PROJECT_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updateProject).toHaveBeenCalledWith(
      mocks.database,
      USER_ID,
      PROJECT_ID,
      1,
      { name: "Acme Labs", status: "archived" },
    );
    expect((await response.json()).project).toMatchObject({
      id: PROJECT_ID,
      name: "Acme Labs",
      status: "archived",
      version: 2,
    });
  });

  it("does not reveal whether a failed update belongs to another tenant", async () => {
    mocks.updateProject.mockResolvedValue(null);
    mocks.getProjectById.mockResolvedValue(null);

    const response = await updateProjectRoute(
      projectRequest({ archived: true, version: 1 }, {}, "PATCH"),
      { params: Promise.resolve({ projectId: PROJECT_ID }) },
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error).toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.updateProject).toHaveBeenCalledWith(
      mocks.database,
      USER_ID,
      PROJECT_ID,
      1,
      { status: "archived" },
    );
    expect(mocks.getProjectById).toHaveBeenCalledWith(mocks.database, USER_ID, PROJECT_ID);
  });
});

function projectRequest(
  body: unknown,
  headers: Record<string, string> = {},
  method = "POST",
) {
  return new Request(
    method === "PATCH"
      ? `https://app.example.test/api/projects/${PROJECT_ID}`
      : "https://app.example.test/api/projects",
    {
      method,
      headers: {
        origin: "https://app.example.test",
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
}
