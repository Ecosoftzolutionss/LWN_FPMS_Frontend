import React, { useEffect, useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import {
  CButton,
  CFormInput,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react';
import {
  FaBars,
  FaSearch,
  FaTrash,
  FaTimes,
  FaCheckCircle,
  FaFolder,
  FaFolderOpen,
  FaArrowUp,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import API from '../api';
import {
  getFifoDashboardConfiguration,
  saveFifoDashboardConfiguration,
  browseServerFolders,
  pickServerFolder,
} from './dashboardApi';
import '../assets/CSS/Dashboardsettings.css';

const DEFAULT_SLOTS = 8;

const createEmptySlots = (count) =>
  Array.from({ length: count }, (_, index) => ({
    position: index + 1,
    item: null,
  }));

// Absolute Windows path (D:\folder or D:/folder) or UNC path (\\server\share)
const isAbsoluteWindowsPath = (value) =>
  /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\');

const tableStyles = {
  table: { style: { minWidth: '100%' } },
  headRow: {
    style: {
      minHeight: '42px',
      backgroundColor: '#f1f4fa',
      borderBottom: '1px solid #dce3ed',
    },
  },
  headCells: {
    style: {
      color: '#23395d',
      fontSize: '12px',
      fontWeight: '700',
      paddingLeft: '9px',
      paddingRight: '9px',
      whiteSpace: 'normal',
    },
  },
  rows: {
    style: {
      minHeight: '39px',
      fontSize: '12px',
      color: '#263449',
      borderBottom: '1px solid #e9edf3',
    },
    highlightOnHoverStyle: {
      backgroundColor: '#f3f7ff',
      transition: 'background-color 0.2s',
      outline: 'none',
    },
  },
  cells: {
    style: {
      paddingLeft: '9px',
      paddingRight: '9px',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
    },
  },
  pagination: {
    style: {
      minHeight: '48px',
      fontSize: '12px',
      color: '#526176',
      borderTop: '1px solid #e5eaf1',
    },
  },
};

export default function DashboardSettings() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [slots, setSlots] = useState(() => createEmptySlots(DEFAULT_SLOTS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [showPositionModal, setShowPositionModal] = useState(false);

  const [slotCountInput, setSlotCountInput] = useState(String(DEFAULT_SLOTS));
  const [displaySeconds, setDisplaySeconds] = useState('5');

  // Input path + folder browser
  const [inputPath, setInputPath] = useState('');
  const [picking, setPicking] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browse, setBrowse] = useState({
    current: '',
    parent: null,
    folders: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [itemsResponse, config] = await Promise.all([
        API.get('/ItemMaster'),
        getFifoDashboardConfiguration(),
      ]);
      const data = Array.isArray(itemsResponse.data) ? itemsResponse.data : [];
      setItems(data);

      const rowCount = Math.max(
        1,
        Math.min(100, Number(config.displayRows) || DEFAULT_SLOTS)
      );

      setSlotCountInput(String(rowCount));
      setDisplaySeconds(String(config.displaySeconds || 5));
      setInputPath(config.inputPath || '');

      const savedParts = Array.isArray(config.parts) ? config.parts : [];
      const byPosition = new Map(
        savedParts.map((part) => [
          Number(part.position),
          Number(part.itemId),
        ])
      );

      setSlots(
        createEmptySlots(rowCount).map((slot) => {
          const itemId = byPosition.get(slot.position);
          return {
            ...slot,
            item: data.find((item) => Number(item.id) === itemId) || null,
          };
        })
      );
    } catch (error) {
      console.error(
        'Failed to load dashboard settings:',
        error.response?.data ?? error
      );
      toast.error(
        error.response?.data?.message ||
        'Failed to load parts or dashboard configuration'
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) =>
      [
        item.itemNumber,
        item.itemName,
        item.itemGroupName,
        item.hsnCode,
      ].some((value) =>
        String(value ?? '').toLowerCase().includes(keyword)
      )
    );
  }, [items, search]);

  const assignedIds = useMemo(
    () =>
      new Set(
        slots.filter((slot) => slot.item).map((slot) => Number(slot.item.id))
      ),
    [slots]
  );

  const configuredCount = slots.filter((slot) => slot.item).length;

  const openPositionModal = (item) => {
    setSelectedItem(item);
    const existingSlot = slots.find(
      (slot) => Number(slot.item?.id) === Number(item.id)
    );
    setSelectedPosition(existingSlot ? String(existingSlot.position) : '');
    setShowPositionModal(true);
  };

  const closePositionModal = () => {
    setShowPositionModal(false);
    setSelectedItem(null);
    setSelectedPosition('');
  };


  const confirmSelection = () => {
    if (!selectedItem || !selectedPosition) {
      toast.warning('Please select an available display position.');
      return;
    }

    const position = Number(selectedPosition);

    const targetSlot = slots.find(
      (slot) => slot.position === position
    );

    if (!targetSlot) {
      toast.error('The selected display position is invalid.');
      return;
    }

    // Prevent replacing an already assigned part
    if (targetSlot.item) {
      toast.warning(
        `Row ${position} is already assigned to ${targetSlot.item.itemNumber}. Please remove the existing part first.`
      );
      return;
    }

    // Prevent assigning the same part to another position
    const existingSlot = slots.find(
      (slot) =>
        Number(slot.item?.id) === Number(selectedItem.id)
    );

    if (existingSlot) {
      toast.warning(
        `${selectedItem.itemNumber} is already assigned to Row ${existingSlot.position}. Please remove it first if you want to assign it to another row.`
      );
      return;
    }

    setSlots((previous) =>
      previous.map((slot) =>
        slot.position === position
          ? { ...slot, item: selectedItem }
          : slot
      )
    );

    closePositionModal();

    toast.success(
      `${selectedItem.itemNumber} assigned to Row ${position}. Click Save Configuration to save your changes.`
    );
  };


  const removeSelection = (position) => {
    setSlots((previous) =>
      previous.map((slot) =>
        slot.position === position ? { ...slot, item: null } : slot
      )
    );
  };

  const applySlotCount = () => {
    if (slotCountInput.trim() === '') {
      toast.warning('Please enter the number of display rows');
      return;
    }

    const count = Number(slotCountInput);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      toast.warning('Display rows must be between 1 and 100');
      return;
    }

    if (
      count < slots.length &&
      slots.slice(count).some((slot) => slot.item) &&
      !window.confirm(
        'Reducing the row count will remove assignments beyond the new limit. Continue?'
      )
    ) {
      setSlotCountInput(String(slots.length));
      return;
    }

    setSlots((previous) => {
      const updated = previous.slice(0, count);
      while (updated.length < count) {
        updated.push({ position: updated.length + 1, item: null });
      }
      return updated.map((slot, index) => ({
        ...slot,
        position: index + 1,
      }));
    });

    toast.success('Row count updated. Click Save Configuration to persist it.');
  };

  // ---- Folder browser ----
  const loadFolders = async (path = '', fallbackToDrives = false) => {
    try {
      setBrowseLoading(true);
      const result = await browseServerFolders(path);
      setBrowse({
        current: result.current || '',
        parent: result.parent ?? null,
        folders: Array.isArray(result.folders) ? result.folders : [],
      });
    } catch (error) {
      if (fallbackToDrives && path) {
        // The typed/saved path does not exist on the server: show the drives instead.
        try {
          const drives = await browseServerFolders('');
          setBrowse({
            current: '',
            parent: null,
            folders: Array.isArray(drives.folders) ? drives.folders : [],
          });
          return;
        } catch (driveError) {
          error = driveError;
        }
      }
      console.error(
        'Failed to browse folders:',
        error.response?.data ?? error
      );
      toast.error(error.response?.data?.message || 'Failed to browse folders');
    } finally {
      setBrowseLoading(false);
    }
  };

  // Opens the native folder dialog (File Explorer). If it is not available
  // (API not on a Windows desktop session, timeout, etc.), falls back to the
  // in-app folder picker.
  const openBrowse = async () => {
    try {
      setPicking(true);
      const result = await pickServerFolder(inputPath.trim());

      if (!result.cancelled && result.path) {
        setInputPath(result.path);
        toast.info('Input path selected. Click Save Configuration to save it.');
      }
    } catch (error) {
      console.warn(
        'Native folder dialog unavailable, using the in-app picker:',
        error.response?.data ?? error
      );
      setBrowse({ current: '', parent: null, folders: [] });
      setShowBrowse(true);
      loadFolders(inputPath.trim(), true);
    } finally {
      setPicking(false);
    }
  };

  const closeBrowse = () => setShowBrowse(false);

  const selectBrowsedFolder = () => {
    if (!browse.current) {
      toast.warning('Open a folder first');
      return;
    }
    setInputPath(browse.current);
    closeBrowse();
    toast.info('Input path selected. Click Save Configuration to save it.');
  };

  const saveConfiguration = async () => {
    const rowCount = Number(slotCountInput);
    const seconds = Number(displaySeconds);
    const path = inputPath.trim();

    if (!path) {
      toast.warning('Please enter the input path');
      return;
    }

    if (path.length > 500) {
      toast.warning('Input path cannot exceed 500 characters');
      return;
    }

    if (!isAbsoluteWindowsPath(path)) {
      toast.warning('Input path must be an absolute path, e.g. D:\\AutoFile\\PPT');
      return;
    }

    if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 100) {
      toast.warning('Display rows must be between 1 and 100');
      return;
    }

    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600) {
      toast.warning('Display seconds must be between 1 and 3600');
      return;
    }

    if (slots.length !== rowCount) {
      toast.warning('Click Apply Rows before saving the configuration');
      return;
    }

    const parts = slots
      .filter((slot) => slot.item)
      .map((slot) => ({
        position: slot.position,
        itemId: Number(slot.item.id),
      }));

    try {
      setSaving(true);
      await saveFifoDashboardConfiguration({
        displaySeconds: seconds,
        displayRows: rowCount,
        inputPath: path,
        parts,
      });
      setInputPath(path);
      toast.success('Dashboard configuration saved to SQL Server');
    } catch (error) {
      console.error(
        'Failed to save dashboard configuration:',
        error.response?.data ?? error
      );
      toast.error(
        error.response?.data?.message ||
        'Failed to save dashboard configuration'
      );
    } finally {
      setSaving(false);
    }
  };

  const clearConfiguration = () => {
    if (!window.confirm('Clear all dashboard part assignments?')) return;
    setSlots((previous) => previous.map((slot) => ({ ...slot, item: null })));
    toast.info('Assignments cleared. Click Save Configuration to save the change.');
  };

  const leftColumns = useMemo(
    () => [
      {
        name: 'Part Number',
        selector: (row) => row.itemNumber || '',
        minWidth: '115px',
        grow: 1,
        cell: (row) => <span title={row.itemNumber || ''}>{row.itemNumber || '-'}</span>,
      },
      {
        name: 'Part Name',
        selector: (row) => row.itemName || '',
        minWidth: '100px',
        grow: 1.3,
        wrap: true,
        cell: (row) => <span title={row.itemName || ''}>{row.itemName || '-'}</span>,
      },
      {
        name: 'Item Group',
        selector: (row) => row.itemGroupName || '',
        minWidth: '105px',
        grow: 1.2,
        wrap: true,
        cell: (row) => <span title={row.itemGroupName || ''}>{row.itemGroupName || '-'}</span>,
      },
      {
        name: 'Action',
        width: '75px',
        center: true,
        cell: (row) => (
          <input
            type="checkbox"
            className="ds-select-checkbox"
            aria-label={`Configure ${row.itemNumber}`}
            checked={assignedIds.has(Number(row.id))}
            onChange={() => openPositionModal(row)}
          />
        ),
      },
    ],
    [assignedIds, slots]
  );

  const rightColumns = useMemo(
    () => [
      { name: 'S.No', selector: (row) => row.position, width: '65px', center: true },
      {
        name: 'Part Number',
        selector: (row) => row.item?.itemNumber || '',
        minWidth: '100px',
        grow: 1,
        cell: (row) => row.item?.itemNumber || '',
      },
      {
        name: 'Part Name',
        selector: (row) => row.item?.itemName || '',
        minWidth: '100px',
        grow: 1.2,
        wrap: true,
        cell: (row) => row.item?.itemName || '',
      },
      {
        name: 'Item Group',
        selector: (row) => row.item?.itemGroupName || '',
        minWidth: '100px',
        grow: 1.2,
        wrap: true,
        cell: (row) => row.item?.itemGroupName || '',
      },
      {
        name: 'Action',
        width: '75px',
        center: true,
        cell: (row) =>
          row.item ? (
            <button
              type="button"
              className="ds-remove-btn"
              title={`Remove ${row.item.itemNumber}`}
              aria-label={`Remove ${row.item.itemNumber}`}
              onClick={() => removeSelection(row.position)}
            >
              <FaTrash />
            </button>
          ) : (
            <span className="ds-empty-position">—</span>
          ),
      },
    ],
    [slots]
  );

  return (
    <div className="ds-page">
      <div className="ds-path-row">
        <label htmlFor="ds-input-path">Input Path</label>
        <CFormInput
          id="ds-input-path"
          type="text"
          placeholder="D:\AutoFile\PPT"
          value={inputPath}
          maxLength={500}
          onChange={(event) => setInputPath(event.target.value)}
          disabled={saving}
        />
        <CButton
          color="light"
          className="ds-browse-btn"
          onClick={openBrowse}
          disabled={saving || picking}
        >
          <FaFolder className="me-2" style={{ color: '#f5b83d' }} />
          {picking ? 'Opening...' : 'Browse'}
        </CButton>
      </div>

      <div className="dashboard-settings">
        <section className="ds-panel">
          <div className="ds-panel-header">
            <div className="ds-heading">
              <FaBars />
              <span>Part List</span>
            </div>
            <div className="ds-search">
              <FaSearch />
              <input
                type="search"
                placeholder="Search part number, name, group..."
                aria-label="Search parts"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="ds-table-wrapper">
            <DataTable
              columns={leftColumns}
              data={filteredItems}
              keyField="id"
              customStyles={tableStyles}
              pagination
              paginationPerPage={10}
              paginationRowsPerPageOptions={[5, 10, 15, 20, 50]}
              paginationComponentOptions={{
                rowsPerPageText: 'Rows:',
                rangeSeparatorText: 'of',
                selectAllRowsItem: false,
              }}
              progressPending={loading}
              progressComponent={<div className="ds-state-message">Loading parts...</div>}
              noDataComponent={
                <div className="ds-state-message">
                  {search ? 'No matching parts found' : 'No parts available'}
                </div>
              }
              highlightOnHover
              responsive
              persistTableHead
            />
          </div>

          <div className="ds-panel-footer">
            <span>Total Parts: <strong>{items.length}</strong></span>
            <span>Selected: <strong>{assignedIds.size}</strong></span>
          </div>
        </section>

        <section className="ds-panel">
          <div className="ds-panel-header ds-right-header">
            <div className="ds-heading">
              <FaCheckCircle />
              <span>Dashboard Configuration</span>
            </div>
            <div className="ds-slot-control">
              <label htmlFor="ds-slot-count">Display Rows</label>
              <CFormInput
                id="ds-slot-count"
                type="number"
                min="1"
                max="100"
                size="sm"
                value={slotCountInput}
                onChange={(event) => setSlotCountInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applySlotCount();
                }}
              />
              <CButton color="primary" size="sm" onClick={applySlotCount} disabled={saving}>
                Apply Rows
              </CButton>

              <label htmlFor="ds-display-seconds">Seconds</label>
              <CFormInput
                id="ds-display-seconds"
                type="number"
                min="1"
                max="3600"
                size="sm"
                value={displaySeconds}
                onChange={(event) => setDisplaySeconds(event.target.value)}
              />
              <CButton color="success" size="sm" onClick={saveConfiguration} disabled={saving}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </CButton>
            </div>
          </div>

          <div className="ds-table-wrapper">
            <DataTable
              columns={rightColumns}
              data={slots}
              keyField="position"
              customStyles={tableStyles}
              pagination
              paginationPerPage={10}
              paginationRowsPerPageOptions={[5, 10, 15, 20, 50]}
              paginationComponentOptions={{
                rowsPerPageText: 'Rows:',
                rangeSeparatorText: 'of',
                selectAllRowsItem: false,
              }}
              noDataComponent={<div className="ds-state-message">No display positions configured</div>}
              highlightOnHover
              responsive
              persistTableHead
            />
          </div>

          <div className="ds-panel-footer ds-config-footer">
            <span>Configured: <strong>{configuredCount}</strong> / {slots.length}</span>
            <CButton color="secondary" variant="outline" size="sm" onClick={clearConfiguration} disabled={saving}>
              <FaTrash className="me-1" />
              Clear Configuration
            </CButton>
          </div>
        </section>
      </div>

      {/* Display position modal */}
      <CModal
        visible={showPositionModal}
        onClose={closePositionModal}
        alignment="center"
        backdrop="static"
        className="ds-position-modal"
      >
        <CModalHeader>
          <CModalTitle>Choose Display Position</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedItem && (
            <div className="ds-selected-part">
              <strong>{selectedItem.itemNumber}</strong>
              <span>{selectedItem.itemName}</span>
              <small>{selectedItem.itemGroupName || 'No item group'}</small>
            </div>
          )}

          <label htmlFor="ds-position-select" className="ds-modal-label">
            Select display row
          </label>

          <select
            id="ds-position-select"
            className="form-select"
            value={selectedPosition}
            onChange={(event) => setSelectedPosition(event.target.value)}
          >
            <option value="">Choose an available row</option>

            {slots.map((slot) => {
              const isAssigned = Boolean(slot.item);
              const isCurrentPart =
                Number(slot.item?.id) === Number(selectedItem?.id);

              return (
                <option
                  key={slot.position}
                  value={slot.position}
                  disabled={isAssigned && !isCurrentPart}
                >
                  {slot.position}
                  {isCurrentPart
                    ? ` — Already assigned: ${slot.item.itemNumber}`
                    : isAssigned
                      ? ` — Occupied by ${slot.item.itemNumber}`
                      : ' — Available'}
                </option>
              );
            })}
          </select>

          <small className="ds-modal-help">
            Only available rows can be selected. To use an occupied row,
            remove its current part from Dashboard Configuration first.
          </small>

        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={closePositionModal}>
            <FaTimes className="me-1" />
            Cancel
          </CButton>
          <CButton
            color="primary"
            onClick={confirmSelection}
            disabled={!selectedItem || !selectedPosition}
          >
            Confirm Selection
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Folder browser modal */}
      <CModal
        visible={showBrowse}
        onClose={closeBrowse}
        alignment="center"
        backdrop="static"
        className="ds-browse-modal"
      >
        <CModalHeader>
          <CModalTitle>Select Input Folder</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="ds-browse-current" title={browse.current}>
            {browse.current || 'Drives'}
          </div>

          <div className="ds-browse-list">
            {browse.current && (
              <button
                type="button"
                className="ds-browse-item"
                onClick={() => loadFolders(browse.parent || '')}
                disabled={browseLoading}
              >
                <FaArrowUp />
                <span>.. (up)</span>
              </button>
            )}

            {browseLoading && (
              <div className="ds-state-message">Loading...</div>
            )}

            {!browseLoading && browse.folders.length === 0 && (
              <div className="ds-state-message">No sub-folders</div>
            )}

            {!browseLoading &&
              browse.folders.map((folder) => (
                <button
                  key={folder.path}
                  type="button"
                  className="ds-browse-item"
                  onClick={() => loadFolders(folder.path)}
                >
                  <FaFolderOpen />
                  <span>{folder.name}</span>
                </button>
              ))}
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={closeBrowse}>
            <FaTimes className="me-1" />
            Cancel
          </CButton>
          <CButton
            color="primary"
            onClick={selectBrowsedFolder}
            disabled={!browse.current || browseLoading}
          >
            Select This Folder
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
}
