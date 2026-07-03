const DataTable = ({ columns, rows, emptyLabel = 'No records found' }) => (
  <div className="table-wrap">
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? rows.map((row, index) => (
          <tr
            key={
              row.id
              || row.productId
              || row.categoryId
              || row.supplierId
              || row.customerId
              || row.purchaseId
              || row.returnId
              || row.expenseId
              || row.saleId
              || row.userId
              || index
            }
          >
            {columns.map((column) => (
              <td key={column.key}>
                {column.render ? column.render(row) : row[column.key]}
              </td>
            ))}
          </tr>
        )) : (
          <tr>
            <td className="empty-cell" colSpan={columns.length}>
              {emptyLabel}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export default DataTable;
