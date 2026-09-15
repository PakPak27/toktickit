import { createTicketWithRetry } from "./ticketNumber.js";
import { validateTicketInput } from "./validation.js";
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getPrisma } from "./prisma.js";
import type { Prisma } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { authRouter } from "./authRoutes.js";
import { requireAuth, requirePasswordChangeComplete, requireRole } from "./authMiddleware.js";

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

// Shared query-param guards: an unrecognized value is ignored (falls back
// to "no filter"), never passed through to Prisma — an invalid enum value
// or a non-integer id would otherwise throw at the database layer (500)
// instead of failing safely (BR-14-style behavior).
const KNOWN_PRIORITY_VALUES: string[] = ["LOW", "MEDIUM", "HIGH"];
// currentStatus only has NEW until Issue #33 introduces the full workflow enum.
const KNOWN_STATUS_VALUES: string[] = ["NEW"];

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

export default app;