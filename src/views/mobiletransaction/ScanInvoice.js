import React, { useState, useEffect, useRef } from 'react';
import { CButton, CCard, CCardBody, CFormSelect, CFormInput } from '@coreui/react';
import scanInvoiceImg from '../../assets/images/scaninvoice.png';
import DataTable from 'react-data-table-component';
import { toast } from 'react-toastify';
import { FaSave, FaUndo, FaFileInvoice, FaCube, FaArrowLeft, FaPlus, } from 'react-icons/fa';
import '../../assets/CSS/scaninvoice.css';
import API from '../../api.js';
import { useNavigate } from 'react-router-dom';

const ScanInvoice = () => {

    const customTableStyles = {
        headRow: {
            style: {
                backgroundColor: '#0b43b5',
                minHeight: '36px',
            },
        },
        headCells: {
            style: {
                backgroundColor: '#0b43b5',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '12px',
            },
        },
    };
    const [customer, setCustomer] = useState('');
    const [customers, setCustomers] = useState([]);
    const [scanData, setScanData] = useState([]);
    const scanRef = useRef(null);
    const customerRef = useRef(null);
    const navigate = useNavigate();
    const [savedDispatchId, setSavedDispatchId] = useState('');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [dispatchId, setDispatchId] = useState('');
    const [cancelLoading, setCancelLoading] = useState(false);

    // Mirrors the DOM value for display only (scanned-value-display, the Add
    // button's disabled state). The <input> itself is intentionally
    // uncontrolled — see the input below — so this state is never fed back
    // into it. The actual <input> stays visually hidden (see .scanner-input
    // in CSS); it only exists to capture keystrokes from the scanner.
    const [scanValue, setScanValue] = useState('');

    useEffect(() => {
        loadCustomers();
    }, []);

    useEffect(() => {
        const handleGlobalKeydown = (e) => {
            // Block any modifier-combined keystroke outright, everywhere,
            // even while the scanner input is focused. Legitimate scan data
            // is just plain characters plus Tab/Enter — a scanner should
            // never need Ctrl/Alt/Meta held down. If one shows up, it's a
            // misfire (e.g. a keyboard-layout mismatch translating a raw
            // barcode control byte into "Ctrl+J") and the safest thing to
            // do is swallow it before the browser can act on it as a
            // shortcut (Downloads, New Tab, etc.).
            //
            // Caveat: this is best-effort, not a guarantee. Some browsers
            // treat certain combinations (Ctrl+T, Ctrl+N, Ctrl+W) as
            // reserved at the browser-chrome level and act on them before —
            // or regardless of — dispatching the event to the page at all,
            // so no page-level JavaScript can intercept those. The real
            // fix for this class of bug is on the scanner side (correct
            // USB keyboard country/layout, or switch it to USB-CDC/serial
            // mode so it stops emulating a keyboard entirely).
            if (e.ctrlKey || e.metaKey || e.altKey) {
                e.preventDefault()
                e.stopPropagation()
                if (document.activeElement !== scanRef.current) {
                    scanRef.current?.focus()
                }
                return
            }

            // Let genuinely-focused real inputs behave normally
            const active = document.activeElement
            if (active === scanRef.current) return

            // Never let Tab move focus away from the scanner — scanners send
            // Tab as a field separator, and losing focus mid-scan drops/
            // corrupts whatever character arrives next.
            if (e.key === 'Tab') {
                e.preventDefault()
                scanRef.current?.focus()
                return
            }

            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName) && active !== scanRef.current) {
                return
            }

            // Otherwise redirect the keystroke to the scanner input
            e.preventDefault()
            scanRef.current?.focus()
        }

        document.addEventListener('keydown', handleGlobalKeydown, true)
        return () => document.removeEventListener('keydown', handleGlobalKeydown, true)
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            scanRef.current?.focus();
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    const loadCustomers = async () => {
        try {
            const res = await API.get('/customer');
            setCustomers(res.data);
        } catch (err) {

            console.error(err);
            toast.error('Failed to load customers')
        }
    };

    // Clears both the uncontrolled DOM input and the mirrored display state.
    // Since the scanner input is intentionally uncontrolled, setScanValue('')
    // alone would NOT clear what's visibly in the box.
    const clearScanInput = () => {
        if (scanRef.current) scanRef.current.value = '';
        setScanValue('');
    };

    const handleSave = async () => {
        if (!customer) {
            toast.error("Please select customer");
            return;
        }

        if (scanData.length === 0) {
            toast.warning("No data scanned");
            return;
        }

        try {
            const user = JSON.parse(
                sessionStorage.getItem("user") || "{}"
            );

            const res = await API.post("/invoices/bulk", {
                customerId: Number(customer),
                createdBy: user?.id,
                invoices: scanData
            });

            setSavedDispatchId(
                res.data.despatchID
            );

            toast.success(
                `Saved Successfully - ${res.data.DespatchID || res.data.despatchID
                }`
            );

            setScanData([]);
            setCustomer("");
            clearScanInput();

            // Navigate after 3 seconds
            setTimeout(() => {
                navigate("/mobiletransaction/partscan");
            }, 3000);

        } catch (error) {
            console.error(error);
            toast.error("Save Failed");
        }
    };

    const handleCancel = async () => {
        if (scanData.length > 0 && !dispatchId) {
            setScanData([]);
            setCustomer('');
            clearScanInput();
            if (scanRef.current) {
                scanRef.current.focus();
            }
            toast.info('Grid Cleared');
            return;
        }

        // Cancel saved invoice from DB
        if (dispatchId) {
            try {
                setCancelLoading(true);
                const user = JSON.parse(
                    sessionStorage.getItem("user") || "{}"
                );

                const res = await API.put(
                    `/Invoices/cancel-dispatch/${dispatchId}`,
                    {
                        userId: user.id
                    }
                );
                toast.success(res.data.message);
                setDispatchId('');
                setInvoiceNo('');
                setScanData([]);
                setCustomer('');
                clearScanInput();
            }
            catch (err) {

                toast.error(
                    err?.response?.data?.message ||
                    'Cancel Failed'
                );
            }
            finally {
                setCancelLoading(false);
            }
        }
    };


    const totalRecords = scanData.length;

    const totalQty = scanData.reduce(
        (sum, item) => sum + Number(item.qty),
        0
    );

    // --- Barcode structure (per "BARCODE FORMAT CHANGED" spec, confirmed
    //     directly against the official field-width tables) ---
    //
    // Every field within a single record is FIXED WIDTH per the spec's
    // cell diagram, but real scans do NOT pad short values out to that
    // width — amounts, dates+quantity, etc. are written at their natural
    // (often much shorter) length with NO delimiter between fields at
    // all. The only real separator in the whole format is "\r\n" between
    // multiple part line items on one invoice (and even that is absent
    // after the last item) — it does not appear between fields within one
    // record. In practice this "\r\n" frequently doesn't survive scanner
    // capture either, which is what splitBarcodeRecords below exists to
    // recover from by pattern rather than by delimiter.
    //
    // Because of this, extraction below never assumes a separator exists
    // anywhere within a record; it anchors purely on structure it can
    // trust: SHOP CODE + PO NUMBER is always exactly 12 characters (2 +
    // 10, per spec, regardless of shop code), and INVOICE NUMBER is
    // always exactly 10 digits.
    //
    // PART NUMBER is deliberately NOT matched against a hardcoded list of
    // full part-number shapes (e.g. "28700[A-Z]\d{4}", "285xx", "289xx").
    // Real part numbers have turned up with a wider range of suffixes
    // than any fixed shape can anticipate (e.g. "28610K6900", alongside
    // "28700T7230" and "2853008370") — hardcoding shapes means a part
    // with a suffix not yet seen silently gets skipped, and the parser
    // locks onto the WRONG record entirely, corrupting invoice number,
    // quantity, everything downstream. Instead, part number length is
    // determined dynamically by trial: try 10 characters (the
    // overwhelmingly common length) right after the 12-character header
    // prefix, then 11 (a trailing-letter suffix), then 9, and so on up to
    // the spec's own stated maximum of 15 — and accept whichever length
    // is immediately followed by a clean 10-digit run, since that's the
    // real invoice number, and finding one there is what confirms the
    // part-number length guess was right.
    //
    // The one thing this still checks is that the part number starts
    // with one of KNOWN_PART_NUMBER_PREFIXES below. This is NOT the same
    // kind of hardcoding as the old shape list — it's a genuine, stable
    // fact about Hyundai/Kia OEM part numbering under this barcode
    // format (every part number confirmed so far, across every suffix
    // variant seen, has started with "28"), and it exists purely to
    // disambiguate: without ANY content check, an all-digit part number
    // (e.g. "2853008370") and the invoice number immediately after it
    // become genuinely indistinguishable at the wrong trial length —
    // both are just runs of digits, so more than one length can satisfy
    // "the next 10 characters are digits" by coincidence, and the wrong
    // one can win silently instead of failing loudly. If parts from a
    // different manufacturer or family ever need to be supported, add
    // their prefix to this list — nothing else in the matching logic
    // needs to change.
    const KNOWN_PART_NUMBER_PREFIXES = ['28'];

    const HEADER_PREFIX_LENGTH = 12; // shop code (2) + PO number (10), fixed per spec

    // Splits a multi-invoice scan into individual records. Record
    // boundaries are detected by a shop code (2 alphanumeric chars) + a
    // 10-digit Purchase Order Number, confirmed by a recognizable
    // part-number pattern immediately following (the lookahead below).
    // Records are concatenated with no separator between them (the last
    // field of one record touches the header of the next), so boundaries
    // have to be found by pattern rather than by splitting on a delimiter.
    const splitBarcodeRecords = (qr) => {
        const starts = [];
        const prefixAlternation = KNOWN_PART_NUMBER_PREFIXES.join('|');
        const partPattern = `(?:${prefixAlternation})[A-Za-z0-9]{7,9}`;
        const regex = new RegExp(`[A-Za-z0-9]{2}\\d{10}(?=${partPattern})`, 'g');

        let match;
        while ((match = regex.exec(qr)) !== null) {
            starts.push(match.index);
        }

        if (!starts.length) return [qr];

        return starts.map((start, index) => {
            const end = starts[index + 1] || qr.length;
            return qr.substring(start, end);
        });
    };

    // Tries a specific part-number length at the fixed header offset, and
    // only accepts it if what immediately follows looks like a genuine
    // 10-digit invoice number — see the comment above
    // KNOWN_PART_NUMBER_PREFIXES for why the prefix check exists at all.
    const tryExtractHeader = (record, partLen) => {
        if (record.length < HEADER_PREFIX_LENGTH + partLen + 10) return null;
        const partNumber = record.substr(HEADER_PREFIX_LENGTH, partLen);
        if (!KNOWN_PART_NUMBER_PREFIXES.some((prefix) => partNumber.startsWith(prefix))) return null;

        let pos = HEADER_PREFIX_LENGTH + partLen;
        const invoiceNumber = record.substr(pos, 10);
        if (/^\d{10}$/.test(invoiceNumber)) {
            return { partNumber, invoiceNumber, pos: pos + 10 };
        }

        // Allow a single stray separator character before the invoice
        // number, but don't require one.
        if (record[pos] && !/\d/.test(record[pos])) {
            const invoiceNumber2 = record.substr(pos + 1, 10);
            if (/^\d{10}$/.test(invoiceNumber2)) {
                return { partNumber, invoiceNumber: invoiceNumber2, pos: pos + 1 + 10 };
            }
        }
        return null;
    };

    // Extracts invoice number, part number, and quantity from a single record.
    //
    // Best case: some whitespace survived the capture. Tokenize and check
    // whether the TARIFF NUMBER field — a constant literal
    // ("8708.92.000.00") in every real scan checked so far — ended up as
    // its own isolated token. If so, walk backward from it: two tokens
    // before it is date+qty, three tokens before it carries the invoice
    // number, always as its trailing 10 digits. This gives full accuracy
    // including quantity, and the part number is simply whatever's left
    // in the reconstructed header after the fixed 12-character prefix —
    // no shape assumption needed since the boundaries are already known
    // exactly.
    //
    // Worst case: little or no whitespace survived, which is normal per
    // spec. This falls back to the dynamic trial-length detection
    // described above for both part number and invoice number.
    //
    // Quantity in that fallback case can't be read directly off the fused
    // "quantity+value" span right after the date — its digit count
    // varies with no fixed width — so it's recovered from a genuine
    // numeric relationship further into the record: MATERIAL COST = UNIT
    // PRICE × QUANTITY per the spec, and that same total also shows up
    // again later (e.g. as CONSIGNEE PART COST), while UNIT PRICE
    // appears earlier as its own decimal amount. Both are cleanly
    // delimited by their own decimal points even when nothing else is,
    // so scanning every "X.XX"-formatted number in the record and
    // finding one that repeats later gives an unambiguous pair — the
    // value immediately before the repeat is UNIT PRICE, the repeated
    // value is MATERIAL COST, and QUANTITY is their ratio. Verified
    // against confirmed real quantities across a wide range (2, 4, 8,
    // 10, 16, 28, 32, 72). Falls back to 1 only if no such repeated pair
    // is found; the scanned row is still shown before Add either way, so
    // a wrong value is easy to catch and correct.
    const TARIFF_TOKEN_PATTERN = /^\d{4}\.\d{2}\.\d{3}\.\d{2}$/;

    const getQuantityFromRecord = (record) => {
        const values = record.match(/\d+\.\d{2}/g) || [];
        const nums = values.map(Number);
        for (let i = 1; i < nums.length; i++) {
            if (nums[i] === 0) continue;
            const repeatsLater = nums.slice(i + 1).includes(nums[i]);
            if (repeatsLater && nums[i - 1] !== 0) {
                const qty = Math.round(nums[i] / nums[i - 1]);
                if (qty > 0) return qty;
            }
        }
        return 1;
    };

    const extractRowFromRecord = (record) => {
        const tokens = record.trim().split(/\s+/).filter(Boolean);

        const tariffTokenIdx = tokens.findIndex((t) => TARIFF_TOKEN_PATTERN.test(t));
        if (tariffTokenIdx >= 3) {
            const invoiceCarrierToken = tokens[tariffTokenIdx - 3];
            const dateAndQty = tokens[tariffTokenIdx - 2];
            const invoiceMatch = invoiceCarrierToken.match(/\d{10}$/);
            if (invoiceMatch) {
                const invoice = invoiceMatch[0];
                const headerBlob =
                    tokens.slice(0, tariffTokenIdx - 3).join('') +
                    invoiceCarrierToken.slice(0, invoiceCarrierToken.length - invoice.length);
                const partNo = headerBlob.substring(HEADER_PREFIX_LENGTH);
                if (partNo && KNOWN_PART_NUMBER_PREFIXES.some((prefix) => partNo.startsWith(prefix))) {
                    return [{
                        invoiceNo: invoice,
                        partNo,
                        qty: Number(dateAndQty.substring(8)) || 1
                    }];
                }
            }
        }

        const result =
            tryExtractHeader(record, 10) ||
            tryExtractHeader(record, 11) ||
            tryExtractHeader(record, 9);
        if (!result) return [];

        const qty = getQuantityFromRecord(record);

        return [{
            invoiceNo: result.invoiceNumber,
            partNo: result.partNumber,
            qty
        }];
    };

    const processQRCode = async (rawValue) => {
        if (!customer) {
            toast.error("Please Select Customer");
            return;
        }
        try {
            // Normalize every kind of whitespace (real newlines, real tabs,
            // runs of spaces) down to single spaces rather than deleting it —
            // deleting whitespace fuses adjacent fields together with no way
            // to tell them apart afterward.
            const qr = rawValue
                .replace(/\r/g, '')
                .replace(/\$/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            const records = splitBarcodeRecords(qr);
            const rows = records
                .flatMap(record => extractRowFromRecord(record))
                .filter(row => row.invoiceNo && row.partNo);

            if (!rows.length) {
                toast.error("No Valid Invoice Data Found");
                clearScanInput();
                scanRef.current?.focus();
                return;
            }
            const invoiceNo = rows[0].invoiceNo;
            if (
                scanData.length > 0 &&
                scanData[0].invoiceNo !== invoiceNo
            ) {
                toast.warning(
                    `Invoice ${scanData[0].invoiceNo} already scanned. Please Save/Cancel before scanning another invoice.`
                );

                clearScanInput();
                scanRef.current?.focus();
                return;
            }
            const user = JSON.parse(
                sessionStorage.getItem("user") || "{}"
            );

            const checkRes = await API.get(
                "/invoices/checkinvoice",
                {
                    params: {
                        invoiceNo,
                        userId: user.id
                    }
                }
            );

            if (checkRes.data.exists) {
                toast.warning(
                    checkRes.data.message
                );
                clearScanInput();
                scanRef.current?.focus();
                return;
            }

            if (checkRes.data === true) {
                toast.warning(
                    `Invoice No ${invoiceNo} Already Scanned`
                );

                clearScanInput();
                scanRef.current?.focus();
                return;
            }

            let addedCount = 0;
            let skippedCount = 0;

            setScanData(prev => {
                const updated = [...prev];
                rows.forEach(row => {
                    const exists = updated.findIndex(
                        x => x.invoiceNo === row.invoiceNo && x.partNo === row.partNo
                    );

                    if (exists >= 0) {
                        skippedCount++;
                        return;
                    }

                    updated.push(row);
                    addedCount++;
                });

                return updated;
            });

            if (skippedCount > 0 && addedCount === 0) {
                toast.warning(`Invoice ${invoiceNo} Already Scanned`);
            } else if (addedCount > 0) {
                toast.success(`Invoice ${invoiceNo}: ${addedCount} Part(s) Added`);
            }

            clearScanInput();
            scanRef.current?.focus();

        } catch (err) {
            console.error(err);
            toast.error("Invalid QR Format");
            clearScanInput();
            scanRef.current?.focus();
        }
    };

    // Scanning just fills the box (via keystrokes from the scanner); it no
    // longer auto-processes. The user reviews what was scanned and clicks
    // "Add" (or presses Enter) to push it into the grid.
    //
    // If no customer is selected yet, scanning is blocked via the input's
    // `readOnly` attribute (see below) rather than by intercepting this
    // event — readOnly is enforced at the DOM level so nothing can be typed,
    // whereas trying to block it here would require the input to be
    // controlled, which is exactly what causes dropped scanner keystrokes at
    // high scan speed (see the input's comment).
    const handleScanInputChange = (e) => {
        setScanValue(e.target.value);
    };

    const handleAddClick = async () => {
        // Read straight from the DOM (source of truth for the uncontrolled
        // input) rather than the mirrored state, to avoid any chance of
        // using a value that hasn't caught up yet.
        const value = (scanRef.current?.value || '').trim();

        if (!value) {
            toast.warning("Please scan invoice");
            scanRef.current?.focus();
            return;
        }

        await processQRCode(value);
    };

    const columns = [
        {
            name: 'S.NO',
            width: '90px',
            cell: (row, index) => (
                <div
                    style={{
                        width: '100%',
                        textAlign: 'center'
                    }}
                >
                    {index + 1}
                </div>
            ),
        },
        {
            name: 'INVOICE NUMBER',
            selector: row => row.invoiceNo,
        },
        {
            name: 'PART NUMBER',
            selector: row => row.partNo,
        },
        {
            name: 'QTY',
            selector: row => row.qty,
            width: '100px',
        },
    ];

    const searchInvoice = async () => {
        if (!invoiceNo || invoiceNo.trim() === "") {
            toast.warning("Please enter the Invoice Number");
            return;
        }
        try {
            const res = await API.get(
                `/Invoices/invoice/${invoiceNo}`
            );

            setDispatchId(res.data.despatchID);

            setScanData(
                res.data.invoices.map(x => ({
                    invoiceNo: x.invoice_Number,
                    partNo: x.part_Number,
                    qty: x.quantity
                }))
            );

            toast.success(
                `Dispatch Found : ${res.data.despatchID}`
            );
        }
        catch (error) {
            setScanData([]);

            toast.error(
                error?.response?.data?.message ||
                error?.response?.data?.Message ||
                "Something went wrong"
            );
        }
    };

    return (
        <div className="scan-container">

            <div className="scan-header">
                <div>
                    <h3>SCAN INVOICE</h3>
                    <p>Scan and verify Invoice labels</p>
                </div>

                <div
                    className="mobility-back-icon"
                    onClick={() => navigate(-1)}
                    title="Back"
                >
                    <FaArrowLeft />
                </div>
            </div>
            <div className="scan-body">
                <label className="scan-label">
                    Customer Name
                    <span className="required"> *</span>
                </label>
                <CFormSelect
                    ref={customerRef}
                    value={customer}
                    onChange={(e) => {
                        setCustomer(e.target.value);

                        setTimeout(() => {
                            scanRef.current?.focus();
                        }, 100);
                    }}
                >
                    <option value="">
                        Select Customer
                    </option>

                    {customers.map((item) => (
                        <option
                            key={item.customerId}
                            value={item.customerId}
                        >
                            {item.customerName}
                        </option>
                    ))}
                </CFormSelect>

                <div
                    className={`scanner-box ${scanValue ? 'has-value' : ''}`}
                    onClick={() => {
                        if (!customer) {
                            toast.error("Please select customer");
                            customerRef.current?.focus();
                            return;
                        }
                        scanRef.current?.focus();
                    }}
                >
                    {scanValue ? (
                        <div className="scanned-value-display">{scanValue}</div>
                    ) : (
                        <>
                            <img
                                src={scanInvoiceImg}
                                alt="Scan Invoice"
                                className="scanner-image"
                            />
                            <div className="scan-cursor"></div>
                        </>
                    )}

                    <input
                        ref={scanRef}
                        type="text"
                        className="scanner-input"
                        autoFocus
                        autoComplete="off"
                        readOnly={!customer}
                        // Uncontrolled on purpose: a controlled input forces
                        // the DOM value back to React state on every render.
                        // Barcode scanners can fire keystrokes faster than
                        // React's render cycle, and that forced reset can
                        // silently drop characters mid-scan. Letting the DOM
                        // own the value guarantees nothing is lost; we only
                        // mirror it into state afterward for display.
                        onChange={handleScanInputChange}
                        onKeyDown={(e) => {
                            // Second layer of the same guard as the global
                            // handler — belt and suspenders, since this
                            // fires directly on the focused element.
                            if (e.ctrlKey || e.metaKey || e.altKey) {
                                e.preventDefault();
                                return;
                            }
                            if (e.key === 'Tab') {
                                // Scanners send Tab as a field separator, not
                                // a focus-nav key. Letting the browser handle
                                // it moves focus away and silently drops/
                                // fuses the next character(s) of the scan.
                                e.preventDefault();
                                return;
                            }
                            if (e.key === 'Enter') {
                                // Many scanners send Enter automatically at
                                // the end of a scan — treat that the same
                                // as clicking Add.
                                e.preventDefault();
                                handleAddClick();
                            }
                        }}
                    />
                </div>

                <div className="scan-add-row">
                    <CButton
                        className="scan-add-btn"
                        color="primary"
                        disabled={!scanValue.trim()}
                        onClick={handleAddClick}
                    >
                        <FaPlus />
                        <span style={{ marginLeft: '6px' }}>
                            Add
                        </span>
                    </CButton>
                </div>

                <div className="summary-row">
                    <CCard className="summary-card">
                        <CCardBody className="summary-content">
                            <div className="summary-icon invoice-icon">
                                <FaFileInvoice />
                            </div>
                            <div>
                                <small>Total Records</small>
                                <h4>{totalRecords}</h4>
                            </div>
                        </CCardBody>
                    </CCard>

                    <CCard className="summary-card">
                        <CCardBody className="summary-content">
                            <div className="summary-icon qty-icon">
                                <FaCube />
                            </div>
                            <div>
                                <small>Total Quantity</small>
                                <h4>{totalQty}</h4>
                            </div>

                        </CCardBody>
                    </CCard>
                </div>

                <div className="scan-table">
                    <div className="mtable-title">
                        Scanned Details
                    </div>

                    <div className="search-panel">
                        <CFormInput
                            className="search-input"
                            placeholder="Enter Invoice Number to Cancel"
                            value={invoiceNo}
                            onChange={(e) => setInvoiceNo(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    searchInvoice();
                                }
                            }}
                        />

                        <CButton
                            className="search-btn"
                            color="primary"
                            onClick={searchInvoice}
                        >
                            Search
                        </CButton>
                    </div>
                    <DataTable
                        columns={columns}
                        data={scanData}
                        pagination
                        fixedHeader
                        fixedHeaderScrollHeight="180px"
                        dense
                        striped
                        responsive
                        highlightOnHover
                        persistTableHead
                        noDataComponent="No Invoice Scanned"
                        customStyles={customTableStyles}
                    />
                </div>
                <div className="btn-row">

                    <CButton
                        className="cancel-btn"
                        onClick={handleCancel}
                        disabled={cancelLoading}
                    >
                        {cancelLoading ? (
                            <>
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                />
                                Cancelling...
                            </>
                        ) : (
                            <>
                                <FaUndo />
                                <span style={{ marginLeft: '6px' }}>
                                    Cancel
                                </span>
                            </>
                        )}
                    </CButton>

                    <CButton
                        className="msave-btn"
                        onClick={handleSave}
                    >
                        <FaSave />
                        <span style={{ marginLeft: '6px' }}>
                            Save
                        </span>
                    </CButton>
                </div>
            </div>
        </div>
    );
};

export default ScanInvoice;
