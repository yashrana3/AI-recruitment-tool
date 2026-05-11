"""
Database migration utilities
Adds missing columns to existing tables without dropping data
"""
from sqlalchemy import text
from database.mysql import engine


def migrate_scheduler_table():
    """Add new columns to scheduler table if they don't exist"""
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # Check if columns exist and add them if they don't
            columns_to_add = [
                ("job_title", "TEXT"),
                ("skills", "TEXT"),
                ("location", "VARCHAR(255)"),
                ("limit_value", "INTEGER")
            ]
            
            for column_name, column_type in columns_to_add:
                try:
                    # Check if column exists
                    result = conn.execute(text(f"""
                        SELECT COUNT(*) as count
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE()
                        AND TABLE_NAME = 'scheduler'
                        AND COLUMN_NAME = '{column_name}'
                    """))
                    
                    count = result.fetchone()[0]
                    
                    if count == 0:
                        # Column doesn't exist, add it
                        conn.execute(text(f"ALTER TABLE scheduler ADD COLUMN {column_name} {column_type} NULL"))
                        print(f"✓ Added column '{column_name}' to scheduler table")
                    else:
                        print(f"✓ Column '{column_name}' already exists in scheduler table")
                except Exception as e:
                    print(f"✗ Error checking/adding column '{column_name}': {e}")
                    # Continue with other columns even if one fails
            
            trans.commit()
            
            # Also ensure scheduler_runs table exists (separate transaction)
            try:
                with engine.connect() as conn2:
                    trans2 = conn2.begin()
                    conn2.execute(text("""
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
                        )
                    """))
                    trans2.commit()
                    print("✓ Ensured scheduler_runs table exists")
            except Exception as e:
                print(f"✗ Error creating scheduler_runs table: {e}")
                # scheduler_runs will be created by SQLAlchemy if needed
                
        except Exception as e:
            trans.rollback()
            print(f"✗ Migration error: {e}")
            import traceback
            traceback.print_exc()


def migrate_resumes_indexes():
    """Add indexes to resumes table for faster queries"""
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # List of indexes to create (index_name, column_name, index_type)
            indexes_to_add = [
                ("idx_resumes_full_name", "full_name", "INDEX"),
                ("idx_resumes_email", "email", "INDEX"),  # Already exists but ensure it
                ("idx_resumes_title", "title", "INDEX"),
                ("idx_resumes_location_country", "location_country", "INDEX"),
                ("idx_resumes_location_full", "location_full", "INDEX(255)"),  # Prefix index for TEXT field
            ]
            
            for index_name, column_name, index_type in indexes_to_add:
                try:
                    # Check if index exists
                    result = conn.execute(text(f"""
                        SELECT COUNT(*) as count
                        FROM INFORMATION_SCHEMA.STATISTICS
                        WHERE TABLE_SCHEMA = DATABASE()
                        AND TABLE_NAME = 'resumes'
                        AND INDEX_NAME = '{index_name}'
                    """))
                    
                    count = result.fetchone()[0]
                    
                    if count == 0:
                        # Index doesn't exist, create it
                        if "INDEX(255)" in index_type:
                            # Prefix index for TEXT fields (MySQL limitation)
                            conn.execute(text(f"CREATE INDEX {index_name} ON resumes ({column_name}(255))"))
                        else:
                            conn.execute(text(f"CREATE INDEX {index_name} ON resumes ({column_name})"))
                        print(f"✓ Created index '{index_name}' on resumes.{column_name}")
                    else:
                        print(f"✓ Index '{index_name}' already exists on resumes.{column_name}")
                except Exception as e:
                    print(f"✗ Error checking/creating index '{index_name}': {e}")
                    # Continue with other indexes even if one fails
            
            trans.commit()
        except Exception as e:
            trans.rollback()
            print(f"✗ Migration error: {e}")
            import traceback
            traceback.print_exc()


def migrate_jobs_table():
    """Add new columns to jobs table if they don't exist"""
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # Check if columns exist and add them if they don't
            columns_to_add = [
                ("credits_remaining", "VARCHAR(50)"),
            ]
            
            for column_name, column_type in columns_to_add:
                try:
                    # Check if column exists
                    result = conn.execute(text(f"""
                        SELECT COUNT(*) as count
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE()
                        AND TABLE_NAME = 'jobs'
                        AND COLUMN_NAME = '{column_name}'
                    """))
                    
                    count = result.fetchone()[0]
                    
                    if count == 0:
                        # Column doesn't exist, add it
                        conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {column_name} {column_type} NULL"))
                        print(f"✓ Added column '{column_name}' to jobs table")
                    else:
                        print(f"✓ Column '{column_name}' already exists in jobs table")
                except Exception as e:
                    print(f"✗ Error checking/adding column '{column_name}': {e}")
                    # Continue with other columns even if one fails
            
            trans.commit()
        except Exception as e:
            trans.rollback()
            print(f"✗ Migration error: {e}")
            import traceback
            traceback.print_exc()


def run_migrations():
    """Run all migrations"""
    print("Running database migrations...")
    migrate_scheduler_table()
    migrate_resumes_indexes()
    migrate_jobs_table()
    print("Migrations completed!")

