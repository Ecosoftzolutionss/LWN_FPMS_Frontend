import React, {
    useEffect,
    useMemo,
    useState,
    useCallback,
    useRef,
} from 'react'

import DataTable from 'react-data-table-component'
import Select from 'react-select'

import {
    FaSearch,
    FaFileExcel,
    FaSyncAlt,
} from 'react-icons/fa'

import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'

import API from '../../api.js'
import '../../assets/CSS/stockReport.css'


// ==========================================================
// Helpers
// ==========================================================

const num = (value) =>
    Number(value || 0).toLocaleString()


const money = (value) =>
    Number(value || 0).toLocaleString(undefined, {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    })


// ==========================================================
// Status CSS
// ==========================================================

const STATUS_CLASS = {
    Safety: 'sr-status-safety',
    Reorder: 'sr-status-reorder',
    Danger: 'sr-status-danger',
}


// ==========================================================
// Status Badge
// ==========================================================

const StatusBadge = ({ status }) => (
    <span
        className={`sr-status-badge ${
            STATUS_CLASS[status] || ''
        }`}
    >
        {status || '—'}
    </span>
)


// ==========================================================
// Status Options
// ==========================================================

const statusOptions = [
    {
        value: 'Safety',
        label: 'Safety',
    },
    {
        value: 'Reorder',
        label: 'Reorder',
    },
    {
        value: 'Danger',
        label: 'Danger',
    },
]


// ==========================================================
// React Select Styles
// ==========================================================

const selectStyles = {
    control: (base, state) => ({
        ...base,

        minHeight: '40px',
        height: '40px',

        borderRadius: '6px',

        borderColor:
            state.isFocused
                ? '#3d7ff0'
                : '#c4d3ea',

        boxShadow:
            state.isFocused
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


// ==========================================================
// Stock Report
// ==========================================================

const StockReport = () => {

    // ========================================================
    // Filter values
    // ========================================================

    const [itemGroupIdInput, setItemGroupIdInput] =
        useState('')

    const [statusInput, setStatusInput] =
        useState('')


    const [itemGroupId, setItemGroupId] =
        useState('')

    const [status, setStatus] =
        useState('')


    // ========================================================
    // Table search
    // ========================================================

    const [search, setSearch] =
        useState('')


    // ========================================================
    // Item groups
    // ========================================================

    const [itemGroups, setItemGroups] =
        useState([])


    // ========================================================
    // Table data
    // ========================================================

    const [rows, setRows] =
        useState([])

    const [totalRows, setTotalRows] =
        useState(0)


    // ========================================================
    // Pagination
    // Same pattern as Store Report
    // ========================================================

    const [currentPage, setCurrentPage] =
        useState(1)

    const [rowsPerPage, setRowsPerPage] =
        useState(10)


    // ========================================================
    // Loading
    // ========================================================

    const [loading, setLoading] =
        useState(false)

    const [exporting, setExporting] =
        useState(false)


    // ========================================================
    // Search debounce
    // ========================================================

    const searchTimerRef =
        useRef(null)


    // ========================================================
    // Item Group React Select options
    // ========================================================

    const itemGroupOptions = useMemo(() => {

        return itemGroups.map((group) => ({
            value: group.id,
            label: group.groupName,
        }))

    }, [itemGroups])


    // ========================================================
    // Load Stock Report
    // ========================================================

    const loadReport = useCallback(
        async ({
            page = currentPage,
            pageSize = rowsPerPage,
            itemGroup = itemGroupId,
            statusValue = status,
            searchText = search,
            exportAll = false,
        } = {}) => {

            setLoading(true)

            try {

                const params = {
                    page,
                    pageSize,
                }


                // --------------------------------------------
                // Filters
                // --------------------------------------------

                if (itemGroup) {
                    params.itemGroupId =
                        itemGroup
                }


                if (statusValue) {
                    params.status =
                        statusValue
                }


                if (searchText?.trim()) {
                    params.search =
                        searchText.trim()
                }


                if (exportAll) {
                    params.exportAll = true
                }


                // --------------------------------------------
                // API
                // --------------------------------------------

                const res = await API.get(
                    '/Reports/stock',
                    { params }
                )


                // --------------------------------------------
                // Export response
                // --------------------------------------------

                if (exportAll) {

                    return Array.isArray(
                        res.data?.data
                    )
                        ? res.data.data
                        : []
                }


                // --------------------------------------------
                // Normal response
                // --------------------------------------------

                const result =
                    res.data || {}


                setRows(
                    Array.isArray(
                        result.data
                    )
                        ? result.data
                        : []
                )


                setTotalRows(
                    Number(
                        result.totalRows
                    ) || 0
                )


                // --------------------------------------------
                // Item Groups
                // --------------------------------------------

                if (
                    Array.isArray(
                        result.itemGroups
                    )
                ) {

                    setItemGroups(
                        result.itemGroups
                    )
                }

            } catch (err) {

                console.error(
                    'Stock Report Error:',
                    err
                )


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
        [
            currentPage,
            rowsPerPage,
            itemGroupId,
            status,
            search,
        ]
    )


    // ========================================================
    // Initial Load
    // ========================================================

    useEffect(() => {

        loadReport({
            page: 1,
            pageSize: rowsPerPage,
        })

        // eslint-disable-next-line react-hooks/exhaustive-deps

    }, [])


    // ========================================================
    // Filter Search
    // ========================================================

    const handleSearch = async () => {

        setCurrentPage(1)


        setItemGroupId(
            itemGroupIdInput
        )


        setStatus(
            statusInput
        )


        await loadReport({
            page: 1,

            pageSize:
                rowsPerPage,

            itemGroup:
                itemGroupIdInput,

            statusValue:
                statusInput,

            searchText:
                search,
        })
    }


    // ========================================================
    // Clear
    // ========================================================

    const handleClear = async () => {

        if (searchTimerRef.current) {

            clearTimeout(
                searchTimerRef.current
            )
        }


        setItemGroupIdInput('')

        setStatusInput('')


        setItemGroupId('')

        setStatus('')


        setSearch('')


        setCurrentPage(1)


        await loadReport({
            page: 1,

            pageSize:
                rowsPerPage,

            itemGroup: '',

            statusValue: '',

            searchText: '',
        })
    }


    // ========================================================
    // Table Search
    // Same behavior as Store Report
    // ========================================================

    const handleSearchChange = (e) => {

        const value =
            e.target.value


        setSearch(value)


        if (searchTimerRef.current) {

            clearTimeout(
                searchTimerRef.current
            )
        }


        searchTimerRef.current =
            setTimeout(() => {

                setCurrentPage(1)


                loadReport({
                    page: 1,

                    pageSize:
                        rowsPerPage,

                    searchText:
                        value,
                })

            }, 400)
    }


    // ========================================================
    // Server Pagination
    // ========================================================

    const handlePageChange =
        async (page) => {

            setCurrentPage(page)


            await loadReport({
                page,

                pageSize:
                    rowsPerPage,
            })
        }


    // ========================================================
    // Rows Per Page
    // ========================================================

    const handleRowsPerPageChange =
        async (
            newPerPage,
            page
        ) => {

            setRowsPerPage(
                newPerPage
            )

            setCurrentPage(
                page
            )


            await loadReport({
                page,

                pageSize:
                    newPerPage,
            })
        }


    // ========================================================
    // Export Excel
    // ========================================================

    const handleExportExcel =
        async () => {

            if (totalRows === 0) {

                toast.error(
                    'Nothing to export — run a search first'
                )

                return
            }


            setExporting(true)


            try {

                const exportRows =
                    await loadReport({

                        page: 1,

                        pageSize:
                            1000000,

                        itemGroup:
                            itemGroupId,

                        statusValue:
                            status,

                        searchText:
                            search,

                        exportAll:
                            true,
                    })


                if (
                    !exportRows.length
                ) {

                    toast.error(
                        'Nothing to export for the selected filters'
                    )

                    return
                }


                // --------------------------------------------
                // Excel data
                // --------------------------------------------

                const exportData =
                    exportRows.map(
                        (row, index) => ({

                            'S.No':
                                index + 1,

                            'Part Number':
                                row.partNumber,

                            'Part Name':
                                row.partName,

                            'Item Group':
                                row.itemGroupName,

                            'Received':
                                row.receivedQty,

                            'Issued':
                                row.issuedQty,

                            'On Hand':
                                row.onHandQty,

                            'Safety Level':
                                row.safetyLevel,

                            'Reorder Level':
                                row.reorderLevel,

                            'Unit Price':
                                row.unitPrice,

                            'Stock Value':
                                row.stockValue,

                            'Status':
                                row.status,

                        })
                    )


                const worksheet =
                    XLSX.utils.json_to_sheet(
                        exportData
                    )


                const workbook =
                    XLSX.utils.book_new()


                XLSX.utils.book_append_sheet(
                    workbook,
                    worksheet,
                    'Stock Report'
                )


                XLSX.writeFile(
                    workbook,
                    `Stock_Report_${new Date()
                        .toISOString()
                        .slice(0, 10)}.xlsx`
                )


                toast.success(
                    'Stock Report exported successfully'
                )

            } catch (err) {

                console.error(
                    'Export Error:',
                    err
                )


                toast.error(
                    'Failed to export Stock Report'
                )

            } finally {

                setExporting(false)
            }
        }


    // ========================================================
    // Table Columns
    // ========================================================

    const columns = useMemo(
        () => [

            {
                name: 'S.NO',

                width: '70px',

                center: true,

                cell: (
                    row,
                    index
                ) => (

                    <span>

                        {
                            (currentPage - 1) *
                                rowsPerPage +
                            index +
                            1
                        }

                    </span>
                ),
            },


            {
                name: 'PART NUMBER',

                selector:
                    (row) =>
                        row.partNumber ??
                        '—',

                sortable: true,

                width:
                    '140px',
            },


            {
                name: 'PART NAME',

                selector:
                    (row) =>
                        row.partName ??
                        '—',

                sortable: true,

                minWidth:
                    '180px',
            },


            {
                name: 'ITEM GROUP',

                selector:
                    (row) =>
                        row.itemGroupName ??
                        '—',

                sortable: true,

                minWidth:
                    '140px',
            },


            {
                name: 'RECEIVED',

                selector:
                    (row) =>
                        row.receivedQty ??
                        0,

                sortable: true,

                center: true,

                width:
                    '110px',

                cell:
                    (row) => (
                        <span>
                            {num(
                                row.receivedQty
                            )}
                        </span>
                    ),
            },


            {
                name: 'ISSUED',

                selector:
                    (row) =>
                        row.issuedQty ??
                        0,

                sortable: true,

                center: true,

                width:
                    '100px',

                cell:
                    (row) => (
                        <span>
                            {num(
                                row.issuedQty
                            )}
                        </span>
                    ),
            },


            {
                name: 'ON HAND',

                selector:
                    (row) =>
                        row.onHandQty ??
                        0,

                sortable: true,

                center: true,

                width:
                    '110px',

                cell:
                    (row) => (
                        <span>
                            {num(
                                row.onHandQty
                            )}
                        </span>
                    ),
            },


            {
                name: 'STOCK VALUE',

                selector:
                    (row) =>
                        row.stockValue ??
                        0,

                sortable: true,

                right: true,

                width:
                    '140px',

                cell:
                    (row) => (
                        <span>
                            {money(
                                row.stockValue
                            )}
                        </span>
                    ),
            },


            {
                name: 'STATUS',

                width:
                    '120px',

                center: true,

                cell:
                    (row) => (

                        <StatusBadge
                            status={
                                row.status
                            }
                        />

                    ),
            },

        ],
        [
            currentPage,
            rowsPerPage,
        ]
    )


    // ========================================================
    // Custom DataTable Styles
    // ========================================================

    const customStyles = {

        table: {

            style: {

                width:
                    '100%',
            },
        },


        rows: {

            style: {

                minHeight:
                    '44px',
            },
        },


        headRow: {

            style: {

                minHeight:
                    '46px',

                backgroundColor:
                    '#f1f4fa',

                borderBottom:
                    '1px solid #d8deea',
            },
        },


        headCells: {

            style: {

                justifyContent:
                    'center',

                textAlign:
                    'center',

                fontSize:
                    '12px',

                fontWeight:
                    700,

                color:
                    '#23395d',

                textTransform:
                    'uppercase',

                backgroundColor:
                    '#f1f4fa',
            },
        },


        cells: {

            style: {

                justifyContent:
                    'center',

                textAlign:
                    'center',

                fontSize:
                    '13px',

                color:
                    '#1f2937',
            },
        },


        pagination: {

            style: {

                borderTop:
                    'none',

                minHeight:
                    '52px',

                paddingRight:
                    '10px',
            },
        },
    }


    // ========================================================
    // Render
    // ========================================================

    return (

        <div className="sr-page">


            {/* ==================================================
                FILTER CARD
                ================================================== */}

            <div className="sr-filter-card">


                <div className="sr-filter-title">

                    Stock Report

                </div>


                <div className="sr-filter-grid">


                    {/* ITEM GROUP */}

                    <div className="sr-field">

                        <label>
                            ITEM GROUP
                        </label>


                        <Select

                            classNamePrefix=
                                "store-select"

                            styles={
                                selectStyles
                            }

                            placeholder=
                                "Select Item Group"

                            options={
                                itemGroupOptions
                            }

                            value={

                                itemGroupOptions.find(
                                    (option) =>
                                        String(
                                            option.value
                                        ) ===
                                        String(
                                            itemGroupIdInput
                                        )
                                ) || null

                            }

                            onChange={(
                                selected
                            ) => {

                                setItemGroupIdInput(
                                    selected?.value ||
                                    ''
                                )

                            }}

                            isClearable

                            isSearchable

                        />

                    </div>


                    {/* STATUS */}

                    <div className="sr-field">

                        <label>
                            STATUS
                        </label>


                        <Select

                            classNamePrefix=
                                "store-select"

                            styles={
                                selectStyles
                            }

                            placeholder=
                                "All Statuses"

                            options={
                                statusOptions
                            }

                            value={

                                statusOptions.find(
                                    (option) =>
                                        option.value ===
                                        statusInput
                                ) || null

                            }

                            onChange={(
                                selected
                            ) => {

                                setStatusInput(
                                    selected?.value ||
                                    ''
                                )

                            }}

                            isClearable

                        />

                    </div>


                </div>


                {/* FILTER BUTTONS */}

                <div className="sr-filter-actions">


                    <button

                        type="button"

                        className=
                            "sr-btn sr-btn-search"

                        onClick={
                            handleSearch
                        }

                        disabled={
                            loading
                        }

                    >

                        <FaSearch
                            size={12}
                        />

                        Search

                    </button>


                    <button

                        type="button"

                        className=
                            "sr-btn sr-btn-clear"

                        onClick={
                            handleClear
                        }

                        disabled={
                            loading
                        }

                    >

                        <FaSyncAlt
                            size={12}
                        />

                        Clear

                    </button>


                </div>


            </div>


            {/* ==================================================
                RESULT CARD
                ================================================== */}

            <div className="sr-table-card">


                {/* ==================================================
                    TOOLBAR
                    ================================================== */}

                <div className="sr-table-toolbar">


                    {/* EXPORT */}

                    <button

                        type="button"

                        className=
                            "sr-btn sr-btn-export"

                        onClick={
                            handleExportExcel
                        }

                        disabled={
                            loading ||
                            exporting ||
                            totalRows === 0
                        }

                    >

                        <FaFileExcel
                            size={13}
                        />

                        {
                            exporting
                                ? 'Exporting...'
                                : 'Export'
                        }

                    </button>


                    {/* SEARCH INPUT */}

                    <div className="sr-search-box">


                        <FaSearch />


                        <input

                            type="text"

                            value={
                                search
                            }

                            onChange={
                                handleSearchChange
                            }

                            placeholder=
                                "Search by Part No, Part Name..."

                        />


                    </div>


                </div>


                {/* ==================================================
                    DATA TABLE

                    IMPORTANT:
                    Same pagination pattern as Store Report
                    ================================================== */}

                <DataTable

                    columns={
                        columns
                    }

                    data={
                        rows
                    }


                    pagination

                    paginationServer

                    paginationTotalRows={
                        totalRows
                    }

                    paginationPerPage={
                        rowsPerPage
                    }

                    paginationRowsPerPageOptions={[
                        10,
                        25,
                        50,
                        100,
                    ]}


                    onChangePage={
                        handlePageChange
                    }

                    onChangeRowsPerPage={
                        handleRowsPerPageChange
                    }


                    progressPending={
                        loading
                    }


                    persistTableHead

                    striped

                    responsive

                    highlightOnHover


                    noDataComponent={

                        <div className="sr-empty">

                            No stock records found

                        </div>

                    }


                    customStyles={
                        customStyles
                    }

                />


            </div>


        </div>

    )
}


export default StockReport