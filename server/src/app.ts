import { createTicketWithRetry } from "./ticketNumber.js";
import { validateTicketInput } from "./validation.js";
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getPrisma } from "./prisma.js";
import type { Prisma, TicketStatus } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { authRouter } from "./authRoutes.js";
import { requireAuth, requirePasswordChangeComplete, requireRole } from "./authMiddleware.js";
import { isValidTransition, validNextStatuses, ALL_STATUSES } from "./statusTransitions.js";
import { adminRouter } from "./adminRoutes.js";
import { evaluateResolutionGate } from "./resolutionGate.js";

// Lab 2's Requester ticket/attachment endpoints, now gated by an
// authenticated Requester session (BR-09) instead of a client-supplied
// X-Requester-Id header.
const requireRequesterSession = [requireAuth, requirePasswordChangeComplete, requireRole("REQUESTER")];
// Comments are shared across roles (Requester on their own Ticket, any IT
// Staff/Administrator) — only authentication + the password gate apply here;
// per-request ownership is checked inside each handler.
const requireAuthenticatedSession = [requireAuth, requirePasswordChangeComplete];
// Issue #32: the Ticket Queue and later staff Ticket operations (#33).
const requireStaffSession = [
  requireAuth,
  requirePasswordChangeComplete,
  requireRole("IT_STAFF", "ADMINISTRATOR"),
];
// Issue #34: Administrator user management.
const requireAdminSession = [requireAuth, requirePasswordChangeComplete, requireRole("ADMINISTRATOR")];

// Shared query-param guards: an unrecognized value is ignored (falls back
// to "no filter"), never passed through to Prisma — an invalid enum value
// or a non-integer id would otherwise throw at the database layer (500)
// instead of failing safely (BR-14-style behavior).
const KNOWN_PRIORITY_VALUES: string[] = ["LOW", "MEDIUM", "HIGH"];
// Issue #33 introduced the full workflow enum — reuse the same list the
// status-transition matrix validates against instead of a stale copy.
const KNOWN_STATUS_VALUES: string[] = ALL_STATUSES;
// Lab 4 — the Requester Dashboard's "Open" metric and its My Tickets
// drill-down (BR-16/FR-11) both need the same "active" definition, so the
// count the Dashboard shows always matches the list the link opens.
const ACTIVE_STATUSES = ALL_STATUSES.filter((s) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(s)) as TicketStatus[];

export const app = express();

// A credentialed (cookie-bearing) cross-origin request needs an explicit
// origin, not the wildcard cors() default — the browser silently refuses
// to set/send the session cookie against "Access-Control-Allow-Origin: *".
// See specification.md §11 / api-spec.md.
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/admin", ...requireAdminSession, adminRouter);

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch (err) {
    console.error("Failed to fetch categories:", err);
    res.status(500).json({ error: "Unable to load categories" });
  }
});

app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const relatedSystems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(relatedSystems);
  } catch (err) {
    console.error("Failed to fetch related systems:", err);
    res.status(500).json({ error: "Unable to load related systems" });
  }
});

app.post("/api/tickets", ...requireRequesterSession, async (req: Request, res: Response) => {
  // BR-09/AC-04: ownership comes from the session, never a client-supplied
  // requesterId — even if the request body includes one, it is ignored.
  const requesterId = req.user!.id;

  try {
    const { categoryId, relatedSystemId, summary, description, requestedPriority } = req.body;

    const fieldErrors = validateTicketInput({
      categoryId,
      relatedSystemId,
      summary,
      description,
      requestedPriority,
    });
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ error: "Validation failed", fields: fieldErrors });
    }

    const [category, relatedSystem] = await Promise.all([
      getPrisma().category.findUnique({ where: { id: categoryId } }),
      getPrisma().relatedSystem.findUnique({ where: { id: relatedSystemId } }),
    ]);
    if (!category) {
      return res.status(400).json({ error: "Validation failed", fields: { categoryId: "Category not found" } });
    }
    if (!relatedSystem || !relatedSystem.isActive) {
      return res.status(400).json({ error: "Validation failed", fields: { relatedSystemId: "Related System not found or inactive" } });
    }

    const ticket = await createTicketWithRetry(getPrisma(), (ticketNumber) =>
      getPrisma().ticket.create({
        data: {
          ticketNumber,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: summary.trim(),
          description: description.trim(),
          requestedPriority,
        },
      })
    );

    res.status(201).json(ticket);
  } catch (err) {
    console.error("Failed to create ticket:", err);
    res.status(500).json({ error: "Unable to create ticket" });
  }
});

const SORTABLE_FIELDS = ["createdAt", "ticketNumber", "updatedAt"] as const;
const ALLOWED_PAGE_SIZES = [10, 20, 50];

app.get("/api/tickets", ...requireRequesterSession, async (req: Request, res: Response) => {
  const requesterId = req.user!.id;

  try {
    const sortParam = String(req.query.sort ?? "createdAt");
    const sort = (SORTABLE_FIELDS as readonly string[]).includes(sortParam)
      ? (sortParam as typeof SORTABLE_FIELDS[number])
      : "createdAt";

    const orderParam = String(req.query.order ?? "desc");
    const order = orderParam === "asc" ? "asc" : "desc";

    const pageSizeParam = Number(req.query.pageSize);
    const pageSize = ALLOWED_PAGE_SIZES.includes(pageSizeParam) ? pageSizeParam : 10;

    const pageParam = Number(req.query.page);
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

    const where: Record<string, unknown> = { requesterId };

    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }
    const categoryIdParam = Number(req.query.categoryId);
    if (req.query.categoryId && Number.isInteger(categoryIdParam)) {
      where.categoryId = categoryIdParam;
    }
    if (req.query.requestedPriority && KNOWN_PRIORITY_VALUES.includes(String(req.query.requestedPriority))) {
      where.requestedPriority = String(req.query.requestedPriority);
    }
    if (req.query.itPriority && KNOWN_PRIORITY_VALUES.includes(String(req.query.itPriority))) {
      where.itPriority = String(req.query.itPriority);
    }
    if (req.query.currentStatus && KNOWN_STATUS_VALUES.includes(String(req.query.currentStatus))) {
      where.currentStatus = String(req.query.currentStatus);
    } else if (req.query.statusGroup === "active") {
      // Dashboard drill-down (FR-11): ignored when currentStatus is also
      // given, per api-spec.md.
      where.currentStatus = { in: ACTIVE_STATUSES };
    }

    const [data, totalItems] = await Promise.all([
      getPrisma().ticket.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      getPrisma().ticket.count({ where }),
    ]);

    res.status(200).json({
      data,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 1,
      },
    });
  } catch (err) {
    console.error("Failed to fetch tickets:", err);
    res.status(500).json({ error: "Unable to load tickets" });
  }
});

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ACTIVE_ATTACHMENTS = 5;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(file.originalname)}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error("UNSUPPORTED_FILE_TYPE"));
      return;
    }
    cb(null, true);
  },
});

app.get("/api/tickets/:id", ...requireRequesterSession, async (req: Request, res: Response) => {
  const requesterId = req.user!.id;
  const ticketId = Number(req.params.id);

  if (Number.isNaN(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  try {
    const ticket = await getPrisma().ticket.findUnique({
      where: { id: ticketId },
      include: {
        category: true,
        relatedSystem: true,
        attachments: { orderBy: { uploadedAt: "asc" } },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "You do not have access to this ticket" });
    }

    res.status(200).json(ticket);
  } catch (err) {
    console.error("Failed to fetch ticket:", err);
    res.status(500).json({ error: "Unable to load ticket" });
  }
});

// BR-23 to BR-27: Public Comments are shared between a Ticket's owning
// Requester and any IT Staff/Administrator; only a Requester is ownership-
// checked, since IT Staff/Administrator manage every Ticket (their scoped
// Ticket Queue view lands in a later Issue).
async function loadTicketForCommentAccess(req: Request, res: Response, ticketId: number) {
  const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return null;
  }
  if (req.user!.role === "REQUESTER" && ticket.requesterId !== req.user!.id) {
    res.status(403).json({ error: "You do not have access to this ticket" });
    return null;
  }
  return ticket;
}

app.post("/api/tickets/:id/comments", ...requireAuthenticatedSession, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";

  if (Number.isNaN(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }
  if (!content || content.length > 2000) {
    return res.status(400).json({ error: "Comment content is required (1-2000 characters)" });
  }

  try {
    const ticket = await loadTicketForCommentAccess(req, res, ticketId);
    if (!ticket) return;

    const comment = await getPrisma().publicComment.create({
      data: { ticketId, authorId: req.user!.id, content },
    });

    res.status(201).json({
      id: comment.id,
      ticketId,
      authorId: req.user!.id,
      authorName: req.user!.name,
      authorRole: req.user!.role,
      content: comment.content,
      createdAt: comment.createdAt,
    });
  } catch (err) {
    console.error("Failed to post comment:", err);
    res.status(500).json({ error: "Unable to post comment" });
  }
});

app.get("/api/tickets/:id/comments", ...requireAuthenticatedSession, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (Number.isNaN(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  try {
    const ticket = await loadTicketForCommentAccess(req, res, ticketId);
    if (!ticket) return;

    const comments = await getPrisma().publicComment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true, role: true } } },
    });

    res.status(200).json(
      comments.map((c) => ({
        id: c.id,
        ticketId,
        authorId: c.authorId,
        authorName: c.author.name,
        authorRole: c.author.role,
        content: c.content,
        createdAt: c.createdAt,
      }))
    );
  } catch (err) {
    console.error("Failed to fetch comments:", err);
    res.status(500).json({ error: "Unable to load comments" });
  }
});

// BR-21/BR-22: a Requester signal for IT Staff, never a formal status
// change — see specification.md §5.5.
const TERMINAL_STATUSES: string[] = ["CLOSED", "CANCELLED"];

app.post(
  "/api/tickets/:id/resolved-confirmation",
  ...requireRequesterSession,
  async (req: Request, res: Response) => {
    const ticketId = Number(req.params.id);
    if (Number.isNaN(ticketId)) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    try {
      const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (ticket.requesterId !== req.user!.id) {
        return res.status(403).json({ error: "You do not have access to this ticket" });
      }
      if (TERMINAL_STATUSES.includes(ticket.currentStatus)) {
        return res.status(409).json({ error: "This ticket can no longer be updated" });
      }

      const updated = await getPrisma().ticket.update({
        where: { id: ticketId },
        data: { requesterConfirmedResolved: true, requesterConfirmedResolvedAt: new Date() },
      });

      res.status(200).json({
        requesterConfirmedResolved: updated.requesterConfirmedResolved,
        requesterConfirmedResolvedAt: updated.requesterConfirmedResolvedAt,
      });
    } catch (err) {
      console.error("Failed to record resolved confirmation:", err);
      res.status(500).json({ error: "Unable to update ticket" });
    }
  }
);

app.post(
  "/api/tickets/:id/attachments",
  ...requireRequesterSession,
  (req: Request, res: Response, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File exceeds the 5MB size limit" });
      }
      if (err && err.message === "UNSUPPORTED_FILE_TYPE") {
        return res.status(400).json({ error: "File type not supported. Allowed: JPG, JPEG, PNG, WEBP, PDF" });
      }
      if (err) {
        return res.status(400).json({ error: "Unable to process the uploaded file" });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const cleanupFile = () => {
      if (req.file) {
        fs.unlink(req.file.path, () => undefined);
      }
    };

    try {
      const requesterId = req.user!.id;
      const ticketId = Number(req.params.id);

      if (Number.isNaN(ticketId)) {
        cleanupFile();
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "A file is required" });
      }

      const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) {
        cleanupFile();
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (ticket.requesterId !== requesterId) {
        cleanupFile();
        return res.status(403).json({ error: "You do not have access to this ticket" });
      }

      const activeCount = await getPrisma().attachment.count({
        where: { ticketId, removedAt: null },
      });
      if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
        cleanupFile();
        return res.status(409).json({ error: "This ticket already has the maximum of 5 active attachments" });
      }

      const attachment = await getPrisma().attachment.create({
        data: {
          ticketId,
          fileName: req.file.originalname,
          storedPath: req.file.filename,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
        },
      });

      res.status(201).json(attachment);
    } catch (err) {
      cleanupFile();
      console.error("Failed to upload attachment:", err);
      res.status(500).json({ error: "Unable to upload attachment" });
    }
  }
);

app.get("/api/attachments/:id/download", ...requireRequesterSession, async (req: Request, res: Response) => {
  const requesterId = req.user!.id;
  const attachmentId = Number(req.params.id);

  try {
    const attachment = await getPrisma().attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: true },
    });

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "You do not have access to this attachment" });
    }
    if (attachment.removedAt) {
      return res.status(410).json({ error: "This attachment has been removed and is no longer available" });
    }

    const filePath = path.join(UPLOAD_DIR, attachment.storedPath);
    res.download(filePath, attachment.fileName);
  } catch (err) {
    console.error("Failed to download attachment:", err);
    res.status(500).json({ error: "Unable to download attachment" });
  }
});

app.delete("/api/attachments/:id", ...requireRequesterSession, async (req: Request, res: Response) => {
  const requesterId = req.user!.id;
  const attachmentId = Number(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  if (reason.length < 3 || reason.length > 200) {
    return res.status(400).json({ error: "A removal reason of at least 3 characters is required" });
  }

  try {
    const attachment = await getPrisma().attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: true },
    });

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "You do not have access to this attachment" });
    }
    if (attachment.removedAt) {
      return res.status(403).json({ error: "This attachment has already been removed" });
    }

    const updated = await getPrisma().attachment.update({
      where: { id: attachmentId },
      data: { removedAt: new Date(), removalReason: reason },
    });

    res.status(200).json({
      id: updated.id,
      removedAt: updated.removedAt,
      removalReason: updated.removalReason,
    });
  } catch (err) {
    console.error("Failed to remove attachment:", err);
    res.status(500).json({ error: "Unable to remove attachment" });
  }
});

// ---------------------------------------------------------------------------
// Lab 3 Issue #32 — IT Staff Ticket Queue (api-spec.md §10)
// ---------------------------------------------------------------------------
const STAFF_SORTABLE_FIELDS = ["status", "createdAt", "itPriority", "updatedAt"] as const;
type StaffSortField = (typeof STAFF_SORTABLE_FIELDS)[number];

app.get("/api/staff/tickets", ...requireStaffSession, async (req: Request, res: Response) => {
  try {
    const sortParam = String(req.query.sort ?? "status");
    const sort: StaffSortField = (STAFF_SORTABLE_FIELDS as readonly string[]).includes(sortParam)
      ? (sortParam as StaffSortField)
      : "status";

    const orderParam = String(req.query.order ?? "asc");
    const order: Prisma.SortOrder = orderParam === "desc" ? "desc" : "asc";

    const pageSizeParam = Number(req.query.pageSize);
    const pageSize = ALLOWED_PAGE_SIZES.includes(pageSizeParam) ? pageSizeParam : 10;

    const pageParam = Number(req.query.page);
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

    const where: Prisma.TicketWhereInput = {};

    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }
    const categoryIdParam = Number(req.query.categoryId);
    if (req.query.categoryId && Number.isInteger(categoryIdParam)) {
      where.categoryId = categoryIdParam;
    }
    if (req.query.itPriority && KNOWN_PRIORITY_VALUES.includes(String(req.query.itPriority))) {
      where.itPriority = req.query.itPriority as Prisma.TicketWhereInput["itPriority"];
    }
    if (req.query.currentStatus && KNOWN_STATUS_VALUES.includes(String(req.query.currentStatus))) {
      where.currentStatus = req.query.currentStatus as Prisma.TicketWhereInput["currentStatus"];
    }
    const ownerParam = String(req.query.owner ?? "all");
    if (ownerParam === "unassigned") {
      where.ticketOwnerId = null;
    } else if (ownerParam === "mine") {
      where.ticketOwnerId = req.user!.id;
    }

    // Prisma orders enum columns by their declaration order, not text — the
    // matrix in specification.md §5.5 hasn't landed yet (Issue #33), but
    // status/createdAt is a fine default proxy for "open work first" today,
    // since NEW is currently the only status every seeded/created ticket has.
    const orderBy: Prisma.TicketOrderByWithRelationInput[] =
      sort === "status" ? [{ currentStatus: order }, { createdAt: "asc" }] : [{ [sort]: order }];

    const [data, totalItems] = await Promise.all([
      getPrisma().ticket.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { ticketOwner: { select: { id: true, name: true } } },
      }),
      getPrisma().ticket.count({ where }),
    ]);

    res.status(200).json({
      data: data.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        summary: t.summary,
        categoryId: t.categoryId,
        requestedPriority: t.requestedPriority,
        itPriority: t.itPriority,
        currentStatus: t.currentStatus,
        ticketOwner: t.ticketOwner ? { id: t.ticketOwner.id, name: t.ticketOwner.name } : null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 1,
      },
    });
  } catch (err) {
    console.error("Failed to fetch staff ticket queue:", err);
    res.status(500).json({ error: "Unable to load the ticket queue" });
  }
});

// ---------------------------------------------------------------------------
// Lab 3 Issue #33 — IT Staff Ticket operations (api-spec.md §11-16)
// ---------------------------------------------------------------------------

// Not in the original api-spec.md — needed once the UI actually renders
// the Ticket Owner dropdown (ui-spec.md §7): a small, staff-only list of
// who a Ticket can be assigned to.
app.get("/api/staff/assignable-users", ...requireStaffSession, async (_req: Request, res: Response) => {
  try {
    const users = await getPrisma().user.findMany({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(users);
  } catch (err) {
    console.error("Failed to fetch assignable users:", err);
    res.status(500).json({ error: "Unable to load assignable users" });
  }
});

app.get("/api/staff/tickets/:id", ...requireStaffSession, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (Number.isNaN(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  try {
    const ticket = await getPrisma().ticket.findUnique({
      where: { id: ticketId },
      include: {
        category: true,
        relatedSystem: true,
        requester: { select: { id: true, name: true, email: true } },
        ticketOwner: { select: { id: true, name: true } },
        attachments: { orderBy: { uploadedAt: "asc" } },
        internalNotes: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true, role: true } } },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.status(200).json({
      ...ticket,
      internalNotes: ticket.internalNotes.map((n) => ({
        id: n.id,
        ticketId,
        authorId: n.authorId,
        authorName: n.author.name,
        authorRole: n.author.role,
        content: n.content,
        createdAt: n.createdAt,
      })),
      validNextStatuses: validNextStatuses(ticket.currentStatus),
    });
  } catch (err) {
    console.error("Failed to fetch staff ticket detail:", err);
    res.status(500).json({ error: "Unable to load ticket" });
  }
});

// BR-14/BR-15: claim (unassigned -> me) and reassign (owned -> a different
// active IT Staff/Administrator) share one endpoint — both just set
// ticketOwnerId, independent of Current Status (see the note in
// specification.md §5.5).
app.patch("/api/staff/tickets/:id/owner", ...requireStaffSession, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (Number.isNaN(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const rawOwnerId = req.body?.ticketOwnerId;
    if (rawOwnerId === null) {
      await getPrisma().ticket.update({
        where: { id: ticketId },
        data: { ticketOwnerId: null },
      });
      return res.status(200).json({ ticketOwner: null });
    }

    const ticketOwnerId = Number(rawOwnerId);
    if (!Number.isInteger(ticketOwnerId)) {
      return res.status(400).json({ error: "ticketOwnerId must be a number or null" });
    }

    const targetUser = await getPrisma().user.findUnique({ where: { id: ticketOwnerId } });
    if (!targetUser || !targetUser.isActive || (targetUser.role !== "IT_STAFF" && targetUser.role !== "ADMINISTRATOR")) {
      return res.status(400).json({ error: "Ticket Owner must be an active IT Staff or Administrator user" });
    }

    await getPrisma().ticket.update({ where: { id: ticketId }, data: { ticketOwnerId } });
    res.status(200).json({ ticketOwner: { id: targetUser.id, name: targetUser.name } });
  } catch (err) {
    console.error("Failed to update ticket owner:", err);
    res.status(500).json({ error: "Unable to update ticket owner" });
  }
});

app.patch("/api/staff/tickets/:id/priority", ...requireStaffSession, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (Number.isNaN(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }
  if (!KNOWN_PRIORITY_VALUES.includes(String(req.body?.itPriority))) {
    return res.status(400).json({ error: "itPriority must be LOW, MEDIUM, or HIGH" });
  }

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const updated = await getPrisma().ticket.update({
      where: { id: ticketId },
      data: { itPriority: req.body.itPriority },
    });
    res.status(200).json({ itPriority: updated.itPriority });
  } catch (err) {
    console.error("Failed to update IT Priority:", err);
    res.status(500).json({ error: "Unable to update IT Priority" });
  }
});

app.patch("/api/staff/tickets/:id/status", ...requireStaffSession, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const targetStatus = String(req.body?.currentStatus ?? "");
  if (Number.isNaN(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }
  if (!ALL_STATUSES.includes(targetStatus)) {
    return res.status(400).json({ error: "Invalid status value" });
  }
  if (typeof req.body?.updatedAt !== "string" || Number.isNaN(Date.parse(req.body.updatedAt))) {
    return res.status(400).json({ error: "updatedAt is required and must be a valid timestamp" });
  }
  const expectedUpdatedAt = new Date(Date.parse(req.body.updatedAt));

  try {
    const prisma = getPrisma();

    // One transaction: the stale check, the resolution gate (which reads
    // Actions Taken) and the write all happen together — but under Postgres's
    // default READ COMMITTED isolation that alone does not lock the Actions
    // Taken rows this reads, so a concurrent Action Taken write could still
    // commit in between and make the gate's decision stale. What actually
    // closes that race: every Action Taken write (POST/PATCH .../actions)
    // also bumps this Ticket's updatedAt, so the final updateMany's CAS below
    // sees it and rejects as STALE instead of letting a now-invalid gate
    // decision through (reviewer PR #58).
    const outcome = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return { kind: "NOT_FOUND" as const };

      // BR-14 — an early, friendly rejection for the common case: the
      // client's own view is stale. The atomic updateMany below is what
      // actually closes the race (two requests built on the same copy).
      if (ticket.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        return { kind: "STALE" as const, currentStatus: ticket.currentStatus };
      }

      if (!isValidTransition(ticket.currentStatus, targetStatus)) {
        return { kind: "INVALID_TRANSITION" as const, from: ticket.currentStatus };
      }
      // BR-19: RESOLVED requires an assigned Ticket Owner.
      if (targetStatus === "RESOLVED" && !ticket.ticketOwnerId) {
        return { kind: "UNASSIGNED" as const };
      }
      // BR-11/BR-12 (resolution gate): RESOLVED needs at least one Action
      // Taken and none with an open follow-up — checked independently of
      // what the UI's own hint shows (ui-spec.md §7), so a stale hint or a
      // direct API call can't bypass it.
      if (targetStatus === "RESOLVED") {
        const actions = await tx.actionTaken.findMany({
          where: { ticketId },
          select: { id: true, description: true, followUpRequired: true },
        });
        const gate = evaluateResolutionGate(actions);
        if (gate.blocked) return { kind: "BLOCKED" as const, gate };
      }

      // BR-14 — the concurrency check and the write are one statement, so
      // two requests built on the same copy cannot both succeed.
      const { count } = await tx.ticket.updateMany({
        where: { id: ticketId, updatedAt: expectedUpdatedAt },
        data: {
          currentStatus: targetStatus as Prisma.TicketUpdateInput["currentStatus"],
          // BR-22: reopening clears a stale Requester confirmation.
          ...(targetStatus === "REOPENED"
            ? { requesterConfirmedResolved: false, requesterConfirmedResolvedAt: null }
            : {}),
        },
      });
      if (count === 0) {
        const current = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
        return { kind: "STALE" as const, currentStatus: current.currentStatus };
      }

      const updated = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      return { kind: "OK" as const, updated };
    });

    switch (outcome.kind) {
      case "NOT_FOUND":
        return res.status(404).json({ error: "Ticket not found" });
      case "STALE":
        return res.status(409).json({
          error: { code: "STALE_UPDATE", message: "This ticket changed since you opened it" },
          currentStatus: outcome.currentStatus,
          validNextStatuses: validNextStatuses(outcome.currentStatus),
        });
      case "INVALID_TRANSITION":
        return res.status(400).json({
          error: `Cannot transition from ${outcome.from} to ${targetStatus}`,
          validNextStatuses: validNextStatuses(outcome.from),
        });
      case "UNASSIGNED":
        return res.status(409).json({ error: { code: "UNASSIGNED", message: "An unassigned Ticket cannot be resolved" } });
      case "BLOCKED":
        return res.status(409).json({
          error: {
            code: "RESOLUTION_BLOCKED",
            message:
              outcome.gate.reason === "NO_ACTIONS"
                ? "This ticket has no recorded Actions Taken yet"
                : "This ticket has an open follow-up on at least one Action Taken",
            blockingActions: outcome.gate.blockingActions,
          },
        });
    }

    const updated = outcome.updated;
    res.status(200).json({
      currentStatus: updated.currentStatus,
      validNextStatuses: validNextStatuses(updated.currentStatus),
    });
  } catch (err) {
    console.error("Failed to update ticket status:", err);
    res.status(500).json({ error: "Unable to update ticket status" });
  }
});

app.post("/api/staff/tickets/:id/notes", ...requireStaffSession, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";

  if (Number.isNaN(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }
  if (!content || content.length > 2000) {
    return res.status(400).json({ error: "Note content is required (1-2000 characters)" });
  }

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const note = await getPrisma().internalNote.create({
      data: { ticketId, authorId: req.user!.id, content },
    });

    res.status(201).json({
      id: note.id,
      ticketId,
      authorId: req.user!.id,
      authorName: req.user!.name,
      authorRole: req.user!.role,
      content: note.content,
      createdAt: note.createdAt,
    });
  } catch (err) {
    console.error("Failed to post internal note:", err);
    res.status(500).json({ error: "Unable to post internal note" });
  }
});

app.get("/api/staff/tickets/:id/notes", ...requireStaffSession, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (Number.isNaN(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const notes = await getPrisma().internalNote.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true, role: true } } },
    });

    res.status(200).json(
      notes.map((n) => ({
        id: n.id,
        ticketId,
        authorId: n.authorId,
        authorName: n.author.name,
        authorRole: n.author.role,
        content: n.content,
        createdAt: n.createdAt,
      }))
    );
  } catch (err) {
    console.error("Failed to fetch internal notes:", err);
    res.status(500).json({ error: "Unable to load internal notes" });
  }
});

// ---------------------------------------------------------------------------
// Lab 4 Issue #47 — Actions Taken (specification.md BR-01 to BR-09)
// ---------------------------------------------------------------------------
function serializeActionTaken(a: {
  id: number;
  ticketId: number;
  performedById: number;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  performedBy: { name: string };
}) {
  return {
    id: a.id,
    ticketId: a.ticketId,
    performedById: a.performedById,
    performedByName: a.performedBy.name,
    description: a.description,
    result: a.result,
    followUpRequired: a.followUpRequired,
    followUpNote: a.followUpNote,
    attachmentNotes: a.attachmentNotes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

// BR-05/BR-06/BR-07: shared validation for both create and edit. `existing`
// supplies the effective followUpRequired/followUpNote on a partial PATCH
// that only sends one of the two, so that pair is always validated together
// against what the row will actually end up with, not just what was sent.
function validateActionTakenInput(
  body: Record<string, unknown>,
  opts: { partial: boolean; existing?: { followUpRequired: boolean; followUpNote: string | null } }
): string | null {
  const has = (key: string) => !opts.partial || body[key] !== undefined;

  if (has("description")) {
    const d = typeof body.description === "string" ? body.description.trim() : "";
    if (!d || d.length > 2000) return "Description is required (1-2000 characters)";
  }
  if (has("result")) {
    const r = typeof body.result === "string" ? body.result.trim() : "";
    if (!r || r.length > 2000) return "Result is required (1-2000 characters)";
  }
  if (has("followUpRequired") && typeof body.followUpRequired !== "boolean") {
    return "followUpRequired must be true or false";
  }
  // BR-06: Follow-up Note is required (1-1000 chars) exactly when
  // followUpRequired is true — checked whenever either field is present so
  // a partial PATCH can't leave the pair in an inconsistent state. Checked
  // against the *effective* values (falling back to `existing`), not just
  // whichever of the two fields this particular request happened to send.
  if (has("followUpRequired") || has("followUpNote")) {
    const required =
      body.followUpRequired !== undefined ? body.followUpRequired === true : opts.existing?.followUpRequired ?? false;
    const note =
      typeof body.followUpNote === "string" ? body.followUpNote.trim() : opts.existing?.followUpNote ?? "";
    if (required && (!note || note.length > 1000)) {
      return "A follow-up note (1-1000 characters) is required when follow-up is needed";
    }
  }
  if (has("attachmentNotes")) {
    const notes = body.attachmentNotes;
    if (notes !== undefined && notes !== null && notes !== "") {
      if (typeof notes !== "string" || notes.length > 500) {
        return "Attachment notes must be 500 characters or fewer";
      }
    }
  }
  return null;
}

app.get("/api/staff/tickets/:id/actions", ...requireStaffSession, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const actions = await getPrisma().actionTaken.findMany({
      where: { ticketId },
      orderBy: { createdAt: "desc" },
      include: { performedBy: { select: { name: true } } },
    });

    res.status(200).json(actions.map(serializeActionTaken));
  } catch (err) {
    console.error("Failed to fetch actions taken:", err);
    res.status(500).json({ error: "Unable to load actions taken" });
  }
});

app.post("/api/staff/tickets/:id/actions", ...requireStaffSession, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const validationError = validateActionTakenInput(body, { partial: false });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const followUpRequired = body.followUpRequired === true;

    // One transaction: the Action Taken write and the Ticket's updatedAt
    // bump happen together. Action Taken writes never otherwise touch the
    // Ticket row, so without this the status route's stale-update check and
    // resolution gate have no way to see that the Actions Taken changed —
    // reviewer PR #58 found that wrapping only the status route in its own
    // transaction did not actually close that race, since Postgres's
    // default READ COMMITTED isolation takes no lock on rows it reads.
    const created = await getPrisma().$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return null;

      const row = await tx.actionTaken.create({
        data: {
          ticketId,
          performedById: req.user!.id,
          description: (body.description as string).trim(),
          result: (body.result as string).trim(),
          followUpRequired,
          // BR-06: never persist a note alongside followUpRequired=false.
          followUpNote: followUpRequired ? (body.followUpNote as string).trim() : null,
          attachmentNotes:
            typeof body.attachmentNotes === "string" && body.attachmentNotes.trim() ? body.attachmentNotes.trim() : null,
        },
        include: { performedBy: { select: { name: true } } },
      });
      await tx.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
      return row;
    });

    if (!created) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    res.status(201).json(serializeActionTaken(created));
  } catch (err) {
    console.error("Failed to create action taken:", err);
    res.status(500).json({ error: "Unable to create action taken" });
  }
});

app.patch(
  "/api/staff/tickets/:id/actions/:actionId",
  ...requireStaffSession,
  async (req: Request, res: Response) => {
    const ticketId = Number(req.params.id);
    const actionId = Number(req.params.actionId);
    if (!Number.isInteger(ticketId) || !Number.isInteger(actionId)) {
      return res.status(404).json({ error: "Action taken not found" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const hasAnyField = ["description", "result", "followUpRequired", "followUpNote", "attachmentNotes"].some(
      (k) => body[k] !== undefined
    );
    if (!hasAnyField) {
      return res.status(400).json({ error: "Supply at least one field to update" });
    }
    if (typeof body.updatedAt !== "string" || Number.isNaN(Date.parse(body.updatedAt))) {
      return res.status(400).json({ error: "updatedAt is required and must be a valid timestamp" });
    }

    try {
      const existing = await getPrisma().actionTaken.findUnique({ where: { id: actionId } });
      if (!existing || existing.ticketId !== ticketId) {
        return res.status(404).json({ error: "Action taken not found" });
      }

      // BR-06: validated against the *effective* followUpRequired/followUpNote
      // (falling back to `existing`), so a PATCH that only sends one of the
      // two fields can't leave the pair in an inconsistent state.
      const validationError = validateActionTakenInput(body, { partial: true, existing });
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      // BR-13: optimistic concurrency — atomic compare-and-swap on updatedAt
      // so two PATCHes built on the same stale read can't both pass a
      // check-then-write race and have the second silently overwrite the
      // first; only one `updateMany` can match and update the row.
      const nextFollowUpRequired =
        body.followUpRequired !== undefined ? (body.followUpRequired as boolean) : existing.followUpRequired;
      // BR-06: derive the note from the *effective* flag, not just whether
      // followUpNote was supplied, so flipping followUpRequired to false
      // always clears a leftover note even if followUpNote wasn't sent.
      const nextFollowUpNote = nextFollowUpRequired
        ? typeof body.followUpNote === "string"
          ? body.followUpNote.trim()
          : existing.followUpNote
        : null;

      // One transaction: the Action Taken write and the Ticket's updatedAt
      // bump happen together, for the same reason as the create route above
      // — otherwise this edit (e.g. clearing a follow-up) would be invisible
      // to the status route's stale check and resolution gate.
      const outcome = await getPrisma().$transaction(async (tx) => {
        const { count } = await tx.actionTaken.updateMany({
          where: { id: actionId, ticketId, updatedAt: new Date(Date.parse(body.updatedAt as string)) },
          data: {
            ...(body.description !== undefined ? { description: (body.description as string).trim() } : {}),
            ...(body.result !== undefined ? { result: (body.result as string).trim() } : {}),
            followUpRequired: nextFollowUpRequired,
            followUpNote: nextFollowUpNote,
            ...(body.attachmentNotes !== undefined
              ? { attachmentNotes: (body.attachmentNotes as string)?.trim() || null }
              : {}),
          },
        });

        if (count === 0) {
          const current = await tx.actionTaken.findUniqueOrThrow({
            where: { id: actionId },
            include: { performedBy: { select: { name: true } } },
          });
          return { kind: "STALE" as const, current };
        }

        await tx.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
        const updated = await tx.actionTaken.findUniqueOrThrow({
          where: { id: actionId },
          include: { performedBy: { select: { name: true } } },
        });
        return { kind: "OK" as const, updated };
      });

      if (outcome.kind === "STALE") {
        return res.status(409).json({
          error: {
            code: "STALE_UPDATE",
            message: "This entry changed since you opened it",
            current: serializeActionTaken(outcome.current),
          },
        });
      }

      res.status(200).json(serializeActionTaken(outcome.updated));
    } catch (err) {
      console.error("Failed to update action taken:", err);
      res.status(500).json({ error: "Unable to update action taken" });
    }
  }
);

app.get("/api/tickets/:id/actions", ...requireAuthenticatedSession, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId)) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  try {
    const ticket = await loadTicketForCommentAccess(req, res, ticketId);
    if (!ticket) return;

    const actions = await getPrisma().actionTaken.findMany({
      where: { ticketId },
      orderBy: { createdAt: "desc" },
      include: { performedBy: { select: { name: true } } },
    });

    res.status(200).json(actions.map(serializeActionTaken));
  } catch (err) {
    console.error("Failed to fetch actions taken:", err);
    res.status(500).json({ error: "Unable to load actions taken" });
  }
});

// ---------------------------------------------------------------------------
// Lab 4 — Dashboards (specification.md FR-08 to FR-11, BR-16 to BR-20)
// ---------------------------------------------------------------------------
const RECENT_TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  updatedAt: true,
} as const;

app.get("/api/dashboard/requester", ...requireRequesterSession, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = req.user!.id;

    const [openCount, inProgressCount, waitingForRequesterCount, resolvedCount, closedCount, recentTickets, attentionTickets] =
      await Promise.all([
        prisma.ticket.count({ where: { requesterId, currentStatus: { in: ACTIVE_STATUSES } } }),
        prisma.ticket.count({ where: { requesterId, currentStatus: "IN_PROGRESS" } }),
        prisma.ticket.count({ where: { requesterId, currentStatus: "WAITING_FOR_REQUESTER" } }),
        prisma.ticket.count({ where: { requesterId, currentStatus: "RESOLVED" } }),
        prisma.ticket.count({ where: { requesterId, currentStatus: "CLOSED" } }),
        prisma.ticket.findMany({
          where: { requesterId },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: RECENT_TICKET_SELECT,
        }),
        prisma.ticket.findMany({
          where: { requesterId, currentStatus: "WAITING_FOR_REQUESTER" },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: RECENT_TICKET_SELECT,
        }),
      ]);

    res.status(200).json({
      metrics: { openCount, inProgressCount, waitingForRequesterCount, resolvedCount, closedCount },
      recentTickets,
      attentionTickets,
    });
  } catch (err) {
    console.error("Failed to load Requester dashboard:", err);
    res.status(500).json({ error: "Unable to load your dashboard" });
  }
});

app.get("/api/dashboard/staff", ...requireStaffSession, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const me = req.user!.id;

    const [newCount, openCount, inProgressCount, waitingForRequesterCount, unassignedCount, myAssignedCount, recentTicketRows] =
      await Promise.all([
        prisma.ticket.count({ where: { currentStatus: "NEW" } }),
        prisma.ticket.count({ where: { currentStatus: "OPEN" } }),
        prisma.ticket.count({ where: { currentStatus: "IN_PROGRESS" } }),
        prisma.ticket.count({ where: { currentStatus: "WAITING_FOR_REQUESTER" } }),
        prisma.ticket.count({ where: { ticketOwnerId: null } }),
        prisma.ticket.count({ where: { ticketOwnerId: me } }),
        prisma.ticket.findMany({
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { ...RECENT_TICKET_SELECT, ticketOwner: { select: { name: true } } },
        }),
      ]);

    res.status(200).json({
      metrics: { newCount, openCount, inProgressCount, waitingForRequesterCount, unassignedCount, myAssignedCount },
      recentTickets: recentTicketRows.map(({ ticketOwner, ...t }) => ({
        ...t,
        ticketOwnerName: ticketOwner?.name ?? null,
      })),
    });
  } catch (err) {
    console.error("Failed to load Staff dashboard:", err);
    res.status(500).json({ error: "Unable to load your dashboard" });
  }
});

export default app;