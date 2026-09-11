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
        minHeight: '40px',

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


    indicatorSeparator: (base) => ({
        ...base,

        backgroundColor: '#dfe4ee',
    }),


    dropdownIndicator: (base) => ({
        ...base,

        color: '#64748b',

        padding: '8px',
    }),


    clearIndicator: (base) => ({
        ...base,

        color: '#94a3b8',

        padding: '8px',

        '&:hover': {
            color: '#dc2626',
        },
    }),


    menu: (base) => ({
        ...base,

        zIndex: 9999,

        fontSize: '13px',

        borderRadius: '8px',

        boxShadow:
            '0 8px 24px rgba(16, 24, 40, 0.12)',

        overflow: 'hidden',
    }),


    menuList: (base) => ({
        ...base,

        padding: '4px',

        maxHeight: '220px',
    }),


    option: (base, state) => ({
        ...base,

        padding: '10px 12px',

        borderRadius: '5px',

        cursor: 'pointer',

        fontSize: '13px',

        color:
            state.isSelected
                ? '#ffffff'
                : '#1e293b',

        backgroundColor:
            state.isSelected
                ? '#2f5fdd'
                : state.isFocused
                    ? '#f1f5f9'
                    : '#ffffff',

        ':active': {
            backgroundColor: '#2650bd',
            color: '#ffffff',
        },
    }),
}


// ==========================================================
// Stock Report
// ==========================================================

const StockReport = () => {

    // ========================================================
    // FILTER INPUT VALUES
    // Values selected before clicking Search
    // ========================================================

    const [
        itemGroupIdInput,
        setItemGroupIdInput,
    ] = useState('')


    const [
        partNumberInput,
        setPartNumberInput,
    ] = useState('')


    const [
        statusInput,
        setStatusInput,
    ] = useState('')


    // ========================================================
    // APPLIED FILTER VALUES
    // Values actually used for API request
    // ========================================================

    const [
        itemGroupId,
        setItemGroupId,
    ] = useState('')


    const [
        partNumber,
        setPartNumber,
    ] = useState('')


    const [
        status,
        setStatus,
    ] = useState('')


    // ========================================================
    // TABLE SEARCH
    // ========================================================

    const [
        search,
        setSearch,
    ] = useState('')


    // ========================================================
    // ITEM GROUPS
    // ========================================================

    const [
        itemGroups,
        setItemGroups,
    ] = useState([])


    // ========================================================
    // PART NUMBERS
    // ========================================================

    const [
        partNumbers,
        setPartNumbers,
    ] = useState([])


    // ========================================================
    // TABLE DATA
    // ========================================================

    const [
        rows,
        setRows,
    ] = useState([])


    const [
        totalRows,
        setTotalRows,
    ] = useState(0)


    // ========================================================
    // PAGINATION
    // ========================================================

    const [
        currentPage,
        setCurrentPage,
    ] = useState(1)


    const [
        rowsPerPage,
        setRowsPerPage,
    ] = useState(10)


    // ========================================================
    // LOADING
    // ========================================================

    const [
        loading,
        setLoading,
    ] = useState(false)


    const [
        exporting,
        setExporting,
    ] = useState(false)


    // ========================================================
    // SEARCH TIMER
    // ========================================================

    const searchTimerRef =
        useRef(null)


    // ========================================================
    // ITEM GROUP OPTIONS
    // ========================================================

    const itemGroupOptions =
        useMemo(() => {

            return itemGroups
                .filter(
                    (group) =>
                        group != null
                )
                .map(
                    (group) => ({
                        value:
                            group.id,

                        label:
                            group.groupName,
                    })
                )

        }, [itemGroups])


    // ========================================================
    // PART NUMBER OPTIONS
    // ========================================================

    const partNumberOptions =
        useMemo(() => {

            const options = []


            partNumbers.forEach(
                (part) => {

                    if (!part) {
                        return
                    }


                    // ----------------------------------------
                    // Backend returns string
                    // ----------------------------------------

                    if (
                        typeof part ===
                        'string'
                    ) {

                        options.push({
                            value: part,
                            label: part,
                        })

                        return
                    }


                    // ----------------------------------------
                    // Backend returns object
                    // ----------------------------------------

                    const value =
                        part.partNumber ??
                        part.PartNumber ??
                        part.value ??
                        ''


                    if (value) {

                        options.push({
                            value,

                            label:
                                part.partNumber ??
                                part.PartNumber ??
                                part.label ??
                                value,
                        })

                    }

                }
            )


            // --------------------------------------------
            // Remove duplicates
            // --------------------------------------------

            const uniqueOptions = []

            const seen =
                new Set()


            options.forEach(
                (option) => {

                    const key =
                        String(
                            option.value
                        ).toLowerCase()


                    if (
                        !seen.has(key)
                    ) {

                        seen.add(key)

                        uniqueOptions.push(
                            option
                        )

                    }

                }
            )


            return uniqueOptions

        }, [partNumbers])


    // ========================================================
    // LOAD STOCK REPORT
    // ========================================================

    const loadReport =
        useCallback(
            async ({
                page = currentPage,
                pageSize = rowsPerPage,

                itemGroup =
                    itemGroupId,

                partNumberValue =
                    partNumber,

                statusValue =
                    status,

                searchText =
                    search,

                exportAll = false,

            } = {}) => {

                setLoading(true)


                try {

                    // ========================================
                    // API PARAMS
                    // ========================================

                    const params = {
                        page,
                        pageSize,
                    }


                    // ========================================
                    // ITEM GROUP FILTER
                    // ========================================

                    if (
                        itemGroup
                    ) {

                        params.itemGroupId =
                            itemGroup

                    }


                    // ========================================
                    // STATUS FILTER
                    // ========================================

                    if (
                        statusValue
                    ) {

                        params.status =
                            statusValue

                    }


                    // ========================================
                    // SEARCH / PART NUMBER
                    //
                    // IMPORTANT:
                    //
                    // Part Number uses the existing
                    // backend "search" parameter.
                    //
                    // If table search has a value,
                    // table search gets priority.
                    //
                    // Otherwise selected Part Number
                    // is sent through "search".
                    // ========================================

                    const finalSearch =
                        searchText?.trim()
                            ? searchText.trim()
                            : partNumberValue?.trim()
                                ? partNumberValue.trim()
                                : ''


                    if (
                        finalSearch
                    ) {

                        params.search =
                            finalSearch

                    }


                    // ========================================
                    // EXPORT
                    // ========================================

                    if (
                        exportAll
                    ) {

                        params.exportAll =
                            true

                    }


                    // ========================================
                    // DEBUG
                    // ========================================

                    console.log(
                        'Stock Report API Params:',
                        params
                    )


                    // ========================================
                    // API CALL
                    // ========================================

                    const res =
                        await API.get(
                            '/Reports/stock',
                            {
                                params,
                            }
                        )


                    // ========================================
                    // EXPORT RESPONSE
                    // ========================================

                    if (
                        exportAll
                    ) {

                        return Array.isArray(
                            res.data?.data
                        )
                            ? res.data.data
                            : []

                    }


                    // ========================================
                    // NORMAL RESPONSE
                    // ========================================

                    const result =
                        res.data || {}


                    // ========================================
                    // TABLE ROWS
                    // ========================================

                    setRows(
                        Array.isArray(
                            result.data
                        )
                            ? result.data
                            : []
                    )


                    // ========================================
                    // TOTAL ROWS
                    // ========================================

                    setTotalRows(
                        Number(
                            result.totalRows
                        ) || 0
                    )


                    // ========================================
                    // ITEM GROUPS
                    // ========================================

                    if (
                        Array.isArray(
                            result.itemGroups
                        )
                    ) {

                        setItemGroups(
                            result.itemGroups
                        )

                    }


                    // ========================================
                    // PART NUMBERS
                    // ========================================

                    if (
                        Array.isArray(
                            result.partNumbers
                        )
                    ) {

                        setPartNumbers(
                            result.partNumbers
                        )

                    }
                    else {

                        // ====================================
                        // FALLBACK
                        // Build part number list
                        // from returned rows
                        // ====================================

                        const fallbackParts =
                            Array.isArray(
                                result.data
                            )
                                ? result.data
                                    .map(
                                        (row) =>
                                            row.partNumber
                                    )
                                    .filter(Boolean)
                                : []


                        if (
                            fallbackParts.length
                        ) {

                            setPartNumbers(
                                (previous) => {

                                    const combined = [
                                        ...previous,
                                        ...fallbackParts,
                                    ]


                                    return [
                                        ...new Set(
                                            combined
                                        ),
                                    ]

                                }
                            )

                        }

                    }

                }
                catch (err) {

                    console.error(
                        'Stock Report Error:',
                        err
                    )


                    toast.error(
                        err?.response?.data?.message ||
                        err?.response?.data?.error ||
                        'Failed to load Stock Report'
                    )


                    if (
                        !exportAll
                    ) {

                        setRows([])

                        setTotalRows(0)

                    }

                }
                finally {

                    setLoading(false)

                }

            },
            [
                currentPage,
                rowsPerPage,
                itemGroupId,
                partNumber,
                status,
                search,
            ]
        )


    // ========================================================
    // INITIAL LOAD
    // ========================================================

    useEffect(() => {

        loadReport({
            page: 1,
            pageSize: rowsPerPage,
        })

        // eslint-disable-next-line react-hooks/exhaustive-deps

    }, [])


    // ========================================================
    // SEARCH BUTTON
    // ========================================================

    const handleSearch =
        async () => {

            // --------------------------------------------
            // Reset page
            // --------------------------------------------

            setCurrentPage(1)


            // --------------------------------------------
            // Apply Item Group
            // --------------------------------------------

            setItemGroupId(
                itemGroupIdInput
            )


            // --------------------------------------------
            // Apply Part Number
            // --------------------------------------------

            setPartNumber(
                partNumberInput
            )


            // --------------------------------------------
            // Apply Status
            // --------------------------------------------

            setStatus(
                statusInput
            )


            // --------------------------------------------
            // Load filtered data
            // --------------------------------------------

            await loadReport({

                page: 1,

                pageSize:
                    rowsPerPage,

                itemGroup:
                    itemGroupIdInput,

                partNumberValue:
                    partNumberInput,

                statusValue:
                    statusInput,

                searchText:
                    search,

            })

        }


    // ========================================================
    // CLEAR
    // ========================================================

    const handleClear =
        async () => {

            // --------------------------------------------
            // Clear debounce timer
            // --------------------------------------------

            if (
                searchTimerRef.current
            ) {

                clearTimeout(
                    searchTimerRef.current
                )

            }


            // --------------------------------------------
            // Clear filter inputs
            // --------------------------------------------

            setItemGroupIdInput('')

            setPartNumberInput('')

            setStatusInput('')


            // --------------------------------------------
            // Clear applied filters
            // --------------------------------------------

            setItemGroupId('')

            setPartNumber('')

            setStatus('')


            // --------------------------------------------
            // Clear table search
            // --------------------------------------------

            setSearch('')


            // --------------------------------------------
            // Reset page
            // --------------------------------------------

            setCurrentPage(1)


            // --------------------------------------------
            // Reload all data
            // --------------------------------------------

            await loadReport({

                page: 1,

                pageSize:
                    rowsPerPage,

                itemGroup: '',

                partNumberValue: '',

                statusValue: '',

                searchText: '',

            })

        }


    // ========================================================
    // TABLE SEARCH
    // ========================================================

    const handleSearchChange =
        (e) => {

            const value =
                e.target.value


            setSearch(value)


            // --------------------------------------------
            // Clear old timer
            // --------------------------------------------

            if (
                searchTimerRef.current
            ) {

                clearTimeout(
                    searchTimerRef.current
                )

            }


            // --------------------------------------------
            // Debounce
            // --------------------------------------------

            searchTimerRef.current =
                setTimeout(
                    () => {

                        setCurrentPage(1)


                        loadReport({

                            page: 1,

                            pageSize:
                                rowsPerPage,

                            itemGroup:
                                itemGroupId,

                            partNumberValue:
                                partNumber,

                            statusValue:
                                status,

                            searchText:
                                value,

                        })

                    },
                    400
                )

        }


    // ========================================================
    // CLEANUP SEARCH TIMER
    // ========================================================

    useEffect(() => {

        return () => {

            if (
                searchTimerRef.current
            ) {

                clearTimeout(
                    searchTimerRef.current
                )

            }

        }

    }, [])


    // ========================================================
    // SERVER PAGINATION
    // ========================================================

    const handlePageChange =
        async (page) => {

            setCurrentPage(page)


            await loadReport({

                page,

                pageSize:
                    rowsPerPage,

                itemGroup:
                    itemGroupId,

                partNumberValue:
                    partNumber,

                statusValue:
                    status,

                searchText:
                    search,

            })

        }


    // ========================================================
    // ROWS PER PAGE
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

                itemGroup:
                    itemGroupId,

                partNumberValue:
                    partNumber,

                statusValue:
                    status,

                searchText:
                    search,

            })

        }


    // ========================================================
    // EXPORT EXCEL
    // ========================================================

    const handleExportExcel =
        async () => {

            if (
                totalRows === 0
            ) {

                toast.error(
                    'Nothing to export — run a search first'
                )

                return

            }


            setExporting(true)


            try {

                // ========================================
                // Get ALL filtered records
                // ========================================

                const exportRows =
                    await loadReport({

                        page: 1,

                        pageSize:
                            1000000,

                        itemGroup:
                            itemGroupId,

                        partNumberValue:
                            partNumber,

                        statusValue:
                            status,

                        searchText:
                            search,

                        exportAll:
                            true,

                    })


                // ========================================
                // No records
                // ========================================

                if (
                    !exportRows.length
                ) {

                    toast.error(
                        'Nothing to export for the selected filters'
                    )

                    return

                }


                // ========================================
                // Excel data
                // ========================================

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


                // ========================================
                // Worksheet
                // ========================================

                const worksheet =
                    XLSX.utils.json_to_sheet(
                        exportData
                    )


                // ========================================
                // Workbook
                // ========================================

                const workbook =
                    XLSX.utils.book_new()


                XLSX.utils.book_append_sheet(
                    workbook,
                    worksheet,
                    'Stock Report'
                )


                // ========================================
                // Download
                // ========================================

                XLSX.writeFile(
                    workbook,
                    `Stock_Report_${new Date()
                        .toISOString()
                        .slice(0, 10)}.xlsx`
                )


                toast.success(
                    'Stock Report exported successfully'
                )

            }
            catch (err) {

                console.error(
                    'Export Error:',
                    err
                )


                toast.error(
                    'Failed to export Stock Report'
                )

            }
            finally {

                setExporting(false)

            }

        }


    // ========================================================
    // TABLE COLUMNS
    // ========================================================

    const columns =
        useMemo(
            () => [

                // =========================================
                // S.NO
                // =========================================

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


                // =========================================
                // PART NUMBER
                // =========================================

                {
                    name: 'PART NUMBER',

                    selector:
                        (row) =>
                            row.partNumber ??
                            '—',

                    sortable: true,

                    width: '140px',
                },


                // =========================================
                // PART NAME
                // =========================================

                {
                    name: 'PART NAME',

                    selector:
                        (row) =>
                            row.partName ??
                            '—',

                    sortable: true,

                    minWidth: '180px',
                },


                // =========================================
                // ITEM GROUP
                // =========================================

                {
                    name: 'ITEM GROUP',

                    selector:
                        (row) =>
                            row.itemGroupName ??
                            '—',

                    sortable: true,

                    minWidth: '140px',
                },


                // =========================================
                // RECEIVED
                // =========================================

                {
                    name: 'RECEIVED',

                    selector:
                        (row) =>
                            row.receivedQty ??
                            0,

                    sortable: true,

                    center: true,

                    width: '110px',

                    cell:
                        (row) => (

                            <span>
                                {
                                    num(
                                        row.receivedQty
                                    )
                                }
                            </span>

                        ),
                },


                // =========================================
                // ISSUED
                // =========================================

                {
                    name: 'ISSUED',

                    selector:
                        (row) =>
                            row.issuedQty ??
                            0,

                    sortable: true,

                    center: true,

                    width: '100px',

                    cell:
                        (row) => (

                            <span>
                                {
                                    num(
                                        row.issuedQty
                                    )
                                }
                            </span>

                        ),
                },


                // =========================================
                // ON HAND
                // =========================================

                {
                    name: 'ON HAND',

                    selector:
                        (row) =>
                            row.onHandQty ??
                            0,

                    sortable: true,

                    center: true,

                    width: '110px',

                    cell:
                        (row) => (

                            <span>
                                {
                                    num(
                                        row.onHandQty
                                    )
                                }
                            </span>

                        ),
                },


                // =========================================
                // STOCK VALUE
                // =========================================

                {
                    name: 'STOCK VALUE',

                    selector:
                        (row) =>
                            row.stockValue ??
                            0,

                    sortable: true,

                    right: true,

                    width: '140px',

                    cell:
                        (row) => (

                            <span>
                                {
                                    money(
                                        row.stockValue
                                    )
                                }
                            </span>

                        ),
                },


                // =========================================
                // STATUS
                // =========================================

                {
                    name: 'STATUS',

                    width: '120px',

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
    // CUSTOM DATATABLE STYLES
    // ========================================================

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
    // RENDER
    // ========================================================

    return (

        <div className="sr-page">

            {/* ==================================================
                FILTER CARD
            ================================================== */}

            <div className="sr-filter-card">

                {/* ==============================================
                    TITLE
                ============================================== */}

                <div className="sr-filter-title">

                    Stock Report

                </div>


                {/* ==============================================
                    FILTER GRID
                    ITEM GROUP | PART NUMBER | STATUS
                ============================================== */}

                <div className="sr-filter-grid">


                    {/* ==========================================
                        ITEM GROUP
                    ========================================== */}

                    <div className="sr-field">

                        <label>
                            PART GROUP
                        </label>


                        <Select

                            className="sr-react-select"

                            classNamePrefix="sr-select"

                            styles={
                                selectStyles
                            }

                            placeholder="Select Item Group"

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

                            onChange={
                                (selected) => {

                                    setItemGroupIdInput(
                                        selected?.value ||
                                        ''
                                    )

                                }
                            }

                            isClearable

                            isSearchable

                        />

                    </div>


                    {/* ==========================================
                        PART NUMBER
                    ========================================== */}

                    <div className="sr-field">

                        <label>
                            PART NUMBER
                        </label>


                        <Select

                            className="sr-react-select"

                            classNamePrefix="sr-select"

                            styles={
                                selectStyles
                            }

                            placeholder="Select Part Number"

                            options={
                                partNumberOptions
                            }

                            value={

                                partNumberOptions.find(
                                    (option) =>
                                        String(
                                            option.value
                                        ) ===
                                        String(
                                            partNumberInput
                                        )
                                ) || null

                            }

                            onChange={
                                (selected) => {

                                    setPartNumberInput(
                                        selected?.value ||
                                        ''
                                    )

                                }
                            }

                            isClearable

                            isSearchable

                            noOptionsMessage={() =>
                                'No Part Number found'
                            }

                        />

                    </div>


                    {/* ==========================================
                        STATUS
                    ========================================== */}

                    <div className="sr-field">

                        <label>
                            STATUS
                        </label>


                        <Select

                            className="sr-react-select"

                            classNamePrefix="sr-select"

                            styles={
                                selectStyles
                            }

                            placeholder="All Statuses"

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

                            onChange={
                                (selected) => {

                                    setStatusInput(
                                        selected?.value ||
                                        ''
                                    )

                                }
                            }

                            isClearable

                        />

                    </div>

                </div>


                {/* ==============================================
                    FILTER BUTTONS
                ============================================== */}

                <div className="sr-filter-actions">


                    {/* SEARCH */}

                    <button

                        type="button"

                        className="
                            sr-btn
                            sr-btn-search
                        "

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


                    {/* CLEAR */}

                    <button

                        type="button"

                        className="
                            sr-btn
                            sr-btn-clear
                        "

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

                        className="
                            sr-btn
                            sr-btn-export
                        "

                        onClick={
                            handleExportExcel
                        }

                        disabled={
                            exporting ||
                            loading
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


                    {/* TABLE SEARCH */}

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

                            placeholder="Search by Part No, Part Name..."

                        />

                    </div>

                </div>


                {/* ==================================================
                    DATA TABLE
                ================================================== */}

                <DataTable

                    columns={
                        columns
                    }

                    data={
                        rows
                    }

                    customStyles={
                        customStyles
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

                />

            </div>

        </div>

    )
}


export default StockReport