-- Manual migration script for scheduler table
-- Run this SQL script if automatic migration doesn't work
-- Run each ALTER TABLE command individually - if column exists, it will error but that's OK

-- Add new columns to scheduler table (ignore error if column already exists)
ALTER TABLE scheduler ADD COLUMN job_title TEXT NULL;
ALTER TABLE scheduler ADD COLUMN skills TEXT NULL;
ALTER TABLE scheduler ADD COLUMN location VARCHAR(255) NULL;
ALTER TABLE scheduler ADD COLUMN limit_value INTEGER NULL;

-- Create scheduler_runs table if it doesn't exist
CREATE TABLE IF NOT EXISTS scheduler_runs (
    run_id INTEGER AUTO_INCREMENT PRIMARY KEY,
    scheduler_id INTEGER NOT NULL,
    executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    jobs_fetched INTEGER DEFAULT 0,
    has_error BOOLEAN DEFAULT FALSE,
    error_message TEXT NULL,
    execution_time_seconds INTEGER NULL,
    INDEX idx_scheduler_id (scheduler_id),
    INDEX idx_executed_at (executed_at),
    FOREIGN KEY (scheduler_id) REFERENCES scheduler(scheduler_id) ON DELETE CASCADE
);

