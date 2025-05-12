import {executeQuery} from '../../../assets/js/scc'

export function wk_obj (x_columns, x_data, y_columns, y_data, z_columns, z_data, pivot_data,
    series_dict, table_name, worksheet_name) {
    this.x_columns = x_columns;
    this.x_data = x_data;
    this.y_columns = y_columns;
    this.y_data = y_data;
    this.z_columns = z_columns;
    this.z_data = z_data;
    this.series_dict = series_dict;
    this.table_name = table_name;
    this.worksheet_name = worksheet_name;
    this.selected_cord = [0, 0]
    this.area_cordinates = [1, 1, 1, 1]
    this.cell_grid = []
    this.x_list = []
    this.y_list = []
    this.pivot_data = pivot_data
    this.row_len = pivot_data.length
    this.col_len = pivot_data[0].length
    this.tbl = document.createElement("table")
    this.tbl.classList.add("scc_core");        
};   

wk_obj.prototype.populateTable = function() {
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");

    const header_rows = this.x_data.length;
    const header_cols = this.y_data[0].length;
    
    const n_rows = this.pivot_data.length + header_rows;
    const n_cols = this.pivot_data[0].length + header_cols;

    
    for (let i = 0; i < n_rows; i++) {
    const tr = document.createElement("tr");
    for (let j = 0; j < n_cols; j++) {
        const [this_x, this_y] = [i - header_rows + 1, j - header_cols + 1];
        var tcell = document.createElement("th");
        if (j < header_cols && i < header_rows) {
            if (i === 0) {
                tcell.textContent = this.y_columns[j];
            } else {
                tcell.textContent = ""; 
            }
            tcell.classList.add(`STX`, `R${i}C${j}`);
        }
         else if (j < header_cols) {
            tcell.textContent = this.y_data[i - header_rows][j];
            tcell.classList.add(`STX`, `C${j}`);
        } else if (i < header_rows) {
            tcell.textContent = this.x_data[i][j - header_cols];
            tcell.classList.add(`STX`, `R${i}`);
        } else {
            var tcell = document.createElement("td");
            tcell.textContent = this.pivot_data[i - header_rows][j - header_cols];
        }
        if (this_x >= 0 && this_y >= 0) {
            tcell.setAttribute("x-data", this_x)
            tcell.setAttribute("y-data", this_y)
        }
        tr.appendChild(tcell);
    }
    if (i < header_rows) {
        thead.appendChild(tr); // Append header row for x_data
    } else 
    {
        tbody.appendChild(tr); // Append body row for pivot_data
    }
    };
    this.tbl.appendChild(thead);
    this.tbl.appendChild(tbody);

    this.mergeSpan(); // Merge the header cells for x_data and y_data
    return this.tbl
};    

wk_obj.prototype.mergeSpan = function() {
    const header_rows = this.x_data.length;
    const header_cols = this.y_data[0].length;

    const n_rows = this.pivot_data.length + header_rows;
    const n_cols = this.pivot_data[0].length + header_cols;

    if (header_rows > 0){
        for (let i = 0; i < header_rows; i++) 
            {
                for (let j = 0; j < header_cols; j++) {
                    if (i === 0) {
                        this.tbl.rows[0].cells[j].setAttribute("rowspan", header_rows);
                    }
                    this.tbl.rows[i].setAttribute("this_delete", "true")
                }
            }
    }
    

    for (let i = 0; i < header_rows - 1; i++) {
        for (let j = header_cols; j < n_cols; j++) {
            let col_span = 1;
            for (let k = j + 1; k < n_cols; k++) {
                if (this.tbl.rows[i].cells[k].textContent === this.tbl.rows[i].cells[j].textContent) {
                    col_span++;
                    this.tbl.rows[i].cells[k].setAttribute("this_delete", "true")
                } else {
                    break;
                }
            }
            this.tbl.rows[i].cells[j].setAttribute("colspan", col_span);
        }
    }

    for (let i = header_rows; i < n_rows; i++) {
        for (let j = 0; j < header_cols - 1; j++) {
            let row_span = 1;
            for (let k = i + 1; k < n_rows; k++) {
                if (this.tbl.rows[k].cells[j].textContent === this.tbl.rows[i].cells[j].textContent) {
                    row_span++;
                    this.tbl.rows[k].cells[j].setAttribute("this_delete", "true")
                } else {
                    break;
                }
            }
            this.tbl.rows[i].cells[j].setAttribute("rowspan", row_span);
        }
    }

    for (let i = 0; i < n_rows; i++) {
        for (let j = 0; j < n_cols; j++) {
            if ( i < header_rows || j < header_cols) {
                if (this.tbl.rows[i].cells[j] && this.tbl.rows[i].cells[j].getAttribute("this_delete") === "true") {
                    this.tbl.rows[i].deleteCell(j);
                    j--;
                }                
            }
        }
    }
}