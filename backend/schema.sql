-- ============================================================================
-- Treeline Tracker - PostgreSQL 16 + PostGIS Production DDL
-- Conforms to Milestone 1 Architecture Specification
-- ============================================================================

-- 1. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Clean Up Existing (for clean migrations)
-- DROP TABLE IF EXISTS lora_messages CASCADE;
-- DROP TABLE IF EXISTS telemetry CASCADE;
-- DROP TABLE IF EXISTS mesh_nodes CASCADE;
-- DROP TABLE IF EXISTS emergencies CASCADE;
-- DROP TABLE IF EXISTS geofences CASCADE;
-- DROP TABLE IF EXISTS waypoints CASCADE;
-- DROP TABLE IF EXISTS tracks CASCADE;
-- DROP TABLE IF EXISTS team_members CASCADE;
-- DROP TABLE IF EXISTS teams CASCADE;
-- DROP TABLE IF EXISTS user_tokens CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    emergency_contact TEXT,
    role TEXT NOT NULL DEFAULT 'hiker' CHECK (role IN ('hiker', 'guide', 'rescuer', 'admin')),
    public_key TEXT,
    key_fingerprint TEXT,
    privacy_mode TEXT NOT NULL DEFAULT 'NORMAL' CHECK (privacy_mode IN ('NORMAL', 'REDUCED', 'STEALTH', 'EMERGENCY')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- 4. User Tokens Table (JWT Refresh Token Rotation & Session Revocation)
CREATE TABLE IF NOT EXISTS user_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    device_info TEXT,
    ip_address TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_family_id ON user_tokens (family_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_hash ON user_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_user_tokens_active ON user_tokens (user_id, revoked_at) WHERE revoked_at IS NULL;

-- 5. Teams Table (Expedition Squads / Groups)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    callsign TEXT,
    description TEXT,
    location TEXT NOT NULL DEFAULT '',
    distance TEXT NOT NULL DEFAULT '0 км',
    difficulty TEXT NOT NULL DEFAULT 'Средне',
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    shared_key_id TEXT,
    route_id UUID,
    start_date TEXT,
    leader_name TEXT,
    safe_radius_meters DOUBLE PRECISION NOT NULL DEFAULT 500.0,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'EMERGENCY')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams (status);

-- 6. Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('LEADER', 'GUIDE', 'MEDIC', 'MEMBER', 'RESCUER')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);

-- 7. Tracks Table (Planned Routes & Recorded Paths)
CREATE TABLE IF NOT EXISTS tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL DEFAULT '',
    difficulty TEXT NOT NULL DEFAULT 'Средне',
    distance TEXT NOT NULL DEFAULT '0 км',
    distance_km DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    time TEXT NOT NULL DEFAULT '1 ч',
    type TEXT NOT NULL DEFAULT 'Пеший',
    altitude TEXT NOT NULL DEFAULT '0 м',
    coordinates TEXT NOT NULL DEFAULT '',
    estimated_duration_min INTEGER DEFAULT 0,
    elevation_gain_m DOUBLE PRECISION DEFAULT 0.0,
    elevation_loss_m DOUBLE PRECISION DEFAULT 0.0,
    track_type TEXT NOT NULL DEFAULT 'PLANNED' CHECK (track_type IN ('PLANNED', 'RECORDED', 'RESCUE_SEARCH_CORRIDOR', 'PATROL')),
    path JSONB NOT NULL DEFAULT '[]'::jsonb,
    path_geom GEOMETRY(LineString, 4326),
    corridor_width_meters DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracks_user ON tracks (user_id);
CREATE INDEX IF NOT EXISTS idx_tracks_team ON tracks (team_id);
CREATE INDEX IF NOT EXISTS idx_tracks_archived ON tracks (is_archived);
CREATE INDEX IF NOT EXISTS idx_tracks_path_geom ON tracks USING GIST (path_geom);

-- 8. Waypoints Table (Tactical Mil-Std & Wilderness Waypoints)
CREATE TABLE IF NOT EXISTS waypoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    symbol TEXT NOT NULL DEFAULT 'WAYPOINT',
    mil_std_2525_code TEXT,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90.0 AND latitude <= 90.0),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180.0 AND longitude <= 180.0),
    altitude DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326),
    sequence_order INTEGER NOT NULL DEFAULT 0,
    is_hazard BOOLEAN NOT NULL DEFAULT FALSE,
    hazard_radius_meters DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waypoints_track ON waypoints (track_id);
CREATE INDEX IF NOT EXISTS idx_waypoints_team ON waypoints (team_id);
CREATE INDEX IF NOT EXISTS idx_waypoints_geom ON waypoints USING GIST (geom);

-- 9. Geofences Table (Safety Buffers & Exclusion Zones)
CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    fence_type TEXT NOT NULL DEFAULT 'SAFETY_BUFFER' CHECK (fence_type IN ('SAFETY_BUFFER', 'EXCLUSION_ZONE', 'HAZARD_ZONE', 'SEARCH_SECTOR', 'CAMP_PERIMETER')),
    shape_type TEXT NOT NULL DEFAULT 'CIRCLE' CHECK (shape_type IN ('CIRCLE', 'POLYGON')),
    center_latitude DOUBLE PRECISION,
    center_longitude DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION,
    polygon_coordinates JSONB,
    geom GEOMETRY(Polygon, 4326),
    breach_action TEXT NOT NULL DEFAULT 'ALERT_TEAM' CHECK (breach_action IN ('LOG_ONLY', 'ALERT_USER', 'ALERT_TEAM', 'TRIGGER_SOS')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofences_team ON geofences (team_id);
CREATE INDEX IF NOT EXISTS idx_geofences_geom ON geofences USING GIST (geom);

-- 10. Emergencies Table (Active & Historical SOS Incidents)
CREATE TABLE IF NOT EXISTS emergencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'SOS_SIGNAL',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED')),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326),
    battery_level INTEGER,
    acknowledged_by JSONB NOT NULL DEFAULT '[]'::jsonb,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergencies_status ON emergencies (status);
CREATE INDEX IF NOT EXISTS idx_emergencies_team ON emergencies (team_id);
CREATE INDEX IF NOT EXISTS idx_emergencies_geom ON emergencies USING GIST (geom);

-- 11. Mesh Nodes Table (Meshtastic Hardware Transceivers)
CREATE TABLE IF NOT EXISTS mesh_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_num BIGINT NOT NULL UNIQUE,
    node_id_str TEXT NOT NULL UNIQUE,
    long_name TEXT,
    short_name TEXT,
    hw_model TEXT,
    mac_address TEXT,
    public_key TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'ROUTER_CLIENT',
    battery_level INTEGER,
    voltage DOUBLE PRECISION,
    channel_utilization DOUBLE PRECISION,
    air_util_tx DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326),
    last_heard TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mesh_nodes_node_num ON mesh_nodes (node_num);
CREATE INDEX IF NOT EXISTS idx_mesh_nodes_id_str ON mesh_nodes (node_id_str);
CREATE INDEX IF NOT EXISTS idx_mesh_nodes_team ON mesh_nodes (team_id);
CREATE INDEX IF NOT EXISTS idx_mesh_nodes_geom ON mesh_nodes USING GIST (geom);

-- 12. Telemetry Table (Partitioned by recorded_at range)
CREATE TABLE IF NOT EXISTS telemetry (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    mesh_node_id UUID REFERENCES mesh_nodes(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    hiker_id TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION,
    accuracy_m DOUBLE PRECISION,
    speed_mps DOUBLE PRECISION,
    heading_deg DOUBLE PRECISION,
    battery_level INTEGER,
    transport_type TEXT NOT NULL DEFAULT 'INTERNET' CHECK (transport_type IN ('INTERNET', 'MESH_LORA', 'OFFLINE_BUFFER', 'BLE_GATEWAY')),
    privacy_mode TEXT NOT NULL DEFAULT 'NORMAL' CHECK (privacy_mode IN ('NORMAL', 'REDUCED', 'STEALTH', 'EMERGENCY')),
    is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
    raw_metadata JSONB DEFAULT '{}'::jsonb,
    geom GEOMETRY(Point, 4326),
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Default and Initial Partitions for Telemetry
CREATE TABLE IF NOT EXISTS telemetry_default PARTITION OF telemetry DEFAULT;
CREATE TABLE IF NOT EXISTS telemetry_2026 PARTITION OF telemetry
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE INDEX IF NOT EXISTS idx_telemetry_user_time ON telemetry (user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_team_time ON telemetry (team_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_node_time ON telemetry (mesh_node_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_geom ON telemetry USING GIST (geom);

-- 13. LoRa Messages Table
CREATE TABLE IF NOT EXISTS lora_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    packet_id BIGINT,
    from_node_id BIGINT NOT NULL,
    to_node_id BIGINT NOT NULL,
    channel INTEGER NOT NULL DEFAULT 0,
    portnum TEXT NOT NULL DEFAULT 'TEXT_MESSAGE_APP',
    hop_limit INTEGER NOT NULL DEFAULT 3,
    hop_start INTEGER NOT NULL DEFAULT 3,
    rx_snr DOUBLE PRECISION,
    rx_rssi INTEGER,
    sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    payload_text TEXT,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_status TEXT NOT NULL DEFAULT 'RECEIVED',
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lora_messages_from ON lora_messages (from_node_id);
CREATE INDEX IF NOT EXISTS idx_lora_messages_to ON lora_messages (to_node_id);
CREATE INDEX IF NOT EXISTS idx_lora_messages_team ON lora_messages (team_id);
CREATE INDEX IF NOT EXISTS idx_lora_messages_received ON lora_messages (received_at DESC);
