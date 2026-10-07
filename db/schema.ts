import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('rooms',{id:text('id').primaryKey(),state:text('state').notNull(),revision:integer('revision').notNull().default(0)});

// Only signaling references live here; audio and video never enter D1.
export const mediaSessions=sqliteTable('media_sessions',{
  sessionId:text('session_id').primaryKey(),
  roomId:text('room_id').notNull(),
  seat:integer('seat').notNull(),
  kind:text('kind').notNull(),
  active:integer('active').notNull().default(0),
  touchedAt:integer('touched_at').notNull(),
},table=>[index('idx_media_sessions_room_active_touched').on(table.roomId,table.active,table.touchedAt)]);
