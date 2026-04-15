-- =======================================================================
-- V2 CẤU TRÚC DATABASE RAITEK
-- =======================================================================

-- Drop Tables in reverse dependency order
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS detail_assigns CASCADE;
DROP TABLE IF EXISTS assigns CASCADE;
DROP TABLE IF EXISTS works CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS model_projects CASCADE;
DROP TABLE IF EXISTS process CASCADE;
DROP TABLE IF EXISTS owners CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS leaders CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- Drop Extensions (Optional - keep these if other DBs use them)
-- DROP EXTENSION IF EXISTS "uuid-ossp";
-- DROP EXTENSION IF EXISTS "pgcrypto";
