BEGIN TRANSACTION;

-- Table: S_NotebookContent
CREATE TABLE IF NOT EXISTS S_NotebookContent (
    CellId	        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	Name            VARCHAR,
    NotebookId      INTEGER NOT NULL,    
	CellContent	    VARCHAR,
    CellType        VARCHAR,
	CreationDate	VARCHAR DEFAULT (datetime('now','localtime')),
	LastUpdateDate	VARCHAR DEFAULT (datetime('now','localtime'))
);

-- Table: S_Notebooks
CREATE TABLE IF NOT EXISTS S_Notebooks (
	NotebookId	    INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	Name            VARCHAR,
	Type			VARCHAR,
	Status	    	VARCHAR DEFAULT 'Active',
	CreationDate	VARCHAR DEFAULT (datetime('now','localtime')),
	LastUpdateDate	VARCHAR DEFAULT (datetime('now','localtime'))
);

CREATE TABLE T_S_TaskMaster (
    TaskId          INTEGER NOT NULL
                            PRIMARY KEY AUTOINCREMENT,
    TaskName        VARCHAR,
    TaskDisplayName VARCHAR,
    TaskType        VARCHAR,
    TaskParameters  VARCHAR,
    TaskStatus      VARCHAR,
    TaskLastRunDate VARCHAR,
    TaskOutput      VARCHAR
);

CREATE TEMP TABLE IF NOT EXISTS temp_check AS
SELECT 1 AS column_exists
FROM pragma_table_info('S_TaskMaster')
WHERE name = 'TaskType';

-- If the column doesn't exist, add it
INSERT INTO temp_check (column_exists)
SELECT 0
WHERE NOT EXISTS (SELECT 1 FROM temp_check);

INSERT INTO T_S_TaskMaster (TaskName, TaskDisplayName, TaskType, TaskParameters, TaskStatus, TaskLastRunDate, TaskOutput)
SELECT TaskName, TaskDisplayName, 
CASE WHEN temp_check.column_exists = 1 
THEN TaskType
ELSE 'PythonScript' END, TaskParameters, TaskStatus, TaskLastRunDate, TaskOutput
FROM S_TaskMaster, temp_check;

DROP TABLE S_TaskMaster;

ALTER TABLE T_S_TaskMaster RENAME TO S_TaskMaster;

-- Perform the ALTER TABLE if necessary
-- Use a CASE statement to check the value
SELECT CASE WHEN (SELECT column_exists FROM temp_check) = 0 THEN
  (SELECT 'ALTER TABLE S_TaskMaster ADD COLUMN TaskType VARCHAR;' AS sql_command)
ELSE
  (SELECT 'Column already exists.' AS sql_command)
END;

COMMIT TRANSACTION;
