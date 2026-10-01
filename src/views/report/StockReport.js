import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CTooltip } from '@coreui/react'
import DataTable from 'react-data-table-component'
import Select from 'react-select'
import { FaFileExcel, FaFilePdf, FaSearch, FaSyncAlt } from 'react-icons/fa'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'
import API from '../../api.js'
import '../../assets/CSS/stockReport.css'
const money = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
const num = (value) => Number(value || 0).toLocaleString()
const CellTooltip = ({ value, children, align = 'left' }) => (
  <CTooltip content={String(value ?? '—')} placement="top">
    <span className={`sr-cell-tooltip sr-cell-tooltip-${align}`}>
      {children}
    </span>
  </CTooltip>
)
const emptyFilters = {
  fromDate: '',
  toDate: '',
  partNumber: '',
  supplierId: '',
  supplierGroupId: '',
  itemGroupId: '',
  customerId: '',
  customerGroupId: '',
}
const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    height: 40,
    borderRadius: 6,
    borderColor: state.isFocused ? '#3d7ff0' : '#c4d3ea',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(61,127,240,.18)' : 'none',
    fontSize: 13,
  }),
  valueContainer: (base) => ({ ...base, height: 40, padding: '0 12px' }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: 13 }),
  singleValue: (base) => ({ ...base, fontSize: 13, color: '#1f2937' }),
  placeholder: (base) => ({ ...base, fontSize: 13, color: '#94a3b8' }),
  indicatorsContainer: (base) => ({ ...base, height: 40 }),
  menu: (base) => ({ ...base, zIndex: 9999, fontSize: 13 }),
  menuList: (base) => ({ ...base, maxHeight: 220 }),
  option: (base, state) => ({
    ...base,
    padding: '9px 12px',
    color: state.isSelected ? '#fff' : '#1e293b',
    backgroundColor: state.isSelected
      ? '#2f5fdd'
      : state.isFocused
        ? '#f1f5f9'
        : '#fff',
  }),
}
const optionList = (items, valueKey = null, labelKey = null) =>
  (Array.isArray(items) ? items : []).map((item) => {
    if (valueKey) {
      return {
        value: item?.[valueKey],
        label: item?.[labelKey] ?? item?.[valueKey],
      }
    }
    return { value: item, label: item }
  })
const StockReport = () => {
  const [inputFilters, setInputFilters] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [options, setOptions] = useState({
    years: [],
    months: [],
    days: [],
    partNumbers: [],
    suppliers: [],
    supplierGroups: [],
    partGroups: [],
    customers: [],
    customerGroups: [],
  })
  const [customerFiltersAvailable, setCustomerFiltersAvailable] = useState(false)
  const [rows, setRows] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pdfExporting, setPdfExporting] = useState(false)
  const [gridSearch, setGridSearch] = useState('')
  const [showInwardRate, setShowInwardRate] = useState(false)
  const [showInwardValue, setShowInwardValue] = useState(false)
  const [showOutwardRate, setShowOutwardRate] = useState(false)
  const [showOutwardValue, setShowOutwardValue] = useState(false)
  // Optional grid columns; enabled by default to preserve the current report.
  const buildParams = (currentFilters, currentPage = page, currentPageSize = pageSize, exportAll = false) => {
    const params = {
      page: currentPage,
      pageSize: currentPageSize,
      exportAll,
    }
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        params[key] = value
      }
    })
    return params
  }
  const loadReport = useCallback(
    async ({
      currentPage = page,
      currentPageSize = pageSize,
      currentFilters = filters,
      exportAll = false,
    } = {}) => {
      setLoading(true)
      try {
        const res = await API.get('/Reports/overall', {
          params: buildParams(
            currentFilters,
            currentPage,
            currentPageSize,
            exportAll
          ),
        })
        const result = res.data || {}
        if (exportAll) {
          return Array.isArray(result.data) ? result.data : []
        }
        setRows(Array.isArray(result.data) ? result.data : [])
        setTotalRows(Number(result.totalRows) || 0)
        const f = result.availableFilters || {}
        setOptions({
          years: f.years || [],
          months: f.months || [],
          days: f.days || [],
          partNumbers: f.partNumbers || [],
          suppliers: f.suppliers || [],
          supplierGroups: f.supplierGroups || [],
          partGroups: f.partGroups || [],
          customers: f.customers || [],
          customerGroups: f.customerGroups || [],
        })
        setCustomerFiltersAvailable(Boolean(result.customerFiltersAvailable))
      } catch (err) {
        console.error('Stock Report Error:', err)
        toast.error(
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to load Stock Report'
        )
        if (!exportAll) {
          setRows([])
          setTotalRows(0)
        }
      } finally {
        setLoading(false)
      }
    },
    [filters, page, pageSize]
  )
  useEffect(() => {
    loadReport({
      currentPage: 1,
      currentPageSize: pageSize,
      currentFilters: emptyFilters,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const partOptions = useMemo(
    () => optionList(options.partNumbers),
    [options.partNumbers]
  )
  const supplierOptions = useMemo(
    () => optionList(options.suppliers, 'id', 'name'),
    [options.suppliers]
  )
  const supplierGroupOptions = useMemo(
    () => optionList(options.supplierGroups, 'id', 'name'),
    [options.supplierGroups]
  )
  const partGroupOptions = useMemo(
    () => optionList(options.partGroups, 'id', 'name'),
    [options.partGroups]
  )
  const customerOptions = useMemo(
    () => optionList(options.customers, 'id', 'name'),
    [options.customers]
  )
  const customerGroupOptions = useMemo(
    () => optionList(options.customerGroups, 'id', 'name'),
    [options.customerGroups]
  )
  const setSelectValue = (key, selected) => {
    setInputFilters((previous) => ({
      ...previous,
      [key]: selected?.value ?? '',
    }))
  }
  const setInputValue = (key, value) => {
    setInputFilters((previous) => ({
      ...previous,
      [key]: value,
    }))
  }
  const handleSearch = async () => {
    if (inputFilters.fromDate && inputFilters.toDate && inputFilters.fromDate > inputFilters.toDate) {
      toast.error('From Date cannot be greater than To Date')
      return
    }
    const applied = { ...inputFilters }
    setFilters(applied)
    setPage(1)
    await loadReport({
      currentPage: 1,
      currentPageSize: pageSize,
      currentFilters: applied,
    })
  }
  const handleClear = async () => {
    setInputFilters(emptyFilters)
    setFilters(emptyFilters)
    setGridSearch('')
    setShowInwardRate(false)
    setShowInwardValue(false)
    setShowOutwardRate(false)
    setShowOutwardValue(false)
    setPage(1)
    await loadReport({
      currentPage: 1,
      currentPageSize: pageSize,
      currentFilters: emptyFilters,
    })
  }
  const handleGridSearch = (event) => {
    setGridSearch(event.target.value)
  }
  const exportReport = async () => {
    setExporting(true)
    try {
      const exportRows = await loadReport({
        currentPage: 1,
        currentPageSize: 1000000,
        currentFilters: filters,
        exportAll: true,
      })
      if (!exportRows.length) {
        toast.error('Nothing to export for the selected filters')
        return
      }
      const exportData = exportRows.map((row, index) => ({
        'S.No': index + 1,
        Date: row.date
          ? new Date(row.date).toLocaleDateString('en-GB')
          : '',
        Direction: row.direction,
        'Part Number': row.partNumber,
        'Part Name': row.partName,
        UOM: row.uom ?? row.UOM ?? '—',
        'Part Group': row.partGroupName,
        Supplier: row.supplierName,
        'Supplier Group': row.supplierGroupName,
        Quantity: row.quantity,
        Inward: row.inward,
        Outward: row.outward,
        Rate: row.rate,
        Value: row.value,
        Reference: row.reference,
      }))
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Stock Report'
      )
      XLSX.writeFile(
        workbook,
        `Stock_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
      )
      toast.success('Stock Report exported successfully')
    } catch (err) {
      console.error('Export Error:', err)
      toast.error('Failed to export Stock Report')
    } finally {
      setExporting(false)
    }
  }
const exportPdf = async () => {
  setPdfExporting(true)

  try {
    const exportRows = await loadReport({
      currentPage: 1,
      currentPageSize: 1000000,
      currentFilters: filters,
      exportAll: true,
    })

    if (!exportRows.length) {
      toast.error('Nothing to export for the selected filters')
      return
    }

    // A4 Portrait
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 10

    // ---------------------------------------------------------
    // HEADER
    // ---------------------------------------------------------

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Stock Report', margin, 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)

    doc.text(
      `Generated: ${new Date().toLocaleString('en-GB')}`,
      margin,
      17
    )

    // ---------------------------------------------------------
    // TOTAL FORMAT
    // No ₹ symbol so the value fits properly.
    // Example: 345,000,000.00
    // ---------------------------------------------------------

    const formatPdfTotal = (value) => {
      return Number(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }

    // ---------------------------------------------------------
    // TABLE
    // ---------------------------------------------------------

    autoTable(doc, {
      startY: 22,

      margin: {
        left: margin,
        right: margin,
      },

      // A4 width = 210
      // 210 - 10 - 10 = 190mm available
      tableWidth: pageWidth - margin * 2,

      head: [
        ['CODE', 'PRODUCT', 'QUANTITY', 'UOM', 'TOTAL'],
      ],

      body: exportRows.map((row) => {
        const partNumber = row?.partNumber ?? '—'
        const partName = row?.partName ?? '—'
        const quantity = row?.quantity ?? 0
        const uom = row?.uom ?? row?.UOM ?? '—'

        const total =
          row?.total ??
          row?.Total ??
          row?.value ??
          row?.Value ??
          0

        return [
          String(partNumber),
          String(partName),
          num(quantity),
          String(uom),
          formatPdfTotal(total),
        ]
      }),

      // -------------------------------------------------------
      // TABLE STYLE
      // -------------------------------------------------------

      theme: 'grid',

      styles: {
        font: 'helvetica',
        fontSize: 7,

        textColor: [55, 55, 55],

        lineColor: [175, 175, 175],
        lineWidth: 0.25,

        cellPadding: {
          top: 2,
          right: 2,
          bottom: 2,
          left: 2,
        },

        minCellHeight: 7,

        valign: 'middle',

        overflow: 'hidden',
      },

      // -------------------------------------------------------
      // HEADER COLOR
      // -------------------------------------------------------

      headStyles: {
        font: 'helvetica',
        fontStyle: 'bold',
        fontSize: 7,

        textColor: [40, 40, 40],

        fillColor: [225, 225, 225],

        lineColor: [160, 160, 160],
        lineWidth: 0.25,

        valign: 'middle',
      },

      // -------------------------------------------------------
      // SECOND ROW / FOURTH ROW / SIXTH ROW...
      // LIGHT GRAY
      // FIRST ROW / THIRD ROW / FIFTH ROW...
      // WHITE
      // -------------------------------------------------------

      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },

      // -------------------------------------------------------
      // COLUMN WIDTHS
      //
      // TOTAL = 34 + 77 + 25 + 18 + 36 = 190mm
      // Exactly fits A4 printable width.
      // -------------------------------------------------------

      columnStyles: {
        0: {
          cellWidth: 34,
          halign: 'left',
        },

        1: {
          cellWidth: 77,
          halign: 'left',
        },

        2: {
          cellWidth: 25,
          halign: 'right',
        },

        3: {
          cellWidth: 18,
          halign: 'center',
        },

        4: {
          cellWidth: 36,
          halign: 'right',
        },
      },

      // -------------------------------------------------------
      // HEADER ALIGNMENT
      // -------------------------------------------------------

      didParseCell: (data) => {
        if (data.section === 'head') {
          if (data.column.index === 2) {
            data.cell.styles.halign = 'right'
          }

          if (data.column.index === 3) {
            data.cell.styles.halign = 'center'
          }

          if (data.column.index === 4) {
            data.cell.styles.halign = 'right'
          }
        }
      },
    })

    // ---------------------------------------------------------
    // PAGE NUMBER
    // ---------------------------------------------------------

    const pageCount = doc.getNumberOfPages()

    for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
      doc.setPage(pageNo)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)

      doc.text(
        `Page ${pageNo} of ${pageCount}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 6,
        {
          align: 'right',
        }
      )
    }

    // ---------------------------------------------------------
    // SAVE
    // ---------------------------------------------------------

    doc.save(
      `Stock_Report_${new Date().toISOString().slice(0, 10)}.pdf`
    )

    toast.success('Stock Report PDF exported successfully')
  } catch (err) {
    console.error('PDF Export Error:', err)
    toast.error('Failed to export Stock Report PDF')
  } finally {
    setPdfExporting(false)
  }
}

  const filteredGridRows = useMemo(() => {
    const search = gridSearch.trim().toLowerCase()
    if (!search) return rows
    return rows.filter((row) =>
      [
        row.partNumber,
        row.partName,
        row.partGroupName,
        row.supplierName,
        row.supplierGroupName,
        row.uom,
        row.UOM,
        row.direction,
        row.reference,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(search)
        )
    )
  }, [rows, gridSearch])
  const columns = useMemo(
    () => [
      {
        name: 'S.NO',
        width: '70px',
        center: true,
        cell: (_, index) => {
          const value = (page - 1) * pageSize + index + 1
          return <CellTooltip value={value} align="center">{value}</CellTooltip>
        },
      },
      {
        name: 'PART NUMBER',
        width: '145px',
        sortable: true,
        selector: (row) => row.partNumber ?? '—',
        cell: (row) => {
          const value = row.partNumber ?? '—'
          return <CellTooltip value={value} align="left">{value}</CellTooltip>
        },
      },
      {
        name: 'PART NAME',
        minWidth: '180px',
        sortable: true,
        selector: (row) => row.partName ?? '—',
        cell: (row) => {
          const value = row.partName ?? '—'
          return <CellTooltip value={value} align="left">{value}</CellTooltip>
        },
      },
      {
        name: 'PART GROUP',
        minWidth: '145px',
        sortable: true,
        selector: (row) => row.partGroupName ?? '—',
        cell: (row) => {
          const value = row.partGroupName ?? '—'
          return <CellTooltip value={value} align="left">{value}</CellTooltip>
        },
      },
      {
        name: 'SUPPLIER',
        minWidth: '150px',
        sortable: true,
        selector: (row) => row.supplierName ?? '—',
        cell: (row) => {
          const value = row.supplierName ?? '—'
          return <CellTooltip value={value} align="left">{value}</CellTooltip>
        },
      },
      {
        name: 'SUPPLIER GROUP',
        minWidth: '155px',
        sortable: true,
        selector: (row) => row.supplierGroupName ?? '—',
        cell: (row) => {
          const value = row.supplierGroupName ?? '—'
          return <CellTooltip value={value} align="left">{value}</CellTooltip>
        },
      },
      {
        name: 'QUANTITY',
        width: '110px',
        right: true,
        sortable: true,
        selector: (row) => row.quantity ?? 0,
        cell: (row) => {
          const value = num(row.quantity)
          return <CellTooltip value={value} align="right">{value}</CellTooltip>
        },
      },
      {
        name: 'UOM',
        width: '80px',
        center: true,
        sortable: true,
        selector: (row) => row.uom ?? row.UOM ?? '—',
        cell: (row) => {
          const value = row.uom ?? row.UOM ?? '—'
          return <CellTooltip value={value} align="center">{value}</CellTooltip>
        },
      },
      {
        name: (
          <div
            className="sr-movement-column-header"
            title="INWARD quantity. Select RATE or VALUE to display the complete column."
          >
            <div className="sr-movement-column-title">INWARD</div>
            <div className="sr-movement-column-options">
              <label title="Show / hide the complete INWARD RATE column">
                <input
                  type="checkbox"
                  checked={showInwardRate}
                  onChange={(event) => setShowInwardRate(event.target.checked)}
                />
                <span>RATE</span>
              </label>
              <label title="Show / hide the complete INWARD VALUE column">
                <input
                  type="checkbox"
                  checked={showInwardValue}
                  onChange={(event) => setShowInwardValue(event.target.checked)}
                />
                <span>VALUE</span>
              </label>
            </div>
          </div>
        ),
        width: '190px',
        minWidth: '190px',
        grow: 0,
        right: true,
        sortable: true,
        selector: (row) => row.inward ?? 0,
        cell: (row) => {
          const value = num(row.inward)
          return <CellTooltip value={`INWARD QUANTITY: ${value}`} align="right">{value}</CellTooltip>
        },
      },
      ...(showInwardRate
        ? [
          {
            name: <span title="INWARD RATE">INWARD RATE</span>,
            width: '150px',
            minWidth: '150px',
            grow: 0,
            right: true,
            sortable: true,
            selector: (row) =>
              Number(row.inward) > 0 ? row.rate ?? 0 : 0,
            cell: (row) => {
              const value =
                Number(row.inward) > 0 ? money(row.rate) : money(0)
              return <CellTooltip value={`INWARD RATE: ${value}`} align="right">{value}</CellTooltip>
            },
          },
        ]
        : []),
      ...(showInwardValue
        ? [
          {
            name: <span title="INWARD VALUE">INWARD VALUE</span>,
            width: '160px',
            minWidth: '160px',
            grow: 0,
            right: true,
            sortable: true,
            selector: (row) =>
              Number(row.inward) > 0 ? row.value ?? 0 : 0,
            cell: (row) => {
              const value =
                Number(row.inward) > 0 ? money(row.value) : money(0)
              return <CellTooltip value={`INWARD VALUE: ${value}`} align="right">{value}</CellTooltip>
            },
          },
        ]
        : []),
      {
        name: (
          <div
            className="sr-movement-column-header"
            title="OUTWARD quantity. Select RATE or VALUE to display the complete column."
          >
            <div className="sr-movement-column-title">OUTWARD</div>
            <div className="sr-movement-column-options">
              <label title="Show / hide the complete OUTWARD RATE column">
                <input
                  type="checkbox"
                  checked={showOutwardRate}
                  onChange={(event) => setShowOutwardRate(event.target.checked)}
                />
                <span>RATE</span>
              </label>
              <label title="Show / hide the complete OUTWARD VALUE column">
                <input
                  type="checkbox"
                  checked={showOutwardValue}
                  onChange={(event) => setShowOutwardValue(event.target.checked)}
                />
                <span>VALUE</span>
              </label>
            </div>
          </div>
        ),
        width: '190px',
        minWidth: '190px',
        grow: 0,
        right: true,
        sortable: true,
        selector: (row) => row.outward ?? 0,
        cell: (row) => {
          const value = num(row.outward)
          return <CellTooltip value={`OUTWARD QUANTITY: ${value}`} align="right">{value}</CellTooltip>
        },
      },
      ...(showOutwardRate
        ? [
          {
            name: <span title="OUTWARD RATE">OUTWARD RATE</span>,
            width: '150px',
            minWidth: '150px',
            grow: 0,
            right: true,
            sortable: true,
            selector: (row) =>
              Number(row.outward) > 0 ? row.rate ?? 0 : 0,
            cell: (row) => {
              const value =
                Number(row.outward) > 0 ? money(row.rate) : money(0)
              return <CellTooltip value={`OUTWARD RATE: ${value}`} align="right">{value}</CellTooltip>
            },
          },
        ]
        : []),
      ...(showOutwardValue
        ? [
          {
            name: <span title="OUTWARD VALUE">OUTWARD VALUE</span>,
            width: '160px',
            minWidth: '160px',
            grow: 0,
            right: true,
            sortable: true,
            selector: (row) =>
              Number(row.outward) > 0 ? row.value ?? 0 : 0,
            cell: (row) => {
              const value =
                Number(row.outward) > 0 ? money(row.value) : money(0)
              return <CellTooltip value={`OUTWARD VALUE: ${value}`} align="right">{value}</CellTooltip>
            },
          },
        ]
        : []),
      {
        name: 'REFERENCE',
        minWidth: '150px',
        sortable: true,
        selector: (row) => row.reference ?? '—',
        cell: (row) => {
          const value = row.reference ?? '—'
          return <CellTooltip value={value} align="left">{value}</CellTooltip>
        },
      },
      {
        name: 'DATE',
        width: '110px',
        sortable: true,
        selector: (row) => row.date ?? '',
        cell: (row) => {
          const value = row.date
            ? new Date(row.date).toLocaleDateString('en-GB')
            : '—'
          return <CellTooltip value={value} align="center">{value}</CellTooltip>
        },
      },
    ],
    [
      page,
      pageSize,
      showInwardRate,
      showInwardValue,
      showOutwardRate,
      showOutwardValue,
    ]
  )
  const tableStyles = useMemo(
    () => ({
      headCells: {
        style: {
          fontSize: '12px',
          fontWeight: 700,
          color: '#23395d',
          textTransform: 'uppercase',
          backgroundColor: '#f1f4fa',
          overflow: 'visible',
          whiteSpace: 'nowrap',
          textOverflow: 'clip',
          paddingLeft: '8px',
          paddingRight: '8px',
        },
      },
      cells: {
        style: {
          fontSize: '13px',
          color: '#1f2937',
          paddingLeft: '10px',
          paddingRight: '10px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        },
      },
      pagination: {
        style: {
          borderTop: 'none',
          minHeight: '52px',
        },
      },
    }),
    []
  )
  const renderDateInput = (label, value, key) => (
    <div className="sr-field sr-date-field">
      <CTooltip content={label} placement="top">
        <label>{label}</label>
      </CTooltip>
      <input
        type="date"
        className="sr-date-input"
        value={value}
        onChange={(event) =>
          setInputValue(key, event.target.value)
        }
      />
    </div>
  )
  const renderSelect = (
    label,
    value,
    optionsList,
    onChange,
    placeholder,
    disabled = false
  ) => (
    <div className="sr-field">
      <label>{label}</label>
      <Select
        className="sr-react-select"
        classNamePrefix="sr-select"
        styles={selectStyles}
        options={optionsList}
        value={
          optionsList.find(
            (option) => String(option.value) === String(value)
          ) || null
        }
        onChange={onChange}
        placeholder={placeholder}
        isClearable
        isSearchable
        isDisabled={disabled}
      />
    </div>
  )
  return (
    <div className="sr-page">
      <div className="sr-filter-card">
        <div className="sr-filter-title">
          Stock Report
        </div>
        <div className="sr-overall-filter-grid">
          {renderDateInput(
            'FROM DATE',
            inputFilters.fromDate,
            'fromDate'
          )}
          {renderDateInput(
            'TO DATE',
            inputFilters.toDate,
            'toDate'
          )}
          {renderSelect(
            'PART NUMBER',
            inputFilters.partNumber,
            partOptions,
            (selected) =>
              setSelectValue('partNumber', selected),
            'All Part Numbers'
          )}
          {renderSelect(
            'SUPPLIER',
            inputFilters.supplierId,
            supplierOptions,
            (selected) =>
              setSelectValue('supplierId', selected),
            'All Suppliers'
          )}
          {renderSelect(
            'SUPPLIER GROUP',
            inputFilters.supplierGroupId,
            supplierGroupOptions,
            (selected) =>
              setSelectValue('supplierGroupId', selected),
            'All Supplier Groups'
          )}
          {renderSelect(
            'PART GROUP',
            inputFilters.itemGroupId,
            partGroupOptions,
            (selected) =>
              setSelectValue('itemGroupId', selected),
            'All Part Groups'
          )}
          {renderSelect(
            'CUSTOMER',
            inputFilters.customerId,
            customerOptions,
            (selected) =>
              setSelectValue('customerId', selected),
            customerFiltersAvailable
              ? 'All Customers'
              : 'Customer mapping unavailable',
            !customerFiltersAvailable
          )}
          {renderSelect(
            'CUSTOMER GROUP',
            inputFilters.customerGroupId,
            customerGroupOptions,
            (selected) =>
              setSelectValue('customerGroupId', selected),
            customerFiltersAvailable
              ? 'All Customer Groups'
              : 'Customer group mapping unavailable',
            !customerFiltersAvailable
          )}
        </div>
        <div className="sr-filter-actions">
          <CTooltip content="Apply the selected filters and load the Stock Report" placement="top">
            <button
              type="button"
              className="sr-btn sr-btn-search"
              onClick={handleSearch}
              disabled={loading}
            >
              <FaSearch size={12} />
              Search
            </button>
          </CTooltip>
          <CTooltip content="Clear all filters and reset the Stock Report" placement="top">
            <button
              type="button"
              className="sr-btn sr-btn-clear"
              onClick={handleClear}
              disabled={loading}
            >
              <FaSyncAlt size={12} />
              Clear
            </button>
          </CTooltip>
        </div>
      </div>
      <div className="sr-table-card">
        <div className="sr-table-toolbar">
          <CTooltip content="Export the current Stock Report to Excel" placement="top">
            <button
              type="button"
              className="sr-btn sr-btn-export"
              onClick={exportReport}
              disabled={exporting || loading}
            >
              <FaFileExcel size={13} />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </CTooltip>
          <CTooltip
            content="Export the Stock Report as a PDF with Part Number, Part Name, Qty, UOM and Total"
            placement="top"
          >
            <button
              type="button"
              className="sr-btn sr-btn-export"
              onClick={exportPdf}
              disabled={pdfExporting || exporting || loading}
            >
              <FaFilePdf size={13} />
              {pdfExporting ? 'Generating PDF...' : 'PDF'}
            </button>
          </CTooltip>
          <div className="sr-search-box">
            <FaSearch />
            <CTooltip content="Search within the loaded Stock Report rows" placement="top">
              <input
                type="text"
                value={gridSearch}
                onChange={handleGridSearch}
                placeholder="Search by Part No, Part Name..."
              />
            </CTooltip>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={filteredGridRows}
          customStyles={tableStyles}
          pagination
          paginationServer
          paginationTotalRows={
            gridSearch ? filteredGridRows.length : totalRows
          }
          paginationPerPage={pageSize}
          paginationRowsPerPageOptions={[
            25,
            50,
            100,
            200,
          ]}
          onChangePage={(nextPage) => {
            setPage(nextPage)
            loadReport({
              currentPage: nextPage,
              currentPageSize: pageSize,
              currentFilters: filters,
            })
          }}
          onChangeRowsPerPage={(size) => {
            setPageSize(size)
            setPage(1)
            loadReport({
              currentPage: 1,
              currentPageSize: size,
              currentFilters: filters,
            })
          }}
          progressPending={loading}
          persistTableHead
          striped
          responsive
          highlightOnHover
          noDataComponent={
            <div className="sr-empty">
              No stock records found
            </div>
          }
        />
      </div>
    </div>
  )
}
export default StockReport;
