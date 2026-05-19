import { pgTable, uuid, text, integer, doublePrecision, timestamp } from 'drizzle-orm/pg-core';

// 1. Audit Sessions Table: Groups extractions under a specific physical stock count event
export const auditSessions = pgTable('audit_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionName: text('session_name').notNull(), // e.g., "Main Warehouse Count - May 2026"
  targetLocation: text('target_location'),     // e.g., "Sector A / Housing Block 4"
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Inventory Items Table: Stores the actual items extracted by Gemini
export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .references(() => auditSessions.id, { onDelete: 'cascade' })
    .notNull(),
  originalUrduText: text('original_urdu_text').notNull(), // e.g., "50 bori gandum" or "بوری گندم 50"
  englishItemName: text('english_item_name').notNull(),   // e.g., "Wheat Bag"
  quantity: doublePrecision('quantity').notNull(),       // e.g., 50
  unit: text('unit').notNull(),                          // e.g., "bags", "kg", "units"
  confidenceScore: doublePrecision('confidence_score'),   // AI accuracy metric (0.00 to 1.00)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});