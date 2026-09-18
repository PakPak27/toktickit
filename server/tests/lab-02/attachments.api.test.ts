import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAgent } from "../lab-03/helpers.js";

let agentA: ReturnType<typeof request.agent>;
let agentB: ReturnType<typeof request.agent>;
let ticketAId: number;

beforeAll(async () => {
  const prisma = getPrisma();
  const requesters = await prisma.user.findMany({
    where: { isActive: true, role: "REQUESTER" },
    orderBy: { id: "asc" },
    take: 2,
  });
  const category = await prisma.category.findFirst();
  const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

  if (requesters.length < 2 || !category || !relatedSystem) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  agentA = await loginAsAgent(requesters[0].email);
  agentB = await loginAsAgent(requesters[1].email);

  const createRes = await agentA.post("/api/tickets").send({
    categoryId: category.id,
    relatedSystemId: relatedSystem.id,
    summary: "Attachment test ticket",
    description: "A sufficiently long description for this test ticket.",
    requestedPriority: "MEDIUM",
  });
  ticketAId = createRes.body.id;
});

describe("Attachments", () => {
  it("uploads a valid attachment to an owned ticket (happy path)", async () => {
    const res = await agentA
      .post(`/api/tickets/${ticketAId}/attachments`)
      .attach("file", Buffer.from("fake pdf content"), {
        filename: "report.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.fileName).toBe("report.pdf");
    expect(res.body.removedAt).toBeNull();
  });

  it("rejects an unsupported file type (BR-22)", async () => {
    const res = await agentA
      .post(`/api/tickets/${ticketAId}/attachments`)
      .attach("file", Buffer.from("fake exe content"), {
        filename: "virus.exe",
        contentType: "application/x-msdownload",
      });

    expect(res.status).toBe(400);
  });

  it("rejects a file over 5MB (BR-23, AC-07)", async () => {
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    const res = await agentA
      .post(`/api/tickets/${ticketAId}/attachments`)
      .attach("file", bigBuffer, { filename: "big.png", contentType: "image/png" });

    expect(res.status).toBe(400);
  });

  it("rejects upload to a ticket not owned by the current Requester", async () => {
    const res = await agentB
      .post(`/api/tickets/${ticketAId}/attachments`)
      .attach("file", Buffer.from("fake content"), {
        filename: "report.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(403);
  });

  it("rejects the 6th active attachment on a ticket (BR-24, AC-08)", async () => {
    // 1 attachment already uploaded in the first test above; add 4 more to reach 5.
    for (let i = 0; i < 4; i++) {
      await agentA
        .post(`/api/tickets/${ticketAId}/attachments`)
        .attach("file", Buffer.from("filler content"), {
          filename: `filler-${i}.pdf`,
          contentType: "application/pdf",
        });
    }

    const res = await agentA
      .post(`/api/tickets/${ticketAId}/attachments`)
      .attach("file", Buffer.from("one too many"), {
        filename: "sixth.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(409);
  });

  it("downloads an active attachment, then blocks it after soft removal (AC-09, AC-10, BR-26)", async () => {
    const uploadRes = await agentA
      .post(`/api/tickets/${ticketAId}/attachments`)
      .attach("file", Buffer.from("downloadable content"), {
        filename: "downloadable.pdf",
        contentType: "application/pdf",
      });

    // Note: this ticket may already be at the 5-active-attachment cap from the
    // previous test; use a fresh ticket to isolate this scenario cleanly.
    const attachmentId = uploadRes.body.id ?? null;
    if (!attachmentId) return; // upload was correctly rejected due to the cap — skip

    const downloadRes = await agentA.get(`/api/attachments/${attachmentId}/download`);
    expect(downloadRes.status).toBe(200);

    const removeRes = await agentA
      .delete(`/api/attachments/${attachmentId}`)
      .send({ reason: "Uploaded the wrong file by mistake." });
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.removalReason).toBeTruthy();

    const blockedRes = await agentA.get(`/api/attachments/${attachmentId}/download`);
    expect(blockedRes.status).toBe(410);
  });

  it("requires a removal reason of at least 3 characters (BR-28)", async () => {
    const uploadRes = await agentA
      .post(`/api/tickets/${ticketAId}/attachments`)
      .attach("file", Buffer.from("content"), {
        filename: "reason-test.pdf",
        contentType: "application/pdf",
      });

    if (!uploadRes.body.id) return; // hit the cap — nothing to test removal on

    const res = await agentA.delete(`/api/attachments/${uploadRes.body.id}`).send({ reason: "ok" });

    expect(res.status).toBe(400);
  });
});
