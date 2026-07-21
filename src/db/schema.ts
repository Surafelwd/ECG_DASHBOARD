import { pgTable, serial, text, timestamp, doublePrecision, boolean, jsonb, uuid } from "drizzle-orm/pg-core";

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  api_key: text("api_key").unique().notNull(),
  serial_number: text("serial_number"),
  is_retired: boolean("is_retired").default(false),
  owner_name: text("owner_name"),
  battery_level: doublePrecision("battery_level").default(100),
  last_sync: timestamp("last_sync"),
  connectivity_status: text("connectivity_status").default("offline")
});

export const readings = pgTable("readings", {
  id: serial("id").primaryKey(),
  device_id: text("device_id").references(() => devices.id).notNull(),
  session_id: uuid("session_id").notNull(),
  time: timestamp("time").notNull(),
  accel_x: doublePrecision("accel_x"),
  accel_y: doublePrecision("accel_y"),
  accel_z: doublePrecision("accel_z"),
  ecg_ch1: doublePrecision("ecg_ch1"),
  ecg_ch2: doublePrecision("ecg_ch2")
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  device_id: text("device_id").references(() => devices.id).notNull(),
  event_type: text("event_type").notNull(),
  subtype: text("subtype").notNull(),
  severity: text("severity"),
  status: text("status"),
  payload: jsonb("payload")
});
