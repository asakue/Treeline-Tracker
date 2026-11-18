/**
 * @fileoverview DDL Schema Syntax & Table Verification Unit Tests
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('PostgreSQL DDL Schema Validation (schema.sql)', () => {
  const schemaPath = path.resolve(__dirname, '../../schema.sql');
  const ddlContent = fs.readFileSync(schemaPath, 'utf-8');

  it('declares mandatory PostGIS and UUID extensions', () => {
    expect(ddlContent).toMatch(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp"/i);
    expect(ddlContent).toMatch(/CREATE EXTENSION IF NOT EXISTS "postgis"/i);
  });

  it('defines all 11 required core tables', () => {
    const requiredTables = [
      'users',
      'user_tokens',
      'teams',
      'team_members',
      'tracks',
      'waypoints',
      'geofences',
      'emergencies',
      'mesh_nodes',
      'telemetry',
      'lora_messages',
    ];

    for (const table of requiredTables) {
      const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i');
      expect(ddlContent).toMatch(tableRegex);
    }
  });

  it('defines spatial geometry columns and GiST indexes for PostGIS performance', () => {
    // PostGIS Geometry columns
    expect(ddlContent).toMatch(/GEOMETRY\(LineString, 4326\)/i);
    expect(ddlContent).toMatch(/GEOMETRY\(Point, 4326\)/i);
    expect(ddlContent).toMatch(/GEOMETRY\(Polygon, 4326\)/i);

    // GiST Indexes
    expect(ddlContent).toMatch(/USING GIST \(path_geom\)/i);
    expect(ddlContent).toMatch(/USING GIST \(geom\)/i);
  });

  it('defines range partitioning on telemetry table by recorded_at', () => {
    expect(ddlContent).toMatch(/PARTITION BY RANGE \(recorded_at\)/i);
    expect(ddlContent).toMatch(/CREATE TABLE IF NOT EXISTS telemetry_default PARTITION OF telemetry DEFAULT/i);
    expect(ddlContent).toMatch(/CREATE TABLE IF NOT EXISTS telemetry_2026 PARTITION OF telemetry/i);
  });

  it('enforces referential integrity with CASCADE and RESTRICT foreign keys', () => {
    expect(ddlContent).toMatch(/REFERENCES users\(id\) ON DELETE CASCADE/i);
    expect(ddlContent).toMatch(/REFERENCES teams\(id\) ON DELETE CASCADE/i);
    expect(ddlContent).toMatch(/REFERENCES users\(id\) ON DELETE RESTRICT/i);
  });
});
