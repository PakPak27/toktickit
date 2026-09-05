import { createTicketWithRetry } from "./ticketNumber.js";
import { validateTicketInput } from "./validation.js";
import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Issue 4 — Category list
// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Lab 2 — Development Requester context
// GET /api/requesters — active Development Requesters only (BR-06)
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true, email: true },
    });
    res.status(200).json(requesters);
  } catch (err) {
    console.error("Failed to fetch requesters:", err);
    res.status(500).json({ error: "Unable to load requesters" });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 — Related Systems (reference data)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Lab 2 — Create Ticket
// POST /api/tickets — creates a Ticket for the current Requester (X-Requester-Id)
// ---------------------------------------------------------------------------
app.post("/api/tickets", async (req: Request, res: Response) => {
  const requesterIdHeader = req.header("X-Requester-Id");
  const requesterId = requesterIdHeader ? Number(requesterIdHeader) : NaN;

  if (!requesterIdHeader || Number.isNaN(requesterId)) {
    return res.status(400).json({ error: "A valid, active requester is required" });
  }

  try {
    const requester = await getPrisma().requesterUser.findUnique({
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

    // BR-17: Category and Related System must reference active, existing records.
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

// ---------------------------------------------------------------------------
// Lab 2 — My Tickets list
// GET /api/tickets — paginated, searchable, filterable, sortable list of the
// current Requester's own tickets (BR-09 through BR-14)
// ---------------------------------------------------------------------------
const SORTABLE_FIELDS = ["createdAt", "ticketNumber", "updatedAt"] as const;
const ALLOWED_PAGE_SIZES = [10, 20, 50];

app.get("/api/tickets", async (req: Request, res: Response) => {
  const requesterIdHeader = req.header("X-Requester-Id");
  const requesterId = requesterIdHeader ? Number(requesterIdHeader) : NaN;

  if (!requesterIdHeader || Number.isNaN(requesterId)) {
    return res.status(400).json({ error: "A valid, active requester is required" });
  }

  try {
    const requester = await getPrisma().requesterUser.findUnique({ where: { id: requesterId } });
    if (!requester || !requester.isActive) {
      return res.status(400).json({ error: "A valid, active requester is required" });
    }

    // BR-14: invalid sort/order/pageSize silently fall back to defaults
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

    // BR-09/BR-10: always scoped to the current Requester — never trust the client beyond this
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

export default app;
