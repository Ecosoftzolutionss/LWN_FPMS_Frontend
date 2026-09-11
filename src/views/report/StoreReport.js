import React, { useEffect, useRef, useState } from 'react'
import DataTable from 'react-data-table-component'
import Select from 'react-select'
import {
    CButton,
    CFormInput,
    CCard,
    CCardBody,
    CTooltip,
} from '@coreui/react'
import {
    FaFileExcel,
    FaSearch,
    FaSyncAlt,
} from 'react-icons/fa'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'
import API from '../../api.js'
import '../../assets/CSS/Storereport.css'

const formatDate = (value) => {
    if (!value) return ''

    const d = new Date(value)

    if (Number.isNaN(d.getTime())) return ''

    return `${String(d.getDate()).padStart(2, '0')}/${String(
        d.getMonth() + 1,
    ).padStart(2, '0')}/${d.getFullYear()}`
}

const TooltipCell = ({ value }) => {
    const text =
        value === null ||
            value === undefined ||
            value === ''
            ? '—'
            : String(value)

    return (
        <CTooltip content={text} placement="top">
            <span className="store-report-tooltip-cell">
                {text}
            </span>
        </CTooltip>
    )
}

const getErrorMessage = (err, fallback) => {
    const data = err?.response?.data

    if (!data) return fallback
    if (typeof data === 'string') return data

    if (data.message || data.error) {
        return data.message || data.error
    }

    return fallback
}

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '40px',
        height: '40px',
        borderRadius: '6px',
        borderColor: state.isFocused ? '#3d7ff0' : '#c4d3ea',
        boxShadow: state.isFocused
            ? '0 0 0 3px rgba(61, 127, 240, 0.18)'
            : 'none',
        '&:hover': {
            borderColor: '#4d8df7',
        },
        fontSize: '13px',
        cursor: 'pointer',
    }),

    valueContainer: (base) => ({
        ...base,
        height: '40px',
        padding: '0 12px',
    }),

    input: (base) => ({
        ...base,
        margin: 0,
        padding: 0,
        fontSize: '13px',
    }),

    singleValue: (base) => ({
        ...base,
        color: '#1f2937',
        fontSize: '13px',
    }),

    placeholder: (base) => ({
        ...base,
        color: '#94a9cf',
        fontSize: '13px',
    }),

    indicatorsContainer: (base) => ({
        ...base,
        height: '40px',
    }),

    menu: (base) => ({
        ...base,
        zIndex: 9999,
        fontSize: '13px',
    }),
}

const StoreReport = () => {
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [search, setSearch] = useState('')

    const [selectedStore, setSelectedStore] = useState('')
    const [selectedItemGroup, setSelectedItemGroup] = useState('')

    const [storeOptions, setStoreOptions] = useState([])
    const [itemGroupOptions, setItemGroupOptions] = useState([])

    const [rows, setRows] = useState([])
    const [totalRows, setTotalRows] = useState(0)

    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)

    const [summary, setSummary] = useState({
        totalQuantity: 0,
        uniquePallets: 0,
        uniqueStores: 0,
    })

    const [loading, setLoading] = useState(false)

    const fromDateRef = useRef(null)
    const toDateRef = useRef(null)
    const mountedRef = useRef(false)
    const searchTimerRef = useRef(null)

    const openDatePicker = (ref) => {
        const input = ref.current
        if (!input) return

        try {
            if (typeof input.showPicker === 'function') {
                input.showPicker()
            } else {
                input.focus()
                input.click()
            }
        } catch {
            input.focus()
        }
    }

    const loadDropdowns = async () => {
        try {
            const [storesRes, itemGroupsRes] = await Promise.all([
                API.get('/StoreMovement/positions'),
                API.get('/ItemGroup'),
            ])

            const locations = []

                ; (storesRes.data || []).forEach((store) => {
                    if (store.storeLocation) {
                        locations.push(store.storeLocation)
                    }
                })

            const uniqueLocations = [...new Set(locations)]

            setStoreOptions(
                uniqueLocations.map((location) => ({
                    value: location,
                    label: location,
                })),
            )

            setItemGroupOptions(
                (itemGroupsRes.data || []).map((group) => ({
                    value: group.id,
                    label: group.groupName,
                })),
            )
        } catch (err) {
            toast.error(
                getErrorMessage(
                    err,
                    'Failed to load Store Report filters',
                ),
            )
        }
    }

    const loadReport = async ({
        page = currentPage,
        pageSize = rowsPerPage,
        from = fromDate,
        to = toDate,
        store = selectedStore,
        itemGroup = selectedItemGroup,
        searchText = search,
        exportAll = false,
    } = {}) => {
        if (from && to && from > to) {
            toast.error('From Date cannot be after To Date')
            return exportAll ? [] : undefined
        }

        setLoading(true)

        try {
            const params = {
                page,
                pageSize,
            }

            if (from) params.fromDate = from
            if (to) params.toDate = to
            if (store) params.storeLocation = store
            if (itemGroup) params.itemGroupId = itemGroup
            if (searchText?.trim()) params.search = searchText.trim()
            if (exportAll) params.exportAll = true

            const res = await API.get('/Reports/store', { params })

            if (exportAll) {
                return Array.isArray(res.data) ? res.data : []
            }

            const result = res.data || {}

            setRows(Array.isArray(result.data) ? result.data : [])
            setTotalRows(Number(result.totalRows) || 0)

            setSummary({
                totalQuantity: Number(result.totalQuantity) || 0,
                uniquePallets: Number(result.uniquePallets) || 0,
                uniqueStores: Number(result.uniqueStores) || 0,
            })
        } catch (err) {
            toast.error(
                getErrorMessage(err, 'Failed to load Store Report'),
            )

            if (!exportAll) {
                setRows([])
                setTotalRows(0)
                setSummary({
                    totalQuantity: 0,
                    uniquePallets: 0,
                    uniqueStores: 0,
                })
            }

            return exportAll ? [] : undefined
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadDropdowns()
        loadReport({
            page: 1,
            pageSize: rowsPerPage,
        })

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleSearch = async () => {
        setCurrentPage(1)

        await loadReport({
            page: 1,
            pageSize: rowsPerPage,
            from: fromDate,
            to: toDate,
            store: selectedStore,
            itemGroup: selectedItemGroup,
            searchText: search,
        })
    }

    const handleClear = async () => {
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current)
        }

        setFromDate('')
        setToDate('')
        setSearch('')
        setSelectedStore('')
        setSelectedItemGroup('')
        setCurrentPage(1)

        await loadReport({
            page: 1,
            pageSize: rowsPerPage,
            from: '',
            to: '',
            store: '',
            itemGroup: '',
            searchText: '',
        })
    }

    const handlePageChange = async (page) => {
        setCurrentPage(page)

        await loadReport({
            page,
            pageSize: rowsPerPage,
        })
    }

    const handleRowsPerPageChange = async (newPerPage, page) => {
        setRowsPerPage(newPerPage)
        setCurrentPage(page)

        await loadReport({
            page,
            pageSize: newPerPage,
        })
    }

    const handleSearchChange = (e) => {
        const value = e.target.value
        setSearch(value)

        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current)
        }

        searchTimerRef.current = setTimeout(() => {
            setCurrentPage(1)

            loadReport({
                page: 1,
                pageSize: rowsPerPage,
                searchText: value,
            })
        }, 400)
    }

    const handleExportExcel = async () => {
        if (totalRows === 0) {
            toast.error('Nothing to export — run a search first')
            return
        }

        setLoading(true)

        try {
            const exportRows = await loadReport({
                page: 1,
                pageSize: 1000000,
                exportAll: true,
            })

            if (!exportRows.length) {
                toast.error('Nothing to export for the selected filters')
                return
            }

            const exportData = exportRows.map((r, index) => ({
                'S.No': index + 1,
                'Movement Date': formatDate(r.movementDate),
                'Store Location': r.storeLocation,
                'Position': r.positionCode,
                'Rack No': r.rackNo,
                'Column No': r.columnNo,
                'Row No': r.rowNo,
                Side: r.side,
                'Slot No': r.slotNumber,
                'Pallet No': r.palletNo,
                'FIFO Pallet No': r.fifoPalletNo,
                'GRN No': r.grnNumber,
                'GRN Type': r.grnType,
                'Part Number': r.partNumber,
                'Part Name': r.partName,
                'Part Group': r.itemGroupName,
                Quantity: r.quantity,
                Status: r.status,
                'Created By': r.createdBy,
            }))

            const worksheet = XLSX.utils.json_to_sheet(exportData)
            const workbook = XLSX.utils.book_new()

            XLSX.utils.book_append_sheet(
                workbook,
                worksheet,
                'Store Report',
            )

            const rangeLabel =
                fromDate && toDate
                    ? `${fromDate}_to_${toDate}`
                    : fromDate
                        ? `from_${fromDate}`
                        : toDate
                            ? `to_${toDate}`
                            : 'all'

            const storeLabel = selectedStore
                ? `_Store_${selectedStore.replace(/[^a-zA-Z0-9_-]/g, '_')}`
                : ''

            XLSX.writeFile(
                workbook,
                `Store_Report_${rangeLabel}${storeLabel}.xlsx`,
            )

            toast.success('Store Report exported successfully')
        } catch (err) {
            toast.error(
                getErrorMessage(err, 'Failed to export Store Report'),
            )
        } finally {
            setLoading(false)
        }
    }

    const columns = [
        {
            name: 'S.NO',
            width: '65px',
            center: true,
            cell: (row, index) => (
                <TooltipCell
                    value={
                        (currentPage - 1) * rowsPerPage + index + 1
                    }
                />
            ),
        },

        {
            name: 'STORE',
            selector: (row) => row.storeLocation,
            sortable: true,
            minWidth: '120px',
            cell: (row) => (
                <TooltipCell value={row.storeLocation} />
            ),
        },
        // {
        //   name: 'POSITION',
        //   selector: (row) => row.positionCode,
        //   sortable: true,
        //   minWidth: '115px',
        //   cell: (row) => (
        //     <TooltipCell value={row.positionCode} />
        //   ),
        // },
        {
            name: 'RACK',
            selector: (row) => row.rackNo,
            sortable: true,
            width: '100px',
            cell: (row) => (
                <TooltipCell value={row.rackNo} />
            ),
        },
        // {
        //   name: 'COLUMN',
        //   selector: (row) => row.columnNo,
        //   sortable: true,
        //   width: '110px',
        //   cell: (row) => (
        //     <TooltipCell value={row.columnNo} />
        //   ),
        // },
        {
            name: 'ROW',
            selector: (row) => row.rowNo,
            sortable: true,
            width: '110px',
            cell: (row) => (
                <TooltipCell value={row.rowNo} />
            ),
        },
        {
            name: 'SIDE',
            selector: (row) => row.side,
            sortable: true,
            width: '110px',
            center: true,
            cell: (row) => (
                <TooltipCell value={row.side} />
            ),
        },
        {
            name: 'PALLET NO',
            selector: (row) => row.palletNo,
            sortable: true,
            width: '135px',
            cell: (row) => (
                <TooltipCell value={row.palletNo} />
            ),
        },
        {
            name: 'FIFO PALLET',
            selector: (row) => row.fifoPalletNo,
            sortable: true,
            minWidth: '135px',
            cell: (row) => (
                <TooltipCell value={row.fifoPalletNo} />
            ),
        },
        {
            name: 'GRN NO',
            selector: (row) => row.grnNumber,
            sortable: true,
            width: '100px',
            cell: (row) => (
                <TooltipCell value={row.grnNumber} />
            ),
        },
        {
            name: 'PART NUMBER',
            selector: (row) => row.partNumber,
            sortable: true,
            width: '135px',
            cell: (row) => (
                <TooltipCell value={row.partNumber} />
            ),
        },
        {
            name: 'PART NAME',
            selector: (row) => row.partName,
            sortable: true,
            minWidth: '160px',
            cell: (row) => (
                <TooltipCell value={row.partName} />
            ),
        },
        {
            name: 'QTY',
            selector: (row) => row.quantity ?? 0,
            sortable: true,
            width: '80px',
            center: true,
            cell: (row) => (
                <TooltipCell value={row.quantity ?? 0} />
            ),
        },


        {
            name: 'STORE MOVEMENT DATE',
            selector: (row) => row.movementDate,
            sortable: true,
            width: '195px',
            cell: (row) => (
                <TooltipCell value={formatDate(row.movementDate)} />
            ),
        },
        {
            name: 'CREATED BY',
            selector: (row) => row.createdBy,
            sortable: true,
            minWidth: '120px',
            cell: (row) => (
                <TooltipCell value={row.createdBy} />
            ),
        },
        {
            name: 'STATUS',
            width: '105px',
            center: true,
            cell: (row) => (
                <span
                    className={`store-report-status-badge ${row.status === 'Issued'
                            ? 'issued'
                            : 'in-store'
                        }`}
                >
                    {row.status || 'In Store'}
                </span>
            ),
        },
    ]

    const customStyles = {
        table: {
            style: {
                width: '100%',
            },
        },

        rows: {
            style: {
                minHeight: '44px',
            },
        },

        headRow: {
            style: {
                minHeight: '46px',
                backgroundColor: '#f1f4fa',
                borderBottom: '1px solid #d8deea',
            },
        },

        headCells: {
            style: {
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: 700,
                color: '#23395d',
                textTransform: 'uppercase',
                backgroundColor: '#f1f4fa',
            },
        },

        cells: {
            style: {
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: '13px',
                color: '#1f2937',
            },
        },

        pagination: {
            style: {
                borderTop: 'none',
                minHeight: '52px',
                paddingRight: '10px',
            },
        },
    }

    return (
        <div className="store-report-page">
            <CCard className="store-report-filter-card mb-3">
                <CCardBody>
                    <div className="section-title">
                        Store Report
                    </div>

                    <div className="store-report-filter-row">
                        <div className="store-report-filter-field">
                            <label className="custom-label">
                                FROM DATE
                            </label>

                            <div
                                className="store-report-date-wrapper"
                                onClick={() => openDatePicker(fromDateRef)}
                            >
                                <CFormInput
                                    ref={fromDateRef}
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => {
                                        setFromDate(e.target.value)
                                        setCurrentPage(1)
                                    }}
                                    className="store-report-date-input"
                                />
                            </div>
                        </div>

                        <div className="store-report-filter-field">
                            <label className="custom-label">
                                TO DATE
                            </label>

                            <div
                                className="store-report-date-wrapper"
                                onClick={() => openDatePicker(toDateRef)}
                            >
                                <CFormInput
                                    ref={toDateRef}
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => {
                                        setToDate(e.target.value)
                                        setCurrentPage(1)
                                    }}
                                    className="store-report-date-input"
                                />
                            </div>
                        </div>

                        <div className="store-report-filter-field">
                            <label className="custom-label">
                                STORE LOCATION
                            </label>

                            <Select
                                classNamePrefix="store-select"
                                styles={selectStyles}
                                placeholder="Select Store Location"
                                options={storeOptions}
                                value={
                                    storeOptions.find(
                                        (x) =>
                                            String(x.value) ===
                                            String(selectedStore),
                                    ) || null
                                }
                                onChange={(selected) => {
                                    setSelectedStore(selected?.value || '')
                                    setCurrentPage(1)
                                }}
                                isClearable
                            />
                        </div>

                        <div className="store-report-filter-field">
                            <label className="custom-label">
                                Part GROUP
                            </label>

                            <Select
                                classNamePrefix="store-select"
                                styles={selectStyles}
                                placeholder="Select Item Group"
                                options={itemGroupOptions}
                                value={
                                    itemGroupOptions.find(
                                        (x) =>
                                            String(x.value) ===
                                            String(selectedItemGroup),
                                    ) || null
                                }
                                onChange={(selected) => {
                                    setSelectedItemGroup(
                                        selected?.value || '',
                                    )
                                    setCurrentPage(1)
                                }}
                                isClearable
                            />
                        </div>
                    </div>

                    <div className="store-report-date-actions">
                        <CButton
                            className="store-report-search-btn"
                            onClick={handleSearch}
                            disabled={loading}
                        >
                            <FaSearch size={12} />
                            Search
                        </CButton>

                        <CButton
                            className="store-report-clear-btn"
                            onClick={handleClear}
                            disabled={loading}
                        >
                            <FaSyncAlt size={12} />
                            Clear
                        </CButton>
                    </div>
                </CCardBody>
            </CCard>

            <CCard className="store-report-result-card">
                <CCardBody>
                    {/* <div className="store-report-summary-row">
            <div>
              <span>TOTAL RECORDS</span>
              <strong>{totalRows}</strong>
            </div>

            <div>
              <span>UNIQUE PALLETS</span>
              <strong>{summary.uniquePallets}</strong>
            </div>

            <div>
              <span>TOTAL QUANTITY</span>
              <strong>{summary.totalQuantity}</strong>
            </div>

            <div>
              <span>STORES</span>
              <strong>{summary.uniqueStores}</strong>
            </div>
          </div> */}

                    <div className="store-report-result-toolbar">
                        <div className="store-report-export-wrapper">
                            <CButton
                                className="store-report-export-btn"
                                onClick={handleExportExcel}
                                disabled={loading || totalRows === 0}
                            >
                                <FaFileExcel size={13} />
                                Export
                            </CButton>
                        </div>

                        <div className="store-report-grid-search">
                            <CFormInput
                                value={search}
                                onChange={handleSearchChange}
                                className="store-report-search-input"
                                placeholder="Search by Pallet, GRN, Part, Store, Rack..."
                            />
                        </div>
                    </div>

                    <div className="store-report-table-wrapper">
                        <DataTable
                            columns={columns}
                            data={rows}
                            pagination
                            paginationServer
                            paginationTotalRows={totalRows}
                            paginationPerPage={rowsPerPage}
                            paginationRowsPerPageOptions={[10, 25, 50, 100]}
                            onChangePage={handlePageChange}
                            onChangeRowsPerPage={handleRowsPerPageChange}
                            progressPending={loading}
                            persistTableHead
                            striped
                            responsive
                            highlightOnHover
                            noDataComponent={
                                <div className="store-report-empty">
                                    No Store Movement records found
                                </div>
                            }
                            customStyles={customStyles}
                        />
                    </div>
                </CCardBody>
            </CCard>
        </div>
    )
}

export default StoreReport
