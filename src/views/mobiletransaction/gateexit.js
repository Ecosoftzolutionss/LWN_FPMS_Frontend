import React, { useEffect, useRef, useState } from 'react';
import { CButton } from '@coreui/react';
import { FaArrowLeft, FaInfoCircle, FaFileInvoice, FaPlus } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import scanInvoiceImg from '../../assets/images/scaninvoice.png';
import API from '../../api';
import '../../assets/CSS/scaninvoice.css';

const GateExit = () => {
    const scanRef = useRef(null);
    const isProcessing = useRef(false);
    const navigate = useNavigate();

    // Mirrors the DOM value for display only (scanned-value-display, the Add
    // button's disabled state). The <input> itself is intentionally
    // uncontrolled — see the input below — so this state is never fed back
    // into it.
    const [scanValue, setScanValue] = useState('');
    const [scannedData, setScannedData] = useState(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            scanRef.current?.focus();
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    // Keeps focus locked on the scanner input and blocks any
    // modifier-combined keystroke outright, everywhere — same protection
    // as ScanInvoice/PartScan. Legitimate scan data is just plain
    // characters plus Tab/Enter; a scanner should never need Ctrl/Alt/Meta
    // held down. If one shows up, it's a misfire (e.g. a keyboard-layout
    // mismatch translating a raw barcode control byte into a shortcut)
    // and the safest thing to do is swallow it before the browser can
    // act on it.
    //
    // IMPORTANT CAVEAT, worth reading if this keeps happening: this is
    // best-effort, not a guarantee. Chrome reserves a specific set of
    // shortcuts — Ctrl+T (new tab), Ctrl+N (new window), Ctrl+W (close
    // tab) among them — at the browser-chrome level and acts on them
    // BEFORE, or entirely independent of, dispatching the keystroke to
    // any page's JavaScript. No preventDefault() anywhere in this file
    // (or any web page's code) can intercept those specific ones — the
    // browser doesn't give the page a chance to see the event at all. If
    // "jumping to another tab" is what's happening, that is Ctrl+T, and
    // it falls squarely in this unfixable-from-JS category.
    //
    // The only real fix for this class of bug is on the scanner side:
    // correct the USB keyboard country/layout so it stops emitting
    // Ctrl-combinations in the first place, or — the more robust option —
    // switch it to USB-CDC/serial mode so it stops emulating a keyboard
    // entirely and reads through the Web Serial API instead, which has no
    // exposure to this class of issue.
    useEffect(() => {
        const handleGlobalKeydown = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                if (document.activeElement !== scanRef.current) {
                    scanRef.current?.focus();
                }
                return;
            }

            const active = document.activeElement;
            if (active === scanRef.current) return;

            // Never let Tab move focus away from the scanner — scanners send
            // Tab as a field separator, and losing focus mid-scan drops/
            // corrupts whatever character arrives next.
            if (e.key === 'Tab') {
                e.preventDefault();
                scanRef.current?.focus();
                return;
            }

            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName) && active !== scanRef.current) {
                return;
            }

            e.preventDefault();
            scanRef.current?.focus();
        };

        document.addEventListener('keydown', handleGlobalKeydown, true);
        return () => document.removeEventListener('keydown', handleGlobalKeydown, true);
    }, []);

    // Clears both the uncontrolled DOM input and the mirrored display state.
    // Since the scanner input is intentionally uncontrolled, setScanValue('')
    // alone would NOT clear what's visibly in the box.
    const clearScanInput = () => {
        if (scanRef.current) scanRef.current.value = '';
        setScanValue('');
    };

    // Mirrors ScanInvoice's tariff-anchored approach: rather than assuming
    // a fixed character width for the header/part number (a shop code not
    // yet seen, like a plant-specific "E1", can have a different width
    // than the Hyundai-standard ones already calibrated — and even a
    // calibrated width can be thrown off by a single stray character
    // landing inside the field during capture), this anchors on the
    // TARIFF NUMBER field, a constant literal ("8708.92.000.00") present
    // whenever the scan includes the full detail line. Working backward
    // from it: the token three before it carries the invoice number,
    // always as its trailing 10 digits (invoice number is consistently
    // exactly 10 digits in every real scan), however much header debris
    // precedes those digits in that same token.
    //
    // Per the actual barcode spec, fields within a single record have NO
    // delimiter at all by design — the tariff field only becomes its own
    // isolated token when a separator happens to survive capture, which
    // is not the normal case. When it doesn't survive, the "first token"
    // is the ENTIRE fused scan (header, invoice number, date, value,
    // tariff, GSTN, IRN hash — everything, with zero whitespace), so
    // checking whether THAT ends in 10 digits is essentially never true
    // (a real scan ends in the alphanumeric IRN hash, not plain digits).
    // So instead of relying on that, the middle fallback anchors on the
    // PART NUMBER pattern directly (present in this same barcode even
    // though this screen doesn't need the part number itself) — the
    // invoice number is exactly the 10 digits immediately following it.
    // Part number matches "28700" + 5 alphanumeric characters (not
    // specifically "1 letter + 4 digits" — real part numbers use both
    // shapes, e.g. "28700T7230" and "28700AY520"). Only if no part
    // number pattern is found at all does this drop to a generic
    // plausible-digit-run guess as a last resort. This is deliberately
    // NOT based on the invoice number starting with "107" — that's
    // common but not guaranteed across all customers/shop codes.
    const TARIFF_PATTERN = /^\d{4}\.\d{2}\.\d{3}\.\d{2}$/;
    const PART_NUMBER_PATTERN = /(?:28700[A-Z0-9]{5}|28[59]\d{7}[A-Z]?|285\d{3}[A-Z0-9]{3,4})/;

    const extractInvoiceNo = (raw) => {
        const clean = raw
            .replace(/\r/g, '')
            .replace(/\$/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const tokens = clean.split(/\s+/).filter(Boolean);
        const tariffIdx = tokens.findIndex((t) => TARIFF_PATTERN.test(t));

        if (tariffIdx >= 3) {
            const invoiceCarrierToken = tokens[tariffIdx - 3];
            const invoiceMatch = invoiceCarrierToken.match(/\d{10}$/);
            if (invoiceMatch) return invoiceMatch[0];
        }

        // Tariff never became its own token (the normal, fully-fused
        // case) — anchor on the part number pattern instead. Invoice
        // number is exactly the 10 digits right after it.
        const partMatch = clean.match(PART_NUMBER_PATTERN);
        if (partMatch) {
            const pos = partMatch.index + partMatch[0].length;
            const candidate = clean.substr(pos, 10);
            if (/^\d{10}$/.test(candidate)) return candidate;
        }

        // Try the first whitespace-bounded token as a further fallback,
        // for a scan where SOME separator survived but not enough to
        // isolate the tariff field.
        const firstTokenMatch = (tokens[0] || '').match(/\d{10}$/);
        if (firstTokenMatch) return firstTokenMatch[0];

        // Last resort: no recognizable structure at all. Take the first
        // plausible digit run, without assuming any specific prefix.
        const numToken = tokens.find(t => /^\d{8,13}$/.test(t));
        if (numToken) return numToken;

        const anyDigits = clean.match(/\d{8,13}/);
        return anyDigits ? anyDigits[0] : null;
    };

    const processBarcode = async (raw) => {
        if (isProcessing.current) return;
        const invoiceNo = extractInvoiceNo(raw);
        if (!invoiceNo) {
            toast.error('Invoice number not found in scan');
            clearScanInput();
            scanRef.current?.focus();
            return;
        }
        isProcessing.current = true;
        try {
            const user = JSON.parse(
                sessionStorage.getItem('user') || '{}'
            );
            const res = await API.post('/gateexit/scan', {
                invoiceNo,
                userId: user.id ?? 0
            });

            setScannedData({
                invoiceNo: res.data?.invoiceNo || '',
                despatchId: res.data?.despatchId || '',
                customerName: res.data?.customerName || '',
                totalQty: res.data?.totalQty || 0,
                exitTime: res.data?.exitTime || ''
            });

            toast.success(
                res.data.message || 'Gate Exit recorded'
            );

            clearScanInput();
            setTimeout(() => {
                navigate('/mobiletransaction/ScanInvoice');
            }, 2000);
        } catch (err) {
            const msg = err?.response?.data;
            toast.error(
                typeof msg === 'string'
                    ? msg
                    : 'Scan failed. Try again.'
            );
        } finally {
            isProcessing.current = false;
            scanRef.current?.focus();
        }
    };

    // Scanning just fills the box (via keystrokes from the scanner); it no
    // longer auto-processes. The user reviews what was scanned and clicks
    // "Add" (or presses Enter) to submit it for gate exit.
    const handleScanInputChange = (e) => {
        setScanValue(e.target.value);
    };

    const handleAddClick = async () => {
        // Read straight from the DOM (source of truth for the uncontrolled
        // input) rather than the mirrored state, to avoid any chance of
        // using a value that hasn't caught up yet.
        const value = (scanRef.current?.value || '').trim();
        if (!value) {
            toast.warning('Please scan invoice');
            scanRef.current?.focus();
            return;
        }
        await processBarcode(value);
    };

    return (
        <div className="scan-container">
            <div className="scan-header">
                <div>
                    <h3>GATE EXIT</h3>
                    <p>Scan and verify Invoice</p>
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
                <div
                    className={`scanner-box ${scanValue ? 'has-value' : ''}`}
                    onClick={() => scanRef.current?.focus()}
                >
                    {scanValue ? (
                        <div className="scanned-value-display">{scanValue}</div>
                    ) : (
                        <>
                            <img
                                src={scanInvoiceImg}
                                alt="Gate Exit Scan"
                                className="scanner-image"
                            />
                            <div className="scan-cursor" />
                        </>
                    )}
                    <input
                        ref={scanRef}
                        type="text"
                        className="scanner-input"
                        autoFocus
                        autoComplete="off"
                        // Uncontrolled on purpose: a controlled input forces
                        // the DOM value back to React state on every render.
                        // Barcode scanners can fire keystrokes faster than
                        // React's render cycle, and that forced reset can
                        // silently drop characters mid-scan — which for this
                        // screen means a corrupted invoice number. Letting
                        // the DOM own the value guarantees nothing is lost;
                        // we only mirror it into state afterward for display.
                        onBlur={() =>
                            setTimeout(
                                () => scanRef.current?.focus(),
                                150
                            )
                        }
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

                <div className="info-box">
                    <FaInfoCircle className="info-icon" />
                    <span>
                        Scan the Invoice for Gate Exit
                    </span>
                </div>

                {scannedData && (
                    <div style={{ maxWidth: '100%', marginTop: '20px' }}>

                        {/* Card Header */}
                        <div style={{
                            background: '#0b43b5',
                            padding: '1.25rem 1.5rem',
                            borderRadius: '12px 12px 0 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: 8,
                                background: 'rgba(255,255,255,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <FaFileInvoice color="#fff" size={18} />
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gate Exit — Scanned</p>
                                <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#fff' }}>Invoice Details</p>
                            </div>
                            <span style={{
                                marginLeft: 'auto', fontSize: 11,
                                background: 'rgba(255,255,255,0.18)', color: '#fff',
                                padding: '3px 10px', borderRadius: 99, fontWeight: 500
                            }}>✓ Verified</span>
                        </div>

                        {/* Card Body */}
                        <div style={{
                            background: '#fff',
                            border: '1px solid #e5eaf5',
                            borderTop: 'none',
                            borderRadius: '0 0 12px 12px',
                            overflow: 'hidden'
                        }}>
                            {/* Row 1 — Invoice + Dispatch */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #eef2f7' }}>
                                <div style={{ padding: '1rem 1.25rem', borderRight: '1px solid #eef2f7' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: 11, color: '#888' }}>Invoice no</p>
                                    <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#0b43b5', fontFamily: 'monospace' }}>{scannedData.invoiceNo}</p>
                                </div>
                                <div style={{ padding: '1rem 1.25rem' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: 11, color: '#888' }}>Dispatch ID</p>
                                    <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#0b43b5', fontFamily: 'monospace' }}>{scannedData.despatchId}</p>
                                </div>
                            </div>

                            {/* Row 2 — Customer */}
                            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: '#dbe8ff', color: '#0b43b5',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 12, fontWeight: 500, flexShrink: 0
                                }}>
                                    {scannedData.customerName?.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 2px', fontSize: 11, color: '#888' }}>Customer</p>
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#111' }}>{scannedData.customerName}</p>
                                </div>
                            </div>

                            {/* Row 3 — Qty + Exit Time */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                <div style={{ padding: '1rem 1.25rem', borderRight: '1px solid #eef2f7' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: 11, color: '#888' }}>Total qty</p>
                                    <p style={{ margin: 0, fontSize: 22, fontWeight: 500, color: '#0b43b5' }}>{scannedData.totalQty}</p>
                                </div>
                                <div style={{ padding: '1rem 1.25rem' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: 11, color: '#888' }}>Exit time</p>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111' }}>{scannedData.exitTime?.split(' ')[0]}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>{scannedData.exitTime?.split(' ')[1]}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default GateExit;
