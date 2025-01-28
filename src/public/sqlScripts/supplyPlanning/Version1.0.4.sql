CREATE TABLE S_Notebook (
	CellId	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	CellContent	VARCHAR,
	CreationDate	VARCHAR DEFAULT (datetime('now','localtime'))
);

INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES('All Other','S_Notebook','Notebook','Input',null,'Active',NULL);