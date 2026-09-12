import { createTicketWithRetry } from "./ticketNumber.js";
import { validateTicketInput } from "./validation.js";
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getPrisma } from "./prisma.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { authRouter } from "./authRoutes.js";

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

app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().user.findMany({
      where: { isActive: true, role: "REQUESTER" },
      orderBy: { id: "asc" },
      select: { id: true, name: true, email: true },
    });
    res.status(200).json(requesters);
  } catch (err) {
    console.error("Failed to fetch requesters:", err);
    res.status(500).json({ error: "Unable to load requesters" });
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

app.post("/api/tickets", async (req: Request, res: Response) => {
  const requesterIdHeader = req.header("X-Requester-Id");
  const requesterId = requesterIdHeader ? Number(requesterIdHeader) : NaN;

  if (!requesterIdHeader || Number.isNaN(requesterId)) {
    return res.status(400).json({ error: "A valid, active requester is required" });
  }

  try {
    const requester = await getPrisma().user.findUnique({
      where: { id: requesterId },
    });
    if (!requester || !requester.isActive) {
      return res.status(400).json({ error: "A valid, active requester is required" });
    }

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

app.get("/api/tickets", async (req: Request, res: Response) => {
  const requesterIdHeader = req.header("X-Requester-Id");
  const requesterId = requesterIdHeader ? Number(requesterIdHeader) : NaN;

  if (!requesterIdHeader || Number.isNaN(requesterId)) {
    return res.status(400).json({ error: "A valid, active requester is required" });
  }

  try {
    const requester = await getPrisma().user.findUnique({ where: { id: requesterId } });
    if (!requester || !requester.isActive) {
      return res.status(400).json({ error: "A valid, active requester is required" });
    }

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
    if (req.query.categoryId) {
      where.categoryId = Number(req.query.categoryId);
    }
    if (req.query.requestedPriority) {
      where.requestedPriority = String(req.query.requestedPriority);
    }
    if (req.query.itPriority) {
      where.itPriority = String(req.query.itPriority);
    }
    if (req.query.currentStatus) {
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

app.get("/api/tickets/:id", async (req: Request, res: Response) => {
  const requesterIdHeader = req.header("X-Requester-Id");
  const requesterId = requesterIdHeader ? Number(requesterIdHeader) : NaN;
  const ticketId = Number(req.params.id);

  if (!requesterIdHeader || Number.isNaN(requesterId)) {
    return res.status(400).json({ error: "A valid, active requester is required" });
  }
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

app.post(
  "/api/tickets/:id/attachments",
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
      const requesterIdHeader = req.header("X-Requester-Id");
      const requesterId = requesterIdHeader ? Number(requesterIdHeader) : NaN;
      const ticketId = Number(req.params.id);

      if (!requesterIdHeader || Number.isNaN(requesterId)) {
        cleanupFile();
        return res.status(400).json({ error: "A valid, active requester is required" });
      }
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

app.get("/api/attachments/:id/download", async (req: Request, res: Response) => {
  const requesterIdHeader = req.header("X-Requester-Id");
  const requesterId = requesterIdHeader ? Number(requesterIdHeader) : NaN;
  const attachmentId = Number(req.params.id);

  if (!requesterIdHeader || Number.isNaN(requesterId)) {
    return res.status(400).json({ error: "A valid, active requester is required" });
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
      return res.status(410).json({ error: "This attachment has been removed and is no longer available" });
    }

    const filePath = path.join(UPLOAD_DIR, attachment.storedPath);
    res.download(filePath, attachment.fileName);
  } catch (err) {
    console.error("Failed to download attachment:", err);
    res.status(500).json({ error: "Unable to download attachment" });
  }
});

app.delete("/api/attachments/:id", async (req: Request, res: Response) => {
  const requesterIdHeader = req.header("X-Requester-Id");
  const requesterId = requesterIdHeader ? Number(requesterIdHeader) : NaN;
  const attachmentId = Number(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  if (!requesterIdHeader || Number.isNaN(requesterId)) {
    return res.status(400).json({ error: "A valid, active requester is required" });
  }
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

export default app;